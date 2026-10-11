import Foundation
import Darwin
import CoreWLAN
import SystemConfiguration

final class NetworkProbe {
    private var previousIn: UInt64 = 0
    private var previousOut: UInt64 = 0
    private var previousTime: Date?
    private var interfaceCache: [NetworkInterface] = []
    private var interfaceCacheTime: Date?
    private var wifiCache: WiFiInfo?
    private var wifiCacheTime: Date?

    func sample() -> NetworkSample {
        var sample = NetworkSample()
        let (totalIn, totalOut) = readCounters()
        let now = Date()
        if let previousTime {
            let elapsed = now.timeIntervalSince(previousTime)
            if elapsed > 0, totalIn >= previousIn, totalOut >= previousOut {
                sample.inBytesPerSecond = Double(totalIn - previousIn) / elapsed
                sample.outBytesPerSecond = Double(totalOut - previousOut) / elapsed
            }
        }
        previousIn = totalIn
        previousOut = totalOut
        previousTime = now
        sample.totalIn = totalIn
        sample.totalOut = totalOut
        sample.interfaces = interfaces()
        sample.primaryInterface = Self.primaryInterfaceName()
        sample.wifi = wifi()
        return sample
    }

    /// Sums the counters of physical interfaces (en*) only, so VPN tunnels are not double counted.
    private func readCounters() -> (UInt64, UInt64) {
        var totalIn: UInt64 = 0
        var totalOut: UInt64 = 0
        var addresses: UnsafeMutablePointer<ifaddrs>?
        guard getifaddrs(&addresses) == 0, let first = addresses else { return (0, 0) }
        defer { freeifaddrs(addresses) }
        var cursor: UnsafeMutablePointer<ifaddrs>? = first
        while let entry = cursor {
            defer { cursor = entry.pointee.ifa_next }
            let name = String(cString: entry.pointee.ifa_name)
            guard name.hasPrefix("en"), let address = entry.pointee.ifa_addr,
                  address.pointee.sa_family == UInt8(AF_LINK), let data = entry.pointee.ifa_data else { continue }
            let stats = data.assumingMemoryBound(to: if_data.self).pointee
            totalIn += UInt64(stats.ifi_ibytes)
            totalOut += UInt64(stats.ifi_obytes)
        }
        return (totalIn, totalOut)
    }

    func interfaces(force: Bool = false) -> [NetworkInterface] {
        if !force, let interfaceCacheTime, Date().timeIntervalSince(interfaceCacheTime) < 10 { return interfaceCache }
        var ipv4: [String: String] = [:]
        var ipv6: [String: String] = [:]
        var mac: [String: String] = [:]
        var up: Set<String> = []
        var names: [String] = []

        var addresses: UnsafeMutablePointer<ifaddrs>?
        if getifaddrs(&addresses) == 0, let first = addresses {
            defer { freeifaddrs(addresses) }
            var cursor: UnsafeMutablePointer<ifaddrs>? = first
            while let entry = cursor {
                defer { cursor = entry.pointee.ifa_next }
                let name = String(cString: entry.pointee.ifa_name)
                guard name != "lo0", !name.hasPrefix("awdl"), !name.hasPrefix("llw"), !name.hasPrefix("gif"), !name.hasPrefix("stf"),
                      !name.hasPrefix("anpi"), !name.hasPrefix("ap") else { continue }
                if !names.contains(name) { names.append(name) }
                let flags = Int32(entry.pointee.ifa_flags)
                if flags & IFF_UP != 0 && flags & IFF_RUNNING != 0 { up.insert(name) }
                guard let address = entry.pointee.ifa_addr else { continue }
                switch Int32(address.pointee.sa_family) {
                case AF_INET:
                    if let text = Self.addressString(address, length: socklen_t(MemoryLayout<sockaddr_in>.size)) { ipv4[name] = text }
                case AF_INET6:
                    if let text = Self.addressString(address, length: socklen_t(MemoryLayout<sockaddr_in6>.size)), !text.hasPrefix("fe80") { ipv6[name] = text }
                case AF_LINK:
                    address.withMemoryRebound(to: sockaddr_dl.self, capacity: 1) { link in
                        let addressLength = Int(link.pointee.sdl_alen)
                        let nameLength = Int(link.pointee.sdl_nlen)
                        let dataOffset = MemoryLayout<sockaddr_dl>.offset(of: \.sdl_data) ?? 8
                        guard addressLength == 6, Int(link.pointee.sdl_len) >= dataOffset + nameLength + 6 else { return }
                        let base = UnsafeRawPointer(link) + dataOffset + nameLength
                        let bytes = (0..<6).map { base.load(fromByteOffset: $0, as: UInt8.self) }
                        mac[name] = bytes.map { String(format: "%02x", $0) }.joined(separator: ":")
                    }
                default: break
                }
            }
        }
        let friendly = Self.friendlyNames()
        let result = names
            .filter { ipv4[$0] != nil || up.contains($0) || friendly[$0] != nil }
            .map { NetworkInterface(name: $0, displayName: friendly[$0] ?? $0, ipv4: ipv4[$0], ipv6: ipv6[$0], macAddress: mac[$0], isUp: up.contains($0)) }
            .sorted { lhs, rhs in
                if (lhs.ipv4 != nil) != (rhs.ipv4 != nil) { return lhs.ipv4 != nil }
                return lhs.name < rhs.name
            }
        interfaceCache = result
        interfaceCacheTime = Date()
        return result
    }

