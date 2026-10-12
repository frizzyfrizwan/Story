import SwiftUI

struct MemoryView: View {
    @Environment(AppState.self) private var state
    @Environment(MetricsEngine.self) private var engine
    @Environment(LicenseManager.self) private var license

    private var memory: MemorySample { engine.memory }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: Theme.gridSpacing) {
                PageHeader(title: "Memory", subtitle: "\(Format.memory(memory.total)) unified memory · pressure \(memory.pressure.title.lowercased())")
                HStack(alignment: .top, spacing: Theme.gridSpacing) {
                    pressureCard
                    breakdownCard
                }
                VStack(alignment: .leading, spacing: 8) {
                    SectionHeader(title: "Memory used", subtitle: "Compressed and swapped memory is what makes a Mac feel slow, not a high \"used\" figure")
                    MetricChart(points: engine.recent, keyPath: \.memoryUsedGB, color: Theme.memory, maximum: Double(memory.total) / 1_073_741_824, unit: "GB", primaryLabel: "Used",
                                format: { String(format: "%.1f GB", $0) })
                        .frame(height: 170)
                }
                .card()
                HStack(alignment: .top, spacing: Theme.gridSpacing) {
                    topProcessesCard
                    actionsCard
                }
            }
            .padding(20)
        }
        .accessibilityIdentifier("page.memory")
    }

    private var pressureColor: Color {
        switch memory.pressure {
        case .normal: return Theme.good
        case .warning: return Theme.warning
        case .critical: return Theme.critical
        }
    }

    private var pressureCard: some View {
        VStack(alignment: .leading, spacing: 12) {
            SectionHeader(title: "Memory pressure", systemImage: "gauge.with.dots.needle.33percent")
            HStack(spacing: 16) {
                RingGauge(fraction: memory.pressurePercent / 100, color: pressureColor, lineWidth: 12, label: memory.pressure.title, caption: "\(Int(memory.pressurePercent))%")
                    .frame(width: 130, height: 130)
                VStack(alignment: .leading, spacing: 6) {
                    Text(memory.pressure.explanation).font(.callout).fixedSize(horizontal: false, vertical: true)
                    if memory.swapUsed > 0 {
                        Label("\(Format.memory(memory.swapUsed)) swapped to disk", systemImage: "arrow.down.doc").font(.caption).foregroundStyle(.secondary)
                    }
                }
            }
        }
        .frame(maxWidth: .infinity)
        .card()
    }

    private var breakdownCard: some View {
        let total = Double(max(memory.total, 1))
        return VStack(alignment: .leading, spacing: 12) {
            SectionHeader(title: "Breakdown", subtitle: "\(Format.memory(memory.used)) used of \(Format.memory(memory.total))")
            SegmentedBar(segments: [
                .init(label: "Apps \(Format.memory(memory.app))", fraction: Double(memory.app) / total, color: Theme.memory),
                .init(label: "Wired \(Format.memory(memory.wired))", fraction: Double(memory.wired) / total, color: Theme.cpu),
                .init(label: "Compressed \(Format.memory(memory.compressed))", fraction: Double(memory.compressed) / total, color: Theme.warning),
                .init(label: "Cached files \(Format.memory(memory.cached))", fraction: Double(memory.cached) / total, color: Color.secondary.opacity(0.5)),
            ])
            VStack(alignment: .leading, spacing: 4) {
                row("Apps", "Memory your apps asked for.")
                row("Wired", "Reserved by macOS and drivers; cannot be paged out.")
                row("Compressed", "Inactive memory squeezed to make room. Cheap, but a sign of pressure.")
                row("Cached files", "Recently used files kept in RAM for speed. Freed instantly when needed — this is not \"used\".")
            }
        }
        .frame(maxWidth: .infinity)
        .card()
    }

    private func row(_ title: String, _ detail: String) -> some View {
        HStack(alignment: .top, spacing: 6) {
            Text(title).font(.caption.weight(.semibold)).frame(width: 90, alignment: .leading)
            Text(detail).font(.caption).foregroundStyle(.secondary)
        }
    }

    private var topProcessesCard: some View {
        VStack(alignment: .leading, spacing: 8) {
            SectionHeader(title: "Biggest memory users", subtitle: "Physical footprint, like Activity Monitor")
            ForEach(engine.topMemoryProcesses) { process in
                ProcessRow(process: process, icon: engine.icon(for: process), showCPU: false)
            }
        }
        .card()
    }

    private var actionsCard: some View {
        VStack(alignment: .leading, spacing: 12) {
            SectionHeader(title: "Free up memory", systemImage: "sparkles")
            Text("Quitting the top app above is the only real fix. \"Free Up Memory\" runs macOS's own purge command to drop file caches and inactive pages, which helps before launching something heavy.")
                .font(.callout).foregroundStyle(.secondary).fixedSize(horizontal: false, vertical: true)
            HStack {
                Button {
                    state.runToolbox(Toolbox.action(id: "purge")!)
                } label: {
                    Label("Free Up Memory", systemImage: "memorychip")
                }
                .buttonStyle(.borderedProminent)
                if !license.isPro { ProBadge() }
                Spacer()
            }
            Text("Needs an administrator password.").font(.caption2).foregroundStyle(.tertiary)
        }
        .frame(width: 320)
        .card()
    }
}

extension MetricPoint {
    var memoryUsedGB: Double { Double(memoryUsed) / 1_073_741_824 }
    var swapUsedGB: Double { Double(swapUsed) / 1_073_741_824 }
    var diskReadMB: Double { diskRead / 1_000_000 }
    var diskWriteMB: Double { diskWrite / 1_000_000 }
    var networkInMB: Double { networkIn / 1_000_000 }
    var networkOutMB: Double { networkOut / 1_000_000 }
}
