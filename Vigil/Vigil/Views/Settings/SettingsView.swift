import SwiftUI
import ServiceManagement

struct SettingsView: View {
    var body: some View {
        TabView {
            GeneralSettings().tabItem { Label("General", systemImage: "gearshape") }
            MenuBarSettings().tabItem { Label("Menu Bar", systemImage: "menubar.rectangle") }
            AlertSettings().tabItem { Label("Alerts", systemImage: "bell") }
            PermissionsSettings().tabItem { Label("Permissions", systemImage: "lock.shield") }
            PrivacySettings().tabItem { Label("Privacy & Data", systemImage: "hand.raised") }
            LicenseSettings().tabItem { Label("Licence", systemImage: "key") }
        }
        .frame(width: 560)
        .padding(.bottom, 8)
    }
}

struct GeneralSettings: View {
    @Environment(AppSettings.self) private var settings
    @Environment(MetricsEngine.self) private var engine
    @State private var launchAtLogin = false
    @State private var diagnosticsMessage: String?

    var body: some View {
        @Bindable var settings = settings
        Form {
            Toggle("Launch at login", isOn: $launchAtLogin)
                .onChange(of: launchAtLogin) { _, newValue in settings.launchAtLogin = newValue }
            Toggle("Show icon in the Dock", isOn: $settings.showDockIcon)
            Text("With the Dock icon hidden Vigil lives only in the menu bar. ⌘D in the menu bar popover opens the dashboard.")
                .font(.caption).foregroundStyle(.secondary)
            Divider()
            Picker("Refresh every", selection: $settings.refreshInterval) {
                Text("1 second").tag(1.0)
                Text("2 seconds").tag(2.0)
                Text("3 seconds").tag(3.0)
                Text("5 seconds").tag(5.0)
            }
            LabeledContent("Sampling cost") {
                Text(String(format: "%.1f%% of one core", engine.samplingCostPercent)).monospacedDigit()
            }
            Text("Vigil is designed to stay under 1% average CPU. Longer intervals cost less battery.").font(.caption).foregroundStyle(.secondary)
            Divider()
            Picker("Temperature unit", selection: $settings.temperatureUnit) {
                ForEach(TemperatureUnit.allCases) { unit in Text(unit.title).tag(unit) }
            }
            Divider()
            LabeledContent("Diagnostics") {
                Button("Save report to Desktop") {
                    if let url = Diagnostics.export(engine: engine, settings: settings) {
                        diagnosticsMessage = "Saved \(url.lastPathComponent) to the Desktop and copied it to the clipboard."
                        NSWorkspace.shared.activateFileViewerSelecting([url])
                    } else {
                        diagnosticsMessage = "Could not write the report; it is on the clipboard."
                    }
                }
            }
            Text(diagnosticsMessage ?? "Every raw sensor, battery, GPU and network reading, for validating Vigil on your hardware. Contains your Mac's serial number; nothing else personal.")
                .font(.caption).foregroundStyle(.secondary)
        }
        .formStyle(.grouped)
        .onAppear { launchAtLogin = settings.launchAtLogin }
        .padding(.vertical, 8)
    }
}

struct MenuBarSettings: View {
    @Environment(AppSettings.self) private var settings
    @Environment(MetricsEngine.self) private var engine

    var body: some View {
        @Bindable var settings = settings
        Form {
            Picker("Show in the menu bar", selection: $settings.menuBarStyle) {
                ForEach(MenuBarStyle.allCases) { style in Text(style.title).tag(style) }
            }
            .pickerStyle(.radioGroup)
            LabeledContent("Preview") {
                Image(nsImage: MenuBarRenderer.image(style: settings.menuBarStyle, cpu: engine.cpu.total, memoryPressure: engine.memory.pressurePercent,
                                                     temperature: engine.sensors.cpuTemperature, netIn: engine.network.inBytesPerSecond, netOut: engine.network.outBytesPerSecond,
                                                     battery: engine.battery, recentCPU: engine.recent.suffix(15).map(\.cpu), unit: settings.temperatureUnit))
                    .padding(6)
                    .background(Color.primary.opacity(0.08), in: RoundedRectangle(cornerRadius: 6))
            }
            Divider()
            Toggle("Show top processes in the popover", isOn: $settings.menuBarShowsProcesses)
        }
        .formStyle(.grouped)
        .padding(.vertical, 8)
    }
}

struct AlertSettings: View {
    @Environment(AppSettings.self) private var settings
    @Environment(AppState.self) private var state
    @State private var authorized: Bool?

