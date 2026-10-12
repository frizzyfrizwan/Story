import Foundation
import AppKit

/// One-click utilities. Each action knows whether it needs an administrator password and whether it is reversible.
struct ToolboxAction: Identifiable, Equatable {
    enum Category: String, CaseIterable, Identifiable {
        case cleaning = "Cleaning modes", performance = "Performance", system = "System", network = "Network", display = "Display & Finder", maintenance = "Maintenance"
        var id: String { rawValue }
    }

    let id: String
    let title: String
    let detail: String
    let symbol: String
    let category: Category
    let needsAdmin: Bool
    let isDestructive: Bool
    var isPro: Bool = false
}

enum ToolboxResult: Equatable {
    case success(String)
    case failure(String)
}

@MainActor
enum Toolbox {
    static let actions: [ToolboxAction] = [
        ToolboxAction(id: "keepAwake", title: "Keep Awake", detail: "Stop the display and the Mac from sleeping while a download, build or presentation runs.", symbol: "cup.and.saucer", category: .cleaning, needsAdmin: false, isDestructive: false),
        ToolboxAction(id: "keyboardClean", title: "Keyboard Cleaning", detail: "Lock the keyboard for 45 seconds so you can wipe it without typing gibberish.", symbol: "keyboard", category: .cleaning, needsAdmin: false, isDestructive: false),
        ToolboxAction(id: "screenClean", title: "Screen Cleaning", detail: "Black out every display and ignore the trackpad so smudges are easy to see and wipe.", symbol: "display", category: .cleaning, needsAdmin: false, isDestructive: false),
        ToolboxAction(id: "purge", title: "Free Up Memory", detail: "Flush inactive memory and file caches (the `purge` command). Useful before a heavy task; macOS refills caches as needed.", symbol: "memorychip", category: .performance, needsAdmin: true, isDestructive: false, isPro: true),
        ToolboxAction(id: "emptyTrash", title: "Empty Trash", detail: "Asks Finder to empty the Trash on every volume.", symbol: "trash", category: .performance, needsAdmin: false, isDestructive: true),
        ToolboxAction(id: "thinSnapshots", title: "Remove Local Snapshots", detail: "Delete Time Machine's local snapshots to reclaim purgeable space right now instead of waiting for macOS.", symbol: "clock.badge.xmark", category: .performance, needsAdmin: true, isDestructive: true, isPro: true),
        ToolboxAction(id: "flushDNS", title: "Flush DNS Cache", detail: "Clears cached DNS lookups. Fixes sites that will not load after a network or VPN change.", symbol: "arrow.triangle.2.circlepath", category: .network, needsAdmin: true, isDestructive: false),
        ToolboxAction(id: "renewDHCP", title: "Renew DHCP Lease", detail: "Ask the router for a fresh IP address on the active interface.", symbol: "wifi.router", category: .network, needsAdmin: true, isDestructive: false),
        ToolboxAction(id: "restartFinder", title: "Relaunch Finder", detail: "Restart Finder when the desktop stops responding or icons vanish.", symbol: "folder", category: .display, needsAdmin: false, isDestructive: false),
        ToolboxAction(id: "restartDock", title: "Relaunch Dock", detail: "Restart the Dock, Mission Control and Launchpad.", symbol: "dock.rectangle", category: .display, needsAdmin: false, isDestructive: false),
        ToolboxAction(id: "restartMenuBar", title: "Relaunch Menu Bar", detail: "Restart Control Center and SystemUIServer when menu bar items freeze.", symbol: "menubar.rectangle", category: .display, needsAdmin: false, isDestructive: false),
        ToolboxAction(id: "toggleDesktopIcons", title: "Hide Desktop Icons", detail: "Toggle a clean desktop for screenshots and presentations. Files stay in the Desktop folder.", symbol: "rectangle.dashed", category: .display, needsAdmin: false, isDestructive: false),
        ToolboxAction(id: "toggleHiddenFiles", title: "Show Hidden Files", detail: "Toggle dot-files and hidden folders in Finder (same as ⌘⇧.).", symbol: "eye", category: .display, needsAdmin: false, isDestructive: false),
        ToolboxAction(id: "toggleDarkMode", title: "Toggle Dark Mode", detail: "Switch between Light and Dark appearance.", symbol: "circle.lefthalf.filled", category: .display, needsAdmin: false, isDestructive: false),
        ToolboxAction(id: "showLibrary", title: "Show ~/Library", detail: "Make your hidden Library folder visible in Finder.", symbol: "books.vertical", category: .display, needsAdmin: false, isDestructive: false),
        ToolboxAction(id: "lockScreen", title: "Lock Screen", detail: "Lock immediately.", symbol: "lock", category: .system, needsAdmin: false, isDestructive: false),
        ToolboxAction(id: "sleepDisplay", title: "Sleep Display", detail: "Turn the display off without sleeping the Mac.", symbol: "moon", category: .system, needsAdmin: false, isDestructive: false),
        ToolboxAction(id: "sleepMac", title: "Sleep Mac", detail: "Put the Mac to sleep now.", symbol: "moon.zzz", category: .system, needsAdmin: false, isDestructive: false),
        ToolboxAction(id: "ejectAll", title: "Eject All Disks", detail: "Safely eject every external drive and disk image.", symbol: "eject", category: .system, needsAdmin: false, isDestructive: false),
        ToolboxAction(id: "clearClipboard", title: "Clear Clipboard", detail: "Erase whatever is on the clipboard (passwords, card numbers).", symbol: "doc.on.clipboard", category: .system, needsAdmin: false, isDestructive: false),
        ToolboxAction(id: "rebuildSpotlight", title: "Rebuild Spotlight Index", detail: "Erase and rebuild the Spotlight index when search misses files or mds hogs the CPU for days. Re-indexing takes a while.", symbol: "magnifyingglass", category: .maintenance, needsAdmin: true, isDestructive: false, isPro: true),
        ToolboxAction(id: "rebuildLaunchServices", title: "Fix \"Open With\" Duplicates", detail: "Rebuild the Launch Services database that powers the Open With menu.", symbol: "arrow.up.forward.app", category: .maintenance, needsAdmin: false, isDestructive: false, isPro: true),
        ToolboxAction(id: "resetLaunchpad", title: "Reset Launchpad", detail: "Restore Launchpad's default layout and remove ghost icons.", symbol: "square.grid.3x3", category: .maintenance, needsAdmin: false, isDestructive: true),
        ToolboxAction(id: "clearFontCache", title: "Clear Font Caches", detail: "Fixes garbled text and missing fonts. Requires a restart afterwards.", symbol: "textformat", category: .maintenance, needsAdmin: true, isDestructive: false, isPro: true),
        ToolboxAction(id: "resetBluetooth", title: "Reset Bluetooth", detail: "Restart the Bluetooth daemon when devices will not connect. Devices reconnect automatically.", symbol: "wave.3.right", category: .maintenance, needsAdmin: true, isDestructive: false),
        ToolboxAction(id: "resetAudio", title: "Reset Audio", detail: "Restart the audio engine when sound stops working or crackles.", symbol: "speaker.wave.2", category: .maintenance, needsAdmin: true, isDestructive: false),
        ToolboxAction(id: "runMaintenance", title: "Run Maintenance Scripts", detail: "Rotate logs and clean temporary files (periodic daily/weekly/monthly).", symbol: "wrench.and.screwdriver", category: .maintenance, needsAdmin: true, isDestructive: false, isPro: true),
    ]

