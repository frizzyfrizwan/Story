import XCTest
import AppKit
@testable import Vigil

/// Exercises the live probes on the machine running the tests. These only check invariants that must hold on any Mac.
final class ProbeSmokeTests: XCTestCase {
    // MARK: - CPU

    func testCPUProbeNeedsTwoSamplesAndReportsEveryCore() throws {
        let probe = CPUProbe()
        XCTAssertNil(probe.sample(), "The first sample has no previous ticks to diff against")
        Thread.sleep(forTimeInterval: 0.3)
        let sample = try XCTUnwrap(probe.sample(), "The second sample should be available")
        XCTAssertEqual(sample.cores.count, ProcessInfo.processInfo.activeProcessorCount)
        XCTAssertTrue((0...100).contains(sample.total), "total was \(sample.total)")
        XCTAssertTrue((0...100).contains(sample.user))
        XCTAssertTrue((0...100).contains(sample.system))
        XCTAssertTrue((0...100).contains(sample.idle))
        for core in sample.cores {
            XCTAssertTrue((0...100).contains(core.usage), "core \(core.index) usage was \(core.usage)")
        }
        XCTAssertEqual(sample.loadAverage.count, 3)
        XCTAssertEqual(Set(sample.cores.map(\.index)).count, sample.cores.count, "Core indices should be unique")
    }

    // MARK: - Memory

    func testMemoryProbeReportsPhysicalMemory() throws {
        let sample = try XCTUnwrap(MemoryProbe().sample())
        XCTAssertEqual(sample.total, ProcessInfo.processInfo.physicalMemory)
        XCTAssertGreaterThan(sample.total, 0)
        XCTAssertLessThanOrEqual(sample.used, sample.total)
        XCTAssertTrue((0...1).contains(sample.usedFraction))
        XCTAssertTrue((0...100).contains(sample.pressurePercent))
    }

    func testPressurePercentIsBandedByKernelLevel() {
        let total: UInt64 = 16_000_000_000
        let normal = MemoryProbe.pressurePercent(used: total / 2, compressed: 0, swapUsed: 0, total: total, level: .normal)
        XCTAssertTrue((0...49).contains(normal), "normal was \(normal)")
        let normalHigh = MemoryProbe.pressurePercent(used: total, compressed: total / 2, swapUsed: total, total: total, level: .normal)
        XCTAssertTrue((0...49).contains(normalHigh), "normal is capped at 49, was \(normalHigh)")

        let warning = MemoryProbe.pressurePercent(used: total / 2, compressed: 0, swapUsed: 0, total: total, level: .warning)
        XCTAssertTrue((50...79).contains(warning), "warning was \(warning)")
        let warningHigh = MemoryProbe.pressurePercent(used: total, compressed: total / 2, swapUsed: total, total: total, level: .warning)
        XCTAssertTrue((50...79).contains(warningHigh), "warning is capped at 79, was \(warningHigh)")

        let critical = MemoryProbe.pressurePercent(used: total / 2, compressed: 0, swapUsed: 0, total: total, level: .critical)
        XCTAssertGreaterThanOrEqual(critical, 80, "critical was \(critical)")
        XCTAssertLessThanOrEqual(critical, 100)

        XCTAssertEqual(MemoryProbe.pressurePercent(used: 1, compressed: 1, swapUsed: 1, total: 0, level: .critical), 0, "A zero total must not divide by zero")
    }

    // MARK: - Disk

    func testDiskProbeFindsRootVolume() throws {
        let sample = DiskProbe().sample()
        let root = try XCTUnwrap(sample.volumes.first(where: \.isRoot), "No root volume among \(sample.volumes.map(\.name))")
        XCTAssertGreaterThan(root.total, 0)
        XCTAssertGreaterThanOrEqual(root.available, 0)
        XCTAssertLessThanOrEqual(root.available, root.total)
        XCTAssertTrue((0...1).contains(root.usedFraction))
        XCTAssertEqual(sample.root?.id, root.id, "DiskSample.root should prefer the root volume")
        XCTAssertEqual(sample.volumes.first?.isRoot, true, "Volumes are sorted root first")
    }

    // MARK: - Network

