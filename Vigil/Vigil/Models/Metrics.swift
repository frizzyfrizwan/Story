import Foundation
import AppKit

// MARK: - CPU

enum CoreKind: String, Codable {
    case performance, efficiency, standard
    var label: String {
        switch self {
        case .performance: return "P"
        case .efficiency: return "E"
        case .standard: return ""
        }
    }
}

struct CoreUsage: Identifiable, Equatable {
    let index: Int
    let kind: CoreKind
    /// 0...100
    let usage: Double
    var id: Int { index }
}

struct CPUSample: Equatable {
    var timestamp = Date()
    /// Total usage 0...100 (across all cores, like Activity Monitor's % CPU graph).
    var total: Double = 0
    var user: Double = 0
    var system: Double = 0
    var idle: Double = 100
    var cores: [CoreUsage] = []
    var loadAverage: [Double] = [0, 0, 0]
    var processCount = 0
    var threadCount = 0

    var performanceCoreUsage: Double { average(of: .performance) }
    var efficiencyCoreUsage: Double { average(of: .efficiency) }

    private func average(of kind: CoreKind) -> Double {
        let matching = cores.filter { $0.kind == kind }
        guard !matching.isEmpty else { return 0 }
        return matching.map(\.usage).average
    }
}

// MARK: - Memory

enum MemoryPressure: Int, Codable, Comparable {
    case normal = 1, warning = 2, critical = 4

    static func < (lhs: MemoryPressure, rhs: MemoryPressure) -> Bool { lhs.rawValue < rhs.rawValue }

    var title: String {
        switch self {
        case .normal: return "Normal"
        case .warning: return "Elevated"
        case .critical: return "Critical"
        }
    }

    var explanation: String {
        switch self {
        case .normal: return "macOS has plenty of room. Memory being \"used\" is normal and healthy — unused RAM is wasted RAM."
        case .warning: return "macOS is compressing memory and may start swapping to disk. Things can feel sluggish when switching apps."
        case .critical: return "macOS is swapping heavily. Quit apps you are not using, especially browsers with many tabs."
        }
    }
}

struct MemorySample: Equatable {
    var timestamp = Date()
    var total: UInt64 = 0
    /// App + wired + compressed, the figure Activity Monitor shows as "Memory Used".
    var used: UInt64 = 0
    var app: UInt64 = 0
    var wired: UInt64 = 0
    var compressed: UInt64 = 0
    var cached: UInt64 = 0
    var free: UInt64 = 0
    var swapTotal: UInt64 = 0
    var swapUsed: UInt64 = 0
    var pressure: MemoryPressure = .normal
    /// Derived 0...100 pressure figure comparable to Activity Monitor's graph.
    var pressurePercent: Double = 0

    var usedFraction: Double { total == 0 ? 0 : Double(used) / Double(total) }
}

// MARK: - Disk

struct Volume: Identifiable, Equatable {
    let url: URL
    let name: String
    let total: Int64
    let available: Int64
    let purgeable: Int64
    let isInternal: Bool
    let isRemovable: Bool
    let isRoot: Bool
    let fileSystem: String

    var id: String { url.path }
    var used: Int64 { max(0, total - available) }
    var usedFraction: Double { total == 0 ? 0 : Double(used) / Double(total) }
    var freeFraction: Double { 1 - usedFraction }
}

struct DiskSample: Equatable {
    var timestamp = Date()
    var volumes: [Volume] = []
    var readBytesPerSecond: Double = 0
    var writeBytesPerSecond: Double = 0
    var totalRead: UInt64 = 0
    var totalWrite: UInt64 = 0
    var smartStatus: String?

    var root: Volume? { volumes.first(where: \.isRoot) ?? volumes.first }
}

// MARK: - Network

struct NetworkInterface: Identifiable, Equatable {
    let name: String
    let displayName: String
    let ipv4: String?
    let ipv6: String?
    let macAddress: String?
    let isUp: Bool
    var id: String { name }
}

