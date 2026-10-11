import Foundation
import IOKit.pwr_mgt
import Observation

/// Prevents display and idle sleep using a power-management assertion (like `caffeinate -d`).
@Observable
final class KeepAwake {
    private var assertionID: IOPMAssertionID = 0
    private var timer: Timer?
    private(set) var isActive = false
    private(set) var until: Date?

    enum Duration: CaseIterable, Identifiable {
        case indefinite, fifteenMinutes, oneHour, twoHours, fourHours
        var id: Self { self }
        var title: String {
            switch self {
            case .indefinite: return "Until turned off"
            case .fifteenMinutes: return "15 minutes"
            case .oneHour: return "1 hour"
            case .twoHours: return "2 hours"
            case .fourHours: return "4 hours"
            }
        }
        var seconds: TimeInterval? {
            switch self {
            case .indefinite: return nil
            case .fifteenMinutes: return 15 * 60
            case .oneHour: return 3600
            case .twoHours: return 2 * 3600
            case .fourHours: return 4 * 3600
            }
        }
    }

    func activate(for duration: Duration) {
        deactivate()
        var id: IOPMAssertionID = 0
        let result = IOPMAssertionCreateWithName(kIOPMAssertionTypePreventUserIdleDisplaySleep as CFString,
                                                 IOPMAssertionLevel(kIOPMAssertionLevelOn),
                                                 "Vigil Keep Awake" as CFString,
                                                 &id)
        guard result == kIOReturnSuccess else { return }
        assertionID = id
        isActive = true
        if let seconds = duration.seconds {
            until = Date().addingTimeInterval(seconds)
            timer = Timer.scheduledTimer(withTimeInterval: seconds, repeats: false) { [weak self] _ in self?.deactivate() }
        } else {
            until = nil
        }
    }

    func deactivate() {
        timer?.invalidate()
        timer = nil
        if assertionID != 0 {
            IOPMAssertionRelease(assertionID)
            assertionID = 0
        }
        isActive = false
        until = nil
    }

    func toggle() {
        if isActive { deactivate() } else { activate(for: .indefinite) }
    }
}
