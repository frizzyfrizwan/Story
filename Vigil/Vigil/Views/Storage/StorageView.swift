import SwiftUI
import AppKit

struct StorageView: View {
    @Environment(AppState.self) private var state
    @Environment(MetricsEngine.self) private var engine
    @Environment(StorageScanner.self) private var scanner
    @Environment(LicenseManager.self) private var license

    @State private var selectedCategories: Set<String> = []
    @State private var confirmClean = false
    @State private var cleaning = false
    @State private var outcomeMessage: String?
    @State private var showLargeFiles = false

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: Theme.gridSpacing) {
                PageHeader(title: "Storage", subtitle: engine.disk.root.map { "\(Format.bytes($0.available)) free of \(Format.bytes($0.total)) on \($0.name)" } ?? "")
                volumesCard
                HStack(alignment: .top, spacing: Theme.gridSpacing) {
                    ioCard
                    foldersCard
                }
                cleanupCard
                if !scanner.largeFiles.isEmpty { largeFilesCard }
            }
            .padding(20)
        }
        .onAppear { if scanner.lastScan == nil && !scanner.isScanning { scanner.scan() } }
        .alert("Clean \(selectedCategories.count) categor\(selectedCategories.count == 1 ? "y" : "ies")?", isPresented: $confirmClean) {
            Button("Clean", role: .destructive) { Task { await clean() } }
            Button("Cancel", role: .cancel) {}
        } message: {
            Text(confirmMessage)
        }
        .alert("Clean-up finished", isPresented: Binding(get: { outcomeMessage != nil }, set: { if !$0 { outcomeMessage = nil } })) {
            Button("OK") { outcomeMessage = nil }
        } message: {
            Text(outcomeMessage ?? "")
        }
        .accessibilityIdentifier("page.storage")
    }

    // MARK: Volumes

    private var volumesCard: some View {
        VStack(alignment: .leading, spacing: 12) {
            SectionHeader(title: "Volumes", subtitle: engine.system.smartStatus.map { "S.M.A.R.T. status: \($0)" }, systemImage: "internaldrive")
            ForEach(engine.disk.volumes) { volume in
                VStack(alignment: .leading, spacing: 6) {
                    HStack {
                        Image(systemName: volume.isRemovable ? "externaldrive" : "internaldrive").foregroundStyle(.secondary)
                        Text(volume.name).font(.callout.weight(.semibold))
                        if volume.isRoot { Text("Startup disk").font(.caption).foregroundStyle(.secondary) }
                        Spacer()
                        Text("\(Format.bytes(volume.available)) free · \(Format.bytes(volume.used)) used of \(Format.bytes(volume.total))")
                            .font(.caption.monospacedDigit()).foregroundStyle(.secondary)
                        if volume.purgeable > 100_000_000 {
                            Text("+\(Format.bytes(volume.purgeable)) purgeable").font(.caption).foregroundStyle(Theme.warning)
                        }
                    }
                    ProgressBar(fraction: volume.usedFraction, color: Theme.severity(volume.usedFraction, warn: 0.85, critical: 0.95), height: 10)
                }
                .padding(.vertical, 4)
            }
        }
        .card()
    }

    private var ioCard: some View {
        VStack(alignment: .leading, spacing: 8) {
            SectionHeader(title: "Disk activity", subtitle: "↓ \(Format.rate(engine.disk.readBytesPerSecond)) read · ↑ \(Format.rate(engine.disk.writeBytesPerSecond)) write")
            MetricChart(points: engine.recent, keyPath: \.diskReadMB, color: Theme.disk, unit: "MB/s", secondary: \.diskWriteMB, secondaryColor: Theme.memory,
                        secondaryLabel: "Write", primaryLabel: "Read", format: { String(format: "%.1f MB/s", $0) })
                .frame(height: 150)
            Text("Since boot: \(Format.bytes(engine.disk.totalRead)) read, \(Format.bytes(engine.disk.totalWrite)) written.").font(.caption).foregroundStyle(.secondary)
        }
        .card()
    }

    private var foldersCard: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                SectionHeader(title: "Where the space goes", subtitle: "Your home folder by top-level directory")
                if scanner.isScanning { ProgressView().controlSize(.small) }
            }
            if scanner.folderSizes.isEmpty {
                Text(scanner.isScanning ? scanner.progressText : "Run a scan to measure folders.").font(.caption).foregroundStyle(.secondary)
            }
            let largest = Double(scanner.folderSizes.first?.bytes ?? 1)
            ForEach(scanner.folderSizes) { folder in
                HStack {
                    Text(folder.name).font(.callout).frame(width: 170, alignment: .leading)
                    ProgressBar(fraction: Double(folder.bytes) / max(largest, 1), color: Theme.disk, height: 8)
                    Text(Format.bytes(folder.bytes)).font(.caption.monospacedDigit()).frame(width: 70, alignment: .trailing)
                    Button { NSWorkspace.shared.activateFileViewerSelecting([folder.url]) } label: { Image(systemName: "folder") }
                        .buttonStyle(.borderless).font(.caption)
                }
            }
        }
        .frame(width: 420)
        .card()
    }

    // MARK: Clean up

    private var cleanupCard: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                SectionHeader(title: "Clean up", subtitle: scanner.isScanning ? scanner.progressText : "Safe items are regenerated automatically. Your own files go to the Trash, never straight to deletion.", systemImage: "sparkles")
                Spacer()
                if scanner.isScanning {
                    Button("Stop") { scanner.cancel() }
                } else {
                    Button(scanner.lastScan == nil ? "Scan" : "Rescan") { scanner.scan() }
                }
                Button("Select all safe") { selectedCategories = Set(CleanupCatalog.all.filter { $0.risk == .safe && (scanner.measurements[$0.id]?.bytes ?? 0) > 0 }.map(\.id)) }
                    .disabled(scanner.isScanning)
            }
            if !license.isPro { ProLockedBanner(feature: "Cleaning") }
            ForEach(CleanupCatalog.groups, id: \.self) { group in
                let categories = CleanupCatalog.all.filter { $0.group == group && isVisible($0) }
                if !categories.isEmpty {
                    Text(group).font(.caption.weight(.semibold)).foregroundStyle(.secondary).padding(.top, 6)
                    ForEach(categories) { category in
                        categoryRow(category)
                    }
                }
            }
            Divider()
            HStack {
                Text(selectionSummary).font(.callout).foregroundStyle(.secondary)
                Spacer()
                Button {
                    confirmClean = true
                } label: {
                    Label(cleaning ? "Cleaning…" : "Clean selected", systemImage: "trash")
                }
                .buttonStyle(.borderedProminent)
                .disabled(selectedCategories.isEmpty || cleaning || !license.isPro)
            }
        }
        .card()
    }

    private func isVisible(_ category: CleanupCategory) -> Bool {
        guard let measurement = scanner.measurements[category.id] else { return !category.onlyIfExists }
        return measurement.exists || !category.onlyIfExists
    }

    private func categoryRow(_ category: CleanupCategory) -> some View {
        let measurement = scanner.measurements[category.id]
        let selected = selectedCategories.contains(category.id)
        return HStack(spacing: 12) {
            Toggle("", isOn: Binding(get: { selected }, set: { on in if on { selectedCategories.insert(category.id) } else { selectedCategories.remove(category.id) } }))
                .toggleStyle(.checkbox)
                .labelsHidden()
                .disabled((measurement?.bytes ?? 0) == 0 && measurement?.items == 0 || measurement?.accessible == false)
            Image(systemName: category.symbol).foregroundStyle(riskColor(category.risk)).frame(width: 22)
            VStack(alignment: .leading, spacing: 2) {
                HStack(spacing: 6) {
                    Text(category.title).font(.callout.weight(.medium))
                    Text(category.risk.title).font(.caption2).padding(.horizontal, 5).padding(.vertical, 1).background(riskColor(category.risk).opacity(0.15), in: Capsule()).foregroundStyle(riskColor(category.risk))
                    if category.isPro && !license.isPro { ProBadge() }
                }
                Text(category.detail).font(.caption).foregroundStyle(.secondary).lineLimit(2)
                if measurement?.accessible == false {
                    Button("Needs Full Disk Access — open System Settings") { Permissions.open(.fullDiskAccess) }.buttonStyle(.link).font(.caption)
                }
            }
            Spacer()
            VStack(alignment: .trailing, spacing: 2) {
                Text(measurement.map { Format.bytes($0.bytes) } ?? (scanner.isScanning ? "…" : "—")).font(.callout.monospacedDigit().weight(.semibold))
                if let measurement, measurement.items > 0 { Text("\(Format.count(measurement.items)) items").font(.caption2).foregroundStyle(.secondary) }
            }
            .frame(width: 90, alignment: .trailing)
            if let path = category.paths.first, !path.isEmpty {
                Button { NSWorkspace.shared.activateFileViewerSelecting([URL(fileURLWithPath: (path as NSString).expandingTildeInPath)]) } label: { Image(systemName: "folder") }
                    .buttonStyle(.borderless).font(.caption).help("Reveal in Finder")
            }
        }
        .padding(.vertical, 4)
        .opacity((measurement?.bytes ?? 0) == 0 && !scanner.isScanning ? 0.55 : 1)
    }

    private func riskColor(_ risk: CleanupCategory.Risk) -> Color {
        switch risk {
        case .safe: return Theme.good
        case .review: return Theme.warning
        case .careful: return Theme.critical
        }
    }

    private var selectionSummary: String {
        let bytes = selectedCategories.reduce(Int64(0)) { $0 + (scanner.measurements[$1]?.bytes ?? 0) }
        if selectedCategories.isEmpty { return "Nothing selected" }
        return "About \(Format.bytes(bytes)) in \(selectedCategories.count) categor\(selectedCategories.count == 1 ? "y" : "ies")"
    }

    private var confirmMessage: String {
        let categories = CleanupCatalog.all.filter { selectedCategories.contains($0.id) }
        let trash = categories.filter { $0.method == .trash }.map(\.title)
        let delete = categories.filter { $0.method == .deleteContents }.map(\.title)
        var lines: [String] = []
        if !delete.isEmpty { lines.append("Deleted permanently: \(delete.joined(separator: ", ")).") }
        if !trash.isEmpty { lines.append("Moved to the Trash: \(trash.joined(separator: ", ")).") }
        if categories.contains(where: { if case .command = $0.method { return true } else { return false } }) { lines.append("Some items run a system command and may ask for your password.") }
        return lines.joined(separator: "\n")
    }

    private func clean() async {
        cleaning = true
        var freed: Int64 = 0
        var failures: [String] = []
        for category in CleanupCatalog.all where selectedCategories.contains(category.id) {
            let outcome = await CleanupService.clean(category, measurement: scanner.measurements[category.id], history: state.history)
            freed += outcome.freedBytes
            failures += outcome.failures.prefix(3)
        }
        cleaning = false
        selectedCategories.removeAll()
        outcomeMessage = "Reclaimed about \(Format.bytes(freed))." + (failures.isEmpty ? "" : "\nSome items could not be removed: \(failures.prefix(3).joined(separator: ", "))")
        scanner.scan()
    }

    // MARK: Large files

    private var largeFilesCard: some View {
        VStack(alignment: .leading, spacing: 8) {
            SectionHeader(title: "Large files", subtitle: "Files over 250 MB in your home folder. Review, then trash the ones you no longer need.", systemImage: "doc.zipper")
            ForEach(scanner.largeFiles.prefix(showLargeFiles ? 60 : 10)) { file in
                HStack {
                    Image(nsImage: NSWorkspace.shared.icon(forFile: file.url.path)).resizable().frame(width: 18, height: 18)
                    VStack(alignment: .leading, spacing: 1) {
                        Text(file.name).font(.callout).lineLimit(1)
                        Text(file.url.deletingLastPathComponent().path.replacingOccurrences(of: URL.homeDirectory.path, with: "~")).font(.caption2).foregroundStyle(.secondary).lineLimit(1)
                    }
                    Spacer()
                    if let modified = file.modified { Text(Format.relative(modified)).font(.caption).foregroundStyle(.secondary) }
                    Text(Format.bytes(file.size)).font(.callout.monospacedDigit()).frame(width: 80, alignment: .trailing)
                    Button { NSWorkspace.shared.activateFileViewerSelecting([file.url]) } label: { Image(systemName: "folder") }.buttonStyle(.borderless)
                    Button {
                        let outcome = CleanupService.trash([file.url])
                        state.toast(outcome.failures.first ?? "Moved \(file.name) to the Trash")
                        scanner.scan()
                    } label: { Image(systemName: "trash") }.buttonStyle(.borderless).disabled(!license.isPro)
                }
                .padding(.vertical, 2)
            }
            if scanner.largeFiles.count > 10 {
                Button(showLargeFiles ? "Show fewer" : "Show all \(scanner.largeFiles.count)") { showLargeFiles.toggle() }.buttonStyle(.link)
            }
        }
        .card()
    }
}
