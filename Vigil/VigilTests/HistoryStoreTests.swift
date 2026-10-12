import XCTest
@testable import Vigil

final class HistoryStoreTests: XCTestCase {
    private var store: HistoryStore!

    /// A minute-aligned anchor (1_700_000_040 is divisible by 60) so 60-second buckets line up with the inserted samples.
    private let base = Date(timeIntervalSince1970: 1_700_000_040)

    override func setUp() {
        super.setUp()
        store = HistoryStore(url: nil)
    }

    override func tearDown() {
        store = nil
        super.tearDown()
    }

    private func makePoint(at time: Date, cpu: Double) -> MetricPoint {
        MetricPoint(time: time,
                    cpu: cpu,
                    memoryUsed: 8_000_000_000,
                    memoryPressure: 1,
                    swapUsed: 0,
                    diskRead: 1_000,
                    diskWrite: 2_000,
                    networkIn: 3_000,
                    networkOut: 4_000,
                    battery: 80,
                    isCharging: false,
                    temperature: 45,
                    fanRPM: 1_200,
                    gpu: 10,
                    power: 12)
    }

    // MARK: - Samples

    func testInMemoryStoreHasNoURL() {
        XCTAssertNil(store.url)
        XCTAssertEqual(store.fileSize(), 0)
    }

    func testEmptyStoreReportsNoSamples() {
        XCTAssertEqual(store.sampleCount(), 0)
        XCTAssertNil(store.oldestSample())
        XCTAssertTrue(store.points(from: base, to: base.addingTimeInterval(3600), bucketSeconds: 60).isEmpty)
    }

    func testInsertedSamplesAreBucketedAndAveraged() {
        // 60 samples at 10-second spacing over 10 minutes; cpu == sample index.
        for index in 0..<60 {
            store.insert(makePoint(at: base.addingTimeInterval(TimeInterval(index * 10)), cpu: Double(index)))
        }
        store.flush()
        XCTAssertEqual(store.sampleCount(), 60)
        XCTAssertEqual(store.oldestSample(), base)

        let points = store.points(from: base, to: base.addingTimeInterval(600), bucketSeconds: 60)
        XCTAssertEqual(points.count, 10)
        guard let first = points.first, let last = points.last else {
            XCTFail("Expected bucketed points")
            return
        }
        // Bucket 0 averages indices 0...5, bucket 9 averages 54...59.
        XCTAssertEqual(first.time, base)
        XCTAssertEqual(first.cpu, 2.5, accuracy: 0.001)
        XCTAssertEqual(last.cpu, 56.5, accuracy: 0.001)
        XCTAssertEqual(first.memoryUsed, 8_000_000_000)
        XCTAssertEqual(first.memoryPressure, 1)
        XCTAssertFalse(first.isCharging)
        XCTAssertEqual(first.temperature, 45, accuracy: 0.001)
        // Buckets are in ascending time order.
        for index in 1..<points.count {
            XCTAssertLessThan(points[index - 1].time, points[index].time)
        }
    }

    func testRawBucketsReturnEverySample() {
        for index in 0..<6 {
            store.insert(makePoint(at: base.addingTimeInterval(TimeInterval(index * 10)), cpu: Double(index * 10)))
        }
        store.flush()
        let points = store.points(from: base, to: base.addingTimeInterval(60), bucketSeconds: 10)
        XCTAssertEqual(points.count, 6)
        XCTAssertEqual(points.map(\.cpu), [0, 10, 20, 30, 40, 50])
    }

    func testPointsOutsideRangeAreExcluded() {
        store.insert(makePoint(at: base, cpu: 1))
        store.insert(makePoint(at: base.addingTimeInterval(3600), cpu: 2))
        store.flush()
        let points = store.points(from: base.addingTimeInterval(1800), to: base.addingTimeInterval(7200), bucketSeconds: 60)
        XCTAssertEqual(points.count, 1)
        XCTAssertEqual(points.first?.cpu, 2)
    }

    func testInsertingSameTimestampReplacesSample() {
        store.insert(makePoint(at: base, cpu: 10))
        store.insert(makePoint(at: base, cpu: 90))
        store.flush()
        XCTAssertEqual(store.sampleCount(), 1)
        let points = store.points(from: base, to: base, bucketSeconds: 1)
        XCTAssertEqual(points.first?.cpu, 90)
    }

