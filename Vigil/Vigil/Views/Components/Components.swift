import SwiftUI
import Charts

// MARK: - Section header

struct SectionHeader: View {
    let title: String
    var subtitle: String? = nil
    var systemImage: String? = nil

    var body: some View {
        VStack(alignment: .leading, spacing: 2) {
            HStack(spacing: 6) {
                if let systemImage { Image(systemName: systemImage).foregroundStyle(.secondary) }
                Text(title).font(.headline)
            }
            if let subtitle { Text(subtitle).font(.subheadline).foregroundStyle(.secondary) }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}

struct PageHeader: View {
    let title: String
    var subtitle: String? = nil

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(title).font(.system(size: 26, weight: .bold))
            if let subtitle { Text(subtitle).font(.body).foregroundStyle(.secondary) }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.bottom, 4)
    }
}

// MARK: - Stat tile

struct StatTile: View {
    let title: String
    let value: String
    var detail: String? = nil
    var color: Color = .accentColor
    var fraction: Double? = nil
    var sparkline: [Double]? = nil
    var systemImage: String? = nil

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(spacing: 6) {
                if let systemImage { Image(systemName: systemImage).foregroundStyle(color) }
                Text(title).font(.subheadline.weight(.medium)).foregroundStyle(.secondary)
                Spacer()
            }
            Text(value)
                .font(.system(size: 26, weight: .semibold, design: .rounded).monospacedDigit())
                .lineLimit(1)
                .minimumScaleFactor(0.6)
            if let detail {
                Text(detail).font(.caption).foregroundStyle(.secondary).lineLimit(2)
            }
            if let sparkline, sparkline.count > 1 {
                Sparkline(values: sparkline, color: color, maximum: 100)
                    .frame(height: 28)
            } else if let fraction {
                ProgressBar(fraction: fraction, color: color)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .card()
        .accessibilityElement(children: .combine)
        .accessibilityLabel("\(title): \(value)")
    }
}

// MARK: - Progress bar

struct ProgressBar: View {
    let fraction: Double
    var color: Color = .accentColor
    var height: CGFloat = 6

    var body: some View {
        GeometryReader { geometry in
            ZStack(alignment: .leading) {
                Capsule().fill(Color.primary.opacity(0.08))
                Capsule().fill(color).frame(width: max(0, geometry.size.width * fraction.clamped(to: 0...1)))
            }
        }
        .frame(height: height)
        .animation(.easeInOut(duration: 0.4), value: fraction)
    }
}

/// A stacked bar used for memory and storage breakdowns.
struct SegmentedBar: View {
    struct Segment: Identifiable {
        let id = UUID()
        let label: String
        let fraction: Double
        let color: Color
    }

    let segments: [Segment]
    var height: CGFloat = 14

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            GeometryReader { geometry in
                HStack(spacing: 1) {
                    ForEach(segments) { segment in
                        Rectangle()
                            .fill(segment.color)
                            .frame(width: max(0, geometry.size.width * segment.fraction.clamped(to: 0...1)))
                    }
                    Spacer(minLength: 0)
                }
                .background(Color.primary.opacity(0.08))
                .clipShape(Capsule())
            }
            .frame(height: height)
            HStack(spacing: 14) {
                ForEach(segments) { segment in
                    HStack(spacing: 5) {
                        Circle().fill(segment.color).frame(width: 8, height: 8)
                        Text(segment.label).font(.caption).foregroundStyle(.secondary)
                    }
                }
            }
        }
    }
}

// MARK: - Sparkline

struct Sparkline: View {
    let values: [Double]
    var color: Color = .accentColor
    var maximum: Double? = nil

