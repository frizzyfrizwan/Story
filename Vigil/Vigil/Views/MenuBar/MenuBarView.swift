import SwiftUI

/// The image in the menu bar. Re-rendered whenever the chosen metric changes.
struct MenuBarLabel: View {
    @Environment(MetricsEngine.self) private var engine
    @Environment(AppSettings.self) private var settings

    var body: some View {
        let image = MenuBarRenderer.image(style: settings.menuBarStyle,
                                          cpu: engine.cpu.total,
                                          memoryPressure: engine.memory.pressurePercent,
                                          temperature: engine.sensors.cpuTemperature,
                                          netIn: engine.network.inBytesPerSecond,
                                          netOut: engine.network.outBytesPerSecond,
                                          battery: engine.battery,
                                          recentCPU: engine.recent.suffix(15).map(\.cpu),
                                          unit: settings.temperatureUnit)
        Image(nsImage: image)
            .accessibilityLabel("Vigil")
    }
}

/// The popover shown when clicking the menu bar item: the whole Mac at a glance.
struct MenuBarView: View {
    @Environment(AppState.self) private var state
    @Environment(MetricsEngine.self) private var engine
    @Environment(AppSettings.self) private var settings
    @Environment(LicenseManager.self) private var license
    @Environment(KeepAwake.self) private var keepAwake
    @Environment(\.openWindow) private var openWindow
    @Environment(\.openSettings) private var openSettings

    var body: some View {
        VStack(spacing: 12) {
            header
            tiles
            if settings.menuBarShowsProcesses { topProcesses }
            if engine.battery.isPresent { batteryRow }
            quickActions
            footer
        }
        .padding(14)
        .frame(width: 360)
        .onAppear { state.openWindowAction = openWindow }
    }

    private var header: some View {
        HStack(spacing: 10) {
            ZStack {
                Circle().stroke(Color.primary.opacity(0.08), lineWidth: 4)
                Circle().trim(from: 0, to: CGFloat(engine.health.score) / 100)
                    .stroke(engine.health.color, style: StrokeStyle(lineWidth: 4, lineCap: .round))
                    .rotationEffect(.degrees(-90))
                Text("\(engine.health.score)").font(.system(size: 13, weight: .bold, design: .rounded))
            }
            .frame(width: 40, height: 40)
            VStack(alignment: .leading, spacing: 1) {
                Text("Mac health: \(engine.health.grade)").font(.headline)
                Text(headline).font(.caption).foregroundStyle(.secondary).lineLimit(1)
            }
            Spacer()
            Button {
                state.selectedSection = .health
                openDashboard()
            } label: { Image(systemName: "chevron.right.circle") }
                .buttonStyle(.borderless)
                .help("Open Health")
        }
    }

    private var headline: String {
        if let worst = engine.health.findings.first(where: { $0.severity >= .warning }) { return worst.title }
        if let top = engine.processes.first, top.cpuPercent > 30 { return "\(top.name) is using \(Int(top.cpuPercent))% CPU" }
        return "Everything looks fine · up \(Format.duration(engine.system.uptime))"
    }

