import SwiftUI
import AppKit
import UserNotifications

@main
struct VigilApp: App {
    @NSApplicationDelegateAdaptor(AppDelegate.self) private var delegate
    @State private var state = AppState()

    // The dashboard window comes first so SwiftUI opens it at launch; the menu bar item is always present.
    var body: some Scene {
        Window("Vigil", id: "dashboard") {
            DashboardView()
                .environment(state)
                .environment(state.settings)
                .environment(state.engine)
                .environment(state.license)
                .environment(state.scanner)
                .environment(state.keepAwake)
                .frame(minWidth: 980, minHeight: 640)
                .onAppear {
                    delegate.state = state
                    state.start()
                }
        }
        .defaultSize(width: 1180, height: 780)
        .windowResizability(.contentMinSize)
        .commands {
            CommandGroup(replacing: .newItem) {}
            CommandGroup(after: .toolbar) {
                Button("Refresh System Information") { state.engine.refreshSystemInfo() }
                    .keyboardShortcut("r", modifiers: [.command])
            }
        }

        MenuBarExtra {
            MenuBarView()
                .environment(state)
                .environment(state.settings)
                .environment(state.engine)
                .environment(state.license)
                .environment(state.keepAwake)
        } label: {
            MenuBarLabel()
                .environment(state.engine)
                .environment(state.settings)
                .onAppear {
                    delegate.state = state
                    state.start()
                }
        }
        .menuBarExtraStyle(.window)

        Settings {
            SettingsView()
                .environment(state)
                .environment(state.settings)
                .environment(state.engine)
                .environment(state.license)
        }
    }
}

final class AppDelegate: NSObject, NSApplicationDelegate, UNUserNotificationCenterDelegate {
    var state: AppState?

    func applicationDidFinishLaunching(_ notification: Notification) {
        UNUserNotificationCenter.current().delegate = self
        AppSettings.shared.applyActivationPolicy()
    }

    func applicationShouldHandleReopen(_ sender: NSApplication, hasVisibleWindows flag: Bool) -> Bool {
        if !flag { state?.openDashboard() }
        return true
    }

    func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool { false }

    func applicationWillTerminate(_ notification: Notification) {
        state?.stop()
    }

    // Show banners while the app is frontmost too.
    func userNotificationCenter(_ center: UNUserNotificationCenter, willPresent notification: UNNotification) async -> UNNotificationPresentationOptions {
        [.banner, .sound]
    }
}