    func testNetworkProbeEnumeratesInterfacesWithoutCrashing() {
        let probe = NetworkProbe()
        let interfaces = probe.interfaces(force: true)
        for interface in interfaces {
            XCTAssertFalse(interface.name.isEmpty)
            XCTAssertFalse(interface.displayName.isEmpty)
            XCTAssertNotEqual(interface.name, "lo0")
        }
        let cached = probe.interfaces()
        XCTAssertEqual(cached.map(\.name), interfaces.map(\.name), "A second call within 10 s returns the cached list")
        let sample = probe.sample()
        XCTAssertGreaterThanOrEqual(sample.inBytesPerSecond, 0)
        XCTAssertGreaterThanOrEqual(sample.outBytesPerSecond, 0)
    }

    // MARK: - Processes

    func testProcessProbeSeesThisProcess() {
        let probe = ProcessProbe()
        let first = probe.sample()
        let selfPID = ProcessInfo.processInfo.processIdentifier
        XCTAssertFalse(first.isEmpty)
        XCTAssertTrue(first.contains { $0.pid == selfPID }, "Current process \(selfPID) not found")
        XCTAssertTrue(first.allSatisfy { $0.pid > 0 })

        Thread.sleep(forTimeInterval: 0.2)
        let second = probe.sample()
        XCTAssertTrue(second.contains { $0.pid == selfPID })
        for process in second {
            XCTAssertGreaterThanOrEqual(process.cpuPercent, 0, "\(process.name) reported negative CPU")
            XCTAssertGreaterThanOrEqual(process.diskReadBytesPerSecond, 0)
            XCTAssertGreaterThanOrEqual(process.diskWriteBytesPerSecond, 0)
            XCTAssertFalse(process.name.isEmpty, "pid \(process.pid) has no name")
        }
        if let me = second.first(where: { $0.pid == selfPID }) {
            XCTAssertGreaterThan(me.memoryBytes, 0)
            XCTAssertGreaterThan(me.threads, 0)
        }
    }

    func testAllPIDsIncludesThisProcess() {
        let pids = ProcessProbe.allPIDs()
        XCTAssertTrue(pids.contains(ProcessInfo.processInfo.processIdentifier))
        XCTAssertTrue(pids.allSatisfy { $0 > 0 })
    }

    // MARK: - System information

    func testSystemInfoProbeCollectsBasics() {
        let info = SystemInfoProbe.collect()
        XCTAssertFalse(info.osVersion.isEmpty)
        XCTAssertGreaterThan(info.logicalCores, 0)
        XCTAssertGreaterThan(info.physicalCores, 0)
        XCTAssertLessThanOrEqual(info.physicalCores, info.logicalCores)
        XCTAssertEqual(info.memoryBytes, ProcessInfo.processInfo.physicalMemory)
        XCTAssertFalse(info.modelName.isEmpty)
        XCTAssertFalse(info.osName.isEmpty)
        XCTAssertGreaterThanOrEqual(info.uptime, 0)
        if let bootTime = info.bootTime {
            XCTAssertLessThan(bootTime, Date())
        }
    }

    func testModelNameMapsIdentifiersToFamilies() {
        XCTAssertTrue(SystemInfoProbe.modelName(identifier: "Mac14,6", chip: "Apple M2 Max").contains("MacBook Pro"))
        XCTAssertEqual(SystemInfoProbe.modelName(identifier: "Mac14,6", chip: "Apple M2 Max"), "MacBook Pro (M2 Max)")
        XCTAssertTrue(SystemInfoProbe.modelName(identifier: "MacBookAir10,1", chip: "Apple M1").contains("MacBook Air"))
        XCTAssertTrue(SystemInfoProbe.modelName(identifier: "Macmini9,1", chip: "Apple M1").contains("Mac mini"))
        XCTAssertTrue(SystemInfoProbe.modelName(identifier: "Mac13,1", chip: "Apple M1 Max").contains("Mac Studio"))
        XCTAssertTrue(SystemInfoProbe.modelName(identifier: "iMac21,1", chip: "Apple M1").contains("iMac"))
        XCTAssertTrue(SystemInfoProbe.modelName(identifier: "Mac14,8", chip: "Apple M2 Ultra").contains("Mac Pro"))
        // Intel chips are not appended; unknown identifiers pass through.
        XCTAssertEqual(SystemInfoProbe.modelName(identifier: "MacBookPro16,1", chip: "Intel(R) Core(TM) i9"), "MacBook Pro")
        XCTAssertEqual(SystemInfoProbe.modelName(identifier: "Unknown1,1", chip: ""), "Unknown1,1")
        XCTAssertEqual(SystemInfoProbe.modelName(identifier: "", chip: ""), "Mac")
    }