    var body: some View {
        GeometryReader { geometry in
            let top = maximum ?? max(values.max() ?? 1, 1)
            let count = max(values.count - 1, 1)
            let points = values.enumerated().map { index, value in
                CGPoint(x: geometry.size.width * CGFloat(index) / CGFloat(count),
                        y: geometry.size.height * (1 - CGFloat((value / top).clamped(to: 0...1))))
            }
            ZStack {
                Path { path in
                    guard let first = points.first else { return }
                    path.move(to: CGPoint(x: first.x, y: geometry.size.height))
                    path.addLine(to: first)
                    for point in points.dropFirst() { path.addLine(to: point) }
                    path.addLine(to: CGPoint(x: points.last?.x ?? 0, y: geometry.size.height))
                    path.closeSubpath()
                }
                .fill(LinearGradient(colors: [color.opacity(0.35), color.opacity(0.02)], startPoint: .top, endPoint: .bottom))
                Path { path in
                    guard let first = points.first else { return }
                    path.move(to: first)
                    for point in points.dropFirst() { path.addLine(to: point) }
                }
                .stroke(color, style: StrokeStyle(lineWidth: 1.5, lineCap: .round, lineJoin: .round))
            }
        }
        .accessibilityHidden(true)
    }
}

// MARK: - Ring gauge

struct RingGauge: View {
    let fraction: Double
    var color: Color = .accentColor
    var lineWidth: CGFloat = 10
    var label: String = ""
    var caption: String? = nil

    var body: some View {
        ZStack {
            Circle().stroke(Color.primary.opacity(0.08), lineWidth: lineWidth)
            Circle()
                .trim(from: 0, to: CGFloat(fraction.clamped(to: 0...1)))
                .stroke(color, style: StrokeStyle(lineWidth: lineWidth, lineCap: .round))
                .rotationEffect(.degrees(-90))
                .animation(.easeInOut(duration: 0.5), value: fraction)
            VStack(spacing: 2) {
                Text(label)
                    .font(.system(size: 22, weight: .semibold, design: .rounded).monospacedDigit())
                    .lineLimit(1)
                    .minimumScaleFactor(0.5)
                if let caption { Text(caption).font(.caption2).foregroundStyle(.secondary) }
            }
            .padding(lineWidth + 6)
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(label)
    }
}

// MARK: - Key/value row

struct KeyValueRow: View {
    let key: String
    let value: String
    var monospaced = false
    var copyable = false

    var body: some View {
        HStack(alignment: .firstTextBaseline) {
            Text(key).foregroundStyle(.secondary)
            Spacer(minLength: 12)
            Text(value)
                .font(monospaced ? .body.monospaced() : .body)
                .multilineTextAlignment(.trailing)
                .textSelection(.enabled)
            if copyable {
                Button {
                    NSPasteboard.general.clearContents()
                    NSPasteboard.general.setString(value, forType: .string)
                } label: {
                    Image(systemName: "doc.on.doc").font(.caption)
                }
                .buttonStyle(.borderless)
                .help("Copy")
            }
        }
        .font(.callout)
        .padding(.vertical, 2)
    }
}

// MARK: - Metric chart

/// Time-series area chart used by the detail pages and History.
struct MetricChart: View {
    let points: [MetricPoint]
    let keyPath: KeyPath<MetricPoint, Double>
    var color: Color = .accentColor
    var maximum: Double? = nil
    var unit: String = "%"
    var secondary: KeyPath<MetricPoint, Double>? = nil
    var secondaryColor: Color = .secondary
    var secondaryLabel: String = ""
    var primaryLabel: String = ""
    var format: ((Double) -> String)? = nil
    var onSelect: ((Date?) -> Void)? = nil
    @State private var selectedDate: Date?

