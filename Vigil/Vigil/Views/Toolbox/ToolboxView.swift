import SwiftUI

struct ToolboxView: View {
    @Environment(AppState.self) private var state
    @Environment(KeepAwake.self) private var keepAwake
    @Environment(LicenseManager.self) private var license
    @State private var pendingAction: ToolboxAction?

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: Theme.gridSpacing) {
                PageHeader(title: "Toolbox", subtitle: "One-click fixes and modes. Actions marked with a key ask for your administrator password.")
                keepAwakeCard
                ForEach(ToolboxAction.Category.allCases) { category in
                    let actions = Toolbox.actions.filter { $0.category == category && $0.id != "keepAwake" }
                    if !actions.isEmpty {
                        VStack(alignment: .leading, spacing: 10) {
                            SectionHeader(title: category.rawValue)
                            LazyVGrid(columns: [GridItem(.adaptive(minimum: 230), spacing: 10)], alignment: .leading, spacing: 10) {
                                ForEach(actions) { action in
                                    actionCard(action)
                                }
                            }
                        }
                        .card()
                    }
                }
            }
            .padding(20)
        }
        .confirmationDialog(pendingAction?.title ?? "", isPresented: Binding(get: { pendingAction != nil }, set: { if !$0 { pendingAction = nil } }), titleVisibility: .visible) {
            Button(pendingAction?.title ?? "Run", role: .destructive) { if let action = pendingAction { state.runToolbox(action) }; pendingAction = nil }
            Button("Cancel", role: .cancel) { pendingAction = nil }
        } message: {
            Text(pendingAction?.detail ?? "")
        }
        .accessibilityIdentifier("page.toolbox")
    }

    private var keepAwakeCard: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack {
                SectionHeader(title: "Keep Awake", subtitle: keepAwake.isActive ? (keepAwake.until.map { "On until \(Format.time($0))" } ?? "On until you turn it off") : "Stop the display and the Mac from sleeping", systemImage: keepAwake.isActive ? "cup.and.saucer.fill" : "cup.and.saucer")
                Spacer()
                if keepAwake.isActive {
                    Button("Turn off") { keepAwake.deactivate() }.buttonStyle(.borderedProminent)
                } else {
                    Menu("Turn on") {
                        ForEach(KeepAwake.Duration.allCases) { duration in
                            Button(duration.title) { keepAwake.activate(for: duration) }
                        }
                    }
                    .frame(width: 120)
                }
            }
        }
        .card()
    }

    private func actionCard(_ action: ToolboxAction) -> some View {
        Button {
            if action.isDestructive { pendingAction = action } else { state.runToolbox(action) }
        } label: {
            VStack(alignment: .leading, spacing: 6) {
                HStack {
                    Image(systemName: action.symbol).font(.title3).foregroundStyle(Color.accentColor)
                    Spacer()
                    if action.needsAdmin { Image(systemName: "key").font(.caption).foregroundStyle(.secondary).help("Needs administrator password") }
                    if action.isPro && !license.isPro { ProBadge() }
                }
                Text(action.title).font(.callout.weight(.semibold))
                Text(action.detail).font(.caption).foregroundStyle(.secondary).lineLimit(3).fixedSize(horizontal: false, vertical: true)
            }
            .frame(maxWidth: .infinity, minHeight: 96, alignment: .topLeading)
            .padding(12)
            .background(Color.primary.opacity(0.05), in: RoundedRectangle(cornerRadius: 10, style: .continuous))
        }
        .buttonStyle(.plain)
        .accessibilityIdentifier("toolbox.\(action.id)")
    }
}