    // MARK: - Processes

    func testProcessesNearTimeAreSortedByCPUDescending() {
        let snapshot = base.addingTimeInterval(300)
        store.insert(processes: [
            ProcessPoint(time: snapshot, name: "light", bundleIdentifier: nil, cpu: 5, memory: 100),
            ProcessPoint(time: snapshot, name: "heavy", bundleIdentifier: "com.example.heavy", cpu: 95, memory: 300),
            ProcessPoint(time: snapshot, name: "medium", bundleIdentifier: nil, cpu: 40, memory: 200),
        ])
        store.flush()

        let rows = store.processes(near: snapshot.addingTimeInterval(20), tolerance: 90, limit: 12)
        XCTAssertEqual(rows.map(\.name), ["heavy", "medium", "light"])
        XCTAssertEqual(rows.first?.bundleIdentifier, "com.example.heavy")
        XCTAssertEqual(rows.first?.memory, 300)
        XCTAssertEqual(rows.first?.time, snapshot)
        XCTAssertNil(rows.last?.bundleIdentifier)

        let limited = store.processes(near: snapshot, tolerance: 90, limit: 1)
        XCTAssertEqual(limited.map(\.name), ["heavy"])
    }

    func testProcessesOutsideToleranceAreNotReturned() {
        let snapshot = base.addingTimeInterval(300)
        store.insert(processes: [ProcessPoint(time: snapshot, name: "heavy", bundleIdentifier: nil, cpu: 95, memory: 300)])
        store.flush()
        XCTAssertTrue(store.processes(near: snapshot.addingTimeInterval(600), tolerance: 90, limit: 12).isEmpty)
    }

    func testInsertingEmptyProcessListIsNoOp() {
        store.insert(processes: [])
        store.flush()
        XCTAssertTrue(store.processes(near: base, tolerance: 90, limit: 12).isEmpty)
    }

    func testTopProcessesRankHeaviestFirst() {
        let first = base
        let second = base.addingTimeInterval(60)
        store.insert(processes: [
            ProcessPoint(time: first, name: "heavy", bundleIdentifier: nil, cpu: 90, memory: 500),
            ProcessPoint(time: first, name: "light", bundleIdentifier: nil, cpu: 5, memory: 100),
            ProcessPoint(time: first, name: "medium", bundleIdentifier: nil, cpu: 30, memory: 200),
        ])
        store.insert(processes: [
            ProcessPoint(time: second, name: "heavy", bundleIdentifier: nil, cpu: 80, memory: 700),
            ProcessPoint(time: second, name: "light", bundleIdentifier: nil, cpu: 5, memory: 100),
            ProcessPoint(time: second, name: "medium", bundleIdentifier: nil, cpu: 30, memory: 250),
        ])
        store.flush()

        let top = store.topProcesses(from: base, to: base.addingTimeInterval(120), limit: 10)
        XCTAssertEqual(top.map(\.name), ["heavy", "medium", "light"])
        guard let heavy = top.first else {
            XCTFail("Expected a top process")
            return
        }
        XCTAssertEqual(heavy.cpu, 85, accuracy: 0.001, "Average CPU over both snapshots")
        XCTAssertEqual(heavy.memory, 700, "Peak memory over both snapshots")

        let limited = store.topProcesses(from: base, to: base.addingTimeInterval(120), limit: 2)
        XCTAssertEqual(limited.count, 2)
    }

    // MARK: - Events

    func testEventsAreReturnedNewestFirstWithKind() {
        let older = base
        let newer = base.addingTimeInterval(60)
        store.record(.cpuSpike, title: "node at 200%", detail: "runaway", at: older)
        store.record(.cleanup, title: "Freed 2 GB", detail: "", at: newer)
        store.flush()

        let events = store.events(from: base.addingTimeInterval(-10), to: base.addingTimeInterval(120), limit: 10)
        XCTAssertEqual(events.count, 2)
        XCTAssertEqual(events.first?.kind, .cleanup)
        XCTAssertEqual(events.first?.title, "Freed 2 GB")
        XCTAssertEqual(events.first?.time, newer)
        XCTAssertEqual(events.last?.kind, .cpuSpike)
        XCTAssertEqual(events.last?.detail, "runaway")
        XCTAssertEqual(events.last?.time, older)
        XCTAssertNotEqual(events.first?.id, events.last?.id)
    }

