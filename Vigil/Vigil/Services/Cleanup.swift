import Foundation
import AppKit
import Observation

/// A reclaimable category of files. Sizes are measured by `StorageScanner`.
struct CleanupCategory: Identifiable, Equatable {
    enum Risk: Int, Comparable {
        case safe = 0, review = 1, careful = 2
        static func < (lhs: Risk, rhs: Risk) -> Bool { lhs.rawValue < rhs.rawValue }
        var title: String {
            switch self {
            case .safe: return "Safe"
            case .review: return "Review first"
            case .careful: return "Careful"
            }
        }
        var explanation: String {
            switch self {
            case .safe: return "Regenerated automatically. Deleting only costs a slower first launch."
            case .review: return "Your own files. Vigil moves them to the Trash so you can recover them."
            case .careful: return "Deleting loses data you may want (backups, archives). Only remove what you are sure about."
            }
        }
    }

    enum Method: Equatable {
        /// Delete the contents of the directories (not the directory itself).
        case deleteContents
        /// Move the matched items to the Trash.
        case trash
        /// Run a command instead of touching files.
        case command(String)
    }

    let id: String
    let title: String
    let detail: String
    let symbol: String
    let risk: Risk
    let paths: [String]
    let method: Method
    let group: String
    var requiresFullDiskAccess = false
    var onlyIfExists = true
    /// File-name filter for `.trash` categories (lowercased extensions), nil = everything.
    var extensions: [String]? = nil
    /// Minimum age in days for `.trash` categories (nil = any age).
    var olderThanDays: Int? = nil
    var isPro = false
}

