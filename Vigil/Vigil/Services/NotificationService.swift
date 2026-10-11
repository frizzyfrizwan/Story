import Foundation
import UserNotifications

/// Posts user notifications with per-alert cooldowns so the same problem is not reported every second.
final class NotificationService {
    private var lastSent: [String: Date] = [:]
    private let cooldown: TimeInterval
    private(set) var authorized = false

    init(cooldown: TimeInterval = 30 * 60) {
        self.cooldown = cooldown
    }

    func requestAuthorization() async -> Bool {
        do {
            let granted = try await UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .sound, .badge])
            authorized = granted
            return granted
        } catch {
            return false
        }
    }

    func refreshAuthorization() async {
        let settings = await UNUserNotificationCenter.current().notificationSettings()
        authorized = settings.authorizationStatus == .authorized || settings.authorizationStatus == .provisional
    }

    /// Returns true when a notification was actually posted.
    @discardableResult
    func alert(id: String, title: String, body: String, enabled: Bool) -> Bool {
        guard enabled, shouldSend(id: id) else { return false }
        lastSent[id] = Date()
        let content = UNMutableNotificationContent()
        content.title = title
        content.body = body
        content.sound = .default
        let request = UNNotificationRequest(identifier: "vigil.\(id)", content: content, trigger: nil)
        UNUserNotificationCenter.current().add(request)
        return true
    }

    func shouldSend(id: String) -> Bool {
        guard let last = lastSent[id] else { return true }
        return Date().timeIntervalSince(last) >= cooldown
    }

    func resetCooldowns() { lastSent.removeAll() }
}
