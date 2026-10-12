import Foundation

/// Everything the health rules need, so they can be evaluated without live probes (tests).
struct HealthContext {
    var cpu: CPUSample
    var memory: MemorySample
    var disk: DiskSample
    var battery: BatterySample
    var sensors: SensorSample
    var system: SystemInfo
    var processes: [ProcessSample]
    var startupItemCount: Int?
    var now: Date
}

/// Turns a snapshot of the Mac into a score and a list of findings with concrete actions.
/// Every rule is deterministic so the score is explainable: 100 minus the penalties of the findings.
struct HealthEngine {
    func evaluate(context: HealthContext) -> HealthReport {
        var findings: [HealthFinding] = []
        findings += storageRules(context)
        findings += memoryRules(context)
        findings += cpuRules(context)
        findings += batteryRules(context)
        findings += thermalRules(context)
        findings += securityRules(context)
        findings += maintenanceRules(context)
        findings += backupRules(context)
        findings.sort { lhs, rhs in
            if lhs.severity != rhs.severity { return lhs.severity > rhs.severity }
            return lhs.title < rhs.title
        }
        let penalty = findings.reduce(0) { $0 + $1.severity.penalty }
        var report = HealthReport()
        report.score = max(0, 100 - penalty)
        report.findings = findings
        report.generatedAt = context.now
        return report
    }

    // MARK: Storage

    private func storageRules(_ context: HealthContext) -> [HealthFinding] {
        guard let root = context.disk.root else { return [] }
        let freePercent = root.freeFraction * 100
        var findings: [HealthFinding] = []
        if freePercent < 5 {
            findings.append(HealthFinding(id: "storage.critical", severity: .critical, category: .storage,
                                          title: "Startup disk is almost full",
                                          detail: "Only \(Format.bytes(root.available)) (\(Int(freePercent))%) free. macOS needs free space for swap, updates and caches; below 5% apps start failing to save and the Mac slows dramatically.",
                                          action: .openSection(.storage), actionTitle: "Clean up now"))
        } else if freePercent < 15 {
            findings.append(HealthFinding(id: "storage.low", severity: .warning, category: .storage,
                                          title: "Keep at least 15% of your disk free",
                                          detail: "\(Format.bytes(root.available)) (\(Int(freePercent))%) free. SSDs stay fast and healthy with headroom, and macOS updates need 20–30 GB temporarily.",
                                          action: .openSection(.storage), actionTitle: "Find what to remove"))
        } else {
            findings.append(HealthFinding(id: "storage.ok", severity: .good, category: .storage,
                                          title: "Plenty of free space", detail: "\(Format.bytes(root.available)) free on \(root.name).", action: nil))
        }
        if root.purgeable > 5_000_000_000 {
            findings.append(HealthFinding(id: "storage.purgeable", severity: .info, category: .storage,
                                          title: "\(Format.bytes(root.purgeable)) is purgeable",
                                          detail: "Local Time Machine snapshots and iCloud caches that macOS removes when space is tight. You can reclaim them now from Storage.",
                                          action: .openSection(.storage), actionTitle: "View"))
        }
        if let smart = context.system.smartStatus, smart != "Verified", smart != "Not Supported" {
            findings.append(HealthFinding(id: "storage.smart", severity: .critical, category: .storage,
                                          title: "Disk reports a S.M.A.R.T. problem (\(smart))",
                                          detail: "The drive's own self-monitoring says it may be failing. Back up immediately and have the drive checked.",
                                          action: .openSection(.storage), actionTitle: "Check backups"))
        }
        return findings
    }

    // MARK: Memory

