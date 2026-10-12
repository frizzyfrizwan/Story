import XCTest
@testable import Vigil

final class HealthEngineTests: XCTestCase {
    private let now = Date()
    private let engine = HealthEngine()

    // MARK: - Fixtures

    private func makeVolume(total: Int64 = 1_000_000_000_000, freeFraction: Double = 0.4, purgeable: Int64 = 0) -> Volume {
        Volume(url: URL(fileURLWithPath: "/"),
               name: "Macintosh HD",
               total: total,
               available: Int64(Double(total) * freeFraction),
               purgeable: purgeable,
               isInternal: true,
               isRemovable: false,
               isRoot: true,
               fileSystem: "APFS")
    }

    private func makeProcess(name: String, cpuPercent: Double, memoryBytes: UInt64 = 100_000_000, isApplication: Bool = false, bundleIdentifier: String? = nil) -> ProcessSample {
        ProcessSample(pid: pid_t(name.hashValue & 0xFFFF) + 100,
                      name: name,
                      bundleIdentifier: bundleIdentifier,
                      path: nil,
                      user: "tester",
                      isApplication: isApplication,
                      cpuPercent: cpuPercent,
                      memoryBytes: memoryBytes,
                      threads: 4,
                      diskReadBytesPerSecond: 0,
                      diskWriteBytesPerSecond: 0,
                      startTime: nil,
                      parentPID: 1)
    }

    /// A context in which every rule reports "good".
    private func healthyContext() -> HealthContext {
        var memory = MemorySample()
        memory.total = 16_000_000_000
        memory.used = 8_000_000_000
        memory.pressure = .normal

        var disk = DiskSample()
        disk.volumes = [makeVolume()]

        var battery = BatterySample()
        battery.isPresent = true
        battery.percent = 95
        battery.cycleCount = 100
        battery.designCapacity = 5000
        battery.maxCapacity = 4750
        battery.currentCapacity = 4500
        battery.temperature = 30
        battery.condition = "Normal"

        var sensors = SensorSample()
        sensors.thermalState = .nominal

        var system = SystemInfo()
        system.fileVaultEnabled = true
        system.firewallEnabled = true
        system.sipEnabled = true
        system.timeMachineConfigured = true
        system.lastTimeMachineBackup = now.addingTimeInterval(-3600)
        system.pendingUpdates = []
        system.bootTime = now.addingTimeInterval(-3600)

        return HealthContext(cpu: CPUSample(),
                             memory: memory,
                             disk: disk,
                             battery: battery,
                             sensors: sensors,
                             system: system,
                             processes: [],
                             startupItemCount: nil,
                             now: now)
    }

    private func finding(_ id: String, in report: HealthReport) -> HealthFinding? {
        report.findings.first { $0.id == id }
    }

    // MARK: - Baseline

    func testHealthyContextScoresHighWithNoWarnings() {
        let report = engine.evaluate(context: healthyContext())
        XCTAssertGreaterThanOrEqual(report.score, 90)
        XCTAssertTrue(report.findings.allSatisfy { $0.severity < .warning }, "Unexpected findings: \(report.findings.map(\.id))")
        XCTAssertEqual(report.grade, "Excellent")
        XCTAssertEqual(report.generatedAt, now)
    }

    // MARK: - Storage

    func testAlmostFullRootVolumeIsCritical() throws {
        let healthy = engine.evaluate(context: healthyContext())
        var context = healthyContext()
        context.disk.volumes = [makeVolume(freeFraction: 0.03)]
        let report = engine.evaluate(context: context)
        let finding = try XCTUnwrap(finding("storage.critical", in: report))
        XCTAssertEqual(finding.severity, .critical)
        XCTAssertEqual(finding.category, .storage)
        XCTAssertLessThanOrEqual(report.score, healthy.score - 25)
    }

    func testLowRootVolumeIsWarning() throws {
        var context = healthyContext()
        context.disk.volumes = [makeVolume(freeFraction: 0.10)]
        let report = engine.evaluate(context: context)
        let finding = try XCTUnwrap(finding("storage.low", in: report))
        XCTAssertEqual(finding.severity, .warning)
        XCTAssertNil(self.finding("storage.critical", in: report))
    }

    // MARK: - Memory

    func testCriticalMemoryPressureProducesWarning() throws {
        var context = healthyContext()
        context.memory.pressure = .critical
        context.memory.swapUsed = 2_000_000_000
        let report = engine.evaluate(context: context)
        let finding = try XCTUnwrap(finding("memory.critical", in: report))
        XCTAssertEqual(finding.severity, .warning)
        XCTAssertEqual(finding.category, .memory)
    }

    // MARK: - CPU

    func testKernelTaskAboveOneCoreProducesKernelFinding() throws {
        var context = healthyContext()
        context.processes = [makeProcess(name: "kernel_task", cpuPercent: 150)]
        let report = engine.evaluate(context: context)
        let finding = try XCTUnwrap(finding("cpu.kernel", in: report))
        XCTAssertEqual(finding.severity, .warning)
        XCTAssertNil(self.finding("cpu.runaway", in: report), "kernel_task must not be reported as a runaway process")
    }