    func testEventsRespectRangeAndLimit() {
        for index in 0..<5 {
            store.record(.system, title: "event \(index)", at: base.addingTimeInterval(TimeInterval(index * 60)))
        }
        store.flush()
        let limited = store.events(from: base, to: base.addingTimeInterval(600), limit: 2)
        XCTAssertEqual(limited.map(\.title), ["event 4", "event 3"])
        let ranged = store.events(from: base.addingTimeInterval(60), to: base.addingTimeInterval(120), limit: 10)
        XCTAssertEqual(ranged.map(\.title), ["event 2", "event 1"])
    }

    // MARK: - Maintenance

    func testPruneRemovesSamplesOlderThanRetention() {
        let now = Date()
        store.insert(makePoint(at: now.addingTimeInterval(-200 * 86_400), cpu: 1))
        store.insert(makePoint(at: now.addingTimeInterval(-10 * 86_400), cpu: 2))
        store.insert(makePoint(at: now, cpu: 3))
        store.record(.system, title: "old", at: now.addingTimeInterval(-200 * 86_400))
        store.record(.system, title: "recent", at: now)
        store.flush()
        XCTAssertEqual(store.sampleCount(), 3)

        store.prune(retentionDays: 90)
        store.flush()
        XCTAssertEqual(store.sampleCount(), 2)
        if let oldest = store.oldestSample() {
            XCTAssertGreaterThan(oldest, now.addingTimeInterval(-90 * 86_400))
        } else {
            XCTFail("Expected a remaining sample")
        }
        let events = store.events(from: now.addingTimeInterval(-365 * 86_400), to: now.addingTimeInterval(60), limit: 10)
        XCTAssertEqual(events.map(\.title), ["recent"])
    }

    func testPruneKeepsProcessSnapshotsForAtMostFourteenDays() {
        let now = Date()
        let old = now.addingTimeInterval(-20 * 86_400)
        store.insert(processes: [ProcessPoint(time: old, name: "stale", bundleIdentifier: nil, cpu: 50, memory: 100)])
        store.insert(processes: [ProcessPoint(time: now, name: "fresh", bundleIdentifier: nil, cpu: 50, memory: 100)])
        store.flush()
        store.prune(retentionDays: 90)
        store.flush()
        XCTAssertTrue(store.processes(near: old, tolerance: 90, limit: 12).isEmpty)
        XCTAssertEqual(store.processes(near: now, tolerance: 90, limit: 12).map(\.name), ["fresh"])
    }

    func testDeleteAllEmptiesTheStore() {
        store.insert(makePoint(at: base, cpu: 1))
        store.insert(processes: [ProcessPoint(time: base, name: "p", bundleIdentifier: nil, cpu: 1, memory: 1)])
        store.record(.system, title: "x", at: base)
        store.flush()
        XCTAssertEqual(store.sampleCount(), 1)

        store.deleteAll()
        store.flush()
        XCTAssertEqual(store.sampleCount(), 0)
        XCTAssertNil(store.oldestSample())
        XCTAssertTrue(store.processes(near: base, tolerance: 90, limit: 12).isEmpty)
        XCTAssertTrue(store.events(from: base.addingTimeInterval(-10), to: base.addingTimeInterval(10), limit: 10).isEmpty)
    }

    func testFileBackedStorePersistsAcrossInstances() throws {
        let directory = FileManager.default.temporaryDirectory.appendingPathComponent("VigilHistoryTests-\(UUID().uuidString)", isDirectory: true)
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        defer { try? FileManager.default.removeItem(at: directory) }
        let url = directory.appendingPathComponent("history.sqlite")

        let writer = HistoryStore(url: url)
        writer.insert(makePoint(at: base, cpu: 42))
        writer.flush()
        XCTAssertEqual(writer.sampleCount(), 1)
        XCTAssertEqual(writer.url, url)
        XCTAssertTrue(FileManager.default.fileExists(atPath: url.path))

        let reader = HistoryStore(url: url)
        XCTAssertEqual(reader.sampleCount(), 1)
        XCTAssertEqual(reader.points(from: base, to: base, bucketSeconds: 1).first?.cpu, 42)
    }
}
