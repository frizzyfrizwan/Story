import SwiftUI
import AppKit

struct SystemInfoView: View {
    @Environment(MetricsEngine.self) private var engine
    @Environment(AppState.self) private var state
    @Environment(AppSettings.self) private var settings

    private var system: SystemInfo { engine.system }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: Theme.gridSpacing) {
                HStack(alignment: .top) {
                    PageHeader(title: system.modelName, subtitle: "\(system.osName) \(system.osVersion) (\(system.osBuild))")
                    Button {
                        NSPasteboard.general.clearContents()
                        NSPasteboard.general.setString(report, forType: .string)
                        state.toast("System report copied")
                    } label: { Label("Copy report", systemImage: "doc.on.doc") }
                    Button {
                        if let url = Diagnostics.export(engine: engine, settings: settings) {
                            state.toast("Diagnostics saved to \(url.lastPathComponent) and copied")
                            NSWorkspace.shared.activateFileViewerSelecting([url])
                        } else {
                            state.toast("Diagnostics copied to the clipboard")
                        }
                    } label: { Label("Diagnostics", systemImage: "stethoscope") }
                    .help("Save every raw reading to the Desktop for hardware validation")
                    Button("Refresh") { engine.refreshSystemInfo() }
                }
                LazyVGrid(columns: [GridItem(.flexible(), alignment: .top), GridItem(.flexible(), alignment: .top)], alignment: .leading, spacing: Theme.gridSpacing) {
                    hardwareCard
                    softwareCard
                    displaysCard
                    securityCard
                }
            }
            .padding(20)
        }
        .accessibilityIdentifier("page.system")
    }

    private var hardwareCard: some View {
        VStack(alignment: .leading, spacing: 4) {
            SectionHeader(title: "Hardware", systemImage: "laptopcomputer")
            KeyValueRow(key: "Model", value: system.modelName)
            KeyValueRow(key: "Identifier", value: system.modelIdentifier, monospaced: true)
            KeyValueRow(key: "Chip", value: system.chip)
            KeyValueRow(key: "Cores", value: system.performanceCores > 0 && system.efficiencyCores > 0 ? "\(system.physicalCores) (\(system.performanceCores) performance, \(system.efficiencyCores) efficiency)" : "\(system.physicalCores) physical, \(system.logicalCores) logical")
            KeyValueRow(key: "Memory", value: Format.memory(system.memoryBytes))
            KeyValueRow(key: "GPU", value: system.gpuName + (system.gpuCores.map { " · \($0) cores" } ?? ""))
            if let root = engine.disk.root { KeyValueRow(key: "Startup disk", value: "\(root.name) · \(Format.bytes(root.total)) \(root.fileSystem)") }
            KeyValueRow(key: "Serial number", value: system.serialNumber, monospaced: true, copyable: true)
            KeyValueRow(key: "Hardware UUID", value: system.hardwareUUID, monospaced: true, copyable: true)
            KeyValueRow(key: "Battery", value: engine.battery.isPresent ? "\(Int(engine.battery.healthPercent))% health, \(engine.battery.cycleCount) cycles" : "None")
        }
        .card()
    }

    private var softwareCard: some View {
        VStack(alignment: .leading, spacing: 4) {
            SectionHeader(title: "Software", systemImage: "gearshape")
            KeyValueRow(key: "macOS", value: "\(system.osName) \(system.osVersion)")
            KeyValueRow(key: "Build", value: system.osBuild, monospaced: true)
            KeyValueRow(key: "Kernel", value: "Darwin \(system.kernelVersion)")
            KeyValueRow(key: "Architecture", value: system.architecture)
            KeyValueRow(key: "Computer name", value: system.hostName)
            KeyValueRow(key: "User", value: system.userName)
            KeyValueRow(key: "Uptime", value: Format.duration(system.uptime))
            if let boot = system.bootTime { KeyValueRow(key: "Last restart", value: Format.dateTime(boot)) }
            KeyValueRow(key: "Processes", value: "\(engine.processes.count)")
            if !system.pendingUpdates.isEmpty { KeyValueRow(key: "Updates waiting", value: system.pendingUpdates.joined(separator: ", ")) }
        }
        .card()
    }

    private var displaysCard: some View {
        VStack(alignment: .leading, spacing: 4) {
            SectionHeader(title: "Displays", systemImage: "display")
            ForEach(system.displays) { display in
                VStack(alignment: .leading, spacing: 2) {
                    HStack {
                        Text(display.name).font(.callout.weight(.medium))
                        if display.isMain { Text("Main").font(.caption2).padding(.horizontal, 5).background(Color.accentColor.opacity(0.15), in: Capsule()).foregroundStyle(Color.accentColor) }
                    }
                    Text("\(display.pixelWidth) × \(display.pixelHeight) px · \(display.pointWidth) × \(display.pointHeight) pt @\(Int(display.scale))x · \(display.refreshRate) Hz")
                        .font(.caption).foregroundStyle(.secondary)
                }
                .padding(.vertical, 2)
            }
            if !engine.peripherals.isEmpty {
                Divider().padding(.vertical, 4)
                SectionHeader(title: "Bluetooth devices", systemImage: "wave.3.right")
                ForEach(engine.peripherals) { device in
                    KeyValueRow(key: device.name, value: "\(device.percent)% battery")
                }
            }
        }
        .card()
    }

    private var securityCard: some View {
        VStack(alignment: .leading, spacing: 4) {
            SectionHeader(title: "Security & backups", systemImage: "lock.shield")
            statusRow("FileVault", system.fileVaultEnabled, on: "Encrypted", off: "Not encrypted")
            statusRow("Firewall", system.firewallEnabled, on: "On", off: "Off")
            statusRow("System Integrity Protection", system.sipEnabled, on: "Enabled", off: "Disabled")
            statusRow("Time Machine", system.timeMachineConfigured, on: system.lastTimeMachineBackup.map { "Last backup \(Format.relative($0))" } ?? "Configured", off: "Not configured")
            if let smart = system.smartStatus { statusRow("S.M.A.R.T.", smart == "Verified" || smart == "Not Supported", on: smart, off: smart) }
        }
        .card()
    }

    private func statusRow(_ title: String, _ value: Bool?, on: String, off: String) -> some View {
        HStack {
            Text(title).foregroundStyle(.secondary)
            Spacer()
            if let value {
                Label(value ? on : off, systemImage: value ? "checkmark.circle.fill" : "exclamationmark.triangle.fill")
                    .foregroundStyle(value ? Theme.good : Theme.warning)
            } else {
                Text("Checking…").foregroundStyle(.tertiary)
            }
        }
        .font(.callout)
        .padding(.vertical, 2)
    }

    private var report: String {
        var lines: [String] = []
        lines.append("Vigil system report — \(Format.dateTime(Date()))")
        lines.append("Model: \(system.modelName) (\(system.modelIdentifier))")
        lines.append("Chip: \(system.chip), \(system.physicalCores) cores, \(Format.memory(system.memoryBytes)) memory")
        lines.append("macOS: \(system.osName) \(system.osVersion) (\(system.osBuild)), uptime \(Format.duration(system.uptime))")
        lines.append("Serial: \(system.serialNumber)")
        if let root = engine.disk.root { lines.append("Disk: \(Format.bytes(root.available)) free of \(Format.bytes(root.total)); SMART \(system.smartStatus ?? "unknown")") }
        lines.append("Memory: \(Format.memory(engine.memory.used)) used, pressure \(engine.memory.pressure.title), swap \(Format.memory(engine.memory.swapUsed))")
        if engine.battery.isPresent { lines.append("Battery: \(Int(engine.battery.percent))%, health \(Int(engine.battery.healthPercent))%, \(engine.battery.cycleCount) cycles, \(engine.battery.condition)") }
        lines.append("Thermal: \(engine.sensors.thermalState.title)" + (engine.sensors.cpuTemperature.map { ", CPU \(Int($0))°C" } ?? ""))
        lines.append("Security: FileVault \(flag(system.fileVaultEnabled)), Firewall \(flag(system.firewallEnabled)), SIP \(flag(system.sipEnabled))")
        lines.append("Time Machine: \(system.lastTimeMachineBackup.map { Format.dateTime($0) } ?? (system.timeMachineConfigured == false ? "not configured" : "unknown"))")
        lines.append("Health score: \(engine.health.score) (\(engine.health.grade))")
        for finding in engine.health.findings where finding.severity > .good { lines.append("  - [\(finding.severity.title)] \(finding.title)") }
        lines.append("Top processes:")
        for process in engine.processes.prefix(10) { lines.append(String(format: "  %5.1f%%  %@  %@", process.cpuPercent, Format.memory(process.memoryBytes), process.name)) }
        return lines.joined(separator: "\n")
    }

    private func flag(_ value: Bool?) -> String { value.map { $0 ? "on" : "off" } ?? "unknown" }
}