    var body: some View {
        @Bindable var settings = settings
        Form {
            Toggle("Send notifications", isOn: $settings.alertsEnabled)
            if authorized == false {
                HStack {
                    Text("Notifications are turned off for Vigil in System Settings.").font(.caption).foregroundStyle(.secondary)
                    Button("Open") { Permissions.open(.notifications) }
                }
            } else if authorized == nil {
                Button("Allow notifications") { Task { _ = await state.notifications.requestAuthorization(); await refresh() } }
            }
            Divider()
            LabeledContent("Startup disk below") {
                HStack { Slider(value: $settings.alertDiskFreePercent, in: 3...25, step: 1).frame(width: 160); Text("\(Int(settings.alertDiskFreePercent))% free").monospacedDigit() }
            }
            LabeledContent("CPU hotter than") {
                HStack { Slider(value: $settings.alertCPUTemperature, in: 80...110, step: 1).frame(width: 160); Text(Format.temperature(settings.alertCPUTemperature, unit: settings.temperatureUnit)).monospacedDigit() }
            }
            LabeledContent("Battery hotter than") {
                HStack { Slider(value: $settings.alertBatteryTemperature, in: 32...50, step: 1).frame(width: 160); Text(Format.temperature(settings.alertBatteryTemperature, unit: settings.temperatureUnit)).monospacedDigit() }
            }
            Toggle("Memory pressure turns critical", isOn: $settings.alertMemoryPressure)
            Toggle("A process runs away", isOn: $settings.alertRunawayProcess)
            if settings.alertRunawayProcess {
                LabeledContent("Runaway means above") {
                    HStack { Slider(value: $settings.alertRunawayCPUPercent, in: 80...400, step: 10).frame(width: 160); Text("\(Int(settings.alertRunawayCPUPercent))% CPU").monospacedDigit() }
                }
            }
            Text("Each alert fires at most once every 30 minutes.").font(.caption).foregroundStyle(.secondary)
        }
        .formStyle(.grouped)
        .task { await refresh() }
        .padding(.vertical, 8)
    }

    private func refresh() async {
        let status = await Permissions.status(of: .notifications)
        switch status {
        case .granted: authorized = true
        case .denied: authorized = false
        case .unknown: authorized = nil
        }
    }
}

struct PermissionsSettings: View {
    @State private var statuses: [Permissions.Kind: Permissions.Status] = [:]
    @Environment(AppState.self) private var state

    var body: some View {
        Form {
            Text("Vigil monitors everything without special permissions. These unlock extra details and actions.").font(.callout).foregroundStyle(.secondary)
            ForEach(Permissions.Kind.allCases) { kind in
                HStack(alignment: .top, spacing: 12) {
                    Image(systemName: kind.symbol).frame(width: 24).foregroundStyle(Color.accentColor)
                    VStack(alignment: .leading, spacing: 2) {
                        HStack {
                            Text(kind.title).font(.callout.weight(.semibold))
                            statusBadge(statuses[kind] ?? .unknown)
                        }
                        Text(kind.reason).font(.caption).foregroundStyle(.secondary).fixedSize(horizontal: false, vertical: true)
                    }
                    Spacer()
                    Button(buttonTitle(kind)) { request(kind) }
                }
                .padding(.vertical, 4)
            }
            Button("Re-check") { Task { await refresh() } }
        }
        .formStyle(.grouped)
        .task { await refresh() }
        .padding(.vertical, 8)
    }

    private func buttonTitle(_ kind: Permissions.Kind) -> String {
        switch kind {
        case .notifications: return statuses[kind] == .granted ? "Settings" : "Allow"
        case .location: return statuses[kind] == .granted ? "Settings" : "Allow"
        case .accessibility: return statuses[kind] == .granted ? "Settings" : "Allow"
        default: return "Open Settings"
        }
    }

    private func request(_ kind: Permissions.Kind) {
        switch kind {
        case .notifications where statuses[kind] != .granted:
            Task { _ = await state.notifications.requestAuthorization(); await refresh() }
        case .location where statuses[kind] != .granted:
            LocationPermission.shared.request()
        case .accessibility where statuses[kind] != .granted:
            Permissions.requestAccessibility()
        default:
            Permissions.open(kind)
        }
    }

    private func refresh() async {
        var result: [Permissions.Kind: Permissions.Status] = [:]
        for kind in Permissions.Kind.allCases { result[kind] = await Permissions.status(of: kind) }
        statuses = result
    }

    @ViewBuilder
    private func statusBadge(_ status: Permissions.Status) -> some View {
        switch status {
        case .granted: Text("Granted").font(.caption2).padding(.horizontal, 5).background(Theme.good.opacity(0.15), in: Capsule()).foregroundStyle(Theme.good)
        case .denied: Text("Not granted").font(.caption2).padding(.horizontal, 5).background(Theme.warning.opacity(0.15), in: Capsule()).foregroundStyle(Theme.warning)
        case .unknown: Text("Asked when needed").font(.caption2).padding(.horizontal, 5).background(Color.primary.opacity(0.06), in: Capsule()).foregroundStyle(.secondary)
        }
    }
}

