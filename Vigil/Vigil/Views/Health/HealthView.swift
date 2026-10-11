import SwiftUI

struct HealthView: View {
    @Environment(AppState.self) private var state
    @Environment(MetricsEngine.self) private var engine
    @State private var selectedCategory: HealthCategory?

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: Theme.gridSpacing) {
                PageHeader(title: "Health", subtitle: "A score you can act on. Every point lost names a cause and a fix.")
                HStack(alignment: .top, spacing: Theme.gridSpacing) {
                    scoreCard
                    categoriesCard
                }
                findingsList
                longevityCard
            }
            .padding(20)
        }
        .accessibilityIdentifier("page.health")
    }

    private var report: HealthReport { engine.health }

    private var scoreCard: some View {
        VStack(spacing: 12) {
            RingGauge(fraction: Double(report.score) / 100, color: report.color, lineWidth: 14, label: "\(report.score)", caption: report.grade)
                .frame(width: 150, height: 150)
            Text(summary).font(.callout).multilineTextAlignment(.center).foregroundStyle(.secondary)
            Text("Checked \(Format.relative(report.generatedAt))").font(.caption2).foregroundStyle(.tertiary)
        }
        .frame(width: 260)
        .card()
    }

    private var summary: String {
        let critical = report.findings.filter { $0.severity == .critical }.count
        let warnings = report.findings.filter { $0.severity == .warning }.count
        let tips = report.findings.filter { $0.severity == .info }.count
        if critical == 0 && warnings == 0 && tips == 0 { return "Nothing needs your attention. Keep it up." }
        var parts: [String] = []
        if critical > 0 { parts.append("\(critical) critical") }
        if warnings > 0 { parts.append("\(warnings) to fix") }
        if tips > 0 { parts.append("\(tips) tip\(tips == 1 ? "" : "s")") }
        return parts.joined(separator: ", ")
    }

    private var categoriesCard: some View {
        VStack(alignment: .leading, spacing: 10) {
            SectionHeader(title: "By area", subtitle: "Click an area to filter the list")
            LazyVGrid(columns: [GridItem(.adaptive(minimum: 150), spacing: 10)], spacing: 10) {
                ForEach(HealthCategory.allCases) { category in
                    let worst = report.findings(in: category).map(\.severity).max() ?? .good
                    Button {
                        selectedCategory = selectedCategory == category ? nil : category
                    } label: {
                        HStack(spacing: 8) {
                            Image(systemName: category.symbol).foregroundStyle(worst.color)
                            Text(category.rawValue).font(.callout)
                            Spacer()
                            Image(systemName: worst.symbol).foregroundStyle(worst.color).font(.caption)
                        }
                        .padding(10)
                        .background((selectedCategory == category ? Color.accentColor.opacity(0.18) : Color.primary.opacity(0.05)), in: RoundedRectangle(cornerRadius: 10, style: .continuous))
                    }
                    .buttonStyle(.plain)
                }
            }
        }
        .card()
    }

    private var visibleFindings: [HealthFinding] {
        let filtered = selectedCategory.map { report.findings(in: $0) } ?? report.findings
        return filtered
    }

    private var findingsList: some View {
        VStack(alignment: .leading, spacing: 10) {
            SectionHeader(title: selectedCategory.map { "\($0.rawValue) findings" } ?? "All findings")
            if visibleFindings.isEmpty {
                EmptyState(systemImage: "checkmark.circle", title: "Nothing to report here")
            }
            ForEach(visibleFindings) { finding in
                HStack(alignment: .top, spacing: 12) {
                    Image(systemName: finding.severity.symbol).foregroundStyle(finding.severity.color).font(.title3).frame(width: 24)
                    VStack(alignment: .leading, spacing: 4) {
                        HStack {
                            Text(finding.title).font(.headline)
                            SeverityPill(severity: finding.severity)
                            if finding.severity.penalty > 0 { Text("−\(finding.severity.penalty)").font(.caption.monospacedDigit()).foregroundStyle(.tertiary) }
                        }
                        Text(finding.detail).font(.callout).foregroundStyle(.secondary).fixedSize(horizontal: false, vertical: true)
                    }
                    Spacer()
                    if let action = finding.action {
                        Button(finding.actionTitle ?? action.title) { state.perform(action) }
                            .buttonStyle(.bordered)
                    }
                }
                .padding(12)
                .background(Color.primary.opacity(0.04), in: RoundedRectangle(cornerRadius: 10, style: .continuous))
            }
        }
        .card()
    }

    private var longevityCard: some View {
        VStack(alignment: .leading, spacing: 10) {
            SectionHeader(title: "Make your Mac last longer", subtitle: "The habits that matter most, in order of impact", systemImage: "leaf")
            ForEach(Self.longevityTips) { tip in
                HStack(alignment: .top, spacing: 10) {
                    Image(systemName: tip.symbol).foregroundStyle(Color.accentColor).frame(width: 22)
                    VStack(alignment: .leading, spacing: 2) {
                        Text(tip.title).font(.callout.weight(.semibold))
                        Text(tip.detail).font(.callout).foregroundStyle(.secondary).fixedSize(horizontal: false, vertical: true)
                    }
                }
            }
        }
        .card()
    }

    struct LongevityTip: Identifiable {
        let title: String
        let symbol: String
        let detail: String
        var id: String { title }
    }

    static let longevityTips: [LongevityTip] = [
        LongevityTip(title: "Keep heat down", symbol: "thermometer.sun", detail: "Heat ages every component, especially the battery. Use a hard surface, clear the vents of dust once a year, and don't run heavy exports while the Mac sits on a bed or sofa."),
        LongevityTip(title: "Stay between 20% and 80%", symbol: "battery.50percent", detail: "Lithium cells wear fastest at the extremes. Optimized Battery Charging does this automatically when your routine is predictable; for a desk-bound laptop it's the single biggest battery saver."),
        LongevityTip(title: "Leave 15–20% of the SSD free", symbol: "internaldrive", detail: "SSDs need free blocks to spread writes evenly. A nearly full disk wears faster, slows down, and leaves no room for swap and updates."),
        LongevityTip(title: "Restart every week or two", symbol: "arrow.clockwise", detail: "Clears swap, leaked memory and stuck background tasks. Updates also need it to finish installing."),
        LongevityTip(title: "Keep a backup", symbol: "clock.arrow.circlepath", detail: "Hardware does fail. Time Machine to any external disk means a dead SSD is an inconvenience, not a catastrophe."),
        LongevityTip(title: "Install updates", symbol: "arrow.down.circle", detail: "Security fixes, but also firmware improvements to charging, thermals and sleep behaviour."),
        LongevityTip(title: "Prune what starts at login", symbol: "power", detail: "Fewer background agents means a cooler, quieter Mac that stays responsive and wakes faster."),
    ]
}