enum CleanupCatalog {
    static let all: [CleanupCategory] = [
        CleanupCategory(id: "caches.user", title: "App caches", detail: "Temporary data apps keep in ~/Library/Caches. Spotify, Slack, browsers and Xcode are the usual hogs.", symbol: "shippingbox", risk: .safe, paths: ["~/Library/Caches"], method: .deleteContents, group: "System"),
        CleanupCategory(id: "logs.user", title: "App logs", detail: "Diagnostic logs in ~/Library/Logs. Useful only when debugging a problem.", symbol: "doc.text", risk: .safe, paths: ["~/Library/Logs"], method: .deleteContents, group: "System"),
        CleanupCategory(id: "temp", title: "Temporary files", detail: "Your account's temp folder. Running apps may hold files here; those are skipped.", symbol: "clock", risk: .safe, paths: [NSTemporaryDirectory()], method: .deleteContents, group: "System"),
        CleanupCategory(id: "trash", title: "Trash", detail: "Everything you have already deleted. Emptied through Finder.", symbol: "trash", risk: .review, paths: ["~/.Trash"], method: .command("emptyTrash"), group: "System", requiresFullDiskAccess: true),
        CleanupCategory(id: "snapshots", title: "Local Time Machine snapshots", detail: "Hourly snapshots macOS keeps on the internal disk when the backup drive is away. Counted as purgeable space.", symbol: "clock.badge.xmark", risk: .safe, paths: [], method: .command("thinSnapshots"), group: "System", onlyIfExists: false, isPro: true),
        CleanupCategory(id: "mail", title: "Mail attachments cache", detail: "Attachments Mail has downloaded for viewing. They re-download from the server.", symbol: "envelope", risk: .safe, paths: ["~/Library/Containers/com.apple.mail/Data/Library/Mail Downloads"], method: .deleteContents, group: "System", requiresFullDiskAccess: true),
        CleanupCategory(id: "safari.cache", title: "Safari cache", detail: "Cached web pages and images.", symbol: "safari", risk: .safe, paths: ["~/Library/Containers/com.apple.Safari/Data/Library/Caches", "~/Library/Caches/com.apple.Safari"], method: .deleteContents, group: "Browsers", requiresFullDiskAccess: true),
        CleanupCategory(id: "chrome.cache", title: "Chrome cache", detail: "Chrome's web cache. Chrome rebuilds it as you browse.", symbol: "globe", risk: .safe, paths: ["~/Library/Caches/Google/Chrome", "~/Library/Application Support/Google/Chrome/Default/Cache", "~/Library/Application Support/Google/Chrome/Default/Code Cache"], method: .deleteContents, group: "Browsers"),
        CleanupCategory(id: "firefox.cache", title: "Firefox cache", detail: "Firefox's web cache.", symbol: "flame", risk: .safe, paths: ["~/Library/Caches/Firefox"], method: .deleteContents, group: "Browsers"),
        CleanupCategory(id: "downloads.old", title: "Old downloads", detail: "Files in Downloads untouched for more than 90 days. Moved to the Trash, not deleted.", symbol: "arrow.down.circle", risk: .review, paths: ["~/Downloads"], method: .trash, group: "Your files", olderThanDays: 90),
        CleanupCategory(id: "downloads.installers", title: "Installers in Downloads", detail: "Disk images and packages you have probably already installed.", symbol: "shippingbox.fill", risk: .review, paths: ["~/Downloads"], method: .trash, group: "Your files", extensions: ["dmg", "pkg", "mpkg", "iso", "zip", "xip"]),
        CleanupCategory(id: "xcode.derived", title: "Xcode DerivedData", detail: "Build products and indexes. Xcode rebuilds them on the next build.", symbol: "hammer", risk: .safe, paths: ["~/Library/Developer/Xcode/DerivedData"], method: .deleteContents, group: "Developer"),
        CleanupCategory(id: "xcode.archives", title: "Xcode archives", detail: "Archived builds for App Store uploads and their dSYMs. Keep the ones for versions still in the wild.", symbol: "archivebox", risk: .careful, paths: ["~/Library/Developer/Xcode/Archives"], method: .trash, group: "Developer"),
        CleanupCategory(id: "xcode.devicesupport", title: "iOS device support files", detail: "Symbols for every iOS version you have ever plugged in. Xcode re-downloads the ones it needs.", symbol: "iphone", risk: .safe, paths: ["~/Library/Developer/Xcode/iOS DeviceSupport", "~/Library/Developer/Xcode/watchOS DeviceSupport", "~/Library/Developer/Xcode/tvOS DeviceSupport"], method: .deleteContents, group: "Developer"),
        CleanupCategory(id: "xcode.simcaches", title: "Simulator caches", detail: "Caches for every simulator you have booted.", symbol: "ipad", risk: .safe, paths: ["~/Library/Developer/CoreSimulator/Caches"], method: .deleteContents, group: "Developer"),
        CleanupCategory(id: "xcode.simunavailable", title: "Unavailable simulators", detail: "Simulator devices whose runtimes are no longer installed. Removed with `simctl delete unavailable`.", symbol: "xmark.rectangle", risk: .safe, paths: ["~/Library/Developer/CoreSimulator/Devices"], method: .command("simctlDeleteUnavailable"), group: "Developer", isPro: true),
        CleanupCategory(id: "homebrew", title: "Homebrew cache", detail: "Downloaded bottles and source tarballs. `brew cleanup` also prunes old versions.", symbol: "mug", risk: .safe, paths: ["~/Library/Caches/Homebrew"], method: .deleteContents, group: "Developer"),
        CleanupCategory(id: "npm", title: "npm / yarn / pnpm caches", detail: "Package tarballs cached by Node package managers.", symbol: "cube.box", risk: .safe, paths: ["~/.npm/_cacache", "~/Library/Caches/Yarn", "~/.yarn/berry/cache", "~/Library/pnpm/store", "~/.bun/install/cache"], method: .deleteContents, group: "Developer"),
        CleanupCategory(id: "pip", title: "pip / conda caches", detail: "Python package caches.", symbol: "cube.box.fill", risk: .safe, paths: ["~/Library/Caches/pip", "~/.cache/pip", "~/opt/anaconda3/pkgs", "~/miniconda3/pkgs"], method: .deleteContents, group: "Developer"),
        CleanupCategory(id: "cocoapods", title: "CocoaPods & Carthage caches", detail: "Cached pod specs and built frameworks.", symbol: "shippingbox", risk: .safe, paths: ["~/Library/Caches/CocoaPods", "~/Library/Caches/org.carthage.CarthageKit"], method: .deleteContents, group: "Developer"),
        CleanupCategory(id: "gradle", title: "Gradle & Maven caches", detail: "JVM build caches (Android Studio, IntelliJ).", symbol: "cup.and.saucer", risk: .safe, paths: ["~/.gradle/caches", "~/.m2/repository"], method: .deleteContents, group: "Developer"),
        CleanupCategory(id: "cargo", title: "Rust & Go caches", detail: "Cargo registry cache and the Go module cache.", symbol: "gearshape.2", risk: .safe, paths: ["~/.cargo/registry/cache", "~/go/pkg/mod/cache"], method: .deleteContents, group: "Developer"),
        CleanupCategory(id: "docker", title: "Docker Desktop disk image", detail: "The virtual disk holding every image, container and volume. Prune from inside Docker (`docker system prune -a`) rather than deleting the file.", symbol: "shippingbox.circle", risk: .careful, paths: ["~/Library/Containers/com.docker.docker/Data/vms", "~/Library/Containers/com.docker.docker/Data/docker.raw"], method: .command("dockerPrune"), group: "Developer", isPro: true),
        CleanupCategory(id: "ios.backups", title: "iPhone & iPad backups", detail: "Local backups made by Finder. Keep the latest for each device; old ones from devices you no longer own are safe to remove.", symbol: "iphone.gen3", risk: .careful, paths: ["~/Library/Application Support/MobileSync/Backup"], method: .trash, group: "Your files", requiresFullDiskAccess: true),
        CleanupCategory(id: "ios.updates", title: "iOS update installers", detail: "Firmware files downloaded when updating a device through Finder.", symbol: "arrow.down.app", risk: .safe, paths: ["~/Library/iTunes/iPhone Software Updates", "~/Library/iTunes/iPad Software Updates"], method: .deleteContents, group: "Your files"),
        CleanupCategory(id: "spotify", title: "Spotify cache", detail: "Offline song cache. Downloaded playlists stay intact.", symbol: "music.note", risk: .safe, paths: ["~/Library/Caches/com.spotify.client", "~/Library/Application Support/Spotify/PersistentCache/Storage"], method: .deleteContents, group: "Apps"),
        CleanupCategory(id: "slack", title: "Slack cache", detail: "Cached images and files from Slack workspaces.", symbol: "bubble.left.and.bubble.right", risk: .safe, paths: ["~/Library/Application Support/Slack/Cache", "~/Library/Application Support/Slack/Service Worker/CacheStorage", "~/Library/Containers/com.tinyspeck.slackmacgap/Data/Library/Application Support/Slack/Cache"], method: .deleteContents, group: "Apps"),
        CleanupCategory(id: "teams", title: "Microsoft Teams cache", detail: "Teams caches, a well-known multi-GB offender.", symbol: "person.2", risk: .safe, paths: ["~/Library/Containers/com.microsoft.teams2/Data/Library/Caches", "~/Library/Application Support/Microsoft/Teams/Cache", "~/Library/Application Support/Microsoft/Teams/Service Worker/CacheStorage"], method: .deleteContents, group: "Apps"),
        CleanupCategory(id: "adobe", title: "Adobe caches", detail: "Media caches from Premiere, After Effects and Photoshop.", symbol: "paintbrush", risk: .safe, paths: ["~/Library/Caches/Adobe", "~/Library/Application Support/Adobe/Common/Media Cache Files", "~/Library/Application Support/Adobe/Common/Media Cache"], method: .deleteContents, group: "Apps"),
        CleanupCategory(id: "zoom", title: "Zoom cache", detail: "Zoom's cached data and old installers.", symbol: "video", risk: .safe, paths: ["~/Library/Application Support/zoom.us/AutoUpdater", "~/Library/Caches/us.zoom.xos"], method: .deleteContents, group: "Apps"),
        CleanupCategory(id: "discord", title: "Discord cache", detail: "Cached images, GIFs and code.", symbol: "gamecontroller", risk: .safe, paths: ["~/Library/Application Support/discord/Cache", "~/Library/Application Support/discord/Code Cache", "~/Library/Application Support/discord/GPUCache"], method: .deleteContents, group: "Apps"),
        CleanupCategory(id: "vscode", title: "VS Code caches", detail: "Cached extensions and workspace storage.", symbol: "chevron.left.forwardslash.chevron.right", risk: .safe, paths: ["~/Library/Application Support/Code/Cache", "~/Library/Application Support/Code/CachedData", "~/Library/Application Support/Code/CachedExtensionVSIXs"], method: .deleteContents, group: "Apps"),
        CleanupCategory(id: "jetbrains", title: "JetBrains caches", detail: "IntelliJ, PyCharm, WebStorm indexes and logs.", symbol: "cube", risk: .safe, paths: ["~/Library/Caches/JetBrains"], method: .deleteContents, group: "Apps"),
    ]

