import SwiftUI
import AppKit

struct NetworkView: View {
    @Environment(AppState.self) private var state
    @Environment(MetricsEngine.self) private var engine
    @Environment(AppSettings.self) private var settings

    private var network: NetworkSample { engine.network }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: Theme.gridSpacing) {
                PageHeader(title: "Network", subtitle: network.wifi?.ssid.map { "Connected to \($0)" } ?? (network.localIP.map { "Connected · \($0)" } ?? "Not connected"))
                HStack(spacing: Theme.gridSpacing) {
                    StatTile(title: "Download", value: Format.rate(network.inBytesPerSecond), detail: "\(Format.bytes(network.totalIn)) since boot", color: Theme.network, sparkline: engine.recent.map(\.networkIn), systemImage: "arrow.down.circle")
                    StatTile(title: "Upload", value: Format.rate(network.outBytesPerSecond), detail: "\(Format.bytes(network.totalOut)) since boot", color: Theme.memory, sparkline: engine.recent.map(\.networkOut), systemImage: "arrow.up.circle")
                    StatTile(title: "Local IP", value: network.localIP ?? "—", detail: NetworkProbe.routerAddress().map { "Router \($0)" } ?? "", color: Theme.cpu, systemImage: "house")
                    StatTile(title: "Public IP", value: network.publicIP ?? (settings.publicIPLookup ? "…" : "Off"), detail: settings.publicIPLookup ? "Looked up every 10 min" : "Enable in Settings → Privacy", color: Theme.disk, systemImage: "globe")
                }
                VStack(alignment: .leading, spacing: 8) {
                    SectionHeader(title: "Throughput")
                    MetricChart(points: engine.recent, keyPath: \.networkInMB, color: Theme.network, unit: "MB/s", secondary: \.networkOutMB, secondaryColor: Theme.memory,
                                secondaryLabel: "Upload", primaryLabel: "Download", format: { String(format: "%.2f MB/s", $0) })
                        .frame(height: 160)
                }
                .card()
                HStack(alignment: .top, spacing: Theme.gridSpacing) {
                    if let wifi = network.wifi { wifiCard(wifi) }
                    interfacesCard
                    actionsCard
                }
            }
            .padding(20)
        }
        .accessibilityIdentifier("page.network")
    }

    private func wifiCard(_ wifi: WiFiInfo) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            SectionHeader(title: "Wi-Fi", subtitle: wifi.ssid ?? "Network name hidden", systemImage: "wifi")
            HStack(spacing: 14) {
                RingGauge(fraction: wifi.signalQuality, color: wifi.signalQuality > 0.6 ? Theme.good : wifi.signalQuality > 0.35 ? Theme.warning : Theme.critical, lineWidth: 8, label: "\(wifi.rssi)", caption: "dBm")
                    .frame(width: 90, height: 90)
                VStack(alignment: .leading, spacing: 4) {
                    KeyValueRow(key: "Signal", value: wifi.signalLabel)
                    KeyValueRow(key: "Noise", value: "\(wifi.noise) dBm")
                    KeyValueRow(key: "Link speed", value: String(format: "%.0f Mbps", wifi.transmitRate))
                    KeyValueRow(key: "Channel", value: "\(wifi.channel) · \(wifi.band)" + (wifi.channelWidth > 0 ? " · \(wifi.channelWidth) MHz" : ""))
                    if !wifi.phyMode.isEmpty { KeyValueRow(key: "PHY mode", value: wifi.phyMode) }
                    KeyValueRow(key: "Security", value: wifi.security)
                }
            }
            if wifi.ssid == nil {
                VStack(alignment: .leading, spacing: 4) {
                    Text("macOS hides the network name until Location access is granted.").font(.caption).foregroundStyle(.secondary)
                    Button("Allow Location access") { LocationPermission.shared.request() }.buttonStyle(.link).font(.caption)
                }
            }
            Text(wifi.signalQuality < 0.35 ? "Weak signal: move closer to the router or switch to the 5 GHz band." : wifi.band == "2.4 GHz" ? "On 2.4 GHz. If your router offers 5 GHz, it is usually much faster at short range." : "Signal is good.")
                .font(.caption).foregroundStyle(.secondary)
        }
        .frame(maxWidth: 380)
        .card()
    }

    private var interfacesCard: some View {
        VStack(alignment: .leading, spacing: 8) {
            SectionHeader(title: "Interfaces", systemImage: "cable.connector")
            ForEach(network.interfaces) { interface in
                HStack(spacing: 10) {
                    Circle().fill(interface.isUp ? Theme.good : Color.secondary.opacity(0.4)).frame(width: 8, height: 8)
                    VStack(alignment: .leading, spacing: 1) {
                        Text(interface.displayName).font(.callout.weight(.medium))
                        Text(interface.name + (interface.macAddress.map { " · \($0)" } ?? "")).font(.caption2.monospaced()).foregroundStyle(.secondary)
                    }
                    Spacer()
                    VStack(alignment: .trailing, spacing: 1) {
                        Text(interface.ipv4 ?? "—").font(.callout.monospaced())
                        if let ipv6 = interface.ipv6 { Text(ipv6).font(.caption2.monospaced()).foregroundStyle(.secondary).lineLimit(1) }
                    }
                }
                .padding(.vertical, 3)
            }
            let dns = NetworkProbe.dnsServers()
            if !dns.isEmpty { KeyValueRow(key: "DNS", value: dns.joined(separator: ", "), monospaced: true) }
        }
        .card()
    }

    private var actionsCard: some View {
        VStack(alignment: .leading, spacing: 10) {
            SectionHeader(title: "Fix-its", systemImage: "wrench")
            ForEach(["flushDNS", "renewDHCP"], id: \.self) { id in
                if let action = Toolbox.action(id: id) {
                    Button { state.runToolbox(action) } label: { Label(action.title, systemImage: action.symbol).frame(maxWidth: .infinity, alignment: .leading) }
                }
            }
            Button {
                if let ip = network.localIP { NSPasteboard.general.clearContents(); NSPasteboard.general.setString(ip, forType: .string); state.toast("Copied \(ip)") }
            } label: { Label("Copy local IP", systemImage: "doc.on.doc").frame(maxWidth: .infinity, alignment: .leading) }
            Button {
                NSWorkspace.shared.open(URL(string: "x-apple.systempreferences:com.apple.Network-Settings.extension")!)
            } label: { Label("Network settings", systemImage: "gearshape").frame(maxWidth: .infinity, alignment: .leading) }
        }
        .frame(width: 220)
        .card()
    }
}
