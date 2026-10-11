import Foundation
import SwiftUI
import ServiceManagement
import AppKit

enum MenuBarStyle: String, CaseIterable, Identifiable, Codable {
    case icon, cpu, memory, temperature, network, battery, graph
    var id: String { rawValue }
    var title: String {
        switch self {
        case .icon: return "Icon only"
        case .cpu: return "CPU %"
        case .memory: return "Memory pressure"
        case .temperature: return "Temperature"
        case .network: return "Network speed"
        case .battery: return "Battery"
        case .graph: return "CPU graph"
        }
    }
}

/// User preferences, persisted in UserDefaults. Observable so views update immediately.
@Observable
final class AppSettings {
    static let shared = AppSettings()

    private let defaults: UserDefaults

    init(defaults: UserDefaults = .standard) {
        self.defaults = defaults
        refreshInterval = defaults.object(forKey: "refreshInterval") as? Double ?? 2
        temperatureUnit = TemperatureUnit(rawValue: defaults.string(forKey: "temperatureUnit") ?? "") ?? .celsius
        menuBarStyle = MenuBarStyle(rawValue: defaults.string(forKey: "menuBarStyle") ?? "") ?? .graph
        showDockIcon = defaults.object(forKey: "showDockIcon") as? Bool ?? true
        alertsEnabled = defaults.object(forKey: "alertsEnabled") as? Bool ?? true
        alertDiskFreePercent = defaults.object(forKey: "alertDiskFreePercent") as? Double ?? 10
        alertCPUTemperature = defaults.object(forKey: "alertCPUTemperature") as? Double ?? 95
        alertBatteryTemperature = defaults.object(forKey: "alertBatteryTemperature") as? Double ?? 40
        alertMemoryPressure = defaults.object(forKey: "alertMemoryPressure") as? Bool ?? true
        alertRunawayProcess = defaults.object(forKey: "alertRunawayProcess") as? Bool ?? true
        alertRunawayCPUPercent = defaults.object(forKey: "alertRunawayCPUPercent") as? Double ?? 150
        publicIPLookup = defaults.object(forKey: "publicIPLookup") as? Bool ?? false
        historyRetentionDays = defaults.object(forKey: "historyRetentionDays") as? Int ?? 90
        showAllProcesses = defaults.object(forKey: "showAllProcesses") as? Bool ?? false
        hasCompletedOnboarding = defaults.object(forKey: "hasCompletedOnboarding") as? Bool ?? false
        menuBarShowsProcesses = defaults.object(forKey: "menuBarShowsProcesses") as? Bool ?? true
        firstLaunchDate = defaults.object(forKey: "firstLaunchDate") as? Date
        if firstLaunchDate == nil {
            firstLaunchDate = Date()
            defaults.set(firstLaunchDate, forKey: "firstLaunchDate")
        }
    }

    var refreshInterval: Double { didSet { defaults.set(refreshInterval, forKey: "refreshInterval") } }
    var temperatureUnit: TemperatureUnit { didSet { defaults.set(temperatureUnit.rawValue, forKey: "temperatureUnit") } }
    var menuBarStyle: MenuBarStyle { didSet { defaults.set(menuBarStyle.rawValue, forKey: "menuBarStyle") } }
    var showDockIcon: Bool { didSet { defaults.set(showDockIcon, forKey: "showDockIcon"); applyActivationPolicy() } }
    var alertsEnabled: Bool { didSet { defaults.set(alertsEnabled, forKey: "alertsEnabled") } }
    var alertDiskFreePercent: Double { didSet { defaults.set(alertDiskFreePercent, forKey: "alertDiskFreePercent") } }
    var alertCPUTemperature: Double { didSet { defaults.set(alertCPUTemperature, forKey: "alertCPUTemperature") } }
    var alertBatteryTemperature: Double { didSet { defaults.set(alertBatteryTemperature, forKey: "alertBatteryTemperature") } }
    var alertMemoryPressure: Bool { didSet { defaults.set(alertMemoryPressure, forKey: "alertMemoryPressure") } }
    var alertRunawayProcess: Bool { didSet { defaults.set(alertRunawayProcess, forKey: "alertRunawayProcess") } }
    var alertRunawayCPUPercent: Double { didSet { defaults.set(alertRunawayCPUPercent, forKey: "alertRunawayCPUPercent") } }
    var publicIPLookup: Bool { didSet { defaults.set(publicIPLookup, forKey: "publicIPLookup") } }
    var historyRetentionDays: Int { didSet { defaults.set(historyRetentionDays, forKey: "historyRetentionDays") } }
    var showAllProcesses: Bool { didSet { defaults.set(showAllProcesses, forKey: "showAllProcesses") } }
    var hasCompletedOnboarding: Bool { didSet { defaults.set(hasCompletedOnboarding, forKey: "hasCompletedOnboarding") } }
    var menuBarShowsProcesses: Bool { didSet { defaults.set(menuBarShowsProcesses, forKey: "menuBarShowsProcesses") } }
    private(set) var firstLaunchDate: Date?

    // MARK: Launch at login

    var launchAtLogin: Bool {
        get { SMAppService.mainApp.status == .enabled }
        set {
            do {
                if newValue { try SMAppService.mainApp.register() } else { try SMAppService.mainApp.unregister() }
            } catch {
                NSLog("Launch at login change failed: \(error.localizedDescription)")
            }
        }
    }

    func applyActivationPolicy() {
        NSApp?.setActivationPolicy(showDockIcon ? .regular : .accessory)
    }
}