struct WiFiInfo: Equatable {
    var interfaceName: String
    var ssid: String?
    var bssid: String?
    var rssi: Int
    var noise: Int
    var transmitRate: Double
    var channel: Int
    var band: String
    /// Channel width in MHz (20/40/80/160); 0 when unknown.
    var channelWidth: Int = 0
    /// Active PHY mode, e.g. "802.11ax (Wi-Fi 6)"; empty when unknown.
    var phyMode: String = ""
    var security: String
    var countryCode: String?

    var signalQuality: Double {
        // -50 dBm or better ≈ 100 %, -100 dBm ≈ 0 %
        ((Double(rssi) + 100) / 50).clamped(to: 0...1)
    }

    var signalLabel: String {
        switch rssi {
        case -55...0: return "Excellent"
        case -67 ..< -55: return "Good"
        case -75 ..< -67: return "Fair"
        default: return "Weak"
        }
    }
}

struct NetworkSample: Equatable {
    var timestamp = Date()
    var inBytesPerSecond: Double = 0
    var outBytesPerSecond: Double = 0
    var totalIn: UInt64 = 0
    var totalOut: UInt64 = 0
    var interfaces: [NetworkInterface] = []
    var wifi: WiFiInfo?
    var primaryInterface: String?
    var publicIP: String?

    var localIP: String? {
        if let primaryInterface, let iface = interfaces.first(where: { $0.name == primaryInterface }), let ip = iface.ipv4 { return ip }
        return interfaces.first(where: { $0.ipv4 != nil })?.ipv4
    }
}

// MARK: - Battery

struct BatterySample: Equatable {
    var timestamp = Date()
    var isPresent = false
    var percent: Double = 0
    var isCharging = false
    var isPluggedIn = false
    var fullyCharged = false
    /// Minutes to empty (discharging) or to full (charging); nil when unknown.
    var timeRemainingMinutes: Int?
    var cycleCount = 0
    /// Cycles the battery is rated for (`DesignCycleCount9C`, 1000 on every Mac since 2010); 0 when unknown.
    var designCycleCount = 0
    var designCapacity = 0
    /// Live full-charge estimate from the gauge (`AppleRawMaxCapacity`). Sags by a few percent under heavy discharge.
    var maxCapacity = 0
    /// Smoothed full-charge capacity (`NominalChargeCapacity`, Apple Silicon only); the figure behind System
    /// Information's "Maximum Capacity". 0 when the firmware does not expose it.
    var nominalCapacity = 0
    /// "Maximum Capacity Percent" as macOS itself reports it (`pmset -g ps -xml`): the smoothed figure System
    /// Information and the Battery settings pane display. nil when pmset did not provide it.
    var systemMaxCapacityPercent: Int?
    /// powerd's "Battery Service State" (0 = none); surfaced for diagnostics.
    var serviceState: Int?
    var currentCapacity = 0
    var temperature: Double = 0
    var voltage: Double = 0
    var amperage: Double = 0
    var adapterWatts: Int?
    var adapterName: String?
    var condition: String = "Unknown"
    var optimizedChargingEngaged = false
    var serial: String?
    var manufactureDate: Date?

    /// The full-charge capacity health is judged on: the smoothed nominal figure when present, else the live one.
    var fullChargeCapacity: Int { nominalCapacity > 0 ? nominalCapacity : maxCapacity }

    /// Maximum capacity relative to design capacity, 0...100. Prefers the figure macOS publishes (what System
    /// Information shows); the live gauge values swing 2–3% with load, so they are only the fallback.
    var healthPercent: Double {
        if let systemMaxCapacityPercent, systemMaxCapacityPercent > 0 { return Double(systemMaxCapacityPercent).clamped(to: 0...100) }
        guard designCapacity > 0, fullChargeCapacity > 0 else { return 0 }
        return (Double(fullChargeCapacity) / Double(designCapacity) * 100).clamped(to: 0...100)
    }

    /// `healthPercent` rounded the way System Information rounds its "Maximum Capacity" (77.6% shows as 78%).
    var healthPercentRounded: Int { Int(healthPercent.rounded()) }

    /// Rated cycles, falling back to Apple's long-standing 1000 when the firmware does not say.
    var ratedCycleCount: Int { designCycleCount > 0 ? designCycleCount : 1000 }

