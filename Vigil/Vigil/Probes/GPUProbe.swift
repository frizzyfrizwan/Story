import Foundation
import IOKit

final class GPUProbe {
    private(set) var name: String = ""

    func sample() -> GPUSample? {
        var sample: GPUSample?
        IORegistry.forEachService(matching: "IOAccelerator") { service in
            guard sample == nil, let properties = IORegistry.properties(of: service),
                  let statistics = properties.dictionary("PerformanceStatistics") else { return }
            var result = GPUSample()
            result.utilization = Double(statistics.int("Device Utilization %") ?? statistics.int("GPU Activity(%)") ?? 0).clamped(to: 0...100)
            result.rendererUtilization = Double(statistics.int("Renderer Utilization %") ?? 0).clamped(to: 0...100)
            result.tilerUtilization = Double(statistics.int("Tiler Utilization %") ?? 0).clamped(to: 0...100)
            if let used = statistics.int("In use system memory") ?? statistics.int("Alloc system memory") { result.vramUsedBytes = UInt64(max(0, used)) }
            if name.isEmpty {
                name = properties.string("model") ?? properties.string("IOGLBundleName") ?? ""
            }
            result.name = name.isEmpty ? "GPU" : name
            if let cores = properties.int("gpu-core-count") { result.cores = cores }
            sample = result
        }
        return sample
    }
}
