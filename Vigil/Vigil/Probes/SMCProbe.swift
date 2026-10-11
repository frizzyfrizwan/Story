import Foundation
import IOKit

/// Reads temperatures, fans and power from the System Management Controller.
/// Keys differ between Intel and every Apple Silicon generation, so instead of a fixed table the probe
/// enumerates every key once and keeps the ones that look like plausible sensors.
final class SMCProbe {
    private struct KeyData {
        struct Version { var major: UInt8 = 0, minor: UInt8 = 0, build: UInt8 = 0, reserved: UInt8 = 0; var release: UInt16 = 0 }
        struct Limit { var version: UInt16 = 0, length: UInt16 = 0; var cpuPLimit: UInt32 = 0, gpuPLimit: UInt32 = 0, memPLimit: UInt32 = 0 }
        struct Info { var dataSize: IOByteCount = 0; var dataType: UInt32 = 0; var dataAttributes: UInt8 = 0 }
        typealias Bytes = (UInt8, UInt8, UInt8, UInt8, UInt8, UInt8, UInt8, UInt8,
                           UInt8, UInt8, UInt8, UInt8, UInt8, UInt8, UInt8, UInt8,
                           UInt8, UInt8, UInt8, UInt8, UInt8, UInt8, UInt8, UInt8,
                           UInt8, UInt8, UInt8, UInt8, UInt8, UInt8, UInt8, UInt8)
        var key: UInt32 = 0
        var version = Version()
        var limit = Limit()
        var info = Info()
        var padding: UInt16 = 0
        var result: UInt8 = 0
        var status: UInt8 = 0
        var data8: UInt8 = 0
        var data32: UInt32 = 0
        var bytes: Bytes = (0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0)
    }

    private enum Selector: UInt8 {
        case readKey = 5
        case keyInfo = 9
        case keyByIndex = 8
    }

    struct SensorKey {
        let code: String
        let type: String
        let size: Int
    }

    private var connection: io_connect_t = 0
    private var infoCache: [UInt32: KeyData.Info] = [:]
    private var temperatureKeys: [SensorKey] = []
    private var fanCount = 0
    private var powerKeys: [String: SensorKey] = [:]
    private(set) var isAvailable = false
    private var discovered = false

    init() {
        let service = IOServiceGetMatchingService(kIOMainPortDefault, IOServiceMatching("AppleSMC"))
        guard service != 0 else { return }
        defer { IOObjectRelease(service) }
        isAvailable = IOServiceOpen(service, mach_task_self_, 0, &connection) == KERN_SUCCESS
    }

    deinit {
        if connection != 0 { IOServiceClose(connection) }
    }

    // MARK: Public

    func sample() -> SensorSample {
        var sample = SensorSample()
        sample.thermalState = ProcessInfo.processInfo.thermalState
        sample.smcAvailable = isAvailable
        guard isAvailable else { return sample }
        if !discovered { discover() }

        sample.temperatures = temperatureKeys.compactMap { key in
            guard let value = readDouble(key), value > 0, value < 130 else { return nil }
            return SensorReading(key: key.code, name: Self.sensorName(for: key.code), group: Self.group(for: key.code), celsius: value)
        }
        if fanCount > 0 {
            sample.fans = (0..<fanCount).compactMap { index in
                guard let actual = readDouble(code: "F\(index)Ac") else { return nil }
                let minimum = readDouble(code: "F\(index)Mn") ?? 0
                let maximum = readDouble(code: "F\(index)Mx") ?? max(actual, 1)
                let target = readDouble(code: "F\(index)Tg") ?? actual
                return FanReading(index: index, name: fanCount == 1 ? "Fan" : (index == 0 ? "Left fan" : index == 1 ? "Right fan" : "Fan \(index + 1)"),
                                  rpm: actual, minimum: minimum, maximum: maximum, target: target)
            }
        }
        if let key = powerKeys["PSTR"], let watts = readDouble(key), watts >= 0, watts < 1000 { sample.systemPowerWatts = watts }
        if let key = powerKeys["PCPC"] ?? powerKeys["PCPT"], let watts = readDouble(key), watts >= 0, watts < 500 { sample.cpuPowerWatts = watts }
        if let key = powerKeys["PGPC"] ?? powerKeys["PGPT"] ?? powerKeys["PG0R"], let watts = readDouble(key), watts >= 0, watts < 500 { sample.gpuPowerWatts = watts }
        return sample
    }

    // MARK: Diagnostics

    struct RawKey {
        let code: String
        let type: String
        let size: Int
        let value: Double?
        let bytes: String
    }

