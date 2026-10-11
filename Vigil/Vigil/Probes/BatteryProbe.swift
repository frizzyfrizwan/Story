import Foundation
import IOKit
import IOKit.ps

final class BatteryProbe {
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
        sample.currentCapacity = rawCurrent
        sample.cycleCount = properties.int("CycleCount") ?? 0
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
        if let date = properties.int("ManufactureDate"), date > 0 {
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

        if let description = Self.powerSourceDescription() {
            if let percent = description[kIOPSCurrentCapacityKey] as? Int { sample.percent = Double(percent) }
            if let health = description[kIOPSBatteryHealthKey] as? String { sample.condition = health }
            if sample.isCharging, let toFull = description[kIOPSTimeToFullChargeKey] as? Int, toFull > 0 { sample.timeRemainingMinutes = toFull }
            if !sample.isCharging, let toEmpty = description[kIOPSTimeToEmptyKey] as? Int, toEmpty > 0 { sample.timeRemainingMinutes = toEmpty }
            if let engaged = description["Optimized Battery Charging Engaged"] as? Bool { sample.optimizedChargingEngaged = engaged }
        }
        if sample.condition == "Unknown" {
            if let failure = properties.int("PermanentFailureStatus"), failure != 0 { sample.condition = "Service Recommended" }
            else if sample.healthPercent > 0 { sample.condition = sample.healthPercent >= 80 ? "Normal" : "Service Recommended" }
        }
        sample.percent = sample.percent.clamped(to: 0...100)
        return sample
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
