import Foundation
import AppKit
import ApplicationServices
import CoreLocation
import UserNotifications

/// Checks and requests the macOS permissions Vigil can make use of. None are required for basic monitoring.
enum Permissions {
    enum Kind: String, CaseIterable, Identifiable {
        case fullDiskAccess, accessibility, notifications, location, automation
        var id: String { rawValue }

        var title: String {
            switch self {
            case .fullDiskAccess: return "Full Disk Access"
            case .accessibility: return "Accessibility"
            case .notifications: return "Notifications"
            case .location: return "Location"
            case .automation: return "Automation"
            }
        }

        var reason: String {
            switch self {
            case .fullDiskAccess: return "Lets the storage scanner measure Mail downloads, Safari caches, the Trash and iOS backups. Without it those categories show as unavailable."
            case .accessibility: return "Needed for Keyboard Cleaning mode to block every key, including ⌘-Tab and ⌘-Q. Without it only keys inside Vigil's window are blocked."
            case .notifications: return "Alerts when your disk is almost full, memory pressure turns critical, a process runs away, or the Mac is overheating."
            case .location: return "macOS only reveals the Wi-Fi network name to apps with Location access. Vigil never stores or sends your location."
            case .automation: return "Lets Vigil ask Finder to empty the Trash, list login items via System Events, and toggle Dark Mode. macOS asks the first time each is used."
            }
        }

        var symbol: String {
            switch self {
            case .fullDiskAccess: return "externaldrive.badge.checkmark"
            case .accessibility: return "accessibility"
            case .notifications: return "bell.badge"
            case .location: return "location"
            case .automation: return "gearshape.2"
            }
        }

        var settingsURL: URL {
            switch self {
            case .fullDiskAccess: return URL(string: "x-apple.systempreferences:com.apple.preference.security?Privacy_AllFiles")!
            case .accessibility: return URL(string: "x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility")!
            case .notifications: return URL(string: "x-apple.systempreferences:com.apple.Notifications-Settings.extension")!
            case .location: return URL(string: "x-apple.systempreferences:com.apple.preference.security?Privacy_LocationServices")!
            case .automation: return URL(string: "x-apple.systempreferences:com.apple.preference.security?Privacy_Automation")!
            }
        }
    }

    enum Status: Equatable {
        case granted, denied, unknown
    }

    static func status(of kind: Kind) async -> Status {
        switch kind {
        case .fullDiskAccess: return hasFullDiskAccess() ? .granted : .denied
        case .accessibility: return AXIsProcessTrusted() ? .granted : .denied
        case .notifications:
            let settings = await UNUserNotificationCenter.current().notificationSettings()
            switch settings.authorizationStatus {
            case .authorized, .provisional: return .granted
            case .denied: return .denied
            default: return .unknown
            }
        case .location:
            switch CLLocationManager().authorizationStatus {
            case .authorizedAlways: return .granted
            case .denied, .restricted: return .denied
            default: return .unknown
            }
        case .automation: return .unknown
        }
    }

    /// Full Disk Access is inferred by trying to list a TCC-protected folder.
    static func hasFullDiskAccess() -> Bool {
        let probes = ["~/Library/Safari", "~/Library/Mail", "~/Library/Application Support/com.apple.TCC"]
        for probe in probes {
            let path = (probe as NSString).expandingTildeInPath
            guard FileManager.default.fileExists(atPath: path) else { continue }
            if (try? FileManager.default.contentsOfDirectory(atPath: path)) != nil { return true }
            return false
        }
        return false
    }

    static func requestAccessibility() {
        let options = [kAXTrustedCheckOptionPrompt.takeUnretainedValue() as String: true] as CFDictionary
        AXIsProcessTrustedWithOptions(options)
    }

    static func open(_ kind: Kind) {
        NSWorkspace.shared.open(kind.settingsURL)
    }

    static func openSystemSettings(_ urlString: String) {
        if let url = URL(string: urlString) { NSWorkspace.shared.open(url) }
    }
}

/// Keeps a CLLocationManager alive so the Wi-Fi SSID becomes readable once the user grants access.
final class LocationPermission: NSObject, CLLocationManagerDelegate {
    static let shared = LocationPermission()
    private let manager = CLLocationManager()

    override init() {
        super.init()
        manager.delegate = self
    }

    func request() {
        manager.requestWhenInUseAuthorization()
    }

    var status: CLAuthorizationStatus { manager.authorizationStatus }
}