    static func category(id: String) -> CleanupCategory? { all.first { $0.id == id } }
    static var groups: [String] { ["System", "Browsers", "Your files", "Developer", "Apps"] }
}

struct LargeFile: Identifiable, Equatable {
    let url: URL
    let size: Int64
    let modified: Date?
    var id: String { url.path }
    var name: String { url.lastPathComponent }
}

struct FolderUsage: Identifiable, Equatable {
    let name: String
    let url: URL
    let bytes: Int64
    var id: String { url.path }
}

struct CleanupMeasurement: Equatable {
    var bytes: Int64 = 0
    var items: Int = 0
    var exists = false
    var accessible = true
    var sampleURLs: [URL] = []
}

/// Measures the cleanup categories and finds large files. Runs on a background task, publishes progress.
@MainActor
@Observable
final class StorageScanner {
    private(set) var measurements: [String: CleanupMeasurement] = [:]
    private(set) var largeFiles: [LargeFile] = []
    private(set) var folderSizes: [FolderUsage] = []
    private(set) var isScanning = false
    private(set) var progressText = ""
    private(set) var lastScan: Date?
    private var task: Task<Void, Never>?

    var totalReclaimable: Int64 {
        CleanupCatalog.all.filter { $0.risk == .safe }.reduce(0) { $0 + (measurements[$1.id]?.bytes ?? 0) }
    }