    func testRunawayProcessProducesRunawayFinding() throws {
        var context = healthyContext()
        context.processes = [makeProcess(name: "node", cpuPercent: 200)]
        let report = engine.evaluate(context: context)
        let finding = try XCTUnwrap(finding("cpu.runaway", in: report))
        XCTAssertEqual(finding.severity, .warning)
        XCTAssertTrue(finding.title.contains("node"))
        XCTAssertNil(self.finding("cpu.kernel", in: report))
    }

    func testLongUptimeProducesWarning() throws {
        var context = healthyContext()
        context.system.bootTime = now.addingTimeInterval(-40 * 86_400)
        let report = engine.evaluate(context: context)
        let finding = try XCTUnwrap(finding("cpu.uptime", in: report))
        XCTAssertEqual(finding.severity, .warning)
        XCTAssertEqual(finding.category, .maintenance)
    }

    // MARK: - Battery

    func testWornBatteryProducesHealthWarning() throws {
        var context = healthyContext()
        context.battery.designCapacity = 5000
        context.battery.maxCapacity = 3000
        XCTAssertLessThan(context.battery.healthPercent, 70)
        let report = engine.evaluate(context: context)
        let finding = try XCTUnwrap(finding("battery.health", in: report))
        XCTAssertEqual(finding.severity, .warning)
        XCTAssertEqual(finding.category, .battery)
    }

    func testAbsentBatteryProducesNoBatteryFindings() {
        var context = healthyContext()
        context.battery = BatterySample()
        let report = engine.evaluate(context: context)
        XCTAssertTrue(report.findings(in: .battery).isEmpty)
    }

    // MARK: - Thermal

    func testSeriousThermalStateProducesWarning() throws {
        var context = healthyContext()
        context.sensors.thermalState = .serious
        let report = engine.evaluate(context: context)
        let finding = try XCTUnwrap(finding("thermal.state", in: report))
        XCTAssertEqual(finding.severity, .warning)
        XCTAssertEqual(finding.category, .thermal)
    }

    // MARK: - Security

    func testFileVaultOffProducesFinding() throws {
        var context = healthyContext()
        context.system.fileVaultEnabled = false
        let report = engine.evaluate(context: context)
        let finding = try XCTUnwrap(finding("security.filevault", in: report))
        XCTAssertEqual(finding.severity, .warning)
        XCTAssertEqual(finding.category, .security)
        XCTAssertNil(self.finding("security.ok", in: report))
    }

    // MARK: - Backups

    func testNoTimeMachineProducesFinding() throws {
        var context = healthyContext()
        context.system.timeMachineConfigured = false
        let report = engine.evaluate(context: context)
        let finding = try XCTUnwrap(finding("backup.none", in: report))
        XCTAssertEqual(finding.severity, .warning)
        XCTAssertEqual(finding.category, .backup)
    }

    func testStaleBackupProducesWarning() throws {
        var context = healthyContext()
        context.system.lastTimeMachineBackup = now.addingTimeInterval(-20 * 86_400)
        let report = engine.evaluate(context: context)
        let finding = try XCTUnwrap(finding("backup.stale", in: report))
        XCTAssertEqual(finding.severity, .warning)
        XCTAssertNil(self.finding("backup.none", in: report))
    }

    // MARK: - Ordering and clamping

    func testFindingsAreSortedMostSevereFirst() {
        var context = healthyContext()
        context.disk.volumes = [makeVolume(freeFraction: 0.03)]
        context.memory.pressure = .warning
        context.system.fileVaultEnabled = false
        context.system.firewallEnabled = false
        let report = engine.evaluate(context: context)
        XCTAssertGreaterThan(report.findings.count, 3)
        let severities = report.findings.map(\.severity)
        for index in 1..<severities.count {
            XCTAssertGreaterThanOrEqual(severities[index - 1], severities[index], "Findings are not sorted most severe first: \(report.findings.map(\.id))")
        }
        XCTAssertEqual(report.findings.first?.severity, .critical)
        XCTAssertEqual(report.worst, .critical)
    }

    func testScoreNeverDropsBelowZero() {
        var context = healthyContext()
        context.disk.volumes = [makeVolume(freeFraction: 0.02)]
        context.system.smartStatus = "Failing"
        context.memory.pressure = .critical
        context.processes = [makeProcess(name: "node", cpuPercent: 300), makeProcess(name: "kernel_task", cpuPercent: 180)]
        context.battery.designCapacity = 5000
        context.battery.maxCapacity = 2500
        context.battery.condition = "Service Recommended"
        context.battery.temperature = 45
        context.battery.cycleCount = 1200
        context.sensors.thermalState = .critical
        context.sensors.temperatures = [SensorReading(key: "TC0P", name: "CPU proximity", group: .cpu, celsius: 105)]
        context.system.fileVaultEnabled = false
        context.system.firewallEnabled = false
        context.system.sipEnabled = false
        context.system.pendingUpdates = ["macOS 14.7", "Safari 18"]
        context.system.timeMachineConfigured = false
        context.system.bootTime = now.addingTimeInterval(-45 * 86_400)
        context.startupItemCount = 30
        let report = engine.evaluate(context: context)
        let totalPenalty = report.findings.reduce(0) { $0 + $1.severity.penalty }
        XCTAssertGreaterThan(totalPenalty, 100, "This fixture is meant to overflow the 100-point budget")
        XCTAssertEqual(report.score, 0)
        XCTAssertGreaterThanOrEqual(report.score, 0)
        XCTAssertEqual(report.grade, "Needs care")
    }
}
