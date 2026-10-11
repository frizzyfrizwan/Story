import Foundation
import AppKit
import Darwin

/// Samples every process on the system with libproc, computing CPU and disk deltas between calls.
final class ProcessProbe {
    private struct Previous {
        var cpuTime: UInt64
        var diskRead: UInt64
        var diskWrite: UInt64
        var time: Date
    }

    private var previous: [pid_t: Previous] = [:]
    private var userNames: [uid_t: String] = [:]
    private var staticInfo: [pid_t: (name: String, path: String?, bundle: String?, isApp: Bool, user: String, start: Date?, parent: pid_t)] = [:]

    func sample() -> [ProcessSample] {
        let now = Date()
        let pids = Self.allPIDs()
        var result: [ProcessSample] = []
        result.reserveCapacity(pids.count)
        var seen = Set<pid_t>()
        let runningApps = NSWorkspace.shared.runningApplications
        var appsByPID: [pid_t: NSRunningApplication] = [:]
        for app in runningApps { appsByPID[app.processIdentifier] = app }

        for pid in pids where pid > 0 {
            var usage = rusage_info_v4()
            let status = withUnsafeMutablePointer(to: &usage) { pointer -> Int32 in
                pointer.withMemoryRebound(to: rusage_info_t?.self, capacity: 1) { proc_pid_rusage(pid, RUSAGE_INFO_V4, $0) }
            }
            guard status == 0 else { continue }
            seen.insert(pid)
            let cpuTime = usage.ri_user_time + usage.ri_system_time
            let diskRead = usage.ri_diskio_bytesread
            let diskWrite = usage.ri_diskio_byteswritten

            var cpuPercent = 0.0
            var readRate = 0.0
            var writeRate = 0.0
            if let last = previous[pid] {
                let elapsed = now.timeIntervalSince(last.time)
                if elapsed > 0 {
                    if cpuTime >= last.cpuTime { cpuPercent = Double(cpuTime - last.cpuTime) / (elapsed * 1_000_000_000) * 100 }
                    if diskRead >= last.diskRead { readRate = Double(diskRead - last.diskRead) / elapsed }
                    if diskWrite >= last.diskWrite { writeRate = Double(diskWrite - last.diskWrite) / elapsed }
                }
            }
            previous[pid] = Previous(cpuTime: cpuTime, diskRead: diskRead, diskWrite: diskWrite, time: now)

            let info: (name: String, path: String?, bundle: String?, isApp: Bool, user: String, start: Date?, parent: pid_t)
            if let cached = staticInfo[pid] {
                info = cached
            } else {
                info = Self.describe(pid: pid, app: appsByPID[pid], userNames: &userNames)
                staticInfo[pid] = info
            }

            var threads = 0
            var taskInfo = proc_taskinfo()
            let size = Int32(MemoryLayout<proc_taskinfo>.size)
            if proc_pidinfo(pid, PROC_PIDTASKINFO, 0, &taskInfo, size) == size {
                threads = Int(taskInfo.pti_threadnum)
            }

            result.append(ProcessSample(pid: pid,
                                        name: info.name,
                                        bundleIdentifier: info.bundle,
                                        path: info.path,
                                        user: info.user,
                                        isApplication: info.isApp,
                                        cpuPercent: cpuPercent,
                                        memoryBytes: usage.ri_phys_footprint,
                                        threads: threads,
                                        diskReadBytesPerSecond: readRate,
                                        diskWriteBytesPerSecond: writeRate,
                                        startTime: info.start,
                                        parentPID: info.parent))
        }
        // Forget processes that exited.
        for pid in previous.keys where !seen.contains(pid) {
            previous.removeValue(forKey: pid)
            staticInfo.removeValue(forKey: pid)
        }
        return result
    }

    func icon(for process: ProcessSample) -> NSImage? {
        if process.isApplication, let app = NSRunningApplication(processIdentifier: process.pid), let icon = app.icon { return icon }
        if let path = process.path {
            // Walk up to the enclosing .app bundle, if any, so helpers show their parent app's icon.
            if let range = path.range(of: ".app/") {
                return NSWorkspace.shared.icon(forFile: String(path[..<range.lowerBound]) + ".app")
            }
        }
        return nil
    }

    // MARK: - Helpers

    static func allPIDs() -> [pid_t] {
        let needed = proc_listpids(UInt32(PROC_ALL_PIDS), 0, nil, 0)
        guard needed > 0 else { return [] }
        var buffer = [pid_t](repeating: 0, count: Int(needed) / MemoryLayout<pid_t>.size + 64)
        let written = proc_listpids(UInt32(PROC_ALL_PIDS), 0, &buffer, Int32(buffer.count * MemoryLayout<pid_t>.size))
        guard written > 0 else { return [] }
        let count = Int(written) / MemoryLayout<pid_t>.size
        return Array(buffer.prefix(count)).filter { $0 > 0 }
    }

    private static func describe(pid: pid_t, app: NSRunningApplication?, userNames: inout [uid_t: String])
        -> (name: String, path: String?, bundle: String?, isApp: Bool, user: String, start: Date?, parent: pid_t) {
        var pathBuffer = [CChar](repeating: 0, count: Int(MAXPATHLEN) * 4)
        let pathLength = proc_pidpath(pid, &pathBuffer, UInt32(pathBuffer.count))
        let path: String? = pathLength > 0 ? String(cString: pathBuffer) : nil

        var nameBuffer = [CChar](repeating: 0, count: Int(MAXPATHLEN))
        let nameLength = proc_name(pid, &nameBuffer, UInt32(nameBuffer.count))
        var name = nameLength > 0 ? String(cString: nameBuffer) : (path.map { ($0 as NSString).lastPathComponent } ?? "pid \(pid)")

        var bsd = proc_bsdinfo()
        let bsdSize = Int32(MemoryLayout<proc_bsdinfo>.size)
        var user = ""
        var start: Date?
        var parent: pid_t = 0
        if proc_pidinfo(pid, PROC_PIDTBSDINFO, 0, &bsd, bsdSize) == bsdSize {
            let uid = bsd.pbi_uid
            if let cached = userNames[uid] {
                user = cached
            } else if let entry = getpwuid(uid) {
                user = String(cString: entry.pointee.pw_name)
                userNames[uid] = user
            } else {
                user = "\(uid)"
            }
            if bsd.pbi_start_tvsec > 0 { start = Date(timeIntervalSince1970: TimeInterval(bsd.pbi_start_tvsec)) }
            parent = pid_t(bsd.pbi_ppid)
            if name.isEmpty {
                name = withUnsafePointer(to: &bsd.pbi_comm) { pointer in
                    pointer.withMemoryRebound(to: CChar.self, capacity: Int(MAXCOMLEN) + 1) { String(cString: $0) }
                }
            }
        }

        if let app {
            return (app.localizedName ?? name, path, app.bundleIdentifier, true, user, start, parent)
        }
        return (name, path, nil, false, user, start, parent)
    }
}
