import Foundation
import SwiftUI
import Observation

/// The object graph shared by every window. Created once by the app and injected through the environment.
@MainActor
@Observable
final class AppState {
    let settings: AppSettings
    let history: HistoryStore
    let notifications: NotificationService
    let engine: MetricsEngine
    let license: LicenseManager
    let scanner: StorageScanner
    let keepAwake: KeepAwake
    let events: EventRecorder

    var selectedSection: DashboardSection = .overview
    var startupItems: [StartupItem] = []
    var loginItems: [StartupItem] = []
    var startupItemsLoadedAt: Date?
    var showOnboarding = false
    var toastMessage: String?
    /// Set by the menu bar view so AppKit-side code can open the SwiftUI dashboard window.
    var openWindowAction: OpenWindowAction?

    init(settings: AppSettings = .shared, historyURL: URL? = HistoryStore.defaultURL) {
        self.settings = settings
        self.history = HistoryStore(url: historyURL)
        self.notifications = NotificationService()
        self.engine = MetricsEngine(history: history, settings: settings, notifications: notifications)
        self.license = LicenseManager()
        self.scanner = StorageScanner()
        self.keepAwake = KeepAwake()
        self.events = EventRecorder(history: history)
        showOnboarding = !settings.hasCompletedOnboarding
        if CommandLine.arguments.contains("-uitesting") {
            // Screenshot runs: no onboarding sheet, no permission prompts, deterministic section.
            showOnboarding = false
            settings.alertsEnabled = false
        }
    }

    func start() {
        engine.start()
        events.start()
        Task { await notifications.refreshAuthorization() }
        if CommandLine.arguments.contains("-diagnostics") {
            // `open -a Vigil --args -diagnostics`: sample for a few seconds, write the report, quit.
            Task { @MainActor in
                try? await Task.sleep(nanoseconds: 8_000_000_000)
                Diagnostics.export(engine: engine, settings: settings)
                NSApp.terminate(nil)
            }
        }
    }

    func stop() {
        engine.stop()
        events.stop()
        keepAwake.deactivate()
    }

    /// Reloads launch agents and login items (the latter may prompt for Automation access).
    func reloadStartupItems(includeLoginItems: Bool) async {
        let agents = await Task.detached(priority: .userInitiated) { StartupItemsService.load() }.value
        startupItems = agents
        if includeLoginItems { loginItems = StartupItemsService.loginItems() }
        startupItemsLoadedAt = Date()
    }

    var startupItemCount: Int { startupItems.filter { $0.kind == .userAgent || $0.kind == .globalAgent }.count + loginItems.count }

    func toast(_ message: String) {
        toastMessage = message
        Task {
            try? await Task.sleep(nanoseconds: 3_500_000_000)
            if toastMessage == message { toastMessage = nil }
        }
    }

    func perform(_ action: HealthAction) {
        switch action {
        case .openSection(let section):
            selectedSection = section
            openDashboard()
        case .toolbox(let id):
            if let toolboxAction = Toolbox.action(id: id) {
                let result = Toolbox.run(toolboxAction)
                switch result {
                case .success(let message): toast(message)
                case .failure(let message): toast(message)
                }
            }
        case .openURL(let string):
            if let url = URL(string: string) { NSWorkspace.shared.open(url) }
        case .systemSettings(let string):
            Permissions.openSystemSettings(string)
        }
    }

    func openDashboard() {
        NSApp.activate(ignoringOtherApps: true)
        if let window = NSApp.windows.first(where: { ($0.identifier?.rawValue.hasPrefix("dashboard") ?? false) }) {
            window.makeKeyAndOrderFront(nil)
        } else {
            openWindowAction?(id: "dashboard")
        }
    }

    /// Runs a toolbox action, routing the ones that own UI state (keep awake, cleaning modes) to their controllers.
    func runToolbox(_ action: ToolboxAction) {
        if action.isPro && !license.isPro {
            toast("\(action.title) is a Pro feature. Start the trial or enter a licence in Settings.")
            selectedSection = .toolbox
            return
        }
        switch action.id {
        case "keepAwake":
            keepAwake.toggle()
            toast(keepAwake.isActive ? "Keep Awake on. Your Mac will not sleep." : "Keep Awake off.")
        case "keyboardClean":
            CleaningModeController.shared.start(.keyboard)
        case "screenClean":
            CleaningModeController.shared.start(.screen)
        default:
            let result = Toolbox.run(action)
            switch result {
            case .success(let message):
                toast(message)
                history.record(.toolbox, title: action.title, detail: message)
            case .failure(let message):
                toast(message)
            }
        }
    }
}
