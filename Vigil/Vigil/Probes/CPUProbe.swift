import Foundation
import Darwin

/// Samples per-core CPU load from the Mach host, computing deltas between calls.
final class CPUProbe {
    private var previousTicks: [UInt32] = []
    private let stateCount = Int(CPU_STATE_MAX)
    private let efficiencyCoreCount: Int
    private let performanceCoreCount: Int

    init() {
        // On Apple Silicon the efficiency cores are the first logical CPUs.
        var efficiency = 0
        var performance = 0
        for level in 0..<2 {
            guard let name = Sysctl.string("hw.perflevel\(level).name"),
                  let count = Sysctl.int("hw.perflevel\(level).logicalcpu") else { continue }
            if name.lowercased().hasPrefix("eff") { efficiency = count } else { performance = count }
        }
        efficiencyCoreCount = efficiency
        performanceCoreCount = performance
    }

    func sample() -> CPUSample? {
        var cpuCount: natural_t = 0
        var infoArray: processor_info_array_t?
        var infoCount: mach_msg_type_number_t = 0
        let result = host_processor_info(mach_host_self(), PROCESSOR_CPU_LOAD_INFO, &cpuCount, &infoArray, &infoCount)
        guard result == KERN_SUCCESS, let info = infoArray else { return nil }
        defer {
            let size = vm_size_t(infoCount) * vm_size_t(MemoryLayout<integer_t>.stride)
            vm_deallocate(mach_task_self_, vm_address_t(bitPattern: info), size)
        }

        let count = Int(cpuCount)
        var ticks = [UInt32](repeating: 0, count: count * stateCount)
        for index in 0..<ticks.count {
            ticks[index] = UInt32(bitPattern: info[index])
        }
        defer { previousTicks = ticks }
        guard previousTicks.count == ticks.count else { return nil }

        var cores: [CoreUsage] = []
        var userTotal = 0.0, systemTotal = 0.0, idleTotal = 0.0, allTotal = 0.0
        for core in 0..<count {
            let base = core * stateCount
            func delta(_ state: Int32) -> Double {
                let index = base + Int(state)
                return Double(ticks[index] &- previousTicks[index])
            }
            let user = delta(CPU_STATE_USER) + delta(CPU_STATE_NICE)
            let system = delta(CPU_STATE_SYSTEM)
            let idle = delta(CPU_STATE_IDLE)
            let total = user + system + idle
            let usage = total > 0 ? (user + system) / total * 100 : 0
            let kind: CoreKind
            if efficiencyCoreCount > 0 && core < efficiencyCoreCount { kind = .efficiency }
            else if efficiencyCoreCount > 0 { kind = .performance }
            else { kind = .standard }
            cores.append(CoreUsage(index: core, kind: kind, usage: usage.clamped(to: 0...100)))
            userTotal += user; systemTotal += system; idleTotal += idle; allTotal += total
        }

        var loads = [Double](repeating: 0, count: 3)
        _ = getloadavg(&loads, 3)

        var sample = CPUSample()
        sample.cores = cores
        sample.user = allTotal > 0 ? userTotal / allTotal * 100 : 0
        sample.system = allTotal > 0 ? systemTotal / allTotal * 100 : 0
        sample.idle = allTotal > 0 ? idleTotal / allTotal * 100 : 100
        sample.total = (sample.user + sample.system).clamped(to: 0...100)
        sample.loadAverage = loads
        return sample
    }
}
