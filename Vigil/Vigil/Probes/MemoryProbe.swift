import Foundation
import Darwin

final class MemoryProbe {
    private let pageSize = UInt64(vm_kernel_page_size)
    private let total = ProcessInfo.processInfo.physicalMemory

    func sample() -> MemorySample? {
        var stats = vm_statistics64()
        var count = mach_msg_type_number_t(MemoryLayout<vm_statistics64>.size / MemoryLayout<integer_t>.size)
        let result = withUnsafeMutablePointer(to: &stats) { pointer in
            pointer.withMemoryRebound(to: integer_t.self, capacity: Int(count)) {
                host_statistics64(mach_host_self(), HOST_VM_INFO64, $0, &count)
            }
        }
        guard result == KERN_SUCCESS else { return nil }

        let wired = UInt64(stats.wire_count) * pageSize
        let compressed = UInt64(stats.compressor_page_count) * pageSize
        let purgeable = UInt64(stats.purgeable_count) * pageSize
        let internalPages = UInt64(stats.internal_page_count) * pageSize
        let external = UInt64(stats.external_page_count) * pageSize
        let free = UInt64(stats.free_count) * pageSize
        let app = internalPages > purgeable ? internalPages - purgeable : internalPages
        let used = app + wired + compressed

        var sample = MemorySample()
        sample.total = total
        sample.used = min(used, total)
        sample.app = app
        sample.wired = wired
        sample.compressed = compressed
        sample.cached = external + purgeable
        sample.free = free
        if let swap = Sysctl.swapUsage() {
            sample.swapTotal = swap.total
            sample.swapUsed = swap.used
        }
        let level = Sysctl.int("kern.memorystatus_vm_pressure_level") ?? 1
        sample.pressure = MemoryPressure(rawValue: level) ?? (level >= 4 ? .critical : level >= 2 ? .warning : .normal)
        sample.pressurePercent = Self.pressurePercent(used: sample.used, compressed: compressed, swapUsed: sample.swapUsed, total: total, level: sample.pressure)
        return sample
    }

    /// Approximates Activity Monitor's pressure graph: driven by compression and swap, floored by the kernel level.
    static func pressurePercent(used: UInt64, compressed: UInt64, swapUsed: UInt64, total: UInt64, level: MemoryPressure) -> Double {
        guard total > 0 else { return 0 }
        let usedFraction = Double(used) / Double(total)
        let compressedFraction = Double(compressed) / Double(total)
        let swapFraction = Double(swapUsed) / Double(total)
        var score = usedFraction * 40 + compressedFraction * 120 + swapFraction * 100
        switch level {
        case .normal: score = min(score, 49)
        case .warning: score = max(50, min(score, 79))
        case .critical: score = max(80, score)
        }
        return score.clamped(to: 0...100)
    }
}
