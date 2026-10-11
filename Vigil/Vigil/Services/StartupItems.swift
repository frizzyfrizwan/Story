import Foundation
import AppKit

/// Something that starts automatically: a login item, a user/system launch agent or a launch daemon.
struct StartupItem: Identifiable, Equatable {
    enum Kind: String, CaseIterable {
        case loginItem = "Login item", userAgent = "Your launch agents", globalAgent = "Launch agents (all users)", daemon = "Launch daemons"
        var explanation: String {
            switch self {
            case .loginItem: return "Apps listed in System Settings → General → Login Items. They open when you log in."
            case .userAgent: return "Background helpers installed in your account by apps (sync clients, updaters, menu bar helpers). Safe to disable; the app re-adds it if it really needs it."
            case .globalAgent: return "Background helpers for every user, installed by apps with an installer package."
            case .daemon: return "Root-level services (drivers, VPNs, backup agents). Changing these needs an administrator password; Vigil shows them read-only."
            }
        }
    }

    let id: String
    let kind: Kind
    let label: String
    let name: String
    let program: String?
    let path: URL?
    let runAtLoad: Bool
    let keepAlive: Bool
    let isLoaded: Bool
    let isDisabled: Bool
    let vendor: String
    let isApple: Bool

    var canToggle: Bool { kind == .userAgent || kind == .loginItem }
}

enum StartupItemsService {
    static func load() -> [StartupItem] {
        var items: [StartupItem] = []
        let loaded = loadedLabels()
        let disabled = disabledLabels()
        items += agents(in: URL.home("~/Library/LaunchAgents"), kind: .userAgent, loaded: loaded, disabled: disabled)
        items += agents(in: URL(fileURLWithPath: "/Library/LaunchAgents"), kind: .globalAgent, loaded: loaded, disabled: disabled)
        items += agents(in: URL(fileURLWithPath: "/Library/LaunchDaemons"), kind: .daemon, loaded: loaded, disabled: disabled)
        return items.sorted { lhs, rhs in
            if lhs.kind != rhs.kind { return kindOrder(lhs.kind) < kindOrder(rhs.kind) }
            return lhs.name.localizedCaseInsensitiveCompare(rhs.name) == .orderedAscending
        }
    }

    private static func kindOrder(_ kind: StartupItem.Kind) -> Int {
        switch kind {
        case .loginItem: return 0
        case .userAgent: return 1
        case .globalAgent: return 2
        case .daemon: return 3
        }
    }

    /// Login items via System Events (prompts for Automation permission the first time). Call on the main thread.
    @MainActor
    static func loginItems() -> [StartupItem] {
        let script = """
        tell application "System Events"
            set output to ""
            repeat with anItem in login items
                set output to output & (name of anItem) & "\\t" & (path of anItem) & "\\t" & (hidden of anItem as string) & linefeed
            end repeat
            return output
        end tell
        """
        guard let output = try? Shell.appleScript(script) else { return [] }
        return output.split(separator: "\n").compactMap { line in
            let parts = line.split(separator: "\t", omittingEmptySubsequences: false).map(String.init)
            guard parts.count >= 2, !parts[0].isEmpty else { return nil }
            let path = URL(fileURLWithPath: parts[1])
            let bundle = Bundle(url: path)
            let vendor = bundle?.bundleIdentifier.map { Self.vendorName($0) } ?? "Unknown"
            return StartupItem(id: "login.\(parts[0])", kind: .loginItem, label: parts[0], name: parts[0], program: parts[1], path: path,
                               runAtLoad: true, keepAlive: false, isLoaded: true, isDisabled: false, vendor: vendor, isApple: bundle?.bundleIdentifier?.hasPrefix("com.apple.") ?? false)
        }
    }

    @MainActor
    static func removeLoginItem(_ item: StartupItem) throws {
        let escaped = item.name.replacingOccurrences(of: "\"", with: "\\\"")
        try Shell.appleScript("tell application \"System Events\" to delete login item \"\(escaped)\"")
    }

