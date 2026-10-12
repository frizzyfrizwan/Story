import Foundation

/// Thin, safe wrappers around `sysctlbyname`.
enum Sysctl {
    static func string(_ name: String) -> String? {
        var size = 0
        guard sysctlbyname(name, nil, &size, nil, 0) == 0, size > 0 else { return nil }
        var buffer = [CChar](repeating: 0, count: size + 1)
        guard sysctlbyname(name, &buffer, &size, nil, 0) == 0 else { return nil }
        return String(cString: buffer)
    }

    static func int64(_ name: String) -> Int64? {
        var value: Int64 = 0
        var size = MemoryLayout<Int64>.size
        guard sysctlbyname(name, &value, &size, nil, 0) == 0 else { return nil }
        if size == MemoryLayout<Int32>.size {
            return Int64(Int32(truncatingIfNeeded: value))
        }
        return value
    }

    static func int(_ name: String) -> Int? {
        int64(name).map { Int($0) }
    }

    static func uint64(_ name: String) -> UInt64? {
        int64(name).map { UInt64(bitPattern: $0) }
    }

    /// Boot time as reported by the kernel (`kern.boottime`).
    static func bootTime() -> Date? {
        var tv = timeval()
        var size = MemoryLayout<timeval>.size
        guard sysctlbyname("kern.boottime", &tv, &size, nil, 0) == 0, tv.tv_sec > 0 else { return nil }
        return Date(timeIntervalSince1970: TimeInterval(tv.tv_sec) + TimeInterval(tv.tv_usec) / 1_000_000)
    }

    /// Swap usage (`vm.swapusage`).
    static func swapUsage() -> (total: UInt64, used: UInt64, free: UInt64)? {
        var usage = xsw_usage()
        var size = MemoryLayout<xsw_usage>.size
        guard sysctlbyname("vm.swapusage", &usage, &size, nil, 0) == 0 else { return nil }
        return (UInt64(usage.xsu_total), UInt64(usage.xsu_used), UInt64(usage.xsu_avail))
    }
}
