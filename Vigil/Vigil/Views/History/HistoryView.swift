import SwiftUI

/// "What was my Mac doing at 3 pm?" Charts over any range plus the per-process snapshot nearest the selected time.
struct HistoryView: View {
    @Environment(AppState.self) private var state
    @Environment(MetricsEngine.self) private var engine
    @Environment(AppSettings.self) private var settings
    @Environment(LicenseManager.self) private var license

    @State private var range: TimeRange = .sixHours
    @State private var points: [MetricPoint] = []
    @State private var events: [HistoryEvent] = []
    @State private var topProcesses: [ProcessPoint] = []
    @State private var selectedTime: Date?
    @State private var snapshot: [ProcessPoint] = []
    @State private var loading = false
    @State private var eventFilter: EventKind?

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: Theme.gridSpacing) {
                HStack(alignment: .top) {
                    PageHeader(title: "History", subtitle: "Recorded every 10 seconds, kept for \(settings.historyRetentionDays) days. Drag across a chart to see what was running at that moment.")
                    Picker("Range", selection: $range) {
                        ForEach(TimeRange.allCases) { range in Text(range.rawValue).tag(range) }
                    }
                    .pickerStyle(.segmented)
                    .frame(width: 280)
                    .accessibilityIdentifier("history.range")
                }
                if !license.isPro && range.seconds > TimeRange.day.seconds {
                    ProLockedBanner(feature: "History beyond 24 hours")
                }
                if points.isEmpty && !loading {
                    EmptyState(systemImage: "clock.arrow.circlepath", title: "No history yet for this range", message: "Vigil records while it is running. Leave it in the menu bar and come back.")
                        .card()
                }
                LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: Theme.gridSpacing) {
                    chart("CPU", color: Theme.cpu, keyPath: \.cpu, maximum: 100, unit: "%")
                    chart("Memory used", color: Theme.memory, keyPath: \.memoryUsedGB, maximum: Double(engine.memory.total) / 1_073_741_824, unit: "GB", format: { String(format: "%.1f GB", $0) })
                    chart("Disk read / write", color: Theme.disk, keyPath: \.diskReadMB, secondary: \.diskWriteMB, unit: "MB/s", format: { String(format: "%.1f MB/s", $0) })
                    chart("Network down / up", color: Theme.network, keyPath: \.networkInMB, secondary: \.networkOutMB, unit: "MB/s", format: { String(format: "%.2f MB/s", $0) })
                    if engine.sensors.smcAvailable {
                        chart("CPU temperature", color: Theme.thermal, keyPath: \.temperature, maximum: 110, unit: "°", format: { Format.temperature($0, unit: settings.temperatureUnit) })
                    }
                    if engine.battery.isPresent {
                        chart("Battery", color: Theme.battery, keyPath: \.battery, maximum: 100, unit: "%", filter: { $0.battery >= 0 })
                    }
                    if engine.gpu != nil {
                        chart("GPU", color: Theme.gpu, keyPath: \.gpu, maximum: 100, unit: "%")
                    }
                    chart("Power", color: Theme.warning, keyPath: \.power, unit: "W", format: { Format.watts($0) })
                }
                HStack(alignment: .top, spacing: Theme.gridSpacing) {
                    snapshotCard
                    topCard
                }
                eventsCard
            }
            .padding(20)
        }
        .task(id: range) { await load() }
        .accessibilityIdentifier("page.history")
    }

    private func chart(_ title: String, color: Color, keyPath: KeyPath<MetricPoint, Double>, secondary: KeyPath<MetricPoint, Double>? = nil,
                       maximum: Double? = nil, unit: String, format: ((Double) -> String)? = nil, filter: ((MetricPoint) -> Bool)? = nil) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(title).font(.subheadline.weight(.semibold))
            MetricChart(points: filter.map { points.filter($0) } ?? points, keyPath: keyPath, color: color, maximum: maximum, unit: unit,
                        secondary: secondary, secondaryColor: color.opacity(0.6), secondaryLabel: "Secondary", primaryLabel: title, format: format,
                        onSelect: { date in select(date) })
                .frame(height: 130)
        }
        .card()
    }

    private func select(_ date: Date?) {
        guard let date else { return }
        selectedTime = date
        let history = engine.history
        let tolerance = max(90, range.bucketSeconds)
        Task {
            let result = await Task.detached { history.processes(near: date, tolerance: tolerance) }.value
            if selectedTime == date { snapshot = result }
        }
    }

    private func load() async {
        loading = true
        let history = engine.history
        let range = range
        let effectiveRange = license.isPro ? range : (range.seconds > TimeRange.day.seconds ? .day : range)
        let start = Date().addingTimeInterval(-effectiveRange.seconds)
        let (loadedPoints, loadedEvents, loadedTop) = await Task.detached {
            (history.points(from: start, bucketSeconds: effectiveRange.bucketSeconds), history.events(from: start), history.topProcesses(from: start))
        }.value
        points = loadedPoints
        events = loadedEvents
        topProcesses = loadedTop
        loading = false
    }

    private var snapshotCard: some View {
        VStack(alignment: .leading, spacing: 8) {
            SectionHeader(title: selectedTime.map { "Running at \(Format.dateTime($0))" } ?? "Processes at a moment in time",
                          subtitle: selectedTime == nil ? "Drag across any chart above" : "Top 12 by CPU, recorded once a minute", systemImage: "clock")
            if snapshot.isEmpty {
                Text(selectedTime == nil ? "" : "No process snapshot within range of that time.").font(.caption).foregroundStyle(.secondary)
            }
            ForEach(snapshot) { process in
                HStack {
                    Text(process.name).font(.callout).lineLimit(1)
                    Spacer()
                    Text(String(format: "%.1f%%", process.cpu)).font(.callout.monospacedDigit()).frame(width: 64, alignment: .trailing)
                    Text(Format.memory(process.memory)).font(.callout.monospacedDigit()).foregroundStyle(.secondary).frame(width: 80, alignment: .trailing)
                }
            }
        }
        .frame(maxWidth: .infinity)
        .card()
    }

    private var topCard: some View {
        VStack(alignment: .leading, spacing: 8) {
            SectionHeader(title: "Heaviest over this period", subtitle: "Average CPU while present · peak memory", systemImage: "flame")
            ForEach(topProcesses) { process in
                HStack {
                    Text(process.name).font(.callout).lineLimit(1)
                    Spacer()
                    Text(String(format: "%.1f%%", process.cpu)).font(.callout.monospacedDigit()).frame(width: 64, alignment: .trailing)
                    Text(Format.memory(process.memory)).font(.callout.monospacedDigit()).foregroundStyle(.secondary).frame(width: 80, alignment: .trailing)
                }
            }
            if topProcesses.isEmpty { Text("Nothing recorded yet.").font(.caption).foregroundStyle(.secondary) }
        }
        .frame(maxWidth: .infinity)
        .card()
    }

    private var eventsCard: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                SectionHeader(title: "Timeline", subtitle: "App launches, sleep and wake, thermal and memory events, clean-ups", systemImage: "list.bullet.below.rectangle")
                Picker("Filter", selection: $eventFilter) {
                    Text("Everything").tag(EventKind?.none)
                    ForEach(EventKind.allCases, id: \.self) { kind in Text(kind.rawValue).tag(EventKind?.some(kind)) }
                }
                .frame(width: 180)
            }
            let visible = events.filter { eventFilter == nil || $0.kind == eventFilter }
            if visible.isEmpty { Text("No events in this range.").font(.caption).foregroundStyle(.secondary) }
            ForEach(visible.prefix(200)) { event in
                HStack(alignment: .top, spacing: 10) {
                    Image(systemName: event.kind.symbol).foregroundStyle(.secondary).frame(width: 20)
                    Text(Format.dateTime(event.time)).font(.caption.monospacedDigit()).foregroundStyle(.secondary).frame(width: 150, alignment: .leading)
                    VStack(alignment: .leading, spacing: 1) {
                        Text(event.title).font(.callout)
                        if !event.detail.isEmpty { Text(event.detail).font(.caption).foregroundStyle(.secondary).lineLimit(1) }
                    }
                    Spacer()
                }
                .padding(.vertical, 2)
            }
        }
        .card()
    }
}
