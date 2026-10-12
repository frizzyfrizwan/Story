import SwiftUI

/// Hidden macOS settings. Values are read live from the preference domains and written back through CFPreferences.
struct TweaksView: View {
    @Environment(AppState.self) private var state
    @Environment(LicenseManager.self) private var license
    @State private var values: [String: TweakValue] = [:]
    @State private var modified: Set<String> = []
    @State private var search = ""
    @State private var category: Tweak.Category? = nil

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: Theme.gridSpacing) {
                HStack(alignment: .top) {
                    PageHeader(title: "Tweaks", subtitle: "Settings macOS has but does not show. Every change can be reset to Apple's default.")
                    TextField("Search tweaks", text: $search).textFieldStyle(.roundedBorder).frame(width: 220)
                }
                if !license.isPro { ProLockedBanner(feature: "Changing tweaks") }
                HStack(spacing: 8) {
                    chip("All", selected: category == nil) { category = nil }
                    ForEach(Tweak.Category.allCases) { item in
                        chip(item.rawValue, symbol: item.symbol, selected: category == item) { category = item }
                    }
                }
                ForEach(Tweak.Category.allCases) { item in
                    let tweaks = visible(in: item)
                    if !tweaks.isEmpty {
                        VStack(alignment: .leading, spacing: 4) {
                            SectionHeader(title: item.rawValue, systemImage: item.symbol)
                            ForEach(tweaks) { tweak in
                                row(tweak)
                                if tweak.id != tweaks.last?.id { Divider().opacity(0.5) }
                            }
                        }
                        .card()
                    }
                }
                Text("Finder, Dock and the menu bar are relaunched automatically when a tweak needs it. Tweaks marked \"log out\" take effect after you log out and back in.")
                    .font(.caption).foregroundStyle(.secondary)
            }
            .padding(20)
        }
        .task { reload() }
        .accessibilityIdentifier("page.tweaks")
    }

    private func reload() {
        var loaded: [String: TweakValue] = [:]
        var changed: Set<String> = []
        for tweak in TweakCatalog.all {
            loaded[tweak.id] = TweaksService.current(tweak)
            if TweaksService.isModified(tweak) { changed.insert(tweak.id) }
        }
        values = loaded
        modified = changed
    }

    private func visible(in item: Tweak.Category) -> [Tweak] {
        guard category == nil || category == item else { return [] }
        let tweaks = TweakCatalog.tweaks(in: item)
        guard !search.isEmpty else { return tweaks }
        return tweaks.filter { $0.title.localizedCaseInsensitiveContains(search) || $0.detail.localizedCaseInsensitiveContains(search) || $0.key.localizedCaseInsensitiveContains(search) }
    }

    private func chip(_ title: String, symbol: String? = nil, selected: Bool, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            HStack(spacing: 4) {
                if let symbol { Image(systemName: symbol).font(.caption) }
                Text(title).font(.caption)
            }
            .padding(.horizontal, 10).padding(.vertical, 5)
            .background(selected ? Color.accentColor.opacity(0.2) : Color.primary.opacity(0.06), in: Capsule())
        }
        .buttonStyle(.plain)
    }

    private func apply(_ tweak: Tweak, _ value: TweakValue) {
        guard license.isPro else { state.toast("Tweaks need Vigil Pro. Start the trial or enter a licence in Settings."); return }
        TweaksService.apply(tweak, value: value)
        values[tweak.id] = value
        modified.insert(tweak.id)
        state.history.record(.tweak, title: "\(tweak.title) → \(value.description)", detail: "\(tweak.domain) \(tweak.key)")
        if tweak.restart == .logout { state.toast("Takes effect after you log out and back in.") }
    }

    private func reset(_ tweak: Tweak) {
        guard license.isPro else { return }
        TweaksService.reset(tweak)
        values[tweak.id] = tweak.defaultValue
        modified.remove(tweak.id)
        state.history.record(.tweak, title: "\(tweak.title) reset to default", detail: "\(tweak.domain) \(tweak.key)")
    }

    private func row(_ tweak: Tweak) -> some View {
        let current = values[tweak.id] ?? tweak.defaultValue
        return HStack(alignment: .center, spacing: 12) {
            VStack(alignment: .leading, spacing: 2) {
                HStack(spacing: 6) {
                    Text(tweak.title).font(.callout.weight(.medium))
                    if modified.contains(tweak.id) {
                        Text("changed").font(.caption2).padding(.horizontal, 5).background(Color.accentColor.opacity(0.15), in: Capsule()).foregroundStyle(Color.accentColor)
                    }
                    if tweak.restart == .logout {
                        Text("log out").font(.caption2).padding(.horizontal, 5).background(Color.primary.opacity(0.06), in: Capsule()).foregroundStyle(.secondary)
                    }
                }
                Text(tweak.detail).font(.caption).foregroundStyle(.secondary).fixedSize(horizontal: false, vertical: true)
                Text("defaults write \(tweak.domain) \(tweak.key)").font(.caption2.monospaced()).foregroundStyle(.tertiary)
            }
            Spacer()
            control(tweak, current: current)
            Button { reset(tweak) } label: { Image(systemName: "arrow.uturn.backward") }
                .buttonStyle(.borderless)
                .help("Reset to macOS default")
                .disabled(!modified.contains(tweak.id) || !license.isPro)
        }
        .padding(.vertical, 6)
    }

    @ViewBuilder
    private func control(_ tweak: Tweak, current: TweakValue) -> some View {
        switch tweak.kind {
        case .toggle(let on, let off):
            Toggle("", isOn: Binding(get: { current.matches(on) }, set: { apply(tweak, $0 ? on : off) }))
                .toggleStyle(.switch).labelsHidden().controlSize(.small)
        case .choice(let options):
            Picker("", selection: Binding<Int>(
                get: { options.firstIndex(where: { current.matches($0.value) }) ?? options.firstIndex(where: { tweak.defaultValue.matches($0.value) }) ?? 0 },
                set: { index in apply(tweak, options[index].value) })) {
                ForEach(0..<options.count, id: \.self) { index in
                    Text(options[index].label).tag(index)
                }
            }
            .labelsHidden()
            .frame(width: 180)
        case .number(let range, let step):
            HStack(spacing: 8) {
                Slider(value: Binding(get: { current.doubleValue ?? range.lowerBound }, set: { newValue in
                    let snapped = (newValue / step).rounded() * step
                    switch tweak.defaultValue {
                    case .int: apply(tweak, .int(Int(snapped)))
                    default: apply(tweak, .double((snapped * 1000).rounded() / 1000))
                    }
                }), in: range, step: step)
                .frame(width: 140)
                Text(current.description).font(.callout.monospacedDigit()).frame(width: 44, alignment: .trailing)
            }
        }
    }
}