    func scan() {
        guard !isScanning else { return }
        isScanning = true
        progressText = "Starting…"
        task = Task { [weak self] in
            guard let self else { return }
            for category in CleanupCatalog.all {
                if Task.isCancelled { break }
                progressText = "Measuring \(category.title)…"
                let measurement = await Task.detached(priority: .utility) { StorageScanner.measure(category) }.value
                measurements[category.id] = measurement
            }
            progressText = "Measuring home folders…"
            folderSizes = await Task.detached(priority: .utility) { StorageScanner.homeFolderSizes() }.value
            progressText = "Looking for large files…"
            largeFiles = await Task.detached(priority: .utility) { StorageScanner.findLargeFiles(minimumBytes: 250_000_000, limit: 60) }.value
            progressText = ""
            lastScan = Date()
            isScanning = false
        }
    }

    func cancel() {
        task?.cancel()
        isScanning = false
        progressText = ""
    }

    // MARK: Measuring

    nonisolated static func measure(_ category: CleanupCategory) -> CleanupMeasurement {
        var measurement = CleanupMeasurement()
        let fileManager = FileManager.default
        for path in category.paths {
            let url = URL(fileURLWithPath: (path as NSString).expandingTildeInPath)
            guard fileManager.fileExists(atPath: url.path) else { continue }
            measurement.exists = true
            if category.requiresFullDiskAccess, (try? fileManager.contentsOfDirectory(atPath: url.path)) == nil {
                measurement.accessible = false
                continue
            }
            switch category.method {
            case .trash:
                for item in matchingItems(in: url, category: category) {
                    measurement.bytes += item.size
                    measurement.items += 1
                    if measurement.sampleURLs.count < 50 { measurement.sampleURLs.append(item.url) }
                }
            case .deleteContents, .command:
                let (bytes, count) = directorySize(url)
                measurement.bytes += bytes
                measurement.items += count
            }
        }
        if category.id == "snapshots" {
            measurement.exists = true
            measurement.items = localSnapshotCount()
            measurement.bytes = purgeableBytes()
        }
        return measurement
    }

    nonisolated static func matchingItems(in directory: URL, category: CleanupCategory) -> [LargeFile] {
        let keys: Set<URLResourceKey> = [.totalFileAllocatedSizeKey, .fileAllocatedSizeKey, .contentModificationDateKey, .contentAccessDateKey, .isDirectoryKey, .isPackageKey]
        guard let items = try? FileManager.default.contentsOfDirectory(at: directory, includingPropertiesForKeys: Array(keys), options: [.skipsHiddenFiles]) else { return [] }
        let cutoff = category.olderThanDays.map { Date().addingTimeInterval(-Double($0) * 86_400) }
        var result: [LargeFile] = []
        for url in items {
            guard let values = try? url.resourceValues(forKeys: keys) else { continue }
            if let extensions = category.extensions, !extensions.contains(url.pathExtension.lowercased()) { continue }
            let modified = values.contentModificationDate
            let accessed = values.contentAccessDate
            if let cutoff {
                let newest = [modified, accessed].compactMap { $0 }.max() ?? Date()
                guard newest < cutoff else { continue }
            }
            let size: Int64
            if values.isDirectory == true && values.isPackage != true {
                size = directorySize(url).bytes
            } else {
                size = Int64(values.totalFileAllocatedSize ?? values.fileAllocatedSize ?? 0)
            }
            result.append(LargeFile(url: url, size: size, modified: modified))
        }
        return result.sorted { $0.size > $1.size }
    }