    private func memoryRules(_ context: HealthContext) -> [HealthFinding] {
        var findings: [HealthFinding] = []
        let memory = context.memory
        switch memory.pressure {
        case .critical:
            let top = context.processes.max(by: { $0.memoryBytes < $1.memoryBytes })
            findings.append(HealthFinding(id: "memory.critical", severity: .warning, category: .memory,
                                          title: "Memory pressure is critical",
                                          detail: "macOS is swapping to disk (\(Format.memory(memory.swapUsed)) in swap). \(top.map { "\($0.name) is the biggest user at \(Format.memory($0.memoryBytes))." } ?? "")",
                                          action: .openSection(.memory), actionTitle: "See what's using memory"))
        case .warning:
            findings.append(HealthFinding(id: "memory.warning", severity: .info, category: .memory,
                                          title: "Memory is getting tight",
                                          detail: "macOS is compressing memory to keep up. Closing a few browser tabs or an idle app usually fixes it.",
                                          action: .openSection(.memory), actionTitle: "See what's using memory"))
        case .normal:
            findings.append(HealthFinding(id: "memory.ok", severity: .good, category: .memory,
                                          title: "Memory pressure is normal", detail: "\(Format.memory(memory.used)) of \(Format.memory(memory.total)) in use.", action: nil))
        }
        if memory.swapUsed > 4_000_000_000 && memory.pressure == .normal {
            findings.append(HealthFinding(id: "memory.swap", severity: .info, category: .memory,
                                          title: "\(Format.memory(memory.swapUsed)) of swap in use",
                                          detail: "Swap writes wear the SSD a little and slow app switching. A restart clears it; the real fix is fewer memory-hungry apps at once.",
                                          action: .openSection(.memory), actionTitle: "Details"))
        }
        return findings
    }

    // MARK: CPU

    private func cpuRules(_ context: HealthContext) -> [HealthFinding] {
        var findings: [HealthFinding] = []
        if let runaway = context.processes.first(where: { $0.cpuPercent > 150 && $0.name.lowercased() != "kernel_task" }) {
            let explanation = ProcessDictionary.explanation(for: runaway.name, bundleIdentifier: runaway.bundleIdentifier, isApplication: runaway.isApplication)
            findings.append(HealthFinding(id: "cpu.runaway", severity: .warning, category: .cpu,
                                          title: "\(runaway.name) is using \(Int(runaway.cpuPercent))% CPU",
                                          detail: explanation.summary,
                                          action: .openSection(.activity), actionTitle: "Inspect"))
        }
        if let kernel = context.processes.first(where: { $0.name.lowercased() == "kernel_task" && $0.cpuPercent > 100 }) {
            findings.append(HealthFinding(id: "cpu.kernel", severity: .warning, category: .thermal,
                                          title: "kernel_task is at \(Int(kernel.cpuPercent))% — your Mac is cooling itself",
                                          detail: "kernel_task hogs the CPU on purpose when the Mac is too hot. Improve airflow, unplug from a hot charger, and check which app is heating things up.",
                                          action: .openSection(.sensors), actionTitle: "Check temperatures"))
        }
        let uptimeDays = context.system.uptime / 86_400
        if uptimeDays >= 30 {
            findings.append(HealthFinding(id: "cpu.uptime", severity: .warning, category: .maintenance,
                                          title: "\(Int(uptimeDays)) days since the last restart",
                                          detail: "Long uptimes accumulate swap, leaked memory and pending updates. A restart every week or two keeps things snappy and applies security fixes.",
                                          action: nil, actionTitle: nil))
        } else if uptimeDays >= 14 {
            findings.append(HealthFinding(id: "cpu.uptime", severity: .info, category: .maintenance,
                                          title: "\(Int(uptimeDays)) days since the last restart",
                                          detail: "Restarting occasionally clears swap and lets macOS finish background maintenance.",
                                          action: nil, actionTitle: nil))
        }
        return findings
    }

    // MARK: Battery

