import Foundation
import SQLite3

/// Persists metric samples, per-process snapshots and events in SQLite so the app can answer
/// "what was using my Mac at 3 pm?". All calls are serialised on a private queue.
final class HistoryStore {
    private var database: OpaquePointer?
    private let queue = DispatchQueue(label: "com.faisalrizwan.vigil.history", qos: .utility)
    private let transient = unsafeBitCast(-1, to: sqlite3_destructor_type.self)
    let url: URL?

    static let defaultURL: URL = {
        let support = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask).first!
        let directory = support.appendingPathComponent("Vigil", isDirectory: true)
        try? FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        return directory.appendingPathComponent("history.sqlite")
    }()

    /// Pass `nil` for an in-memory store (tests).
    init(url: URL? = HistoryStore.defaultURL) {
        self.url = url
        queue.sync { open() }
    }

    deinit {
        if let database { sqlite3_close(database) }
    }

    // MARK: - Schema

    private func open() {
        let path = url?.path ?? ":memory:"
        guard sqlite3_open_v2(path, &database, SQLITE_OPEN_READWRITE | SQLITE_OPEN_CREATE | SQLITE_OPEN_FULLMUTEX, nil) == SQLITE_OK else {
            NSLog("Vigil: could not open history database at \(path)")
            database = nil
            return
        }
        execute("PRAGMA journal_mode = WAL")
        execute("PRAGMA synchronous = NORMAL")
        execute("""
        CREATE TABLE IF NOT EXISTS samples (
            ts INTEGER PRIMARY KEY,
            cpu REAL, mem_used INTEGER, mem_pressure INTEGER, swap_used INTEGER,
            disk_read REAL, disk_write REAL, net_in REAL, net_out REAL,
            battery REAL, charging INTEGER, temperature REAL, fan REAL, gpu REAL, power REAL
        )
        """)
        execute("""
        CREATE TABLE IF NOT EXISTS process_samples (
            ts INTEGER, name TEXT, bundle TEXT, cpu REAL, memory INTEGER
        )
        """)
        execute("CREATE INDEX IF NOT EXISTS process_samples_ts ON process_samples(ts)")
        execute("""
        CREATE TABLE IF NOT EXISTS events (
            id INTEGER PRIMARY KEY AUTOINCREMENT, ts INTEGER, kind TEXT, title TEXT, detail TEXT
        )
        """)
        execute("CREATE INDEX IF NOT EXISTS events_ts ON events(ts)")
    }

    @discardableResult
    private func execute(_ sql: String) -> Bool {
        guard let database else { return false }
        var message: UnsafeMutablePointer<CChar>?
        let result = sqlite3_exec(database, sql, nil, nil, &message)
        if result != SQLITE_OK, let message {
            NSLog("Vigil SQL error: \(String(cString: message)) in \(sql.prefix(80))")
            sqlite3_free(message)
        }
        return result == SQLITE_OK
    }

    // MARK: - Writing

    func insert(_ point: MetricPoint) {
        queue.async { [self] in
            guard let database else { return }
            let sql = "INSERT OR REPLACE INTO samples VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)"
            var statement: OpaquePointer?
            guard sqlite3_prepare_v2(database, sql, -1, &statement, nil) == SQLITE_OK else { return }
            defer { sqlite3_finalize(statement) }
            sqlite3_bind_int64(statement, 1, Int64(point.time.timeIntervalSince1970))
            sqlite3_bind_double(statement, 2, point.cpu)
            sqlite3_bind_int64(statement, 3, point.memoryUsed)
            sqlite3_bind_int(statement, 4, Int32(point.memoryPressure))
            sqlite3_bind_int64(statement, 5, point.swapUsed)
            sqlite3_bind_double(statement, 6, point.diskRead)
            sqlite3_bind_double(statement, 7, point.diskWrite)
            sqlite3_bind_double(statement, 8, point.networkIn)
            sqlite3_bind_double(statement, 9, point.networkOut)
            sqlite3_bind_double(statement, 10, point.battery)
            sqlite3_bind_int(statement, 11, point.isCharging ? 1 : 0)
            sqlite3_bind_double(statement, 12, point.temperature)
            sqlite3_bind_double(statement, 13, point.fanRPM)
            sqlite3_bind_double(statement, 14, point.gpu)
            sqlite3_bind_double(statement, 15, point.power)
            sqlite3_step(statement)
        }
    }

    func insert(processes: [ProcessPoint]) {
        guard !processes.isEmpty else { return }
        queue.async { [self] in
            guard let database else { return }
            execute("BEGIN")
            let sql = "INSERT INTO process_samples (ts, name, bundle, cpu, memory) VALUES (?,?,?,?,?)"
            var statement: OpaquePointer?
            guard sqlite3_prepare_v2(database, sql, -1, &statement, nil) == SQLITE_OK else { execute("ROLLBACK"); return }
            for point in processes {
                sqlite3_reset(statement)
                sqlite3_bind_int64(statement, 1, Int64(point.time.timeIntervalSince1970))
                sqlite3_bind_text(statement, 2, point.name, -1, transient)
                if let bundle = point.bundleIdentifier { sqlite3_bind_text(statement, 3, bundle, -1, transient) } else { sqlite3_bind_null(statement, 3) }
                sqlite3_bind_double(statement, 4, point.cpu)
                sqlite3_bind_int64(statement, 5, point.memory)
                sqlite3_step(statement)
            }
            sqlite3_finalize(statement)
            execute("COMMIT")
        }
    }

    func record(_ kind: EventKind, title: String, detail: String = "", at time: Date = Date()) {
        queue.async { [self] in
            guard let database else { return }
            let sql = "INSERT INTO events (ts, kind, title, detail) VALUES (?,?,?,?)"
            var statement: OpaquePointer?
            guard sqlite3_prepare_v2(database, sql, -1, &statement, nil) == SQLITE_OK else { return }
            defer { sqlite3_finalize(statement) }
            sqlite3_bind_int64(statement, 1, Int64(time.timeIntervalSince1970))
            sqlite3_bind_text(statement, 2, kind.rawValue, -1, transient)
            sqlite3_bind_text(statement, 3, title, -1, transient)
            sqlite3_bind_text(statement, 4, detail, -1, transient)
            sqlite3_step(statement)
        }
    }

    /// Deletes raw data older than the retention window. Process snapshots are kept for 14 days at most.
    func prune(retentionDays: Int) {
        queue.async { [self] in
            let cutoff = Int64(Date().timeIntervalSince1970) - Int64(max(1, retentionDays)) * 86_400
            execute("DELETE FROM samples WHERE ts < \(cutoff)")
            execute("DELETE FROM events WHERE ts < \(cutoff)")
            let processCutoff = Int64(Date().timeIntervalSince1970) - Int64(min(14, max(1, retentionDays))) * 86_400
            execute("DELETE FROM process_samples WHERE ts < \(processCutoff)")
        }
    }

    // MARK: - Reading (synchronous; wrap in Task for the UI)

    /// Points in `range`, averaged into buckets of `bucketSeconds` so charts stay light.
    func points(from start: Date, to end: Date = Date(), bucketSeconds: TimeInterval) -> [MetricPoint] {
        queue.sync { [self] in
            guard let database else { return [] }
            let bucket = max(1, Int64(bucketSeconds))
            let sql = """
            SELECT (ts / \(bucket)) * \(bucket) AS bucket, AVG(cpu), AVG(mem_used), MAX(mem_pressure), AVG(swap_used),
                   AVG(disk_read), AVG(disk_write), AVG(net_in), AVG(net_out), AVG(battery), MAX(charging),
                   AVG(temperature), AVG(fan), AVG(gpu), AVG(power)
            FROM samples WHERE ts >= ? AND ts <= ? GROUP BY bucket ORDER BY bucket
            """
            var statement: OpaquePointer?
            guard sqlite3_prepare_v2(database, sql, -1, &statement, nil) == SQLITE_OK else { return [] }
            defer { sqlite3_finalize(statement) }
            sqlite3_bind_int64(statement, 1, Int64(start.timeIntervalSince1970))
            sqlite3_bind_int64(statement, 2, Int64(end.timeIntervalSince1970))
            var result: [MetricPoint] = []
            while sqlite3_step(statement) == SQLITE_ROW {
                result.append(MetricPoint(time: Date(timeIntervalSince1970: TimeInterval(sqlite3_column_int64(statement, 0))),
                                          cpu: sqlite3_column_double(statement, 1),
                                          memoryUsed: Int64(sqlite3_column_double(statement, 2)),
                                          memoryPressure: Int(sqlite3_column_int(statement, 3)),
                                          swapUsed: Int64(sqlite3_column_double(statement, 4)),
                                          diskRead: sqlite3_column_double(statement, 5),
                                          diskWrite: sqlite3_column_double(statement, 6),
                                          networkIn: sqlite3_column_double(statement, 7),
                                          networkOut: sqlite3_column_double(statement, 8),
                                          battery: sqlite3_column_double(statement, 9),
                                          isCharging: sqlite3_column_int(statement, 10) == 1,
                                          temperature: sqlite3_column_double(statement, 11),
                                          fanRPM: sqlite3_column_double(statement, 12),
                                          gpu: sqlite3_column_double(statement, 13),
                                          power: sqlite3_column_double(statement, 14)))
            }
            return result
        }
    }

    /// Top processes recorded closest to `time` (within ±`tolerance` seconds).
    func processes(near time: Date, tolerance: TimeInterval = 90, limit: Int = 12) -> [ProcessPoint] {
        queue.sync { [self] in
            guard let database else { return [] }
            let target = Int64(time.timeIntervalSince1970)
            let nearest = "SELECT ts FROM process_samples WHERE ts BETWEEN ? AND ? ORDER BY ABS(ts - ?) LIMIT 1"
            var probe: OpaquePointer?
            guard sqlite3_prepare_v2(database, nearest, -1, &probe, nil) == SQLITE_OK else { return [] }
            sqlite3_bind_int64(probe, 1, target - Int64(tolerance))
            sqlite3_bind_int64(probe, 2, target + Int64(tolerance))
            sqlite3_bind_int64(probe, 3, target)
            var snapshot: Int64?
            if sqlite3_step(probe) == SQLITE_ROW { snapshot = sqlite3_column_int64(probe, 0) }
            sqlite3_finalize(probe)
            guard let snapshot else { return [] }

            let sql = "SELECT ts, name, bundle, cpu, memory FROM process_samples WHERE ts = ? ORDER BY cpu DESC LIMIT ?"
            var statement: OpaquePointer?
            guard sqlite3_prepare_v2(database, sql, -1, &statement, nil) == SQLITE_OK else { return [] }
            defer { sqlite3_finalize(statement) }
            sqlite3_bind_int64(statement, 1, snapshot)
            sqlite3_bind_int(statement, 2, Int32(limit))
            var result: [ProcessPoint] = []
            while sqlite3_step(statement) == SQLITE_ROW {
                let bundle = sqlite3_column_text(statement, 2).map { String(cString: $0) }
                result.append(ProcessPoint(time: Date(timeIntervalSince1970: TimeInterval(sqlite3_column_int64(statement, 0))),
                                           name: sqlite3_column_text(statement, 1).map { String(cString: $0) } ?? "",
                                           bundleIdentifier: bundle,
                                           cpu: sqlite3_column_double(statement, 3),
                                           memory: sqlite3_column_int64(statement, 4)))
            }
            return result
        }
    }

    /// Aggregated CPU-seconds and peak memory per process over a range: "who used the most of my Mac today".
    func topProcesses(from start: Date, to end: Date = Date(), limit: Int = 10) -> [ProcessPoint] {
        queue.sync { [self] in
            guard let database else { return [] }
            let sql = """
            SELECT name, bundle, AVG(cpu), MAX(memory), COUNT(*) FROM process_samples
            WHERE ts >= ? AND ts <= ? GROUP BY name ORDER BY AVG(cpu) * COUNT(*) DESC LIMIT ?
            """
            var statement: OpaquePointer?
            guard sqlite3_prepare_v2(database, sql, -1, &statement, nil) == SQLITE_OK else { return [] }
            defer { sqlite3_finalize(statement) }
            sqlite3_bind_int64(statement, 1, Int64(start.timeIntervalSince1970))
            sqlite3_bind_int64(statement, 2, Int64(end.timeIntervalSince1970))
            sqlite3_bind_int(statement, 3, Int32(limit))
            var result: [ProcessPoint] = []
            while sqlite3_step(statement) == SQLITE_ROW {
                result.append(ProcessPoint(time: start,
                                           name: sqlite3_column_text(statement, 0).map { String(cString: $0) } ?? "",
                                           bundleIdentifier: sqlite3_column_text(statement, 1).map { String(cString: $0) },
                                           cpu: sqlite3_column_double(statement, 2),
                                           memory: sqlite3_column_int64(statement, 3)))
            }
            return result
        }
    }

    func events(from start: Date, to end: Date = Date(), limit: Int = 500) -> [HistoryEvent] {
        queue.sync { [self] in
            guard let database else { return [] }
            let sql = "SELECT id, ts, kind, title, detail FROM events WHERE ts >= ? AND ts <= ? ORDER BY ts DESC LIMIT ?"
            var statement: OpaquePointer?
            guard sqlite3_prepare_v2(database, sql, -1, &statement, nil) == SQLITE_OK else { return [] }
            defer { sqlite3_finalize(statement) }
            sqlite3_bind_int64(statement, 1, Int64(start.timeIntervalSince1970))
            sqlite3_bind_int64(statement, 2, Int64(end.timeIntervalSince1970))
            sqlite3_bind_int(statement, 3, Int32(limit))
            var result: [HistoryEvent] = []
            while sqlite3_step(statement) == SQLITE_ROW {
                let kind = sqlite3_column_text(statement, 2).map { String(cString: $0) } ?? ""
                result.append(HistoryEvent(id: sqlite3_column_int64(statement, 0),
                                           time: Date(timeIntervalSince1970: TimeInterval(sqlite3_column_int64(statement, 1))),
                                           kind: EventKind(rawValue: kind) ?? .system,
                                           title: sqlite3_column_text(statement, 3).map { String(cString: $0) } ?? "",
                                           detail: sqlite3_column_text(statement, 4).map { String(cString: $0) } ?? ""))
            }
            return result
        }
    }

    func sampleCount() -> Int {
        queue.sync { [self] in
            guard let database else { return 0 }
            var statement: OpaquePointer?
            guard sqlite3_prepare_v2(database, "SELECT COUNT(*) FROM samples", -1, &statement, nil) == SQLITE_OK else { return 0 }
            defer { sqlite3_finalize(statement) }
            return sqlite3_step(statement) == SQLITE_ROW ? Int(sqlite3_column_int64(statement, 0)) : 0
        }
    }

    func oldestSample() -> Date? {
        queue.sync { [self] in
            guard let database else { return nil }
            var statement: OpaquePointer?
            guard sqlite3_prepare_v2(database, "SELECT MIN(ts) FROM samples", -1, &statement, nil) == SQLITE_OK else { return nil }
            defer { sqlite3_finalize(statement) }
            guard sqlite3_step(statement) == SQLITE_ROW, sqlite3_column_type(statement, 0) != SQLITE_NULL else { return nil }
            return Date(timeIntervalSince1970: TimeInterval(sqlite3_column_int64(statement, 0)))
        }
    }

    /// Size of the database on disk.
    func fileSize() -> Int64 {
        guard let url, let attributes = try? FileManager.default.attributesOfItem(atPath: url.path) else { return 0 }
        return (attributes[.size] as? Int64) ?? 0
    }

    /// Blocks until queued writes are flushed (tests).
    func flush() { queue.sync {} }

    func deleteAll() {
        queue.async { [self] in
            execute("DELETE FROM samples")
            execute("DELETE FROM process_samples")
            execute("DELETE FROM events")
            execute("VACUUM")
        }
    }
}