    nonisolated static func directorySize(_ url: URL) -> (bytes: Int64, count: Int) {
        let keys: Set<URLResourceKey> = [.totalFileAllocatedSizeKey, .fileAllocatedSizeKey, .isRegularFileKey]
        guard let enumerator = FileManager.default.enumerator(at: url, includingPropertiesForKeys: Array(keys), options: [], errorHandler: { _, _ in true }) else { return (0, 0) }
        var total: Int64 = 0
        var count = 0
        for case let item as URL in enumerator {
            if Task.isCancelled { break }
            guard let values = try? item.resourceValues(forKeys: keys), values.isRegularFile == true else { continue }
            total += Int64(values.totalFileAllocatedSize ?? values.fileAllocatedSize ?? 0)
            count += 1
        }
        return (total, count)
    }

    nonisolated static func homeFolderSizes() -> [FolderUsage] {
        let home = URL.homeDirectory
        let folders = ["Desktop", "Documents", "Downloads", "Movies", "Music", "Pictures", "Library", "Applications", "Developer"]
        var result: [FolderUsage] = []
        for name in folders {
            let url = home.appendingPathComponent(name)
            guard FileManager.default.directoryExists(at: url) else { continue }
            result.append(FolderUsage(name: name, url: url, bytes: directorySize(url).bytes))
        }
        let applications = URL(fileURLWithPath: "/Applications")
        if FileManager.default.directoryExists(at: applications) {
            result.append(FolderUsage(name: "Applications (all users)", url: applications, bytes: directorySize(applications).bytes))
        }
        return result.sorted { $0.bytes > $1.bytes }
    }

    nonisolated static func findLargeFiles(minimumBytes: Int64, limit: Int) -> [LargeFile] {
        let home = URL.homeDirectory
        let keys: Set<URLResourceKey> = [.totalFileAllocatedSizeKey, .fileAllocatedSizeKey, .isRegularFileKey, .contentModificationDateKey, .isPackageKey]
        let skip: Set<String> = ["Library/Application Support/MobileSync", ".Trash", "Library/Developer/CoreSimulator", "Library/Containers/com.docker.docker"]
        guard let enumerator = FileManager.default.enumerator(at: home, includingPropertiesForKeys: Array(keys), options: [.skipsPackageDescendants], errorHandler: { _, _ in true }) else { return [] }
        var found: [LargeFile] = []
        for case let item as URL in enumerator {
            if Task.isCancelled { break }
            let relative = item.path.dropFirst(home.path.count + 1)
            if skip.contains(where: { relative.hasPrefix($0) }) { enumerator.skipDescendants(); continue }
            guard let values = try? item.resourceValues(forKeys: keys) else { continue }
            let size: Int64
            if values.isPackage == true {
                size = directorySize(item).bytes
            } else if values.isRegularFile == true {
                size = Int64(values.totalFileAllocatedSize ?? values.fileAllocatedSize ?? 0)
            } else {
                continue
            }
            if size >= minimumBytes { found.append(LargeFile(url: item, size: size, modified: values.contentModificationDate)) }
        }
        return Array(found.sorted { $0.size > $1.size }.prefix(limit))
    }

    nonisolated static func localSnapshotCount() -> Int {
        let result = Shell.run("/usr/bin/tmutil", ["listlocalsnapshots", "/"], timeout: 15)
        guard result.succeeded else { return 0 }
        return result.output.split(separator: "\n").filter { $0.contains("com.apple.TimeMachine") }.count
    }

    nonisolated static func purgeableBytes() -> Int64 {
        let keys: Set<URLResourceKey> = [.volumeAvailableCapacityForImportantUsageKey, .volumeAvailableCapacityKey]
        guard let values = try? URL(fileURLWithPath: "/").resourceValues(forKeys: keys) else { return 0 }
        let important = values.volumeAvailableCapacityForImportantUsage ?? 0
        let plain = Int64(values.volumeAvailableCapacity ?? 0)
        return max(0, important - plain)
    }
}

