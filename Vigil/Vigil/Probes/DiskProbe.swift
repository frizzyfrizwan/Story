import Foundation
import IOKit

final class DiskProbe {
    private var previousRead: UInt64 = 0
    private var previousWrite: UInt64 = 0
    private var previousTime: Date?
    private var volumeCache: [Volume] = []
    private var volumeCacheTime: Date?

    func sample() -> DiskSample {
        var sample = DiskSample()
        let (read, write) = readIOCounters()
        let now = Date()
        if let previousTime {
            let elapsed = now.timeIntervalSince(previousTime)
            if elapsed > 0, read >= previousRead, write >= previousWrite {
                sample.readBytesPerSecond = Double(read - previousRead) / elapsed
                sample.writeBytesPerSecond = Double(write - previousWrite) / elapsed
            }
        }
        previousRead = read
        previousWrite = write
        previousTime = now
        sample.totalRead = read
        sample.totalWrite = write
        sample.volumes = volumes()
        return sample
    }

    /// Volumes are refreshed every 15 s; the resource lookup is comparatively slow.
    func volumes(force: Bool = false) -> [Volume] {
        if !force, let volumeCacheTime, Date().timeIntervalSince(volumeCacheTime) < 15, !volumeCache.isEmpty {
            return volumeCache
        }
        let keys: [URLResourceKey] = [
            .volumeNameKey, .volumeTotalCapacityKey, .volumeAvailableCapacityForImportantUsageKey, .volumeAvailableCapacityKey,
            .volumeIsInternalKey, .volumeIsRemovableKey, .volumeIsRootFileSystemKey, .volumeIsBrowsableKey, .volumeIsLocalKey,
            .volumeLocalizedFormatDescriptionKey, .volumeIsEjectableKey
        ]
        let urls = FileManager.default.mountedVolumeURLs(includingResourceValuesForKeys: keys, options: [.skipHiddenVolumes]) ?? []
        var result: [Volume] = []
        for url in urls {
            guard let values = try? url.resourceValues(forKeys: Set(keys)) else { continue }
            guard values.volumeIsBrowsable ?? true, values.volumeIsLocal ?? true else { continue }
            let total = Int64(values.volumeTotalCapacity ?? 0)
            guard total > 0 else { continue }
            let important = values.volumeAvailableCapacityForImportantUsage ?? Int64(values.volumeAvailableCapacity ?? 0)
            let plain = Int64(values.volumeAvailableCapacity ?? 0)
            let purgeable = max(0, important - plain)
            let isRoot = values.volumeIsRootFileSystem ?? (url.path == "/")
            result.append(Volume(url: url,
                                 name: values.volumeName ?? url.lastPathComponent,
                                 total: total,
                                 available: important,
                                 purgeable: purgeable,
                                 isInternal: values.volumeIsInternal ?? false,
                                 isRemovable: (values.volumeIsRemovable ?? false) || (values.volumeIsEjectable ?? false),
                                 isRoot: isRoot,
                                 fileSystem: values.volumeLocalizedFormatDescription ?? ""))
        }
        // Root first, then internal, then by name.
        result.sort { lhs, rhs in
            if lhs.isRoot != rhs.isRoot { return lhs.isRoot }
            if lhs.isInternal != rhs.isInternal { return lhs.isInternal }
            return lhs.name.localizedCaseInsensitiveCompare(rhs.name) == .orderedAscending
        }
        volumeCache = result
        volumeCacheTime = Date()
        return result
    }

    private func readIOCounters() -> (UInt64, UInt64) {
        var read: UInt64 = 0
        var write: UInt64 = 0
        IORegistry.forEachService(matching: "IOBlockStorageDriver") { service in
            guard let properties = IORegistry.properties(of: service),
                  let statistics = properties.dictionary("Statistics") else { return }
            read += UInt64(max(0, statistics.int("Bytes (Read)") ?? 0))
            write += UInt64(max(0, statistics.int("Bytes (Write)") ?? 0))
        }
        return (read, write)
    }

    /// SMART status of the boot volume via `diskutil`; slow, so call rarely.
    static func smartStatus() -> String? {
        let result = Shell.run("/usr/sbin/diskutil", ["info", "-plist", "/"], timeout: 10)
        guard result.succeeded, let data = result.output.data(using: .utf8),
              let plist = try? PropertyListSerialization.propertyList(from: data, format: nil) as? [String: Any] else { return nil }
        if let status = plist["SMARTStatus"] as? String { return status }
        // APFS volumes report SMART on the physical store.
        if let store = plist["APFSPhysicalStores"] as? [[String: Any]], let identifier = store.first?["APFSPhysicalStore"] as? String {
            let inner = Shell.run("/usr/sbin/diskutil", ["info", "-plist", identifier], timeout: 10)
            if inner.succeeded, let innerData = inner.output.data(using: .utf8),
               let innerPlist = try? PropertyListSerialization.propertyList(from: innerData, format: nil) as? [String: Any],
               let status = innerPlist["SMARTStatus"] as? String {
                return status
            }
        }
        return nil
    }
}
