import Foundation
import IOKit

/// Helpers for reading the IORegistry without leaking objects.
enum IORegistry {
    /// Returns the properties dictionary of a registry entry, or nil.
    static func properties(of entry: io_registry_entry_t) -> [String: Any]? {
        var unmanaged: Unmanaged<CFMutableDictionary>?
        let result = IORegistryEntryCreateCFProperties(entry, &unmanaged, kCFAllocatorDefault, 0)
        guard result == KERN_SUCCESS, let dictionary = unmanaged?.takeRetainedValue() else { return nil }
        return (dictionary as NSDictionary) as? [String: Any]
    }

    /// Reads a single property of a registry entry.
    static func property(_ key: String, of entry: io_registry_entry_t) -> Any? {
        guard let value = IORegistryEntryCreateCFProperty(entry, key as CFString, kCFAllocatorDefault, 0) else { return nil }
        return value.takeRetainedValue()
    }

    /// Calls `body` once for every service matching `className`, releasing every object afterwards.
    static func forEachService(matching className: String, _ body: (io_service_t) -> Void) {
        var iterator: io_iterator_t = 0
        guard IOServiceGetMatchingServices(kIOMainPortDefault, IOServiceMatching(className), &iterator) == KERN_SUCCESS else { return }
        defer { IOObjectRelease(iterator) }
        var service = IOIteratorNext(iterator)
        while service != 0 {
            body(service)
            IOObjectRelease(service)
            service = IOIteratorNext(iterator)
        }
    }

    /// Returns the properties of the first service matching `className`.
    static func firstProperties(matching className: String) -> [String: Any]? {
        let service = IOServiceGetMatchingService(kIOMainPortDefault, IOServiceMatching(className))
        guard service != 0 else { return nil }
        defer { IOObjectRelease(service) }
        return properties(of: service)
    }

    /// Reads a string property from the platform expert (`IOPlatformSerialNumber`, `IOPlatformUUID`, `model`).
    static func platformExpertString(_ key: String) -> String? {
        let expert = IOServiceGetMatchingService(kIOMainPortDefault, IOServiceMatching("IOPlatformExpertDevice"))
        guard expert != 0 else { return nil }
        defer { IOObjectRelease(expert) }
        guard let value = property(key, of: expert) else { return nil }
        if let string = value as? String { return string }
        if let data = value as? Data { return String(data: data, encoding: .utf8)?.trimmingCharacters(in: .controlCharacters) }
        return nil
    }
}

extension Dictionary where Key == String, Value == Any {
    func int(_ key: String) -> Int? {
        if let value = self[key] as? Int { return value }
        if let value = self[key] as? Int64 { return Int(value) }
        if let value = self[key] as? Double { return Int(value) }
        if let value = self[key] as? NSNumber { return value.intValue }
        return nil
    }

    func double(_ key: String) -> Double? {
        if let value = self[key] as? Double { return value }
        if let value = self[key] as? Int { return Double(value) }
        if let value = self[key] as? NSNumber { return value.doubleValue }
        return nil
    }

    func bool(_ key: String) -> Bool? {
        if let value = self[key] as? Bool { return value }
        if let value = self[key] as? NSNumber { return value.boolValue }
        return nil
    }

    func string(_ key: String) -> String? {
        if let value = self[key] as? String { return value }
        if let data = self[key] as? Data { return String(data: data, encoding: .utf8)?.trimmingCharacters(in: .controlCharacters) }
        return nil
    }

    func dictionary(_ key: String) -> [String: Any]? {
        if let value = self[key] as? [String: Any] { return value }
        if let value = self[key] as? NSDictionary { return value as? [String: Any] }
        return nil
    }
}