    static func action(id: String) -> ToolboxAction? { actions.first { $0.id == id } }

    /// Runs the action. Cleaning modes and Keep Awake are handled by the caller because they own UI state.
    static func run(_ action: ToolboxAction) -> ToolboxResult {
        do {
            switch action.id {
            case "purge":
                try Shell.runPrivileged("/usr/sbin/purge")
                return .success("Inactive memory flushed.")
            case "emptyTrash":
                try Shell.appleScript("tell application \"Finder\" to empty trash")
                return .success("Trash emptied.")
            case "thinSnapshots":
                let output = try Shell.runPrivileged("/usr/bin/tmutil thinlocalsnapshots / 999999999999 4")
                return .success(output.isEmpty ? "Local snapshots removed." : output.trimmingCharacters(in: .whitespacesAndNewlines))
            case "flushDNS":
                try Shell.runPrivileged("/usr/bin/dscacheutil -flushcache; /usr/bin/killall -HUP mDNSResponder")
                return .success("DNS cache flushed.")
            case "renewDHCP":
                let interface = NetworkProbe.primaryInterfaceName() ?? "en0"
                try Shell.runPrivileged("/usr/sbin/ipconfig set \(interface) DHCP")
                return .success("DHCP lease renewed on \(interface).")
            case "restartFinder":
                Shell.killAll("Finder")
                return .success("Finder relaunched.")
            case "restartDock":
                Shell.killAll("Dock")
                return .success("Dock relaunched.")
            case "restartMenuBar":
                Shell.killAll("SystemUIServer")
                Shell.killAll("ControlCenter")
                return .success("Menu bar relaunched.")
            case "toggleDesktopIcons":
                let current = TweaksService.readBool(domain: "com.apple.finder", key: "CreateDesktop") ?? true
                TweaksService.write(domain: "com.apple.finder", key: "CreateDesktop", value: !current)
                Shell.killAll("Finder")
                return .success(current ? "Desktop icons hidden." : "Desktop icons shown.")
            case "toggleHiddenFiles":
                let current = TweaksService.readBool(domain: "com.apple.finder", key: "AppleShowAllFiles") ?? false
                TweaksService.write(domain: "com.apple.finder", key: "AppleShowAllFiles", value: !current)
                Shell.killAll("Finder")
                return .success(current ? "Hidden files hidden." : "Hidden files shown.")
            case "toggleDarkMode":
                try Shell.appleScript("tell application \"System Events\" to tell appearance preferences to set dark mode to not dark mode")
                return .success("Appearance switched.")
            case "showLibrary":
                try Shell.runChecked("/usr/bin/chflags", ["nohidden", URL.homeDirectory.appendingPathComponent("Library").path])
                return .success("~/Library is now visible.")
            case "lockScreen":
                lockScreen()
                return .success("Locked.")
            case "sleepDisplay":
                try Shell.runChecked("/usr/bin/pmset", ["displaysleepnow"])
                return .success("Display sleeping.")
            case "sleepMac":
                try Shell.runChecked("/usr/bin/pmset", ["sleepnow"])
                return .success("Sleeping.")
            case "ejectAll":
                let count = ejectAll()
                return .success(count == 0 ? "No external disks to eject." : "Ejected \(count) disk\(count == 1 ? "" : "s").")
            case "clearClipboard":
                NSPasteboard.general.clearContents()
                return .success("Clipboard cleared.")
            case "rebuildSpotlight":
                try Shell.runPrivileged("/usr/bin/mdutil -E /")
                return .success("Spotlight is re-indexing. mds will be busy for a while.")
            case "rebuildLaunchServices":
                try Shell.runChecked("/System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister",
                                     ["-kill", "-r", "-domain", "local", "-domain", "system", "-domain", "user"], timeout: 120)
                Shell.killAll("Finder")
                return .success("Launch Services rebuilt.")
            case "resetLaunchpad":
                TweaksService.write(domain: "com.apple.dock", key: "ResetLaunchPad", value: true)
                Shell.killAll("Dock")
                return .success("Launchpad reset.")
            case "clearFontCache":
                try Shell.runPrivileged("/usr/bin/atsutil databases -remove")
                return .success("Font caches cleared. Restart your Mac to finish.")
            case "resetBluetooth":
                try Shell.runPrivileged("/usr/bin/pkill bluetoothd")
                return .success("Bluetooth restarted.")
            case "resetAudio":
                try Shell.runPrivileged("/usr/bin/killall coreaudiod")
                return .success("Audio engine restarted.")
            case "runMaintenance":
                try Shell.runPrivileged("/usr/sbin/periodic daily weekly monthly")
                return .success("Maintenance scripts finished.")
            default:
                return .failure("Unknown action.")
            }
        } catch ShellError.privilegedCancelled {
            return .failure("Cancelled.")
        } catch {
            return .failure(error.localizedDescription)
        }
    }

