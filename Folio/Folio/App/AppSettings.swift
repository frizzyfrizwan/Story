import Foundation

/// Lightweight user preferences backed by UserDefaults.
@MainActor @Observable
final class AppSettings {
    private let defaults = UserDefaults.standard

    private enum Key {
        static let drawWithFinger = "settings.drawWithFinger"
        static let scanPageSize = "settings.scanPageSize"
        static let recognizeTextOnScan = "settings.recognizeTextOnScan"
        static let hasSeenWelcome = "settings.hasSeenWelcome"
        static let librarySort = "settings.librarySort"
    }

    var drawWithFinger: Bool {
        didSet { defaults.set(drawWithFinger, forKey: Key.drawWithFinger) }
    }

    var scanPageSize: ScanPageSize {
        didSet { defaults.set(scanPageSize.rawValue, forKey: Key.scanPageSize) }
    }

    /// Default state of the "Recognize text" toggle when reviewing a scan.
    var recognizeTextOnScan: Bool {
        didSet { defaults.set(recognizeTextOnScan, forKey: Key.recognizeTextOnScan) }
    }

    var hasSeenWelcome: Bool {
        didSet { defaults.set(hasSeenWelcome, forKey: Key.hasSeenWelcome) }
    }

    var librarySort: LibrarySort {
        didSet { defaults.set(librarySort.rawValue, forKey: Key.librarySort) }
    }

    init() {
        drawWithFinger = defaults.object(forKey: Key.drawWithFinger) as? Bool ?? true
        scanPageSize = ScanPageSize(rawValue: defaults.string(forKey: Key.scanPageSize) ?? "") ?? .auto
        recognizeTextOnScan = defaults.object(forKey: Key.recognizeTextOnScan) as? Bool ?? true
        hasSeenWelcome = defaults.bool(forKey: Key.hasSeenWelcome)
        librarySort = LibrarySort(rawValue: defaults.string(forKey: Key.librarySort) ?? "") ?? .recent
    }
}

enum ScanPageSize: String, CaseIterable, Identifiable {
    case auto, letter, a4

    var id: String { rawValue }

    var title: String {
        switch self {
        case .auto: return "Match scan"
        case .letter: return "US Letter"
        case .a4: return "A4"
        }
    }

    var subtitle: String {
        switch self {
        case .auto: return "Page takes the shape of what you scanned"
        case .letter: return "8.5 × 11 in"
        case .a4: return "210 × 297 mm"
        }
    }
}

enum LibrarySort: String, CaseIterable, Identifiable {
    case recent, name, size

    var id: String { rawValue }

    var title: String {
        switch self {
        case .recent: return "Recently edited"
        case .name: return "Name"
        case .size: return "Size"
        }
    }
}
