import Foundation
import AppKit

/// Listens to workspace notifications (app launches, sleep, wake) and writes them to the history.
final class EventRecorder {
    private let history: HistoryStore
    private var observers: [NSObjectProtocol] = []

    init(history: HistoryStore) {
        self.history = history
    }

    func start() {
        let center = NSWorkspace.shared.notificationCenter
        observers.append(center.addObserver(forName: NSWorkspace.didLaunchApplicationNotification, object: nil, queue: .main) { [weak self] note in
            guard let app = note.userInfo?[NSWorkspace.applicationUserInfoKey] as? NSRunningApplication, let name = app.localizedName else { return }
            self?.history.record(.appLaunched, title: "\(name) opened", detail: app.bundleIdentifier ?? "")
        })
        observers.append(center.addObserver(forName: NSWorkspace.didTerminateApplicationNotification, object: nil, queue: .main) { [weak self] note in
            guard let app = note.userInfo?[NSWorkspace.applicationUserInfoKey] as? NSRunningApplication, let name = app.localizedName else { return }
            self?.history.record(.appQuit, title: "\(name) quit", detail: app.bundleIdentifier ?? "")
        })
        observers.append(center.addObserver(forName: NSWorkspace.willSleepNotification, object: nil, queue: .main) { [weak self] _ in
            self?.history.record(.sleep, title: "Mac went to sleep")
        })
        observers.append(center.addObserver(forName: NSWorkspace.didWakeNotification, object: nil, queue: .main) { [weak self] _ in
            self?.history.record(.wake, title: "Mac woke up")
        })
        observers.append(center.addObserver(forName: NSWorkspace.didMountNotification, object: nil, queue: .main) { [weak self] note in
            let path = (note.userInfo?["NSDevicePath"] as? String) ?? ""
            self?.history.record(.system, title: "Disk connected", detail: path)
        })
        observers.append(center.addObserver(forName: NSWorkspace.didUnmountNotification, object: nil, queue: .main) { [weak self] note in
            let path = (note.userInfo?["NSDevicePath"] as? String) ?? ""
            self?.history.record(.system, title: "Disk ejected", detail: path)
        })
        history.record(.system, title: "Vigil started", detail: "Monitoring began")
    }

    func stop() {
        let center = NSWorkspace.shared.notificationCenter
        observers.forEach { center.removeObserver($0) }
        observers.removeAll()
    }
}