    private func batteryRules(_ context: HealthContext) -> [HealthFinding] {
        let battery = context.battery
        guard battery.isPresent else { return [] }
        var findings: [HealthFinding] = []
        let health = battery.healthPercent
        if health > 0 && health < 70 {
            findings.append(HealthFinding(id: "battery.health", severity: .warning, category: .battery,
                                          title: "Battery holds \(Int(health))% of its original capacity",
                                          detail: "Apple considers a battery consumed below 80%. Runtime is noticeably shorter and the Mac may shut down unexpectedly under load. Consider a battery service.",
                                          action: .openSection(.power), actionTitle: "Battery details"))
        } else if health > 0 && health < 80 {
            findings.append(HealthFinding(id: "battery.health", severity: .info, category: .battery,
                                          title: "Battery capacity is at \(Int(health))%",
                                          detail: "Normal wear, but it is approaching the 80% service threshold. Keeping the charge between 20% and 80% slows further wear.",
                                          action: .openSection(.power), actionTitle: "Battery details"))
        } else if health > 0 {
            findings.append(HealthFinding(id: "battery.ok", severity: .good, category: .battery,
                                          title: "Battery is healthy", detail: "\(Int(health))% of design capacity after \(battery.cycleCount) cycles.", action: nil))
        }
        if battery.condition.lowercased().contains("service") || battery.condition.lowercased().contains("replace") {
            findings.append(HealthFinding(id: "battery.service", severity: .warning, category: .battery,
                                          title: "macOS recommends battery service",
                                          detail: "The battery reports condition \"\(battery.condition)\". Book a service at an Apple Store or authorised provider.",
                                          action: .openSection(.power), actionTitle: "Battery details"))
        }
        if battery.cycleCount >= 900 {
            findings.append(HealthFinding(id: "battery.cycles", severity: .info, category: .battery,
                                          title: "\(battery.cycleCount) charge cycles",
                                          detail: "Modern Mac batteries are rated for 1000 cycles at 80% capacity. Partial charges count partially, so topping up often is fine.",
                                          action: nil, actionTitle: nil))
        }
        if battery.temperature >= 40 {
            findings.append(HealthFinding(id: "battery.hot", severity: .warning, category: .battery,
                                          title: "Battery is \(Int(battery.temperature))°C",
                                          detail: "Heat is the main cause of battery ageing. Avoid charging while running heavy workloads on a soft surface.",
                                          action: .openSection(.sensors), actionTitle: "Temperatures"))
        }
        if battery.isPluggedIn && battery.fullyCharged && !battery.optimizedChargingEngaged {
            findings.append(HealthFinding(id: "battery.optimized", severity: .info, category: .battery,
                                          title: "Sitting at 100% on the charger",
                                          detail: "Lithium batteries age fastest when held at full charge. Turn on Optimized Battery Charging in System Settings → Battery so macOS holds the charge at 80% until you need it.",
                                          action: .systemSettings("x-apple.systempreferences:com.apple.Battery-Settings.extension"), actionTitle: "Battery settings"))
        }
        return findings
    }

    // MARK: Thermal

    private func thermalRules(_ context: HealthContext) -> [HealthFinding] {
        var findings: [HealthFinding] = []
        switch context.sensors.thermalState {
        case .critical:
            findings.append(HealthFinding(id: "thermal.state", severity: .critical, category: .thermal, title: "Thermal state is critical",
                                          detail: context.sensors.thermalState.explanation, action: .openSection(.activity), actionTitle: "Find the hot app"))
        case .serious:
            findings.append(HealthFinding(id: "thermal.state", severity: .warning, category: .thermal, title: "Your Mac is throttling",
                                          detail: context.sensors.thermalState.explanation, action: .openSection(.activity), actionTitle: "Find the hot app"))
        case .fair:
            findings.append(HealthFinding(id: "thermal.state", severity: .info, category: .thermal, title: "Running a little warm",
                                          detail: context.sensors.thermalState.explanation, action: nil, actionTitle: nil))
        default:
            findings.append(HealthFinding(id: "thermal.ok", severity: .good, category: .thermal, title: "Temperatures are normal",
                                          detail: context.sensors.cpuTemperature.map { "CPU at \(Int($0))°C." } ?? "No throttling.", action: nil))
        }
        if let cpuTemp = context.sensors.cpuTemperature, cpuTemp >= 100 {
            findings.append(HealthFinding(id: "thermal.cpu", severity: .warning, category: .thermal, title: "CPU at \(Int(cpuTemp))°C",
                                          detail: "Sustained temperatures above 100°C shorten component life. Clean the vents, use a hard surface, and check for a runaway process.",
                                          action: .openSection(.sensors), actionTitle: "Temperatures"))
        }
        return findings
    }

    // MARK: Security

