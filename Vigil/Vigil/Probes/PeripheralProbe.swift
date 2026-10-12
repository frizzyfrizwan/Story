import Foundation
import IOKit

/// Battery levels of Bluetooth input devices (Magic Mouse, Magic Keyboard, Magic Trackpad, some headsets).
enum PeripheralProbe {
    static func batteries() -> [PeripheralBattery] {
        var result: [PeripheralBattery] = []
        var seen = Set<String>()
        for className in ["AppleDeviceManagementHIDEventService", "AppleHSBluetoothDevice", "IOBluetoothDevice", "BNBMouseDevice", "AppleBluetoothHIDKeyboard"] {
            IORegistry.forEachService(matching: className) { service in
                guard let properties = IORegistry.properties(of: service),
                      let percent = properties.int("BatteryPercent") ?? properties.int("BatteryPercentMain"), percent >= 0, percent <= 100 else { return }
                let name = properties.string("Product") ?? properties.string("DeviceName") ?? properties.string("Name") ?? "Bluetooth device"
                let address = properties.string("DeviceAddress") ?? properties.string("SerialNumber") ?? name
                let key = "\(name)-\(address)"
                guard !seen.contains(key) else { return }
                seen.insert(key)
                let kind: String
                let lowered = name.lowercased()
                if lowered.contains("mouse") { kind = "magicmouse" }
                else if lowered.contains("trackpad") { kind = "trackpad" }
                else if lowered.contains("keyboard") { kind = "keyboard" }
                else if lowered.contains("airpods") || lowered.contains("beats") { kind = "airpods" }
                else { kind = "bluetooth" }
                result.append(PeripheralBattery(id: key, name: name, kind: kind, percent: percent))
            }
        }
        return result.sorted { $0.name < $1.name }
    }
}