struct PrivacySettings: View {
    @Environment(AppSettings.self) private var settings
    @Environment(AppState.self) private var state
    @State private var sampleCount = 0
    @State private var oldest: Date?
    @State private var fileSize: Int64 = 0
    @State private var confirmDelete = false

    var body: some View {
        @Bindable var settings = settings
        Form {
            Text("Nothing leaves your Mac. Vigil has no account, no analytics and no server. History is stored in a local SQLite database you can delete at any time.")
                .font(.callout).foregroundStyle(.secondary)
            Divider()
            Toggle("Look up my public IP address", isOn: $settings.publicIPLookup)
            Text("Off by default. When on, Vigil asks api.ipify.org for your public address every 10 minutes. That request reveals your IP to that service, which is how public IP lookups work.")
                .font(.caption).foregroundStyle(.secondary)
            Divider()
            Picker("Keep history for", selection: $settings.historyRetentionDays) {
                Text("7 days").tag(7)
                Text("30 days").tag(30)
                Text("90 days").tag(90)
                Text("1 year").tag(365)
            }
            LabeledContent("Stored") {
                Text("\(Format.count(sampleCount)) samples · \(Format.bytes(fileSize))" + (oldest.map { " · since \(Format.dateTime($0))" } ?? ""))
                    .font(.callout).foregroundStyle(.secondary)
            }
            HStack {
                Button("Show in Finder") { if let url = state.history.url { NSWorkspace.shared.activateFileViewerSelecting([url]) } }
                Button("Delete all history…", role: .destructive) { confirmDelete = true }
            }
        }
        .formStyle(.grouped)
        .task { await refresh() }
        .confirmationDialog("Delete all recorded history?", isPresented: $confirmDelete, titleVisibility: .visible) {
            Button("Delete", role: .destructive) { state.history.deleteAll(); Task { await refresh() } }
            Button("Cancel", role: .cancel) {}
        }
        .padding(.vertical, 8)
    }

    private func refresh() async {
        let history = state.history
        let (count, first, size) = await Task.detached { (history.sampleCount(), history.oldestSample(), history.fileSize()) }.value
        sampleCount = count
        oldest = first
        fileSize = size
    }
}

struct LicenseSettings: View {
    @Environment(LicenseManager.self) private var license
    @State private var key = ""
    @State private var message: String?
    @State private var isError = false

    var body: some View {
        Form {
            HStack(spacing: 12) {
                Image(systemName: license.isPro ? "checkmark.seal.fill" : "seal").font(.title).foregroundStyle(license.isPro ? Color.accentColor : .secondary)
                VStack(alignment: .leading, spacing: 2) {
                    Text(license.state.title).font(.headline)
                    if case .licensed(let payload) = license.state {
                        Text("Licensed to \(payload.email)" + (payload.expiryDate.map { " · renews \(Format.dateTime($0))" } ?? " · lifetime")).font(.caption).foregroundStyle(.secondary)
                    } else {
                        Text("Pro adds clean-up, tweaks, startup-item control, history beyond 24 hours and the admin tools.").font(.caption).foregroundStyle(.secondary)
                    }
                }
            }
            Divider()
            if case .licensed = license.state {
                Button("Deactivate on this Mac") { license.deactivate(); key = ""; message = nil }
            } else {
                TextField("Licence key (VIGIL-…)", text: $key)
                    .textFieldStyle(.roundedBorder)
                    .font(.body.monospaced())
                HStack {
                    Button("Activate") { activate() }.buttonStyle(.borderedProminent).disabled(key.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
                    Button("Buy Vigil Pro…") { NSWorkspace.shared.open(URL(string: "https://vigil.lemonsqueezy.com")!) }
                    Spacer()
                }
                if let message {
                    Text(message).font(.caption).foregroundStyle(isError ? Theme.critical : Theme.good)
                }
            }
            Divider()
            VStack(alignment: .leading, spacing: 4) {
                Text("What's free forever").font(.callout.weight(.semibold))
                Text("Live monitoring of CPU, memory, disk, network, battery, temperatures and fans; the process explainer; the health score; 24 hours of history; keep awake, keyboard and screen cleaning, and the non-admin toolbox actions.")
                    .font(.caption).foregroundStyle(.secondary).fixedSize(horizontal: false, vertical: true)
            }
        }
        .formStyle(.grouped)
        .padding(.vertical, 8)
    }

    private func activate() {
        do {
            let payload = try license.activate(key)
            message = "Activated. Thank you, \(payload.email)!"
            isError = false
        } catch {
            message = error.localizedDescription
            isError = true
        }
    }
}