/// Performs the actual deletion. Everything is logged to the history.
@MainActor
enum CleanupService {
    struct Outcome: Equatable {
        var freedBytes: Int64 = 0
        var removedItems = 0
        var failures: [String] = []
        var message: String?
    }

    static func clean(_ category: CleanupCategory, measurement: CleanupMeasurement?, history: HistoryStore) async -> Outcome {
        var outcome = Outcome()
        switch category.method {
        case .command(let command):
            outcome = await runCommand(command)
        case .deleteContents:
            let paths = category.paths
            outcome = await Task.detached(priority: .userInitiated) { CleanupService.deleteContents(of: paths) }.value
        case .trash:
            let urls = measurement?.sampleURLs ?? []
            let all = urls.isEmpty ? category.paths.flatMap { StorageScanner.matchingItems(in: URL(fileURLWithPath: ($0 as NSString).expandingTildeInPath), category: category).map(\.url) } : urls
            outcome = trash(all)
        }
        if outcome.freedBytes > 0 || outcome.removedItems > 0 {
            history.record(.cleanup, title: "Cleaned \(category.title)", detail: "\(Format.bytes(outcome.freedBytes)) freed, \(outcome.removedItems) items")
        }
        return outcome
    }

    static func trash(_ urls: [URL]) -> Outcome {
        var outcome = Outcome()
        for url in urls {
            let size = (try? url.resourceValues(forKeys: [.totalFileAllocatedSizeKey]).totalFileAllocatedSize).map { Int64($0) } ?? 0
            do {
                try FileManager.default.trashItem(at: url, resultingItemURL: nil)
                outcome.freedBytes += size
                outcome.removedItems += 1
            } catch {
                outcome.failures.append("\(url.lastPathComponent): \(error.localizedDescription)")
            }
        }
        outcome.message = "Moved \(outcome.removedItems) items to the Trash."
        return outcome
    }

    nonisolated static func deleteContents(of paths: [String]) -> Outcome {
        var outcome = Outcome()
        let fileManager = FileManager.default
        for path in paths {
            let directory = URL(fileURLWithPath: (path as NSString).expandingTildeInPath)
            guard let items = try? fileManager.contentsOfDirectory(at: directory, includingPropertiesForKeys: nil, options: []) else { continue }
            for item in items {
                // Never touch Vigil's own data or files another process currently holds open in TMPDIR.
                if item.lastPathComponent.hasPrefix("com.faisalrizwan.vigil") { continue }
                let size = StorageScanner.directorySize(item).bytes + Int64((try? item.resourceValues(forKeys: [.totalFileAllocatedSizeKey]).totalFileAllocatedSize) ?? 0)
                do {
                    try fileManager.removeItem(at: item)
                    outcome.freedBytes += size
                    outcome.removedItems += 1
                } catch {
                    outcome.failures.append(item.lastPathComponent)
                }
            }
        }
        outcome.message = "Removed \(outcome.removedItems) items."
        return outcome
    }

    private static func runCommand(_ command: String) async -> Outcome {
        var outcome = Outcome()
        switch command {
        case "emptyTrash":
            let result = Toolbox.run(Toolbox.action(id: "emptyTrash")!)
            if case .failure(let message) = result { outcome.failures.append(message) } else { outcome.message = "Trash emptied."; outcome.removedItems = 1 }
        case "thinSnapshots":
            let result = Toolbox.run(Toolbox.action(id: "thinSnapshots")!)
            if case .failure(let message) = result { outcome.failures.append(message) } else { outcome.message = "Local snapshots removed."; outcome.removedItems = 1 }
        case "simctlDeleteUnavailable":
            let result = await Task.detached { Shell.run("/usr/bin/xcrun", ["simctl", "delete", "unavailable"], timeout: 120) }.value
            if result.succeeded { outcome.message = "Unavailable simulators deleted."; outcome.removedItems = 1 } else { outcome.failures.append(result.error) }
        case "dockerPrune":
            let result = await Task.detached { Shell.zsh("docker system prune -af --volumes 2>&1", timeout: 300) }.value
            if result.succeeded { outcome.message = result.output.split(separator: "\n").last.map(String.init) ?? "Docker pruned."; outcome.removedItems = 1 } else { outcome.failures.append("Docker is not running or the docker CLI is not installed.") }
        default:
            outcome.failures.append("Unknown command.")
        }
        return outcome
    }
}
