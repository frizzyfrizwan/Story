import Foundation
import SwiftUI

extension Double {
    func clamped(to range: ClosedRange<Double>) -> Double { Swift.min(Swift.max(self, range.lowerBound), range.upperBound) }
    var rounded1: Double { (self * 10).rounded() / 10 }
}

extension Int {
    func clamped(to range: ClosedRange<Int>) -> Int { Swift.min(Swift.max(self, range.lowerBound), range.upperBound) }
}

extension Array where Element == Double {
    var average: Double { isEmpty ? 0 : reduce(0, +) / Double(count) }
}

extension Date {
    static func minutesAgo(_ minutes: Double) -> Date { Date().addingTimeInterval(-minutes * 60) }
    static func hoursAgo(_ hours: Double) -> Date { Date().addingTimeInterval(-hours * 3600) }
}

extension URL {
    /// Expands `~` and returns a file URL.
    static func home(_ relativePath: String) -> URL {
        let expanded = (relativePath as NSString).expandingTildeInPath
        return URL(fileURLWithPath: expanded)
    }
    static var homeDirectory: URL { FileManager.default.homeDirectoryForCurrentUser }
}

extension FileManager {
    func directoryExists(at url: URL) -> Bool {
        var isDirectory: ObjCBool = false
        return fileExists(atPath: url.path, isDirectory: &isDirectory) && isDirectory.boolValue
    }
}

extension View {
    /// Applies the standard card chrome.
    func card() -> some View { modifier(CardModifier()) }
}

struct CardModifier: ViewModifier {
    @Environment(\.colorScheme) private var scheme
    func body(content: Content) -> some View {
        content
            .padding(Theme.cardPadding)
            .background(
                RoundedRectangle(cornerRadius: Theme.cornerRadius, style: .continuous)
                    .fill(Theme.cardBackground(scheme))
            )
            .overlay(
                RoundedRectangle(cornerRadius: Theme.cornerRadius, style: .continuous)
                    .strokeBorder(Color.primary.opacity(scheme == .dark ? 0.08 : 0.06), lineWidth: 1)
            )
    }
}

extension String {
    var nilIfEmpty: String? { isEmpty ? nil : self }
}
