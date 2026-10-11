import SwiftUI

struct DashboardView: View {
    @Environment(AppState.self) private var state
    @Environment(MetricsEngine.self) private var engine
    @Environment(\.openWindow) private var openWindow

    var body: some View {
        @Bindable var state = state
        NavigationSplitView {
            SidebarView(selection: $state.selectedSection)
        } detail: {
            ZStack(alignment: .bottom) {
                detail
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                if let message = state.toastMessage {
                    ToastView(message: message)
                }
            }
            .animation(.easeInOut(duration: 0.25), value: state.toastMessage)
        }
        .navigationTitle(state.selectedSection.title)
        .sheet(isPresented: $state.showOnboarding) {
            OnboardingView()
        }
        .onAppear { state.openWindowAction = openWindow }
    }

    @ViewBuilder
    private var detail: some View {
        switch state.selectedSection {
        case .overview: OverviewView()
        case .health: HealthView()
        case .activity: ActivityView()
        case .cpu: CPUView()
        case .memory: MemoryView()
        case .storage: StorageView()
        case .network: NetworkView()
        case .power: PowerView()
        case .sensors: SensorsView()
        case .history: HistoryView()
        case .startup: StartupView()
        case .toolbox: ToolboxView()
        case .tweaks: TweaksView()
        case .system: SystemInfoView()
        }
    }
}

struct SidebarView: View {
    @Binding var selection: DashboardSection
    @Environment(MetricsEngine.self) private var engine
    @Environment(LicenseManager.self) private var license

    var body: some View {
        List(selection: $selection) {
            SwiftUI.Section("Monitor") {
                ForEach(DashboardSection.monitorSections) { section in
                    row(section)
                }
            }
            SwiftUI.Section("Tools") {
                ForEach(DashboardSection.toolSections) { section in
                    row(section)
                }
            }
        }
        .listStyle(.sidebar)
        .navigationSplitViewColumnWidth(min: 200, ideal: 220, max: 260)
        .safeAreaInset(edge: .bottom) {
            VStack(alignment: .leading, spacing: 4) {
                Divider()
                HStack {
                    Image(systemName: license.isPro ? "checkmark.seal.fill" : "seal").foregroundStyle(license.isPro ? Color.accentColor : .secondary)
                    Text(license.state.title).font(.caption)
                    Spacer()
                }
                .padding(.horizontal, 12)
                .padding(.vertical, 8)
            }
        }
    }

    private func row(_ section: DashboardSection) -> some View {
        NavigationLink(value: section) {
            Label {
                HStack {
                    Text(section.title)
                    Spacer()
                    badge(for: section)
                }
            } icon: {
                Image(systemName: section.symbol)
            }
        }
        .accessibilityIdentifier("sidebar.\(section.rawValue)")
    }

    @ViewBuilder
    private func badge(for section: DashboardSection) -> some View {
        switch section {
        case .health:
            let worst = engine.health.worst
            if worst >= .warning {
                Circle().fill(worst.color).frame(width: 8, height: 8)
            }
        case .cpu:
            Text(String(format: "%.0f%%", engine.cpu.total)).font(.caption2.monospacedDigit()).foregroundStyle(.secondary)
        case .memory:
            if engine.memory.pressure != .normal {
                Circle().fill(engine.memory.pressure == .critical ? Theme.critical : Theme.warning).frame(width: 8, height: 8)
            }
        case .sensors:
            if engine.sensors.thermalState == .serious || engine.sensors.thermalState == .critical {
                Circle().fill(Theme.critical).frame(width: 8, height: 8)
            }
        default:
            EmptyView()
        }
    }
}
