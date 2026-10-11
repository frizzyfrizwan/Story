import SwiftUI

/// Semantic colors and metrics shared by every screen.
enum Theme {
    static let cpu = Color(red: 0.25, green: 0.56, blue: 1.0)
    static let memory = Color(red: 0.62, green: 0.40, blue: 0.98)
    static let disk = Color(red: 0.98, green: 0.62, blue: 0.20)
    static let network = Color(red: 0.16, green: 0.78, blue: 0.62)
    static let battery = Color(red: 0.30, green: 0.80, blue: 0.40)
    static let thermal = Color(red: 0.98, green: 0.35, blue: 0.35)
    static let gpu = Color(red: 0.95, green: 0.45, blue: 0.75)
    static let good = Color(red: 0.26, green: 0.78, blue: 0.44)
    static let warning = Color(red: 0.98, green: 0.72, blue: 0.20)
    static let critical = Color(red: 0.95, green: 0.33, blue: 0.30)

    static let cornerRadius: CGFloat = 14
    static let cardPadding: CGFloat = 16
    static let gridSpacing: CGFloat = 14

    static func severity(_ fraction: Double, warn: Double = 0.75, critical: Double = 0.9) -> Color {
        if fraction >= critical { return Theme.critical }
        if fraction >= warn { return Theme.warning }
        return Theme.good
    }

    static func cardBackground(_ scheme: ColorScheme) -> Color {
        scheme == .dark ? Color.white.opacity(0.06) : Color.black.opacity(0.035)
    }
}

extension Color {
    static let vigilAccent = Color("AccentColor")
}