    var body: some View {
        Chart {
            ForEach(points) { point in
                AreaMark(x: .value("Time", point.time), y: .value(primaryLabel, point[keyPath: keyPath]), series: .value("Series", primaryLabel))
                    .foregroundStyle(LinearGradient(colors: [color.opacity(0.35), color.opacity(0.02)], startPoint: .top, endPoint: .bottom))
                    .interpolationMethod(.monotone)
                LineMark(x: .value("Time", point.time), y: .value(primaryLabel, point[keyPath: keyPath]), series: .value("Series", primaryLabel))
                    .foregroundStyle(color)
                    .lineStyle(StrokeStyle(lineWidth: 1.5))
                    .interpolationMethod(.monotone)
                if let secondary {
                    LineMark(x: .value("Time", point.time), y: .value(secondaryLabel, point[keyPath: secondary]), series: .value("Series", secondaryLabel))
                        .foregroundStyle(secondaryColor)
                        .lineStyle(StrokeStyle(lineWidth: 1.5, dash: [4, 3]))
                        .interpolationMethod(.monotone)
                }
            }
            if let selectedDate, let nearest = nearestPoint(to: selectedDate) {
                RuleMark(x: .value("Selected", nearest.time))
                    .foregroundStyle(Color.secondary.opacity(0.5))
                    .annotation(position: .top, alignment: .leading, spacing: 4) {
                        VStack(alignment: .leading, spacing: 2) {
                            Text(Format.time(nearest.time)).font(.caption2).foregroundStyle(.secondary)
                            Text(formatted(nearest[keyPath: keyPath])).font(.caption.weight(.semibold).monospacedDigit())
                            if let secondary { Text(formatted(nearest[keyPath: secondary])).font(.caption.monospacedDigit()).foregroundStyle(secondaryColor) }
                        }
                        .padding(6)
                        .background(.regularMaterial, in: RoundedRectangle(cornerRadius: 6))
                    }
            }
        }
        .chartYScale(domain: 0...(maximum ?? max(1, (points.map { $0[keyPath: keyPath] }.max() ?? 1) * 1.15)))
        .chartYAxis {
            AxisMarks(position: .trailing, values: .automatic(desiredCount: 4)) { value in
                AxisGridLine().foregroundStyle(Color.primary.opacity(0.08))
                AxisValueLabel {
                    if let number = value.as(Double.self) { Text(formatted(number)).font(.caption2).foregroundStyle(.secondary) }
                }
            }
        }
        .chartXAxis {
            AxisMarks(values: .automatic(desiredCount: 5)) { value in
                AxisGridLine().foregroundStyle(Color.primary.opacity(0.05))
                AxisValueLabel {
                    if let date = value.as(Date.self) { Text(axisLabel(date)).font(.caption2).foregroundStyle(.secondary) }
                }
            }
        }
        .chartLegend(.hidden)
        .chartOverlay { proxy in
            GeometryReader { geometry in
                Rectangle().fill(Color.clear).contentShape(Rectangle())
                    .gesture(
                        DragGesture(minimumDistance: 0)
                            .onChanged { value in
                                let origin = geometry[proxy.plotFrame!].origin
                                let x = value.location.x - origin.x
                                if let date: Date = proxy.value(atX: x) {
                                    selectedDate = date
                                    onSelect?(date)
                                }
                            }
                            .onEnded { _ in
                                if onSelect == nil { selectedDate = nil }
                            }
                    )
            }
        }
    }

    private func nearestPoint(to date: Date) -> MetricPoint? {
        points.min(by: { abs($0.time.timeIntervalSince(date)) < abs($1.time.timeIntervalSince(date)) })
    }

    private func formatted(_ value: Double) -> String {
        if let format { return format(value) }
        return String(format: unit == "%" ? "%.0f%%" : "%.1f \(unit)", value)
    }

    private func axisLabel(_ date: Date) -> String {
        guard let first = points.first?.time, let last = points.last?.time else { return Format.time(date) }
        let span = last.timeIntervalSince(first)
        if span > 36 * 3600 { return date.formatted(.dateTime.weekday(.abbreviated).hour()) }
        if span < 15 * 60 { return date.formatted(.dateTime.hour().minute().second()) }
        return Format.time(date)
    }
}

// MARK: - Pro gate

struct ProBadge: View {
    var body: some View {
        Text("PRO")
            .font(.system(size: 9, weight: .bold))
            .padding(.horizontal, 5)
            .padding(.vertical, 2)
            .background(Color.accentColor.opacity(0.18), in: Capsule())
            .foregroundStyle(Color.accentColor)
    }
}

struct ProLockedBanner: View {
    let feature: String
    @Environment(LicenseManager.self) private var license
    @Environment(\.openSettings) private var openSettings