    /// Instantaneous power in watts; positive while charging, negative while discharging.
    var powerWatts: Double { voltage * amperage / 1_000_000 }

    var stateDescription: String {
        if !isPresent { return "No battery" }
        if fullyCharged && isPluggedIn { return "Fully charged" }
        if isCharging { return "Charging" }
        if isPluggedIn { return "Plugged in, not charging" }
        return "On battery"
    }
}

// MARK: - Sensors

enum SensorGroup: String, CaseIterable, Identifiable, Codable {
    case cpu = "CPU", gpu = "GPU", memory = "Memory", storage = "Storage", battery = "Battery", system = "System", other = "Other"
    var id: String { rawValue }
}

struct SensorReading: Identifiable, Equatable {
    let key: String
    let name: String
    let group: SensorGroup
    let celsius: Double
    var id: String { key }
}

struct FanReading: Identifiable, Equatable {
    let index: Int
    let name: String
    let rpm: Double
    let minimum: Double
    let maximum: Double
    let target: Double
    var id: Int { index }
    var fraction: Double { maximum > minimum ? ((rpm - minimum) / (maximum - minimum)).clamped(to: 0...1) : 0 }
}

struct SensorSample: Equatable {
    var timestamp = Date()
    var temperatures: [SensorReading] = []
    var fans: [FanReading] = []
    var thermalState: ProcessInfo.ThermalState = .nominal
    var systemPowerWatts: Double?
    var cpuPowerWatts: Double?
    var gpuPowerWatts: Double?
    var smcAvailable = false

    var cpuTemperature: Double? { maximum(in: .cpu) }
    var gpuTemperature: Double? { maximum(in: .gpu) }
    var hottest: SensorReading? { temperatures.max(by: { $0.celsius < $1.celsius }) }

    func maximum(in group: SensorGroup) -> Double? {
        let values = temperatures.filter { $0.group == group }.map(\.celsius)
        return values.max()
    }

    func average(in group: SensorGroup) -> Double? {
        let values = temperatures.filter { $0.group == group }.map(\.celsius)
        return values.isEmpty ? nil : values.average
    }
}

extension ProcessInfo.ThermalState {
    var title: String {
        switch self {
        case .nominal: return "Nominal"
        case .fair: return "Fair"
        case .serious: return "Serious"
        case .critical: return "Critical"
        @unknown default: return "Unknown"
        }
    }

    var explanation: String {
        switch self {
        case .nominal: return "The Mac is running cool. No throttling."
        case .fair: return "Slightly warm. Fans may spin up; performance is unaffected."
        case .serious: return "macOS is reducing CPU and GPU speed to cool down. Expect slower exports and compiles."
        case .critical: return "The Mac is very hot and heavily throttled. Give it airflow and close heavy apps."
        @unknown default: return ""
        }
    }
}

// MARK: - GPU

struct GPUSample: Equatable {
    var timestamp = Date()
    var name: String = "GPU"
    /// 0...100
    var utilization: Double = 0
    var rendererUtilization: Double = 0
    var tilerUtilization: Double = 0
    var vramUsedBytes: UInt64?
    var cores: Int?
}

// MARK: - Processes

struct ProcessSample: Identifiable, Equatable {
    let pid: pid_t
    let name: String
    let bundleIdentifier: String?
    let path: String?
    let user: String
    let isApplication: Bool
    /// Percentage of one core, so values above 100 are possible, like Activity Monitor.
    var cpuPercent: Double
    var memoryBytes: UInt64
    var threads: Int
    var diskReadBytesPerSecond: Double
    var diskWriteBytesPerSecond: Double
    var startTime: Date?
    var parentPID: pid_t

    var id: pid_t { pid }

    static func == (lhs: ProcessSample, rhs: ProcessSample) -> Bool {
        lhs.pid == rhs.pid && lhs.cpuPercent == rhs.cpuPercent && lhs.memoryBytes == rhs.memoryBytes && lhs.threads == rhs.threads
    }
}

// MARK: - Peripherals

struct PeripheralBattery: Identifiable, Equatable {
    let id: String
    let name: String
    let kind: String
    let percent: Int
}