    private static func addressString(_ address: UnsafeMutablePointer<sockaddr>, length: socklen_t) -> String? {
        var host = [CChar](repeating: 0, count: Int(NI_MAXHOST))
        guard getnameinfo(address, length, &host, socklen_t(host.count), nil, 0, NI_NUMERICHOST) == 0 else { return nil }
        let text = String(cString: host)
        // Strip the %scope suffix from link-local IPv6 addresses.
        return text.split(separator: "%").first.map(String.init) ?? text
    }

    private static func friendlyNames() -> [String: String] {
        var map: [String: String] = [:]
        guard let interfaces = SCNetworkInterfaceCopyAll() as? [SCNetworkInterface] else { return map }
        for interface in interfaces {
            guard let bsd = SCNetworkInterfaceGetBSDName(interface) as String?,
                  let name = SCNetworkInterfaceGetLocalizedDisplayName(interface) as String? else { continue }
            map[bsd] = name
        }
        return map
    }

    static func primaryInterfaceName() -> String? {
        guard let store = SCDynamicStoreCreate(nil, "Vigil" as CFString, nil, nil),
              let value = SCDynamicStoreCopyValue(store, "State:/Network/Global/IPv4" as CFString) as? [String: Any] else { return nil }
        return value["PrimaryInterface"] as? String
    }

    static func routerAddress() -> String? {
        guard let store = SCDynamicStoreCreate(nil, "Vigil" as CFString, nil, nil),
              let value = SCDynamicStoreCopyValue(store, "State:/Network/Global/IPv4" as CFString) as? [String: Any] else { return nil }
        return value["Router"] as? String
    }

    static func dnsServers() -> [String] {
        guard let store = SCDynamicStoreCreate(nil, "Vigil" as CFString, nil, nil),
              let value = SCDynamicStoreCopyValue(store, "State:/Network/Global/DNS" as CFString) as? [String: Any] else { return [] }
        return value["ServerAddresses"] as? [String] ?? []
    }

    func wifi(force: Bool = false) -> WiFiInfo? {
        if !force, let wifiCacheTime, Date().timeIntervalSince(wifiCacheTime) < 5 { return wifiCache }
        defer { wifiCacheTime = Date() }
        guard let interface = CWWiFiClient.shared().interface(), interface.powerOn() else {
            wifiCache = nil
            return nil
        }
        let channel = interface.wlanChannel()
        let band: String
        switch channel?.channelBand {
        case .band2GHz: band = "2.4 GHz"
        case .band5GHz: band = "5 GHz"
        case .band6GHz: band = "6 GHz"
        default: band = "—"
        }
        let security: String
        switch interface.security() {
        case .none: security = "Open"
        case .WEP: security = "WEP"
        case .wpaPersonal, .wpaPersonalMixed: security = "WPA"
        case .wpa2Personal: security = "WPA2"
        case .wpa3Personal, .wpa3Transition: security = "WPA3"
        case .personal: security = "Personal"
        case .unknown: security = "Unknown"
        default: security = "Enterprise"
        }
        let info = WiFiInfo(interfaceName: interface.interfaceName ?? "en0",
                            ssid: interface.ssid(),
                            bssid: interface.bssid(),
                            rssi: interface.rssiValue(),
                            noise: interface.noiseMeasurement(),
                            transmitRate: interface.transmitRate(),
                            channel: channel?.channelNumber ?? 0,
                            band: band,
                            security: security,
                            countryCode: interface.countryCode())
        wifiCache = interface.serviceActive() ? info : nil
        return wifiCache
    }
}