    private var tiles: some View {
        LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 8) {
            miniTile("CPU", value: Format.percentValue(engine.cpu.total), color: Theme.cpu, values: engine.recent.map(\.cpu), maximum: 100, section: .cpu)
            miniTile("Memory", value: engine.memory.pressure.title, detail: Format.memory(engine.memory.used), color: Theme.memory,
                     values: engine.recent.map { Double($0.memoryUsed) / Double(max(1, engine.memory.total)) * 100 }, maximum: 100, section: .memory)
            miniTile("Disk", value: engine.disk.root.map { Format.bytes($0.available) + " free" } ?? "—",
                     detail: "↓ \(Format.rate(engine.disk.readBytesPerSecond))  ↑ \(Format.rate(engine.disk.writeBytesPerSecond))", color: Theme.disk,
                     values: engine.recent.map { $0.diskRead + $0.diskWrite }, maximum: nil, section: .storage)
            miniTile("Network", value: "↓ \(Format.rate(engine.network.inBytesPerSecond))", detail: "↑ \(Format.rate(engine.network.outBytesPerSecond))", color: Theme.network,
                     values: engine.recent.map { $0.networkIn + $0.networkOut }, maximum: nil, section: .network)
            if engine.sensors.smcAvailable, let temperature = engine.sensors.cpuTemperature {
                miniTile("Temperature", value: Format.temperature(temperature, unit: settings.temperatureUnit),
                         detail: engine.sensors.fans.first.map { Format.rpm($0.rpm) } ?? engine.sensors.thermalState.title, color: Theme.thermal,
                         values: engine.recent.map(\.temperature), maximum: 110, section: .sensors)
            }
            if let gpu = engine.gpu {
                miniTile("GPU", value: Format.percentValue(gpu.utilization), color: Theme.gpu, values: engine.recent.map(\.gpu), maximum: 100, section: .cpu)
            }
        }
    }

    private func miniTile(_ title: String, value: String, detail: String? = nil, color: Color, values: [Double], maximum: Double?, section: DashboardSection) -> some View {
        Button {
            state.selectedSection = section
            openDashboard()
        } label: {
            VStack(alignment: .leading, spacing: 3) {
                Text(title).font(.caption).foregroundStyle(.secondary)
                Text(value).font(.system(size: 15, weight: .semibold, design: .rounded).monospacedDigit()).lineLimit(1)
                if let detail { Text(detail).font(.caption2).foregroundStyle(.secondary).lineLimit(1) }
                Sparkline(values: Array(values.suffix(60)), color: color, maximum: maximum).frame(height: 18)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(10)
            .background(Color.primary.opacity(0.05), in: RoundedRectangle(cornerRadius: 10, style: .continuous))
        }
        .buttonStyle(.plain)
    }

    private var topProcesses: some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack {
                Text("Using your Mac right now").font(.caption.weight(.semibold)).foregroundStyle(.secondary)
                Spacer()
                Button("All") { state.selectedSection = .activity; openDashboard() }.buttonStyle(.borderless).font(.caption)
            }
            ForEach(engine.processes.prefix(5)) { process in
                ProcessRow(process: process, icon: engine.icon(for: process))
                    .font(.callout)
            }
        }
    }

    private var batteryRow: some View {
        let battery = engine.battery
        return HStack(spacing: 8) {
            Image(systemName: battery.isCharging ? "battery.100percent.bolt" : "battery.75percent").foregroundStyle(Theme.battery)
            Text("\(Int(battery.percent))%").font(.callout.weight(.semibold).monospacedDigit())
            Text(battery.stateDescription).font(.caption).foregroundStyle(.secondary)
            Spacer()
            if let minutes = battery.timeRemainingMinutes {
                Text(battery.isCharging ? "\(Format.minutes(minutes)) to full" : "\(Format.minutes(minutes)) left").font(.caption).foregroundStyle(.secondary)
            }
            Text("\(battery.healthPercentRounded)% health").font(.caption).foregroundStyle(.secondary)
        }
        .padding(.horizontal, 2)
    }

    private var quickActions: some View {
        HStack(spacing: 6) {
            quickAction("Keep awake", symbol: keepAwake.isActive ? "cup.and.saucer.fill" : "cup.and.saucer", active: keepAwake.isActive) {
                state.runToolbox(Toolbox.action(id: "keepAwake")!)
            }
            quickAction("Clean keys", symbol: "keyboard") { state.runToolbox(Toolbox.action(id: "keyboardClean")!) }
            quickAction("Free memory", symbol: "memorychip") { state.runToolbox(Toolbox.action(id: "purge")!) }
            quickAction("Flush DNS", symbol: "arrow.triangle.2.circlepath") { state.runToolbox(Toolbox.action(id: "flushDNS")!) }
        }
    }

    private func quickAction(_ title: String, symbol: String, active: Bool = false, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            VStack(spacing: 4) {
                Image(systemName: symbol).font(.system(size: 15))
                Text(title).font(.caption2)
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, 8)
            .background(active ? Color.accentColor.opacity(0.2) : Color.primary.opacity(0.05), in: RoundedRectangle(cornerRadius: 8, style: .continuous))
        }
        .buttonStyle(.plain)
    }

    private var footer: some View {
        HStack {
            Button("Open Dashboard") { state.selectedSection = .overview; openDashboard() }
                .keyboardShortcut("d", modifiers: [.command])
            Spacer()
            if let message = state.toastMessage { Text(message).font(.caption).foregroundStyle(.secondary).lineLimit(1) }
            Button { openSettings() } label: { Image(systemName: "gearshape") }.buttonStyle(.borderless).help("Settings")
            Button { NSApp.terminate(nil) } label: { Image(systemName: "power") }.buttonStyle(.borderless).help("Quit Vigil")
        }
        .font(.callout)
    }

    private func openDashboard() {
        state.openWindowAction = openWindow
        state.openDashboard()
    }
}
