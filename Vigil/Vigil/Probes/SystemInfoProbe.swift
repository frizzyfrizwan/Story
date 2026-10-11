import Foundation
import AppKit
import IOKit

/// Static facts about the machine. Collected once at launch, refreshed rarely.
enum SystemInfoProbe {
    static func collect() -> SystemInfo {
        var info = SystemInfo()
        info.modelIdentifier = Sysctl.string("hw.model") ?? ""
        info.chip = Sysctl.string("machdep.cpu.brand_string") ?? ""
        info.architecture = Sysctl.string("hw.machine") ?? ""
        info.isAppleSilicon = info.architecture.hasPrefix("arm64") || (Sysctl.int("hw.optional.arm64") ?? 0) == 1
        info.physicalCores = Sysctl.int("hw.physicalcpu") ?? ProcessInfo.processInfo.processorCount
        info.logicalCores = Sysctl.int("hw.logicalcpu") ?? ProcessInfo.processInfo.activeProcessorCount
        for level in 0..<2 {
            guard let name = Sysctl.string("hw.perflevel\(level).name"), let count = Sysctl.int("hw.perflevel\(level).physicalcpu") else { continue }
            if name.lowercased().hasPrefix("eff") { info.efficiencyCores = count } else { info.performanceCores = count }
        }
        info.memoryBytes = ProcessInfo.processInfo.physicalMemory
        let version = ProcessInfo.processInfo.operatingSystemVersion
        info.osVersion = "\(version.majorVersion).\(version.minorVersion).\(version.patchVersion)"
        info.osBuild = Sysctl.string("kern.osversion") ?? ""
        info.osName = marketingName(forMajor: version.majorVersion)
        info.kernelVersion = Sysctl.string("kern.osrelease") ?? ""
        info.serialNumber = IORegistry.platformExpertString("IOPlatformSerialNumber") ?? ""
        info.hardwareUUID = IORegistry.platformExpertString("IOPlatformUUID") ?? ""
        info.hostName = Host.current().localizedName ?? ProcessInfo.processInfo.hostName
        info.userName = NSFullUserName()
        info.bootTime = Sysctl.bootTime()
        info.modelName = modelName(identifier: info.modelIdentifier, chip: info.chip)
        info.displays = displays()
        info.batteryPresent = IORegistry.firstProperties(matching: "AppleSmartBattery")?.bool("BatteryInstalled") ?? false
        if info.isAppleSilicon {
            info.gpuName = info.chip
            info.gpuCores = IORegistry.firstProperties(matching: "AGXAccelerator")?.int("gpu-core-count")
        } else {
            info.gpuName = IORegistry.firstProperties(matching: "IOAccelerator")?.string("model") ?? ""
        }
        return info
    }

    /// Slow checks (shell tools). Call from a background task and merge into the existing info.
    static func collectSlow(into info: inout SystemInfo) {
        let fileVault = Shell.run("/usr/bin/fdesetup", ["status"], timeout: 10)
        if fileVault.succeeded { info.fileVaultEnabled = fileVault.output.contains("FileVault is On") }

        let firewall = Shell.run("/usr/libexec/ApplicationFirewall/socketfilterfw", ["--getglobalstate"], timeout: 10)
        if firewall.succeeded { info.firewallEnabled = firewall.output.lowercased().contains("enabled") && !firewall.output.lowercased().contains("disabled") }

        let sip = Shell.run("/usr/bin/csrutil", ["status"], timeout: 10)
        if sip.succeeded { info.sipEnabled = sip.output.lowercased().contains("enabled") }

        let destination = Shell.run("/usr/bin/tmutil", ["destinationinfo"], timeout: 15)
        if destination.succeeded {
            info.timeMachineConfigured = !destination.output.contains("No destinations configured")
        } else {
            info.timeMachineConfigured = nil
        }
        let latest = Shell.run("/usr/bin/tmutil", ["latestbackup", "-t"], timeout: 15)
        if latest.succeeded {
            let text = latest.output.trimmingCharacters(in: .whitespacesAndNewlines)
            let formatter = DateFormatter()
            formatter.dateFormat = "yyyy-MM-dd-HHmmss"
            formatter.timeZone = .current
            if let last = text.split(separator: "\n").last {
                let stamp = String(last).split(separator: "/").last.map(String.init) ?? String(last)
                let cleaned = stamp.replacingOccurrences(of: ".backup", with: "")
                info.lastTimeMachineBackup = formatter.date(from: cleaned)
            }
        }

        if let updates = CFPreferencesCopyAppValue("RecommendedUpdates" as CFString, "com.apple.SoftwareUpdate" as CFString) as? [[String: Any]] {
            info.pendingUpdates = updates.compactMap { $0["Display Name"] as? String }
        }
        info.smartStatus = DiskProbe.smartStatus()
        if info.modelName == info.modelIdentifier || info.modelName.isEmpty {
            if let name = marketingModelName() { info.modelName = name }
        }
    }