    private static func agents(in directory: URL, kind: StartupItem.Kind, loaded: Set<String>, disabled: Set<String>) -> [StartupItem] {
        guard let urls = try? FileManager.default.contentsOfDirectory(at: directory, includingPropertiesForKeys: nil, options: [.skipsHiddenFiles]) else { return [] }
        return urls.filter { $0.pathExtension == "plist" }.compactMap { url in
            guard let data = try? Data(contentsOf: url),
                  let plist = try? PropertyListSerialization.propertyList(from: data, format: nil) as? [String: Any] else { return nil }
            let label = plist["Label"] as? String ?? url.deletingPathExtension().lastPathComponent
            var program = plist["Program"] as? String
            if program == nil, let arguments = plist["ProgramArguments"] as? [String] { program = arguments.first }
            let runAtLoad = plist["RunAtLoad"] as? Bool ?? false
            let keepAlive: Bool
            if let flag = plist["KeepAlive"] as? Bool { keepAlive = flag } else { keepAlive = plist["KeepAlive"] != nil }
            let isDisabled = (plist["Disabled"] as? Bool ?? false) || disabled.contains(label)
            return StartupItem(id: "\(kind.rawValue).\(label)", kind: kind, label: label, name: friendlyName(label: label, program: program),
                               program: program, path: url, runAtLoad: runAtLoad, keepAlive: keepAlive,
                               isLoaded: loaded.contains(label), isDisabled: isDisabled, vendor: vendorName(label), isApple: label.hasPrefix("com.apple."))
        }
    }

    /// Labels currently loaded into launchd for this user.
    private static func loadedLabels() -> Set<String> {
        let result = Shell.run("/bin/launchctl", ["list"], timeout: 10)
        guard result.succeeded else { return [] }
        var labels = Set<String>()
        for line in result.output.split(separator: "\n").dropFirst() {
            let parts = line.split(separator: "\t")
            if let label = parts.last { labels.insert(String(label)) }
        }
        return labels
    }

    private static func disabledLabels() -> Set<String> {
        let result = Shell.run("/bin/launchctl", ["print-disabled", "gui/\(getuid())"], timeout: 10)
        guard result.succeeded else { return [] }
        var labels = Set<String>()
        for line in result.output.split(separator: "\n") {
            let trimmed = line.trimmingCharacters(in: .whitespaces)
            guard trimmed.hasSuffix("=> disabled") || trimmed.hasSuffix("=> true") else { continue }
            let label = trimmed.replacingOccurrences(of: "\"", with: "").split(separator: " ").first.map(String.init) ?? ""
            if !label.isEmpty { labels.insert(label) }
        }
        return labels
    }

    static func vendorName(_ label: String) -> String {
        let parts = label.split(separator: ".")
        guard parts.count >= 2 else { return label }
        let vendor = String(parts[1])
        let known: [String: String] = [
            "apple": "Apple", "google": "Google", "microsoft": "Microsoft", "adobe": "Adobe", "dropbox": "Dropbox", "spotify": "Spotify",
            "docker": "Docker", "zoom": "Zoom", "slack": "Slack", "logitech": "Logitech", "logi": "Logitech", "jetbrains": "JetBrains",
            "github": "GitHub", "1password": "1Password", "agilebits": "1Password", "bitdefender": "Bitdefender", "malwarebytes": "Malwarebytes",
            "backblaze": "Backblaze", "box": "Box", "nordvpn": "NordVPN", "expressvpn": "ExpressVPN", "teamviewer": "TeamViewer", "oracle": "Oracle",
            "mozilla": "Mozilla", "brave": "Brave", "discordapp": "Discord", "tinyspeck": "Slack", "wacom": "Wacom", "elgato": "Elgato", "corsair": "Corsair",
            "razer": "Razer", "steam": "Steam", "valvesoftware": "Valve", "epicgames": "Epic Games", "nvidia": "NVIDIA", "canon": "Canon", "hp": "HP", "epson": "Epson",
        ]
        if let name = known[vendor.lowercased()] { return name }
        return vendor.prefix(1).uppercased() + vendor.dropFirst()
    }

    static func friendlyName(label: String, program: String?) -> String {
        if let program, let range = program.range(of: ".app/") {
            let appPath = String(program[..<range.lowerBound])
            return (appPath as NSString).lastPathComponent
        }
        let parts = label.split(separator: ".")
        if parts.count >= 3 {
            return parts.dropFirst(2).joined(separator: ".")
        }
        return label
    }

    // MARK: Enable / disable user agents

    static func setEnabled(_ item: StartupItem, enabled: Bool) throws {
        guard item.kind == .userAgent, let path = item.path else { throw ShellError.privilegedFailed("Only your own launch agents can be changed here.") }
        let domain = "gui/\(getuid())"
        if enabled {
            Shell.run("/bin/launchctl", ["enable", "\(domain)/\(item.label)"], timeout: 10)
            try Shell.runChecked("/bin/launchctl", ["bootstrap", domain, path.path], timeout: 10)
        } else {
            Shell.run("/bin/launchctl", ["bootout", "\(domain)/\(item.label)"], timeout: 10)
            try Shell.runChecked("/bin/launchctl", ["disable", "\(domain)/\(item.label)"], timeout: 10)
        }
    }

    static func reveal(_ item: StartupItem) {
        guard let path = item.path else { return }
        NSWorkspace.shared.activateFileViewerSelecting([path])
    }
}