    private static func lockScreen() {
        let legacy = "/System/Library/CoreServices/Menu Extras/User.menu/Contents/Resources/CGSession"
        if FileManager.default.fileExists(atPath: legacy) {
            Shell.run(legacy, ["-suspend"])
            return
        }
        // Fallback: ⌃⌘Q through System Events (needs Accessibility), else sleep the display which locks if a password is required.
        if (try? Shell.appleScript("tell application \"System Events\" to keystroke \"q\" using {control down, command down}")) == nil {
            Shell.run("/usr/bin/pmset", ["displaysleepnow"])
        }
    }

    private static func ejectAll() -> Int {
        let keys: [URLResourceKey] = [.volumeIsRemovableKey, .volumeIsEjectableKey, .volumeIsInternalKey, .volumeIsRootFileSystemKey]
        let urls = FileManager.default.mountedVolumeURLs(includingResourceValuesForKeys: keys, options: [.skipHiddenVolumes]) ?? []
        var count = 0
        for url in urls {
            guard let values = try? url.resourceValues(forKeys: Set(keys)), values.volumeIsRootFileSystem != true,
                  (values.volumeIsRemovable ?? false) || (values.volumeIsEjectable ?? false) || values.volumeIsInternal == false else { continue }
            do {
                try NSWorkspace.shared.unmountAndEjectDevice(at: url)
                count += 1
            } catch {
                continue
            }
        }
        return count
    }
}