    // MARK: - Helpers

    static func marketingName(forMajor major: Int) -> String {
        switch major {
        case 14: return "macOS Sonoma"
        case 15: return "macOS Sequoia"
        case 26: return "macOS Tahoe"
        default: return "macOS"
        }
    }

    static func modelName(identifier: String, chip: String) -> String {
        let lowered = identifier.lowercased()
        let family: String
        if lowered.hasPrefix("macbookpro") || lowered.hasPrefix("mac14,5") || lowered.hasPrefix("mac14,6") || lowered.hasPrefix("mac14,9") || lowered.hasPrefix("mac14,10") || lowered.hasPrefix("mac15,3") || lowered.hasPrefix("mac15,6") || lowered.hasPrefix("mac15,7") || lowered.hasPrefix("mac15,8") || lowered.hasPrefix("mac15,9") || lowered.hasPrefix("mac15,10") || lowered.hasPrefix("mac15,11") || lowered.hasPrefix("mac16,1") || lowered.hasPrefix("mac16,5") || lowered.hasPrefix("mac16,6") || lowered.hasPrefix("mac16,7") || lowered.hasPrefix("mac16,8") {
            family = "MacBook Pro"
        } else if lowered.hasPrefix("macbookair") || lowered.hasPrefix("mac14,2") || lowered.hasPrefix("mac14,15") || lowered.hasPrefix("mac15,12") || lowered.hasPrefix("mac15,13") || lowered.hasPrefix("mac16,12") || lowered.hasPrefix("mac16,13") {
            family = "MacBook Air"
        } else if lowered.hasPrefix("macmini") || lowered.hasPrefix("mac14,3") || lowered.hasPrefix("mac14,12") || lowered.hasPrefix("mac16,10") || lowered.hasPrefix("mac16,11") {
            family = "Mac mini"
        } else if lowered.hasPrefix("macstudio") || lowered.hasPrefix("mac13,") || lowered.hasPrefix("mac14,13") || lowered.hasPrefix("mac14,14") || lowered.hasPrefix("mac15,14") || lowered.hasPrefix("mac16,9") {
            family = "Mac Studio"
        } else if lowered.hasPrefix("imac") || lowered.hasPrefix("mac15,4") || lowered.hasPrefix("mac15,5") || lowered.hasPrefix("mac16,2") || lowered.hasPrefix("mac16,3") {
            family = "iMac"
        } else if lowered.hasPrefix("macpro") || lowered.hasPrefix("mac14,8") {
            family = "Mac Pro"
        } else if lowered.hasPrefix("macbook") {
            family = "MacBook"
        } else {
            family = identifier.isEmpty ? "Mac" : identifier
        }
        let chipSuffix = chip.replacingOccurrences(of: "Apple ", with: "")
        if !chipSuffix.isEmpty, chip.hasPrefix("Apple") { return "\(family) (\(chipSuffix))" }
        return family
    }

    /// Marketing name from `system_profiler`, e.g. "MacBook Pro (14-inch, Nov 2023)". Slow (~1 s).
    static func marketingModelName() -> String? {
        let result = Shell.run("/usr/sbin/system_profiler", ["SPHardwareDataType", "-json"], timeout: 20)
        guard result.succeeded, let data = result.output.data(using: .utf8),
              let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
              let items = json["SPHardwareDataType"] as? [[String: Any]], let first = items.first else { return nil }
        return first["machine_name"] as? String
    }

    static func displays() -> [DisplayInfo] {
        NSScreen.screens.enumerated().map { index, screen in
            let description = screen.deviceDescription
            let number = (description[NSDeviceDescriptionKey("NSScreenNumber")] as? NSNumber)?.intValue ?? index
            let size = description[.size] as? NSSize ?? screen.frame.size
            let scale = screen.backingScaleFactor
            let name = screen.localizedName
            let isBuiltIn = name.localizedCaseInsensitiveContains("built-in") || name.localizedCaseInsensitiveContains("liquid retina")
            return DisplayInfo(id: "\(number)",
                               name: name,
                               pixelWidth: Int(size.width * scale),
                               pixelHeight: Int(size.height * scale),
                               pointWidth: Int(size.width),
                               pointHeight: Int(size.height),
                               scale: scale,
                               refreshRate: screen.maximumFramesPerSecond,
                               isMain: screen == NSScreen.main,
                               isBuiltIn: isBuiltIn)
        }
    }
}