struct DisplayInfo: Identifiable, Equatable {
    let id: String
    let name: String
    let pixelWidth: Int
    let pixelHeight: Int
    let pointWidth: Int
    let pointHeight: Int
    let scale: Double
    let refreshRate: Int
    let isMain: Bool
    let isBuiltIn: Bool
}

// MARK: - System information

struct SystemInfo: Equatable {
    var modelName = "Mac"
    var modelIdentifier = ""
    var chip = ""
    var architecture = ""
    var isAppleSilicon = false
    var physicalCores = 0
    var logicalCores = 0
    var performanceCores = 0
    var efficiencyCores = 0
    var memoryBytes: UInt64 = 0
    var osVersion = ""
    var osBuild = ""
    var osName = ""
    var kernelVersion = ""
    var serialNumber = ""
    var hardwareUUID = ""
    var hostName = ""
    var userName = ""
    var bootTime: Date?
    var gpuName = ""
    var gpuCores: Int?
    var displays: [DisplayInfo] = []
    var batteryPresent = false
    var fileVaultEnabled: Bool?
    var firewallEnabled: Bool?
    var sipEnabled: Bool?
    var lastTimeMachineBackup: Date?
    var timeMachineConfigured: Bool?
    var pendingUpdates: [String] = []
    var smartStatus: String?

    var uptime: TimeInterval { bootTime.map { Date().timeIntervalSince($0) } ?? ProcessInfo.processInfo.systemUptime }
}

// MARK: - History

struct MetricPoint: Identifiable, Equatable, Codable {
    var time: Date
    var cpu: Double
    var memoryUsed: Int64
    var memoryPressure: Int
    var swapUsed: Int64
    var diskRead: Double
    var diskWrite: Double
    var networkIn: Double
    var networkOut: Double
    var battery: Double
    var isCharging: Bool
    var temperature: Double
    var fanRPM: Double
    var gpu: Double
    var power: Double

    var id: Date { time }
}

struct ProcessPoint: Identifiable, Equatable, Codable {
    var time: Date
    var name: String
    var bundleIdentifier: String?
    var cpu: Double
    var memory: Int64
    var id: String { "\(time.timeIntervalSince1970)-\(name)" }
}

enum EventKind: String, Codable, CaseIterable {
    case appLaunched, appQuit, sleep, wake, thermal, battery, cpuSpike, memoryPressure, diskLow, cleanup, tweak, toolbox, system, alert

    var symbol: String {
        switch self {
        case .appLaunched: return "arrow.up.forward.app"
        case .appQuit: return "xmark.app"
        case .sleep: return "moon.zzz"
        case .wake: return "sun.max"
        case .thermal: return "thermometer.medium"
        case .battery: return "battery.75percent"
        case .cpuSpike: return "cpu"
        case .memoryPressure: return "memorychip"
        case .diskLow: return "internaldrive"
        case .cleanup: return "sparkles"
        case .tweak: return "slider.horizontal.3"
        case .toolbox: return "wrench.and.screwdriver"
        case .system: return "macwindow"
        case .alert: return "bell"
        }
    }
}

struct HistoryEvent: Identifiable, Equatable, Codable {
    var id: Int64
    var time: Date
    var kind: EventKind
    var title: String
    var detail: String
}

enum TimeRange: String, CaseIterable, Identifiable {
    case hour = "1h", sixHours = "6h", day = "24h", week = "7d", month = "30d"
    var id: String { rawValue }
    var seconds: TimeInterval {
        switch self {
        case .hour: return 3600
        case .sixHours: return 6 * 3600
        case .day: return 24 * 3600
        case .week: return 7 * 24 * 3600
        case .month: return 30 * 24 * 3600
        }
    }
    var title: String {
        switch self {
        case .hour: return "Last hour"
        case .sixHours: return "Last 6 hours"
        case .day: return "Last 24 hours"
        case .week: return "Last 7 days"
        case .month: return "Last 30 days"
        }
    }
    /// Target number of points for charts.
    var bucketSeconds: TimeInterval {
        switch self {
        case .hour: return 10
        case .sixHours: return 60
        case .day: return 300
        case .week: return 1800
        case .month: return 7200
        }
    }
}
