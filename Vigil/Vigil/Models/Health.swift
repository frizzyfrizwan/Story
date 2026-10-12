import Foundation
import SwiftUI

enum Severity: Int, Comparable, Codable {
    case good = 0, info = 1, warning = 2, critical = 3
    static func < (lhs: Severity, rhs: Severity) -> Bool { lhs.rawValue < rhs.rawValue }

    var color: Color {
        switch self {
        case .good: return Theme.good
        case .info: return Theme.cpu
        case .warning: return Theme.warning
        case .critical: return Theme.critical
        }
    }

    var symbol: String {
        switch self {
        case .good: return "checkmark.circle.fill"
        case .info: return "info.circle.fill"
        case .warning: return "exclamationmark.triangle.fill"
        case .critical: return "xmark.octagon.fill"
        }
    }

    var title: String {
        switch self {
        case .good: return "Good"
        case .info: return "Tip"
        case .warning: return "Needs attention"
        case .critical: return "Critical"
        }
    }

    /// Points removed from the 100-point health score.
    var penalty: Int {
        switch self {
        case .good: return 0
        case .info: return 3
        case .warning: return 10
        case .critical: return 25
        }
    }
}

enum HealthCategory: String, CaseIterable, Identifiable, Codable {
    case storage = "Storage", memory = "Memory", cpu = "Performance", battery = "Battery", thermal = "Thermals", security = "Security", maintenance = "Maintenance", backup = "Backups"
    var id: String { rawValue }
    var symbol: String {
        switch self {
        case .storage: return "internaldrive"
        case .memory: return "memorychip"
        case .cpu: return "cpu"
        case .battery: return "battery.100percent"
        case .thermal: return "thermometer.medium"
        case .security: return "lock.shield"
        case .maintenance: return "wrench.and.screwdriver"
        case .backup: return "clock.arrow.circlepath"
        }
    }
}

/// What the user can do about a finding. Resolved by the UI to a navigation or a toolbox action.
enum HealthAction: Equatable, Codable {
    case openSection(DashboardSection)
    case toolbox(String)
    case openURL(String)
    case systemSettings(String)

    var title: String {
        switch self {
        case .openSection(let section): return "Open \(section.title)"
        case .toolbox: return "Run"
        case .openURL: return "Learn more"
        case .systemSettings: return "Open System Settings"
        }
    }
}

struct HealthFinding: Identifiable, Equatable, Codable {
    let id: String
    let severity: Severity
    let category: HealthCategory
    let title: String
    let detail: String
    let action: HealthAction?
    var actionTitle: String?
}

struct HealthReport: Equatable {
    var score: Int = 100
    var findings: [HealthFinding] = []
    var generatedAt = Date()

    var grade: String {
        switch score {
        case 90...: return "Excellent"
        case 75..<90: return "Good"
        case 55..<75: return "Fair"
        default: return "Needs care"
        }
    }

    var color: Color {
        switch score {
        case 90...: return Theme.good
        case 75..<90: return Theme.cpu
        case 55..<75: return Theme.warning
        default: return Theme.critical
        }
    }

    var worst: Severity { findings.map(\.severity).max() ?? .good }
    func findings(in category: HealthCategory) -> [HealthFinding] { findings.filter { $0.category == category } }
}

/// Sidebar sections of the dashboard window.
enum DashboardSection: String, CaseIterable, Identifiable, Codable {
    case overview, health, activity, cpu, memory, storage, network, power, sensors, history, startup, toolbox, tweaks, system

    var id: String { rawValue }

    var title: String {
        switch self {
        case .overview: return "Overview"
        case .health: return "Health"
        case .activity: return "Activity"
        case .cpu: return "CPU"
        case .memory: return "Memory"
        case .storage: return "Storage"
        case .network: return "Network"
        case .power: return "Battery & Power"
        case .sensors: return "Temperatures & Fans"
        case .history: return "History"
        case .startup: return "Startup Items"
        case .toolbox: return "Toolbox"
        case .tweaks: return "Tweaks"
        case .system: return "This Mac"
        }
    }

    var symbol: String {
        switch self {
        case .overview: return "square.grid.2x2"
        case .health: return "heart.text.square"
        case .activity: return "list.bullet.rectangle"
        case .cpu: return "cpu"
        case .memory: return "memorychip"
        case .storage: return "internaldrive"
        case .network: return "network"
        case .power: return "battery.100percent.bolt"
        case .sensors: return "thermometer.medium"
        case .history: return "clock.arrow.circlepath"
        case .startup: return "power"
        case .toolbox: return "wrench.and.screwdriver"
        case .tweaks: return "slider.horizontal.3"
        case .system: return "laptopcomputer"
        }
    }

    static var monitorSections: [DashboardSection] { [.overview, .health, .activity, .cpu, .memory, .storage, .network, .power, .sensors, .history] }
    static var toolSections: [DashboardSection] { [.startup, .toolbox, .tweaks, .system] }
}