    /// Every SMC key whose name starts with one of `prefixes`, with its raw bytes and decoded value.
    /// Used by the diagnostics report so per-machine sensor names can be mapped without guessing.
    func dumpKeys(prefixes: Set<Character> = ["T", "F", "P", "V", "I"]) -> [RawKey] {
        guard isAvailable, let countInfo = keyInfo(for: Self.code("#KEY")), let countData = readRaw(Self.code("#KEY"), info: countInfo) else { return [] }
        let count = Int(UInt32(countData[0]) << 24 | UInt32(countData[1]) << 16 | UInt32(countData[2]) << 8 | UInt32(countData[3]))
        guard count > 0, count < 10_000 else { return [] }
        var result: [RawKey] = []
        for index in 0..<count {
            guard let code = keyCode(at: index) else { continue }
            let name = Self.string(from: code)
            guard let first = name.first, prefixes.contains(first), let info = keyInfo(for: code) else { continue }
            let type = Self.string(from: info.dataType)
            let data = readRaw(code, info: info) ?? []
            let hex = data.map { String(format: "%02x", $0) }.joined()
            result.append(RawKey(code: name, type: type, size: Int(info.dataSize), value: Self.decode(data, type: type), bytes: hex))
        }
        return result.sorted { $0.code < $1.code }
    }

    // MARK: Discovery

    private func discover() {
        discovered = true
        guard let countKey = keyInfo(for: Self.code("#KEY")), let countData = readRaw(Self.code("#KEY"), info: countKey) else { return }
        let count = Int(UInt32(countData[0]) << 24 | UInt32(countData[1]) << 16 | UInt32(countData[2]) << 8 | UInt32(countData[3]))
        guard count > 0, count < 10_000 else { return }

        var temperatures: [SensorKey] = []
        for index in 0..<count {
            guard let code = keyCode(at: index) else { continue }
            let name = Self.string(from: code)
            guard let first = name.first else { continue }
            if first == "T", let info = keyInfo(for: code) {
                let type = Self.string(from: info.dataType)
                guard ["flt ", "sp78", "sp87", "sp96", "sp69", "ui16", "ui8 "].contains(type) else { continue }
                temperatures.append(SensorKey(code: name, type: type, size: Int(info.dataSize)))
            } else if name == "FNum", let info = keyInfo(for: code), let data = readRaw(code, info: info) {
                fanCount = Int(data.first ?? 0)
            } else if ["PSTR", "PCPC", "PCPT", "PGPC", "PGPT", "PG0R"].contains(name), let info = keyInfo(for: code) {
                powerKeys[name] = SensorKey(code: name, type: Self.string(from: info.dataType), size: Int(info.dataSize))
            }
        }
        // Validate once: drop sensors that return nonsense, keep a stable sorted list.
        temperatureKeys = temperatures.filter { key in
            guard let value = readDouble(key) else { return false }
            return value > 0 && value < 130
        }.sorted { $0.code < $1.code }
        if fanCount > 8 { fanCount = 0 }
    }

    private func keyCode(at index: Int) -> UInt32? {
        var input = KeyData()
        var output = KeyData()
        input.data8 = Selector.keyByIndex.rawValue
        input.data32 = UInt32(index)
        guard call(&input, &output) else { return nil }
        return output.key
    }

    // MARK: Reading

    private func readDouble(code: String) -> Double? {
        let key = Self.code(code)
        guard let info = keyInfo(for: key) else { return nil }
        return readDouble(SensorKey(code: code, type: Self.string(from: info.dataType), size: Int(info.dataSize)))
    }

    private func readDouble(_ key: SensorKey) -> Double? {
        let code = Self.code(key.code)
        guard let info = keyInfo(for: code), let data = readRaw(code, info: info) else { return nil }
        return Self.decode(data, type: key.type)
    }

    static func decode(_ data: [UInt8], type: String) -> Double? {
        switch type {
        case "flt ":
            guard data.count >= 4 else { return nil }
            let bits = UInt32(data[0]) | UInt32(data[1]) << 8 | UInt32(data[2]) << 16 | UInt32(data[3]) << 24
            let value = Double(Float(bitPattern: bits))
            return value.isFinite ? value : nil
        case "sp78":
            guard data.count >= 2 else { return nil }
            return Double(Int16(bitPattern: UInt16(data[0]) << 8 | UInt16(data[1]))) / 256
        case "sp87":
            guard data.count >= 2 else { return nil }
            return Double(Int16(bitPattern: UInt16(data[0]) << 8 | UInt16(data[1]))) / 128
        case "sp96":
            guard data.count >= 2 else { return nil }
            return Double(Int16(bitPattern: UInt16(data[0]) << 8 | UInt16(data[1]))) / 64
        case "sp69":
            guard data.count >= 2 else { return nil }
            return Double(Int16(bitPattern: UInt16(data[0]) << 8 | UInt16(data[1]))) / 512
        case "fpe2":
            guard data.count >= 2 else { return nil }
            return Double(UInt16(data[0]) << 8 | UInt16(data[1])) / 4
        case "fp88":
            guard data.count >= 2 else { return nil }
            return Double(UInt16(data[0]) << 8 | UInt16(data[1])) / 256
        case "ui8 ":
            guard data.count >= 1 else { return nil }
            return Double(data[0])
        case "ui16":
            guard data.count >= 2 else { return nil }
            return Double(UInt16(data[0]) << 8 | UInt16(data[1]))
        case "ui32":
            guard data.count >= 4 else { return nil }
            return Double(UInt32(data[0]) << 24 | UInt32(data[1]) << 16 | UInt32(data[2]) << 8 | UInt32(data[3]))
        case "si16":
            guard data.count >= 2 else { return nil }
            return Double(Int16(bitPattern: UInt16(data[0]) << 8 | UInt16(data[1])))
        case "ioft":
            guard data.count >= 8 else { return nil }
            var value: UInt64 = 0
            for index in 0..<8 { value |= UInt64(data[index]) << (8 * UInt64(7 - index)) }
            return Double(value) / 65_536
        default:
            return nil
        }
    }

