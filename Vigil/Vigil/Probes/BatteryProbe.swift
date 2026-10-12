import Foundation
import IOKit
import IOKit.ps

final class BatteryProbe {
    /// What powerd tells `pmset -g ps -xml` and nothing else: the public IOPS snapshot omits these keys for
    /// unentitled processes, and System Information's "Maximum Capacity" comes from here.
    struct SystemHealth: Equatable {
        var maxCapacityPercent: Int?
        var healthCondition: String?
        var serviceState: Int?
        var serviceFlags: Int?
    }

    private var systemHealth: SystemHealth?
    private var systemHealthAt: Date?
    /// pmset takes ~10 ms; the figure changes rarely, so refresh once a minute.
    static let systemHealthInterval: TimeInterval = 60

    /// Selected raw AppleSmartBattery properties for the diagnostics report.
    static func rawProperties() -> [String: String] {
        guard let properties = IORegistry.firstProperties(matching: "AppleSmartBattery") else { return [:] }
        let keys = ["BatteryInstalled", "CurrentCapacity", "MaxCapacity", "DesignCapacity", "AppleRawCurrentCapacity", "AppleRawMaxCapacity",
                    "NominalChargeCapacity", "CycleCount", "DesignCycleCount9C", "Temperature", "Voltage", "Amperage", "InstantAmperage",
                    "IsCharging", "ExternalConnected", "FullyCharged", "TimeRemaining", "AvgTimeToEmpty", "AvgTimeToFull", "AdapterDetails",
                    "AppleRawAdapterDetails", "Serial", "BatterySerialNumber", "ManufactureDate", "DeviceName", "PermanentFailureStatus",
                    "OptimizedBatteryChargingEngaged", "BatteryHealth", "AtCriticalLevel", "PostChargeWaitSeconds"]
        var result: [String: String] = [:]
        for key in keys {
            if let value = properties[key] { result[key] = String(describing: value).replacingOccurrences(of: "\n", with: " ") }
        }
        return result
    }

    func sample() -> BatterySample {
        var sample = BatterySample()
        guard let properties = IORegistry.firstProperties(matching: "AppleSmartBattery"),
              properties.bool("BatteryInstalled") ?? true else {
            sample.isPresent = false
            return sample
        }
        sample.isPresent = true
        let rawMax = properties.int("AppleRawMaxCapacity") ?? properties.int("MaxCapacity") ?? 0
        let rawCurrent = properties.int("AppleRawCurrentCapacity") ?? properties.int("CurrentCapacity") ?? 0
        let design = properties.int("DesignCapacity") ?? 0
        sample.designCapacity = design
        sample.maxCapacity = rawMax
        sample.nominalCapacity = properties.int("NominalChargeCapacity") ?? 0
        sample.currentCapacity = rawCurrent
        sample.cycleCount = properties.int("CycleCount") ?? 0
        sample.designCycleCount = properties.int("DesignCycleCount9C") ?? 0
        sample.isCharging = properties.bool("IsCharging") ?? false
        sample.isPluggedIn = properties.bool("ExternalConnected") ?? false
        sample.fullyCharged = properties.bool("FullyCharged") ?? false
        if let temperature = properties.double("Temperature") { sample.temperature = temperature / 100 }
        sample.voltage = properties.double("Voltage") ?? 0
        if let amperage = properties.int("Amperage") {
            // Some firmware reports the unsigned 64-bit two's complement.
            sample.amperage = amperage > Int(Int32.max) ? Double(Int64(amperage) - Int64(UInt32.max) - 1) : Double(amperage)
        }
        if let adapter = properties.dictionary("AdapterDetails") {
            sample.adapterWatts = adapter.int("Watts")
            sample.adapterName = adapter.string("Name") ?? adapter.string("Description")
        }
        sample.serial = properties.string("Serial") ?? properties.string("BatterySerialNumber")
        // Apple Silicon packs stores a different, undocumented encoding (a 14-digit value inside BatteryData), so only
        // trust the SMBus 16-bit form.
        if let date = properties.int("ManufactureDate"), date > 0, date < 65_536 {
            // Packed SMBus date: bits 15-9 year since 1980, 8-5 month, 4-0 day.
            var components = DateComponents()
            components.year = 1980 + (date >> 9)
            components.month = (date >> 5) & 0xF
            components.day = date & 0x1F
            sample.manufactureDate = Calendar.current.date(from: components)
        }
        sample.optimizedChargingEngaged = properties.bool("OptimizedBatteryChargingEngaged") ?? false

        // Percent and time estimates come from the power-source API, which matches the menu bar.
        if let percent = properties.int("CurrentCapacity"), (properties.int("MaxCapacity") ?? 100) == 100 {
            sample.percent = Double(percent)
        } else if rawMax > 0 {
            sample.percent = Double(rawCurrent) / Double(rawMax) * 100
        }
        if let time = properties.int("TimeRemaining"), time > 0, time < 65_535 { sample.timeRemainingMinutes = time }

        var powerSourceHealth: String?
        var healthCondition: String?
        if let description = Self.powerSourceDescription() {
            if let percent = description[kIOPSCurrentCapacityKey] as? Int { sample.percent = Double(percent) }
            powerSourceHealth = description[kIOPSBatteryHealthKey] as? String
            healthCondition = description[kIOPSBatteryHealthConditionKey] as? String
            if sample.designCycleCount == 0, let cycles = description["DesignCycleCount"] as? Int { sample.designCycleCount = cycles }
            if sample.isCharging, let toFull = description[kIOPSTimeToFullChargeKey] as? Int, toFull > 0 { sample.timeRemainingMinutes = toFull }
            if !sample.isCharging, let toEmpty = description[kIOPSTimeToEmptyKey] as? Int, toEmpty > 0 { sample.timeRemainingMinutes = toEmpty }
            if let engaged = description["Optimized Battery Charging Engaged"] as? Bool { sample.optimizedChargingEngaged = engaged }
        }
        if let system = refreshedSystemHealth() {
            sample.systemMaxCapacityPercent = system.maxCapacityPercent
            sample.serviceState = system.serviceState
            if let condition = system.healthCondition, !condition.isEmpty { healthCondition = condition }
        }
        sample.condition = Self.condition(powerSourceHealth: powerSourceHealth,
                                          healthCondition: healthCondition,
                                          permanentFailure: (properties.int("PermanentFailureStatus") ?? 0) != 0,
                                          healthPercent: sample.healthPercent)
        sample.percent = sample.percent.clamped(to: 0...100)
        return sample
    }

