import SwiftUI

struct CPUView: View {
    @Environment(MetricsEngine.self) private var engine
    @Environment(AppSettings.self) private var settings

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: Theme.gridSpacing) {
                PageHeader(title: "CPU", subtitle: "\(engine.system.chip) · \(coreSummary)")
                HStack(spacing: Theme.gridSpacing) {
                    StatTile(title: "Total", value: Format.percentValue(engine.cpu.total), detail: String(format: "user %.0f%% · system %.0f%%", engine.cpu.user, engine.cpu.system), color: Theme.cpu, sparkline: engine.recent.map(\.cpu), systemImage: "cpu")
                    if engine.system.performanceCores > 0 {
                        StatTile(title: "Performance cores", value: Format.percentValue(engine.cpu.performanceCoreUsage), detail: "\(engine.system.performanceCores) cores for heavy work", color: Theme.cpu, fraction: engine.cpu.performanceCoreUsage / 100, systemImage: "bolt")
                        StatTile(title: "Efficiency cores", value: Format.percentValue(engine.cpu.efficiencyCoreUsage), detail: "\(engine.system.efficiencyCores) cores for background work", color: Theme.network, fraction: engine.cpu.efficiencyCoreUsage / 100, systemImage: "leaf")
                    }
                    StatTile(title: "Load average", value: String(format: "%.2f", engine.cpu.loadAverage.first ?? 0), detail: String(format: "5 min %.2f · 15 min %.2f · %d logical cores", engine.cpu.loadAverage[safe: 1] ?? 0, engine.cpu.loadAverage[safe: 2] ?? 0, engine.system.logicalCores), color: Theme.cpu, systemImage: "gauge")
                    if let gpu = engine.gpu {
                        StatTile(title: "GPU", value: Format.percentValue(gpu.utilization), detail: gpu.name, color: Theme.gpu, sparkline: engine.recent.map(\.gpu), systemImage: "cube.transparent")
                    }
                }
                VStack(alignment: .leading, spacing: 8) {
                    SectionHeader(title: "Usage", subtitle: "Last \(Format.duration(Double(engine.recent.count) * settings.refreshInterval))")
                    MetricChart(points: engine.recent, keyPath: \.cpu, color: Theme.cpu, maximum: 100, primaryLabel: "CPU")
                        .frame(height: 180)
                }
                .card()
                HStack(alignment: .top, spacing: Theme.gridSpacing) {
                    coresCard
                    topProcessesCard
                }
                explainer
            }
            .padding(20)
        }
        .accessibilityIdentifier("page.cpu")
    }

    private var coreSummary: String {
        if engine.system.performanceCores > 0 {
            return "\(engine.system.performanceCores) performance + \(engine.system.efficiencyCores) efficiency cores"
        }
        return "\(engine.system.physicalCores) cores, \(engine.system.logicalCores) threads"
    }

    private var coresCard: some View {
        VStack(alignment: .leading, spacing: 10) {
            SectionHeader(title: "Per core", subtitle: engine.system.isAppleSilicon ? "E = efficiency, P = performance" : nil)
            LazyVGrid(columns: [GridItem(.adaptive(minimum: 44), spacing: 6)], spacing: 10) {
                ForEach(engine.cpu.cores) { core in
                    VStack(spacing: 4) {
                        ZStack(alignment: .bottom) {
                            RoundedRectangle(cornerRadius: 4).fill(Color.primary.opacity(0.08))
                            RoundedRectangle(cornerRadius: 4)
                                .fill(core.kind == .efficiency ? Theme.network : Theme.cpu)
                                .frame(height: max(2, 60 * CGFloat(core.usage / 100)))
                        }
                        .frame(width: 32, height: 60)
                        .animation(.easeOut(duration: 0.3), value: core.usage)
                        Text("\(core.kind.label)\(core.index)").font(.caption2).foregroundStyle(.secondary)
                        Text("\(Int(core.usage))").font(.caption2.monospacedDigit())
                    }
                }
            }
        }
        .card()
    }

    private var topProcessesCard: some View {
        VStack(alignment: .leading, spacing: 8) {
            SectionHeader(title: "Top processes", subtitle: "Percent of one core; over 100% means several cores")
            ForEach(engine.topCPUProcesses) { process in
                ProcessRow(process: process, icon: engine.icon(for: process), showMemory: false)
            }
        }
        .frame(width: 340)
        .card()
    }

    private var explainer: some View {
        VStack(alignment: .leading, spacing: 8) {
            SectionHeader(title: "Reading these numbers", systemImage: "questionmark.circle")
            Text("**Total** is the share of all cores busy right now. On Apple Silicon, macOS puts background work on the efficiency cores first, so they are often busy while your apps feel fast. **Load average** is the number of threads waiting to run; above the number of cores means the Mac is saturated. A single process above 100% is using more than one core, which is normal for exports, compiles and games. Something you did not start staying above 50% for minutes is worth a look in Activity.")
                .font(.callout).foregroundStyle(.secondary).fixedSize(horizontal: false, vertical: true)
        }
        .card()
    }
}

extension Array {
    subscript(safe index: Int) -> Element? { indices.contains(index) ? self[index] : nil }
}
