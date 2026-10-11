import SwiftUI

struct StartupView: View {
    @Environment(AppState.self) private var state
    @Environment(LicenseManager.self) private var license
    @State private var loading = false
    @State private var errorMessage: String?
    @State private var loginItemsRequested = false

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: Theme.gridSpacing) {
                HStack(alignment: .top) {
                    PageHeader(title: "Startup Items", subtitle: "Everything that starts without asking. \(state.startupItemCount) items from apps, plus Apple's own.")
                    if loading { ProgressView().controlSize(.small) }
                    Button("Reload") { Task { await reload(loginItems: loginItemsRequested) } }
                }
                if !license.isPro { ProLockedBanner(feature: "Disabling startup items") }
                loginItemsCard
                ForEach([StartupItem.Kind.userAgent, .globalAgent, .daemon], id: \.rawValue) { kind in
                    agentsCard(kind)
                }
                explainer
            }
            .padding(20)
        }
        .task { if state.startupItemsLoadedAt == nil { await reload(loginItems: false) } }
        .alert("Couldn't change startup item", isPresented: Binding(get: { errorMessage != nil }, set: { if !$0 { errorMessage = nil } })) {
            Button("OK") { errorMessage = nil }
        } message: { Text(errorMessage ?? "") }
        .accessibilityIdentifier("page.startup")
    }

    private func reload(loginItems: Bool) async {
        loading = true
        await state.reloadStartupItems(includeLoginItems: loginItems)
        loading = false
    }

    private var loginItemsCard: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                SectionHeader(title: StartupItem.Kind.loginItem.rawValue + "s", subtitle: StartupItem.Kind.loginItem.explanation, systemImage: "person.crop.circle")
                Button("System Settings") { Permissions.openSystemSettings("x-apple.systempreferences:com.apple.LoginItems-Settings.extension") }
            }
            if !loginItemsRequested {
                HStack {
                    Text("Reading login items asks macOS for permission to control System Events.").font(.caption).foregroundStyle(.secondary)
                    Button("Load login items") { loginItemsRequested = true; Task { await reload(loginItems: true) } }
                }
            } else if state.loginItems.isEmpty {
                Text("No login items, or permission was declined. You can manage them in System Settings → General → Login Items.").font(.caption).foregroundStyle(.secondary)
            }
            ForEach(state.loginItems) { item in
                HStack(spacing: 10) {
                    if let path = item.path {
                        Image(nsImage: NSWorkspace.shared.icon(forFile: path.path)).resizable().frame(width: 20, height: 20)
                    }
                    VStack(alignment: .leading, spacing: 1) {
                        Text(item.name).font(.callout.weight(.medium))
                        Text(item.program ?? "").font(.caption2).foregroundStyle(.secondary).lineLimit(1)
                    }
                    Spacer()
                    Text(item.vendor).font(.caption).foregroundStyle(.secondary)
                    Button("Remove") {
                        do {
                            try StartupItemsService.removeLoginItem(item)
                            state.history.record(.toolbox, title: "Removed login item \(item.name)")
                            Task { await reload(loginItems: true) }
                        } catch { errorMessage = error.localizedDescription }
                    }
                    .disabled(!license.isPro)
                }
                .padding(.vertical, 3)
            }
        }
        .card()
    }

    private func agentsCard(_ kind: StartupItem.Kind) -> some View {
        let items = state.startupItems.filter { $0.kind == kind }
        return VStack(alignment: .leading, spacing: 8) {
            SectionHeader(title: kind.rawValue, subtitle: kind.explanation, systemImage: kind == .daemon ? "lock.shield" : "gearshape.2")
            if items.isEmpty { Text("None.").font(.caption).foregroundStyle(.secondary) }
            ForEach(items) { item in
                HStack(spacing: 10) {
                    Circle().fill(item.isDisabled ? Color.secondary.opacity(0.3) : item.isLoaded ? Theme.good : Theme.warning).frame(width: 8, height: 8)
                        .help(item.isDisabled ? "Disabled" : item.isLoaded ? "Loaded" : "Not loaded")
                    VStack(alignment: .leading, spacing: 1) {
                        HStack(spacing: 6) {
                            Text(item.name).font(.callout.weight(.medium))
                            if item.isApple { Text("Apple").font(.caption2).foregroundStyle(.secondary) }
                            if item.keepAlive { Text("keeps running").font(.caption2).padding(.horizontal, 4).background(Color.primary.opacity(0.06), in: Capsule()).foregroundStyle(.secondary) }
                            if item.runAtLoad { Text("at login").font(.caption2).padding(.horizontal, 4).background(Color.primary.opacity(0.06), in: Capsule()).foregroundStyle(.secondary) }
                        }
                        Text(item.label).font(.caption2.monospaced()).foregroundStyle(.secondary).lineLimit(1)
                        if let program = item.program { Text(program).font(.caption2).foregroundStyle(.tertiary).lineLimit(1) }
                    }
                    Spacer()
                    Text(item.vendor).font(.caption).foregroundStyle(.secondary)
                    Button { StartupItemsService.reveal(item) } label: { Image(systemName: "folder") }.buttonStyle(.borderless).help("Reveal in Finder")
                    if item.canToggle {
                        Toggle("", isOn: Binding(get: { !item.isDisabled }, set: { enabled in toggle(item, enabled: enabled) }))
                            .toggleStyle(.switch).labelsHidden().controlSize(.small)
                            .disabled(!license.isPro)
                    }
                }
                .padding(.vertical, 3)
            }
        }
        .card()
    }

    private func toggle(_ item: StartupItem, enabled: Bool) {
        Task {
            do {
                try await Task.detached { try StartupItemsService.setEnabled(item, enabled: enabled) }.value
                state.history.record(.toolbox, title: "\(enabled ? "Enabled" : "Disabled") \(item.name)", detail: item.label)
                await reload(loginItems: loginItemsRequested)
            } catch {
                errorMessage = error.localizedDescription
            }
        }
    }

    private var explainer: some View {
        VStack(alignment: .leading, spacing: 6) {
            SectionHeader(title: "Should I disable things?", systemImage: "questionmark.circle")
            Text("Green means loaded and running, amber means installed but not currently loaded. Apple's own agents are part of macOS and are best left alone. For third-party agents: if you don't recognise the vendor or no longer use the app, disable it. Disabling is reversible here; the app may re-enable its helper the next time it runs.")
                .font(.callout).foregroundStyle(.secondary).fixedSize(horizontal: false, vertical: true)
        }
        .card()
    }
}