    func testMarketingNames() {
        XCTAssertEqual(SystemInfoProbe.marketingName(forMajor: 14), "macOS Sonoma")
        XCTAssertEqual(SystemInfoProbe.marketingName(forMajor: 15), "macOS Sequoia")
        XCTAssertEqual(SystemInfoProbe.marketingName(forMajor: 26), "macOS Tahoe")
        XCTAssertEqual(SystemInfoProbe.marketingName(forMajor: 99), "macOS")
    }

    // MARK: - Battery

    func testBatteryProbeDoesNotCrash() {
        let sample = BatteryProbe().sample()
        XCTAssertTrue((0...100).contains(sample.percent))
        if sample.isPresent {
            XCTAssertTrue((0...100).contains(sample.healthPercent))
            XCTAssertFalse(sample.stateDescription.isEmpty)
        } else {
            XCTAssertEqual(sample.stateDescription, "No battery")
        }
    }

    // MARK: - Sensors

    func testSMCProbeSampleHasValidReadings() {
        let probe = SMCProbe()
        let sample = probe.sample()
        XCTAssertEqual(sample.smcAvailable, probe.isAvailable)
        for reading in sample.temperatures {
            XCTAssertGreaterThan(reading.celsius, 0, "\(reading.key) reported \(reading.celsius)")
            XCTAssertLessThan(reading.celsius, 130, "\(reading.key) reported \(reading.celsius)")
            XCTAssertFalse(reading.name.isEmpty)
        }
        for fan in sample.fans {
            XCTAssertGreaterThanOrEqual(fan.rpm, 0)
            XCTAssertTrue((0...1).contains(fan.fraction))
        }
    }

    // MARK: - Menu bar rendering

    func testMenuBarRendererProducesTemplateImagesForEveryStyle() {
        var battery = BatterySample()
        battery.isPresent = true
        battery.percent = 73
        battery.isCharging = true
        let recent = (0..<20).map { Double($0 * 5) }

        for style in MenuBarStyle.allCases {
            let image = MenuBarRenderer.image(style: style, cpu: 42.5, memoryPressure: 31, temperature: 61.2,
                                              netIn: 1_234_567, netOut: 98_765, battery: battery, recentCPU: recent, unit: .celsius)
            XCTAssertTrue(image.isTemplate, "\(style.rawValue) should be a template image")
            XCTAssertGreaterThan(image.size.width, 0, "\(style.rawValue) has no width")
            XCTAssertGreaterThan(image.size.height, 0, "\(style.rawValue) has no height")
            if style != .icon {
                XCTAssertEqual(image.size.height, MenuBarRenderer.height, accuracy: 0.001, "\(style.rawValue) should be \(MenuBarRenderer.height) points tall")
            }
        }
        XCTAssertEqual(MenuBarRenderer.height, 18)
    }

    func testMenuBarRendererHandlesMissingValues() {
        let image = MenuBarRenderer.image(style: .temperature, cpu: 0, memoryPressure: 0, temperature: nil,
                                          netIn: 0, netOut: 0, battery: BatterySample(), recentCPU: [], unit: .fahrenheit)
        XCTAssertTrue(image.isTemplate)
        let graph = MenuBarRenderer.graph([])
        XCTAssertTrue(graph.isTemplate)
        XCTAssertEqual(graph.size.height, MenuBarRenderer.height, accuracy: 0.001)
        XCTAssertEqual(graph.size.width, 30, accuracy: 0.001)
        let noBattery = MenuBarRenderer.image(style: .battery, cpu: 0, memoryPressure: 0, temperature: nil,
                                              netIn: 0, netOut: 0, battery: BatterySample(), recentCPU: [], unit: .celsius)
        XCTAssertTrue(noBattery.isTemplate)
    }

    // MARK: - Notifications

    func testNotificationServiceRespectsEnabledFlagWithoutConsumingCooldown() {
        let service = NotificationService(cooldown: 1)
        XCTAssertTrue(service.shouldSend(id: "disk"))
        XCTAssertFalse(service.alert(id: "disk", title: "Disk", body: "Almost full", enabled: false))
        XCTAssertTrue(service.shouldSend(id: "disk"), "A disabled alert must not start the cooldown")
        XCTAssertFalse(service.authorized)
        service.resetCooldowns()
        XCTAssertTrue(service.shouldSend(id: "disk"))
        XCTAssertTrue(service.shouldSend(id: "never-seen"))
    }
}
