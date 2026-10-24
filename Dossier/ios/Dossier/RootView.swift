import SwiftUI
import Combine

/// Three tabs: the report engine (bundled web app, works offline), the reports you saved, and About.
struct RootView: View {
    @Environment(WebBridge.self) private var bridge
    @Environment(SavedReportsStore.self) private var saved
    @State private var tab: Tab = .dossier

    enum Tab: Hashable { case dossier, saved, about }

    var body: some View {
        TabView(selection: $tab) {
            DossierScreen()
                .tabItem { Label("Dossier", systemImage: "doc.text.magnifyingglass") }
                .tag(Tab.dossier)
            SavedScreen(openInDossier: { report in
                bridge.load(facts: report.factsJSON)
                tab = .dossier
            })
            .tabItem { Label("Saved", systemImage: "bookmark") }
            .tag(Tab.saved)
            .badge(saved.reports.count)
            AboutScreen()
                .tabItem { Label("About", systemImage: "info.circle") }
                .tag(Tab.about)
        }
        .tint(.accentColor)
    }
}

struct DossierScreen: View {
    @Environment(WebBridge.self) private var bridge
    @Environment(SavedReportsStore.self) private var saved
    @State private var shareText: ShareItem?
    @State private var toast: String?

    var body: some View {
        NavigationStack {
            WebView(bridge: bridge)
                .ignoresSafeArea(edges: .bottom)
                .navigationTitle("Dossier")
                .navigationBarTitleDisplayMode(.inline)
                .toolbar {
                    ToolbarItemGroup(placement: .topBarLeading) {
                        Button("Find deals") { bridge.navigate("deals") }
                            .accessibilityIdentifier("findDeals")
                        Button("New report") { bridge.navigate("new") }
                            .accessibilityIdentifier("newReport")
                    }
                    ToolbarItemGroup(placement: .topBarTrailing) {
                        Button { bridge.requestSave() } label: { Image(systemName: "bookmark") }
                            .accessibilityLabel("Save report")
                        Button { bridge.requestShare() } label: { Image(systemName: "square.and.arrow.up") }
                            .accessibilityLabel("Share report")
                    }
                }
                .onReceive(bridge.events) { event in
                    switch event {
                    case .save(let report):
                        saved.upsert(report)
                        toast = "Saved to this device"
                    case .share(let text):
                        shareText = ShareItem(text: text)
                    }
                }
                .sheet(item: $shareText) { item in
                    ShareSheet(items: [item.text])
                }
                .overlay(alignment: .bottom) {
                    if let toast {
                        Text(toast)
                            .font(.subheadline.weight(.semibold))
                            .padding(.horizontal, 16).padding(.vertical, 10)
                            .background(.thinMaterial, in: Capsule())
                            .padding(.bottom, 24)
                            .transition(.move(edge: .bottom).combined(with: .opacity))
                            .task { try? await Task.sleep(for: .seconds(2)); self.toast = nil }
                    }
                }
                .animation(.default, value: toast)
        }
    }
}

/// Wraps text for `.sheet(item:)`.
struct ShareItem: Identifiable {
    let id = UUID()
    let text: String
}

struct SavedScreen: View {
    @Environment(SavedReportsStore.self) private var saved
    var openInDossier: (SavedReport) -> Void
    @State private var shareText: ShareItem?

    var body: some View {
        NavigationStack {
            Group {
                if saved.reports.isEmpty {
                    ContentUnavailableView("No saved reports", systemImage: "bookmark",
                        description: Text("Open a report in the Dossier tab and tap the bookmark to keep it here, offline."))
                } else {
                    List {
                        ForEach(saved.reports) { report in
                            Button { openInDossier(report) } label: {
                                VStack(alignment: .leading, spacing: 4) {
                                    Text(report.title).font(.headline).foregroundStyle(.primary)
                                    HStack(spacing: 8) {
                                        if let price = report.price { Text(price).font(.subheadline.monospacedDigit()) }
                                        Text(report.stance).font(.subheadline).foregroundStyle(stanceColor(report.stance))
                                    }
                                    Text(report.summary).font(.footnote).foregroundStyle(.secondary).lineLimit(3)
                                    Text(report.savedAt, style: .date).font(.caption2).foregroundStyle(.tertiary)
                                }
                            }
                            .swipeActions {
                                Button(role: .destructive) { saved.remove(report) } label: { Label("Delete", systemImage: "trash") }
                                Button { shareText = ShareItem(text: report.shareText) } label: { Label("Share", systemImage: "square.and.arrow.up") }
                            }
                        }
                    }
                }
            }
            .navigationTitle("Saved")
            .sheet(item: $shareText) { ShareSheet(items: [$0.text]) }
        }
    }

    private func stanceColor(_ s: String) -> Color {
        if s.hasPrefix("Reasonable") { return .green }
        if s.hasPrefix("Conditional") { return .orange }
        return .blue
    }
}

struct AboutScreen: View {
    var body: some View {
        NavigationStack {
            List {
                Section {
                    Text("Dossier grades a home on price, cost to own, building, association, hazards, location and resale, then lists what will come up before closing and in years 1 to 3, 3 to 10 and 10 to 30, each with the document that settles it.")
                    Text("Find deals takes your income, cash, household and workplace, works out what you can carry, and ranks a pool of listings that fit.")
                }
                Section("Honesty") {
                    Text("Planning figures (insurance, utilities, growth rates) are estimates and are labeled as such.")
                    Text("An unknown fact never becomes a guess. It becomes a question with who answers it.")
                    Text("Listing data in the pool is a snapshot; verify price and status on the MLS before acting. Dossier is not a lender, an appraiser or a licensed real estate professional.")
                }
                Section("Privacy") {
                    Text("Everything runs on your device. Reports, your profile and your pool stay in the app. Dossier has no account, no analytics and no servers of its own.")
                    Link("Privacy policy", destination: URL(string: "https://frizzyfrizwan.github.io/Story/dossier/privacy.html")!)
                    Link("Support", destination: URL(string: "https://github.com/frizzyfrizwan/Story/issues")!)
                }
                Section("Version") {
                    LabeledContent("Version", value: Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? "")
                    LabeledContent("Build", value: Bundle.main.infoDictionary?["CFBundleVersion"] as? String ?? "")
                }
            }
            .navigationTitle("About")
        }
    }
}
