import Foundation

enum Format {
    private static let byteFormatter: ByteCountFormatter = {
        let formatter = ByteCountFormatter()
        formatter.countStyle = .file
        formatter.allowsNonnumericFormatting = false
        return formatter
    }()

    private static let memoryFormatter: ByteCountFormatter = {
        let formatter = ByteCountFormatter()
        formatter.countStyle = .memory
        formatter.allowsNonnumericFormatting = false
        return formatter
    }()

    /// Disk-style bytes (1 GB = 1,000,000,000 bytes, like Finder).
    static func bytes(_ value: Int64) -> String { byteFormatter.string(fromByteCount: value) }
    static func bytes(_ value: UInt64) -> String { bytes(Int64(clamping: value)) }

    /// Memory-style bytes (1 GB = 1,073,741,824 bytes, like Activity Monitor).
    static func memory(_ value: UInt64) -> String { memoryFormatter.string(fromByteCount: Int64(clamping: value)) }
    static func memory(_ value: Int64) -> String { memoryFormatter.string(fromByteCount: value) }

    /// Throughput, e.g. "12.4 MB/s".
    static func rate(_ bytesPerSecond: Double) -> String {
        let value = max(0, bytesPerSecond)
        if value < 1_000 { return String(format: "%.0f B/s", value) }
        if value < 1_000_000 { return String(format: "%.1f KB/s", value / 1_000) }
        if value < 1_000_000_000 { return String(format: "%.1f MB/s", value / 1_000_000) }
        return String(format: "%.2f GB/s", value / 1_000_000_000)
    }

    static func percent(_ fraction: Double, decimals: Int = 0) -> String {
        let clamped = fraction.isFinite ? fraction : 0
        return String(format: "%.\(decimals)f%%", clamped * 100)
    }

    static func percentValue(_ percent: Double, decimals: Int = 0) -> String {
        let clamped = percent.isFinite ? percent : 0
        return String(format: "%.\(decimals)f%%", clamped)
    }

    static func temperature(_ celsius: Double, unit: TemperatureUnit, decimals: Int = 0) -> String {
        switch unit {
        case .celsius: return String(format: "%.\(decimals)f°C", celsius)
        case .fahrenheit: return String(format: "%.\(decimals)f°F", celsius * 9 / 5 + 32)
        }
    }

    static func watts(_ value: Double) -> String {
        String(format: value < 10 ? "%.1f W" : "%.0f W", value)
    }

    static func duration(_ interval: TimeInterval) -> String {
        guard interval.isFinite, interval >= 0 else { return "—" }
        let total = Int(interval)
        let days = total / 86_400
        let hours = (total % 86_400) / 3_600
        let minutes = (total % 3_600) / 60
        if days > 0 { return hours > 0 ? "\(days)d \(hours)h" : "\(days)d" }
        if hours > 0 { return minutes > 0 ? "\(hours)h \(minutes)m" : "\(hours)h" }
        if minutes > 0 { return "\(minutes)m" }
        return "\(total)s"
    }

    static func minutes(_ minutes: Int) -> String {
        guard minutes >= 0 else { return "—" }
        let hours = minutes / 60
        let remainder = minutes % 60
        if hours > 0 { return "\(hours)h \(remainder)m" }
        return "\(remainder)m"
    }

    static func relative(_ date: Date, to reference: Date = Date()) -> String {
        let formatter = RelativeDateTimeFormatter()
        formatter.unitsStyle = .short
        return formatter.localizedString(for: date, relativeTo: reference)
    }

    static func dateTime(_ date: Date) -> String {
        date.formatted(date: .abbreviated, time: .shortened)
    }

    static func time(_ date: Date) -> String {
        date.formatted(date: .omitted, time: .shortened)
    }

    static func rpm(_ value: Double) -> String {
        String(format: "%.0f rpm", value)
    }

    static func count(_ value: Int) -> String {
        value.formatted(.number)
    }
}

enum TemperatureUnit: String, CaseIterable, Identifiable, Codable {
    case celsius, fahrenheit
    var id: String { rawValue }
    var title: String { self == .celsius ? "Celsius" : "Fahrenheit" }
}