    private func refreshedSystemHealth() -> SystemHealth? {
        if let systemHealthAt, Date().timeIntervalSince(systemHealthAt) < Self.systemHealthInterval { return systemHealth }
        systemHealthAt = Date()
        systemHealth = Self.readSystemHealth()
        return systemHealth
    }

    /// Runs `pmset -g ps -xml` and picks the internal battery's dictionary.
    static func readSystemHealth() -> SystemHealth? {
        let result = Shell.run("/usr/bin/pmset", ["-g", "ps", "-xml"], timeout: 5)
        guard result.succeeded, let data = result.output.data(using: .utf8) else { return nil }
        return parsePowerSourceReport(data)
    }

    /// Parses the plist `pmset -g ps -xml` prints: a dictionary for a single source, or an array of them.
    static func parsePowerSourceReport(_ data: Data) -> SystemHealth? {
        guard let object = try? PropertyListSerialization.propertyList(from: data, format: nil) else { return nil }
        let candidates: [[String: Any]]
        if let dictionary = object as? [String: Any] { candidates = [dictionary] }
        else if let array = object as? [[String: Any]] { candidates = array }
        else { return nil }
        guard let source = candidates.first(where: { ($0["Type"] as? String) == "InternalBattery" || ($0["Name"] as? String)?.hasPrefix("InternalBattery") == true }) ?? candidates.first else { return nil }
        var health = SystemHealth()
        health.maxCapacityPercent = source.int("Maximum Capacity Percent")
        health.healthCondition = source["BatteryHealthCondition"] as? String
        health.serviceState = source.int("Battery Service State")
        health.serviceFlags = source.int("Battery Service Flags")
        return health
    }

    /// Reproduces the "Condition" that System Information shows. The power-source API says "Good" for any battery
    /// that is not failing outright, whereas System Information switches to "Service Recommended" as soon as the
    /// maximum capacity drops below 80% of design (Apple's service threshold), so the percentage decides.
    static func condition(powerSourceHealth: String?, healthCondition: String?, permanentFailure: Bool, healthPercent: Double) -> String {
        if permanentFailure { return "Service Recommended" }
        if let healthCondition, !healthCondition.isEmpty {
            // "Check Battery" or "Permanent Battery Failure".
            return healthCondition.localizedCaseInsensitiveContains("permanent") ? "Replace Now" : "Service Recommended"
        }
        switch powerSourceHealth?.lowercased() {
        case "poor", "fair": return "Service Recommended"
        default: break
        }
        if healthPercent > 0 { return healthPercent >= 80 ? "Normal" : "Service Recommended" }
        switch powerSourceHealth?.lowercased() {
        case "good": return "Normal"
        case .some(let other) where !other.isEmpty: return powerSourceHealth ?? "Unknown"
        default: return "Unknown"
        }
    }

    private static func powerSourceDescription() -> [String: Any]? {
        guard let snapshot = IOPSCopyPowerSourcesInfo()?.takeRetainedValue(),
              let sources = IOPSCopyPowerSourcesList(snapshot)?.takeRetainedValue() as? [CFTypeRef] else { return nil }
        for source in sources {
            if let description = IOPSGetPowerSourceDescription(snapshot, source)?.takeUnretainedValue() as? [String: Any],
               (description[kIOPSTypeKey] as? String) == kIOPSInternalBatteryType {
                return description
            }
        }
        return nil
    }
}
