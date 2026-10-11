import SwiftUI

struct OverviewView: View {
    @Environment(AppState.self) private var state
    @Environment(MetricsEngine.self) private var engine
    @Environment(AppSettings.self) private var settings

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: Theme.gridSpacing) {
                PageHeader(title: engine.system.modelName,
                           subtitle: "\(engine.system.osName) \(engine.system.osVersion) · up \(Format.duration(engine.system.uptime)) · \(engine.processes.count) processes")
                HStack(alignment: .top, spacing: Theme.gridSpacing) {
                    healthCard
                    VStack(spacing: Theme.gridSpacing) {
                        HStack(spacing: Theme.gridSpacing) {
                            StatTile(title: "CPU", value: Format.percentValue(engine.cpu.total),
                                     detail: engine.processes.first.map { "\($0.name) \(Int($0.cpuPercent))%" } ?? "", color: Theme.cpu,
                                     sparkline: engine.recent.map(\.cpu), systemImage: "cpu")
                            StatTile(title: "Memory", value: engine.memory.pressure.title,
                                     detail: "\(Format.memory(engine.memory.used)) of \(Format.memory(engine.memory.total)) used", color: Theme.memory,
                                     fraction: engine.memory.usedFraction, systemImage: "memorychip")
                        }
                        HStack(spacing: Theme.gridSpacing) {
                            StatTile(title: "Storage", value: engine.disk.root.map { Format.bytes($0.available) } ?? "—",
                                     detail: engine.disk.root.map { "free of \(Format.bytes($0.total))" } ?? "", color: engine.disk.root.map { Theme.severity($0.usedFraction, warn: 0.85, critical: 0.95) } ?? Theme.disk,
                                     fraction: engine.disk.root?.usedFraction, systemImage: "internaldrive")
                            StatTile(title: "Network", value: Format.rate(engine.network.inBytesPerSecond),
                                     detail: "↑ \(Format.rate(engine.network.outBytesPerSecond)) · \(engine.network.wifi?.ssid ?? engine.network.localIP ?? "offline")", color: Theme.network,
                                     sparkline: engine.recent.map { $0.networkIn + $0.networkOut }, systemImage: "network")
                        }
                    }
                }
                HStack(alignment: .top, spacing: Theme.gridSpacing) {
                    processesCard
                    VStack(spacing: Theme.gridSpacing) {
                        if engine.battery.isPresent { batteryCard }
                        thermalCard
                    }
                    .frame(width: 320)
                }
                quickActions
            }
            .padding(20)
        }
        .accessibilityIdentifier("page.overview")
    }

    private var healthCard: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                SectionHeader(title: "Health score", systemImage: "heart.text.square")
                Spacer()
                Button("Details") { state.selectedSection = .health }.buttonStyle(.borderless)
            }
            HStack(spacing: 16) {
                RingGauge(fraction: Double(engine.health.score) / 100, color: engine.health.color, lineWidth: 12,
                          label: "\(engine.health.score)", caption: engine.health.grade)
                    .frame(width: 120, height: 120)
                VStack(alignment: .leading, spacing: 6) {
                    ForEach(engine.health.findings.filter { $0.severity > .good }.prefix(3)) { finding in
                        HStack(alignment: .top, spacing: 6) {
                            Image(systemName: finding.severity.symbol).foregroundStyle(finding.severity.color).font(.caption)
                            Text(finding.title).font(.callout).lineLimit(2)
                        }
                    }
                    if engine.health.findings.allSatisfy({ $0.severity == .good }) {
                        Label("No issues found", systemImage: "checkmark.circle.fill").foregroundStyle(Theme.good).font(.callout)
                    }
                }
                Spacer(minLength: 0)
            }
        }
        .frame(width: 400)
        .card()
    }

    private var processesCard: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                SectionHeader(title: "What's using your Mac", subtitle: "Top by CPU right now", systemImage: "list.bullet.rectangle")
                Spacer()
                Button("All processes") { state.selectedSection = .activity }.buttonStyle(.borderless)
            }
            ForEach(engine.processes.prefix(8)) { process in
                ProcessRow(process: process, icon: engine.icon(for: process))
                Divider().opacity(0.4)
            }
        }
        .card()
    }

    private var batteryCard: some View {
        let battery = engine.battery
        return VStack(alignment: .leading, spacing: 10) {
            HStack {
                SectionHeader(title: "Battery", subtitle: battery.stateDescription, systemImage: battery.isCharging ? "battery.100percent.bolt" : "battery.75percent")
                Spacer()
                Button("Details") { state.selectedSection = .power }.buttonStyle(.borderless)
            }
            HStack(alignment: .lastTextBaseline) {
                Text("\(Int(battery.percent))%").font(.system(size: 30, weight: .semibold, design: .rounded))
                if let minutes = battery.timeRemainingMinutes {
                    Text(battery.isCharging ? "\(Format.minutes(minutes)) to full" : "\(Format.minutes(minutes)) remaining").font(.callout).foregroundStyle(.secondary)
                }
            }
            ProgressBar(fraction: battery.percent / 100, color: battery.percent < 20 ? Theme.critical : Theme.battery)
            HStack {
                Label("\(Int(battery.healthPercent))% health", systemImage: "heart").font(.caption)
                Spacer()
                Label("\(battery.cycleCount) cycles", systemImage: "arrow.triangle.2.circlepath").font(.caption)
                Spacer()
                Label(Format.temperature(battery.temperature, unit: settings.temperatureUnit), systemImage: "thermometer.low").font(.caption)
            }
            .foregroundStyle(.secondary)
        }
        .card()
    }

    private var thermalCard: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack {
                SectionHeader(title: "Thermals", subtitle: engine.sensors.thermalState.title, systemImage: "thermometer.medium")
                Spacer()
                Button("Details") { state.selectedSection = .sensors }.buttonStyle(.borderless)
            }
            HStack(spacing: 18) {
                if let cpu = engine.sensors.cpuTemperature {
                    VStack(alignment: .leading) {
                        Text("CPU").font(.caption).foregroundStyle(.secondary)
                        Text(Format.temperature(cpu, unit: settings.temperatureUnit)).font(.title3.weight(.semibold).monospacedDigit())
                    }
                }
                if let gpu = engine.sensors.gpuTemperature {
                    VStack(alignment: .leading) {
                        Text("GPU").font(.caption).foregroundStyle(.secondary)
                        Text(Format.temperature(gpu, unit: settings.temperatureUnit)).font(.title3.weight(.semibold).monospacedDigit())
                    }
                }
                ForEach(engine.sensors.fans.prefix(2)) { fan in
                    VStack(alignment: .leading) {
                        Text(fan.name).font(.caption).foregroundStyle(.secondary)
                        Text(Format.rpm(fan.rpm)).font(.title3.weight(.semibold).monospacedDigit())
                    }
                }
                if !engine.sensors.smcAvailable {
                    Text("Sensor access unavailable").font(.caption).foregroundStyle(.secondary)
                } else if engine.sensors.fans.isEmpty && engine.sensors.cpuTemperature == nil {
                    Text("Fanless · no sensors exposed").font(.caption).foregroundStyle(.secondary)
                }
                Spacer()
            }
            Text(engine.sensors.thermalState.explanation).font(.caption).foregroundStyle(.secondary)
        }
        .card()
    }

    private var quickActions: some View {
        VStack(alignment: .leading, spacing: 10) {
            SectionHeader(title: "Quick actions", systemImage: "bolt")
            HStack(spacing: 10) {
                ForEach(["keepAwake", "keyboardClean", "screenClean", "purge", "flushDNS", "emptyTrash", "restartFinder"], id: \.self) { id in
                    if let action = Toolbox.action(id: id) {
                        Button {
                            state.runToolbox(action)
                        } label: {
                            VStack(spacing: 6) {
                                Image(systemName: action.symbol).font(.title3)
                                Text(action.title).font(.caption).lineLimit(1)
                            }
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 10)
                        }
                        .buttonStyle(.bordered)
                    }
                }
            }
        }
        .card()
    }
}