    private func keyInfo(for code: UInt32) -> KeyData.Info? {
        if let cached = infoCache[code] { return cached }
        var input = KeyData()
        var output = KeyData()
        input.key = code
        input.data8 = Selector.keyInfo.rawValue
        guard call(&input, &output), output.result == 0 else { return nil }
        infoCache[code] = output.info
        return output.info
    }

    private func readRaw(_ code: UInt32, info: KeyData.Info) -> [UInt8]? {
        var input = KeyData()
        var output = KeyData()
        input.key = code
        input.info.dataSize = info.dataSize
        input.data8 = Selector.readKey.rawValue
        guard call(&input, &output), output.result == 0 else { return nil }
        let size = min(Int(info.dataSize), 32)
        return withUnsafeBytes(of: &output.bytes) { raw in Array(raw.prefix(size)) }
    }

    private func call(_ input: inout KeyData, _ output: inout KeyData) -> Bool {
        guard connection != 0 else { return false }
        let inputSize = MemoryLayout<KeyData>.stride
        var outputSize = MemoryLayout<KeyData>.stride
        let result = IOConnectCallStructMethod(connection, 2, &input, inputSize, &output, &outputSize)
        return result == KERN_SUCCESS
    }

    // MARK: Key helpers

    static func code(_ string: String) -> UInt32 {
        var value: UInt32 = 0
        for scalar in string.utf8.prefix(4) { value = value << 8 | UInt32(scalar) }
        if string.utf8.count < 4 { value <<= UInt32(8 * (4 - string.utf8.count)) }
        return value
    }

    static func string(from code: UInt32) -> String {
        let bytes = [UInt8(code >> 24 & 0xFF), UInt8(code >> 16 & 0xFF), UInt8(code >> 8 & 0xFF), UInt8(code & 0xFF)]
        return String(bytes: bytes, encoding: .ascii) ?? "????"
    }

    /// Groups a temperature key by its well-known prefix.
    static func group(for key: String) -> SensorGroup {
        guard key.count == 4 else { return .other }
        let prefix = key.prefix(2)
        switch prefix {
        case "TC", "Tp", "Te", "Tf", "TP": return .cpu
        case "TG", "Tg": return .gpu
        case "TM", "Tm": return .memory
        case "TH", "Th", "TS": return .storage
        case "TB", "Tb": return .battery
        case "TA", "Ta", "Ts", "TW", "Tw", "TL", "TN", "Tt", "TI": return .system
        default: return .other
        }
    }

    static func sensorName(for key: String) -> String {
        let group = group(for: key)
        let suffix = key.dropFirst(2)
        switch group {
        case .cpu:
            if key.hasPrefix("TC") && key.hasSuffix("P") { return "CPU proximity" }
            if key.hasPrefix("TC") && key.hasSuffix("D") { return "CPU die" }
            if key.hasPrefix("TC") && (key.hasSuffix("C") || key.hasSuffix("c")) { return "CPU core \(suffix.prefix(1))" }
            return "CPU \(suffix)"
        case .gpu:
            if key.hasSuffix("P") { return "GPU proximity" }
            if key.hasSuffix("D") { return "GPU die" }
            return "GPU \(suffix)"
        case .memory: return "Memory \(suffix)"
        case .storage: return "Storage \(suffix)"
        case .battery: return "Battery \(suffix)"
        case .system:
            switch key.prefix(2) {
            case "TA", "Ta": return "Ambient \(suffix)"
            case "TW", "Tw": return "Wireless \(suffix)"
            case "Ts": return "Palm rest \(suffix)"
            case "TL": return "Display \(suffix)"
            case "TN": return "Northbridge \(suffix)"
            case "TI", "Tt": return "Thunderbolt \(suffix)"
            default: return "System \(suffix)"
            }
        case .other: return key
        }
    }
}