    private func securityRules(_ context: HealthContext) -> [HealthFinding] {
        var findings: [HealthFinding] = []
        if context.system.fileVaultEnabled == false {
            findings.append(HealthFinding(id: "security.filevault", severity: .warning, category: .security, title: "FileVault is off",
                                          detail: "Without disk encryption anyone with the laptop can read your files. Turning it on costs nothing in performance on modern Macs.",
                                          action: .systemSettings("x-apple.systempreferences:com.apple.settings.PrivacySecurity.extension?FileVault"), actionTitle: "Turn on FileVault"))
        }
        if context.system.firewallEnabled == false {
            findings.append(HealthFinding(id: "security.firewall", severity: .info, category: .security, title: "Firewall is off",
                                          detail: "The macOS firewall blocks unsolicited incoming connections on public Wi-Fi. Turn it on in System Settings → Network → Firewall.",
                                          action: .systemSettings("x-apple.systempreferences:com.apple.Network-Settings.extension?Firewall"), actionTitle: "Firewall settings"))
        }
        if context.system.sipEnabled == false {
            findings.append(HealthFinding(id: "security.sip", severity: .warning, category: .security, title: "System Integrity Protection is disabled",
                                          detail: "SIP stops malware from modifying macOS itself. Unless you disabled it on purpose for development, re-enable it from Recovery.",
                                          action: nil, actionTitle: nil))
        }
        if !context.system.pendingUpdates.isEmpty {
            findings.append(HealthFinding(id: "security.updates", severity: .warning, category: .security,
                                          title: "\(context.system.pendingUpdates.count) update\(context.system.pendingUpdates.count == 1 ? "" : "s") waiting",
                                          detail: context.system.pendingUpdates.prefix(3).joined(separator: ", ") + ". Updates carry security fixes and battery/thermal improvements.",
                                          action: .systemSettings("x-apple.systempreferences:com.apple.Software-Update-Settings.extension"), actionTitle: "Software Update"))
        }
        if context.system.fileVaultEnabled == true && context.system.firewallEnabled == true && context.system.pendingUpdates.isEmpty {
            findings.append(HealthFinding(id: "security.ok", severity: .good, category: .security, title: "Encrypted, firewalled and up to date", detail: "FileVault on, firewall on, no pending updates.", action: nil))
        }
        return findings
    }

    // MARK: Maintenance

    private func maintenanceRules(_ context: HealthContext) -> [HealthFinding] {
        var findings: [HealthFinding] = []
        if let count = context.startupItemCount, count >= 12 {
            findings.append(HealthFinding(id: "maintenance.startup", severity: .info, category: .maintenance,
                                          title: "\(count) items start automatically",
                                          detail: "Each login item and launch agent adds to boot time and idle CPU. Review them and disable the ones you don't use.",
                                          action: .openSection(.startup), actionTitle: "Review startup items"))
        }
        return findings
    }

    // MARK: Backups

    private func backupRules(_ context: HealthContext) -> [HealthFinding] {
        var findings: [HealthFinding] = []
        if context.system.timeMachineConfigured == false {
            findings.append(HealthFinding(id: "backup.none", severity: .warning, category: .backup, title: "No Time Machine backup configured",
                                          detail: "Drives fail and laptops get lost. Any external disk or a NAS works; the first backup takes a few hours, later ones are quick.",
                                          action: .systemSettings("x-apple.systempreferences:com.apple.Time-Machine-Settings.extension"), actionTitle: "Set up Time Machine"))
        } else if let last = context.system.lastTimeMachineBackup {
            let days = context.now.timeIntervalSince(last) / 86_400
            if days >= 14 {
                findings.append(HealthFinding(id: "backup.stale", severity: .warning, category: .backup, title: "Last backup was \(Int(days)) days ago",
                                              detail: "Connect your backup disk. Anything created since \(Format.dateTime(last)) is not backed up.",
                                              action: .systemSettings("x-apple.systempreferences:com.apple.Time-Machine-Settings.extension"), actionTitle: "Time Machine"))
            } else if days >= 3 {
                findings.append(HealthFinding(id: "backup.stale", severity: .info, category: .backup, title: "Last backup was \(Int(days)) days ago",
                                              detail: "Connect your backup disk when you get a chance.", action: nil, actionTitle: nil))
            } else {
                findings.append(HealthFinding(id: "backup.ok", severity: .good, category: .backup, title: "Backed up \(Format.relative(last, to: context.now))", detail: "Time Machine is current.", action: nil))
            }
        }
        return findings
    }
}
