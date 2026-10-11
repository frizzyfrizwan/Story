import SwiftUI
import AppKit

/// Activity Monitor, explained: every process with a plain-English description and a safe-to-quit verdict.
struct ActivityView: View {
    @Environment(AppState.self) private var state
    @Environment(MetricsEngine.self) private var engine
    @Environment(AppSettings.self) private var settings

    @State private var sortOrder = [KeyPathComparator(\ProcessSample.cpuPercent, order: .reverse)]
    @State private var selection: pid_t?
    @State private var search = ""
    @State private var confirmForceQuit = false
    @State private var errorMessage: String?

    private var rows: [ProcessSample] {
        let base = engine.visibleProcesses
        let filtered = search.isEmpty ? base : base.filter { $0.name.localizedCaseInsensitiveContains(search) || ($0.bundleIdentifier?.localizedCaseInsensitiveContains(search) ?? false) || "\($0.pid)" == search }
        return filtered.sorted(using: sortOrder)
    }

    private var selected: ProcessSample? { engine.processes.first { $0.pid == selection } }

    var body: some View {
        HSplitView {
            VStack(spacing: 0) {
                toolbar
                Table(rows, selection: $selection, sortOrder: $sortOrder) {
                    TableColumn("Process", value: \.name) { process in
                        HStack(spacing: 8) {
                            if let icon = engine.icon(for: process) {
                                Image(nsImage: icon).resizable().frame(width: 18, height: 18)
                            } else {
                                Image(systemName: "gearshape").frame(width: 18, height: 18).foregroundStyle(.secondary)
                            }
                            Text(process.name)
                        }
                    }
                    .width(min: 180, ideal: 260)
                    TableColumn("% CPU", value: \.cpuPercent) { process in
                        Text(String(format: "%.1f", process.cpuPercent)).monospacedDigit()
                            .foregroundStyle(process.cpuPercent >= 100 ? Theme.critical : process.cpuPercent >= 50 ? Theme.warning : .primary)
                    }
                    .width(min: 60, ideal: 70)
                    TableColumn("Memory", value: \.memoryBytes) { process in
                        Text(Format.memory(process.memoryBytes)).monospacedDigit()
                    }
                    .width(min: 80, ideal: 90)
                    TableColumn("Threads", value: \.threads) { process in
                        Text("\(process.threads)").monospacedDigit()
                    }
                    .width(min: 50, ideal: 60)
                    TableColumn("Disk", value: \.diskWriteBytesPerSecond) { process in
                        Text(process.diskReadBytesPerSecond + process.diskWriteBytesPerSecond > 1000 ? Format.rate(process.diskReadBytesPerSecond + process.diskWriteBytesPerSecond) : "—").monospacedDigit()
                    }
                    .width(min: 70, ideal: 90)
                    TableColumn("User", value: \.user)
                        .width(min: 60, ideal: 80)
                    TableColumn("PID", value: \.pid) { process in
                        Text("\(process.pid)").monospacedDigit()
                    }
                    .width(min: 50, ideal: 60)
                }
                .accessibilityIdentifier("activity.table")
                .frame(maxWidth: .infinity, maxHeight: .infinity)
                statusBar
            }
            .frame(minWidth: 520, maxWidth: .infinity, maxHeight: .infinity)
            detailPane
                .frame(minWidth: 280, idealWidth: 320, maxWidth: 400, maxHeight: .infinity)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .alert("Force quit \(selected?.name ?? "process")?", isPresented: $confirmForceQuit) {
            Button("Force Quit", role: .destructive) { quit(force: true) }
            Button("Cancel", role: .cancel) {}
        } message: {
            Text("Unsaved changes in this process will be lost.")
        }
        .alert("Couldn't quit", isPresented: Binding(get: { errorMessage != nil }, set: { if !$0 { errorMessage = nil } })) {
            Button("OK") { errorMessage = nil }
        } message: {
            Text(errorMessage ?? "")
        }
        .accessibilityIdentifier("page.activity")
    }

    private var toolbar: some View {
        @Bindable var settings = settings
        return HStack(spacing: 12) {
            TextField("Search processes", text: $search)
                .textFieldStyle(.roundedBorder)
                .frame(maxWidth: 260)
            Toggle("Show all processes", isOn: $settings.showAllProcesses)
                .toggleStyle(.checkbox)
            Spacer()
            Text("\(engine.processes.count) processes · \(engine.cpu.threadCount) threads").font(.caption).foregroundStyle(.secondary)
        }
        .padding(10)
    }

    private var statusBar: some View {
        HStack {
            Text(String(format: "CPU %.0f%% (user %.0f%%, system %.0f%%)", engine.cpu.total, engine.cpu.user, engine.cpu.system))
            Spacer()
            Text("Memory \(Format.memory(engine.memory.used)) · pressure \(engine.memory.pressure.title)")
        }
        .font(.caption.monospacedDigit())
        .foregroundStyle(.secondary)
        .padding(.horizontal, 12)
        .padding(.vertical, 6)
        .background(.bar)
    }

    @ViewBuilder
    private var detailPane: some View {
        if let process = selected {
            let explanation = ProcessDictionary.explanation(for: process.name, bundleIdentifier: process.bundleIdentifier, isApplication: process.isApplication)
            ScrollView {
                VStack(alignment: .leading, spacing: 14) {
                    HStack(spacing: 12) {
                        if let icon = engine.icon(for: process) {
                            Image(nsImage: icon).resizable().frame(width: 44, height: 44)
                        } else {
                            Image(systemName: "gearshape").font(.system(size: 32)).foregroundStyle(.secondary).frame(width: 44, height: 44)
                        }
                        VStack(alignment: .leading, spacing: 2) {
                            Text(explanation.title).font(.title3.weight(.semibold))
                            Text(explanation.category).font(.caption).foregroundStyle(.secondary)
                        }
                    }
                    verdict(explanation.verdict)
                    Text(explanation.summary).font(.callout).fixedSize(horizontal: false, vertical: true)
                    Divider()
                    KeyValueRow(key: "CPU", value: String(format: "%.1f%%", process.cpuPercent))
                    KeyValueRow(key: "Memory", value: Format.memory(process.memoryBytes))
                    KeyValueRow(key: "Threads", value: "\(process.threads)")
                    KeyValueRow(key: "Disk I/O", value: "\(Format.rate(process.diskReadBytesPerSecond)) read · \(Format.rate(process.diskWriteBytesPerSecond)) write")
                    KeyValueRow(key: "PID", value: "\(process.pid) (parent \(process.parentPID))", monospaced: true)
                    KeyValueRow(key: "User", value: process.user)
                    if let start = process.startTime { KeyValueRow(key: "Running since", value: Format.dateTime(start)) }
                    if let bundle = process.bundleIdentifier { KeyValueRow(key: "Bundle", value: bundle, monospaced: true, copyable: true) }
                    if let path = process.path {
                        VStack(alignment: .leading, spacing: 4) {
                            Text("Path").font(.callout).foregroundStyle(.secondary)
                            Text(path).font(.caption.monospaced()).textSelection(.enabled).fixedSize(horizontal: false, vertical: true)
                        }
                    }
                    Divider()
                    HStack {
                        Button("Quit") { quit(force: false) }
                        Button("Force Quit") { confirmForceQuit = true }
                        Spacer()
                        if let path = process.path {
                            Button {
                                NSWorkspace.shared.activateFileViewerSelecting([URL(fileURLWithPath: path)])
                            } label: { Image(systemName: "folder") }
                            .help("Reveal in Finder")
                        }
                    }
                    if explanation.verdict == .system {
                        Text("macOS restarts most system processes automatically; quitting them rarely helps and can log you out.")
                            .font(.caption).foregroundStyle(.secondary)
                    }
                }
                .padding(16)
            }
        } else {
            EmptyState(systemImage: "cursorarrow.click", title: "Select a process", message: "Vigil explains what it is, whether it is safe to quit, and what it is doing right now.")
        }
    }

    private func verdict(_ verdict: ProcessExplanation.Verdict) -> some View {
        let (text, symbol, color): (String, String, Color) = {
            switch verdict {
            case .system: return ("Part of macOS — leave it running", "checkmark.shield", Theme.cpu)
            case .safeToQuit: return ("Safe to quit", "hand.thumbsup", Theme.good)
            case .investigate: return ("Normal in bursts; investigate if sustained", "magnifyingglass", Theme.warning)
            }
        }()
        return Label(text, systemImage: symbol)
            .font(.callout.weight(.medium))
            .padding(.horizontal, 10)
            .padding(.vertical, 6)
            .background(color.opacity(0.14), in: Capsule())
            .foregroundStyle(color)
    }

    private func quit(force: Bool) {
        guard let process = selected else { return }
        if let error = engine.terminate(process, force: force) {
            if force, error.contains("another user") {
                if let adminError = engine.terminateAsAdministrator(process) { errorMessage = adminError }
            } else {
                errorMessage = error
            }
        }
    }
}