    var body: some View {
        HStack(spacing: 12) {
            Image(systemName: "lock.fill").foregroundStyle(Color.accentColor)
            VStack(alignment: .leading, spacing: 2) {
                Text("\(feature) is part of Vigil Pro").font(.subheadline.weight(.semibold))
                Text(license.state == .trialExpired ? "Your 14-day trial has ended. Everything you see here still updates live; actions need a licence." : license.state.title)
                    .font(.caption).foregroundStyle(.secondary)
            }
            Spacer()
            Button("Unlock Pro") { openSettings() }
                .buttonStyle(.borderedProminent)
        }
        .card()
    }
}

// MARK: - Empty state

struct EmptyState: View {
    let systemImage: String
    let title: String
    var message: String? = nil

    var body: some View {
        VStack(spacing: 10) {
            Image(systemName: systemImage).font(.system(size: 36)).foregroundStyle(.tertiary)
            Text(title).font(.headline)
            if let message { Text(message).font(.subheadline).foregroundStyle(.secondary).multilineTextAlignment(.center).frame(maxWidth: 420) }
        }
        .frame(maxWidth: .infinity, minHeight: 160)
        .padding()
    }
}

// MARK: - Severity pill

struct SeverityPill: View {
    let severity: Severity
    var body: some View {
        Label(severity.title, systemImage: severity.symbol)
            .font(.caption.weight(.medium))
            .padding(.horizontal, 8)
            .padding(.vertical, 3)
            .background(severity.color.opacity(0.15), in: Capsule())
            .foregroundStyle(severity.color)
    }
}

// MARK: - Toast

struct ToastView: View {
    let message: String
    var body: some View {
        Text(message)
            .font(.callout)
            .padding(.horizontal, 14)
            .padding(.vertical, 10)
            .background(.regularMaterial, in: RoundedRectangle(cornerRadius: 10))
            .shadow(color: .black.opacity(0.15), radius: 8, y: 2)
            .padding()
            .transition(.move(edge: .bottom).combined(with: .opacity))
    }
}

/// Adaptive grid used by every page.
struct TileGrid<Content: View>: View {
    var minimum: CGFloat = 220
    @ViewBuilder let content: Content

    var body: some View {
        LazyVGrid(columns: [GridItem(.adaptive(minimum: minimum), spacing: Theme.gridSpacing)], alignment: .leading, spacing: Theme.gridSpacing) {
            content
        }
    }
}

/// Process row shared by the overview, memory and CPU pages.
struct ProcessRow: View {
    let process: ProcessSample
    let icon: NSImage?
    var showMemory = true
    var showCPU = true

    var body: some View {
        HStack(spacing: 10) {
            if let icon {
                Image(nsImage: icon).resizable().frame(width: 20, height: 20)
            } else {
                Image(systemName: "gearshape").frame(width: 20, height: 20).foregroundStyle(.secondary)
            }
            Text(process.name).lineLimit(1)
            Spacer()
            if showCPU {
                Text(String(format: "%.1f%%", process.cpuPercent))
                    .font(.callout.monospacedDigit())
                    .foregroundStyle(process.cpuPercent > 50 ? Theme.warning : .primary)
                    .frame(width: 64, alignment: .trailing)
            }
            if showMemory {
                Text(Format.memory(process.memoryBytes))
                    .font(.callout.monospacedDigit())
                    .foregroundStyle(.secondary)
                    .frame(width: 80, alignment: .trailing)
            }
        }
        .padding(.vertical, 2)
    }
}
