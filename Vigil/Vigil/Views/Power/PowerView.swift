import SwiftUI

struct PowerView: View {
    @Environment(AppState.self) private var state
    @Environment(MetricsEngine.self) private var engine
    @Environment(AppSettings.self) private var settings
    @State private var dayPoints: [MetricPoint] = []

    private var battery: BatterySample { engine.battery }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: Theme.gridSpacing) {
                PageHeader(title: "Battery & Power", subtitle: battery.isPresent ? battery.stateDescription : "This Mac has no battery")
                if battery.isPresent {
                    HStack(alignment: .top, spacing: Theme.gridSpacing) {
                        chargeCard
                        healthCard
                        powerCard
                    }
                    VStack(alignment: .leading, spacing: 8) {
                        SectionHeader(title: "Charge over the last 24 hours", subtitle: "Dips show how fast you drain on battery; flat tops are time spent at 100% on the charger")
                        if dayPoints.isEmpty {
                            Text("History builds up as Vigil runs.").font(.caption).foregroundStyle(.secondary).frame(height: 160)
                        } else {
                            MetricChart(points: dayPoints.filter { $0.battery >= 0 }, keyPath: \.battery, color: Theme.battery, maximum: 100, primaryLabel: "Charge")
                                .frame(height: 160)
                        }
                    }
                    .card()
                } else {
                    powerCard
                }
                HStack(alignment: .top, spacing: Theme.gridSpacing) {
                    if !engine.peripherals.isEmpty { peripheralsCard }
                    tipsCard
                }
            }
            .padding(20)
        }
        .task { await loadHistory() }
        .accessibilityIdentifier("page.power")
    }

    private func loadHistory() async {
        let history = engine.history
        dayPoints = await Task.detached { history.points(from: Date.hoursAgo(24), bucketSeconds: 300) }.value
    }

    private var chargeCard: some View {
        VStack(alignment: .leading, spacing: 12) {
            SectionHeader(title: "Charge", systemImage: battery.isCharging ? "battery.100percent.bolt" : "battery.75percent")
            HStack(spacing: 16) {
                RingGauge(fraction: battery.percent / 100, color: battery.percent < 20 ? Theme.critical : Theme.battery, lineWidth: 12, label: "\(Int(battery.percent))%", caption: battery.isCharging ? "charging" : "")
                    .frame(width: 120, height: 120)
                VStack(alignment: .leading, spacing: 4) {
                    if let minutes = battery.timeRemainingMinutes {
                        Text(battery.isCharging ? "\(Format.minutes(minutes)) to full" : "\(Format.minutes(minutes)) remaining").font(.headline)
                    } else {
                        Text(battery.fullyCharged ? "Fully charged" : "Estimating…").font(.headline)
                    }
                    Text("\(battery.currentCapacity) of \(battery.maxCapacity) mAh").font(.caption).foregroundStyle(.secondary)
                    if battery.optimizedChargingEngaged {
                        Label("Optimized charging is holding at 80%", systemImage: "leaf").font(.caption).foregroundStyle(Theme.good)
                    }
                    if let name = battery.adapterName ?? battery.adapterWatts.map({ "\($0) W adapter" }) {
                        Label(battery.adapterWatts.map { "\(name) (\($0) W)" } ?? name, systemImage: "powerplug").font(.caption).foregroundStyle(.secondary)
                    }
                }
            }
        }
        .frame(maxWidth: .infinity)
        .card()
    }

    private var healthCard: some View {
        VStack(alignment: .leading, spacing: 10) {
            SectionHeader(title: "Health", subtitle: battery.condition, systemImage: "heart")
            HStack(alignment: .lastTextBaseline, spacing: 6) {
                Text("\(Int(battery.healthPercent))%").font(.system(size: 34, weight: .semibold, design: .rounded))
                Text("of original capacity").font(.callout).foregroundStyle(.secondary)
            }
            ProgressBar(fraction: battery.healthPercent / 100, color: battery.healthPercent >= 80 ? Theme.good : battery.healthPercent >= 70 ? Theme.warning : Theme.critical)
            KeyValueRow(key: "Cycle count", value: "\(battery.cycleCount) of ~1000 rated")
            KeyValueRow(key: "Design capacity", value: "\(battery.designCapacity) mAh")
            KeyValueRow(key: "Full charge capacity", value: "\(battery.maxCapacity) mAh")
            KeyValueRow(key: "Temperature", value: Format.temperature(battery.temperature, unit: settings.temperatureUnit, decimals: 1))
            if let date = battery.manufactureDate { KeyValueRow(key: "Manufactured", value: date.formatted(date: .abbreviated, time: .omitted)) }
            if let serial = battery.serial { KeyValueRow(key: "Serial", value: serial, monospaced: true, copyable: true) }
        }
        .frame(maxWidth: .infinity)
        .card()
    }

    private var powerCard: some View {
        VStack(alignment: .leading, spacing: 10) {
            SectionHeader(title: "Power draw", systemImage: "bolt")
            if let watts = engine.sensors.systemPowerWatts {
                HStack(alignment: .lastTextBaseline, spacing: 6) {
                    Text(Format.watts(watts)).font(.system(size: 34, weight: .semibold, design: .rounded))
                    Text("whole system").font(.callout).foregroundStyle(.secondary)
                }
            } else if battery.isPresent {
                HStack(alignment: .lastTextBaseline, spacing: 6) {
                    Text(Format.watts(abs(battery.powerWatts))).font(.system(size: 34, weight: .semibold, design: .rounded))
                    Text(battery.powerWatts >= 0 ? "into the battery" : "from the battery").font(.callout).foregroundStyle(.secondary)
                }
            } else {
                Text("Not exposed by this Mac.").font(.callout).foregroundStyle(.secondary)
            }
            if let cpu = engine.sensors.cpuPowerWatts { KeyValueRow(key: "CPU", value: Format.watts(cpu)) }
            if let gpu = engine.sensors.gpuPowerWatts { KeyValueRow(key: "GPU", value: Format.watts(gpu)) }
            if battery.isPresent {
                KeyValueRow(key: "Voltage", value: String(format: "%.2f V", battery.voltage / 1000))
                KeyValueRow(key: "Current", value: String(format: "%.0f mA", battery.amperage))
            }
            MetricChart(points: engine.recent, keyPath: \.power, color: Theme.warning, unit: "W", primaryLabel: "Power", format: { Format.watts($0) })
                .frame(height: 90)
        }
        .frame(maxWidth: .infinity)
        .card()
    }

    private var peripheralsCard: some View {
        VStack(alignment: .leading, spacing: 8) {
            SectionHeader(title: "Bluetooth devices", systemImage: "wave.3.right")
            ForEach(engine.peripherals) { device in
                HStack {
                    Image(systemName: device.kind).foregroundStyle(.secondary).frame(width: 22)
                    Text(device.name).font(.callout)
                    Spacer()
                    ProgressBar(fraction: Double(device.percent) / 100, color: device.percent < 20 ? Theme.critical : Theme.battery).frame(width: 80)
                    Text("\(device.percent)%").font(.callout.monospacedDigit()).frame(width: 44, alignment: .trailing)
                }
            }
        }
        .frame(width: 360)
        .card()
    }

    private var tipsCard: some View {
        VStack(alignment: .leading, spacing: 8) {
            SectionHeader(title: "Battery longevity", systemImage: "leaf")
            ForEach(tips, id: \.self) { tip in
                HStack(alignment: .top, spacing: 8) {
                    Image(systemName: "checkmark.circle").foregroundStyle(Theme.good).font(.caption).padding(.top, 3)
                    Text(tip).font(.callout).foregroundStyle(.secondary).fixedSize(horizontal: false, vertical: true)
                }
            }
            Button("Battery settings") { Permissions.openSystemSettings("x-apple.systempreferences:com.apple.Battery-Settings.extension") }.buttonStyle(.link)
        }
        .card()
    }

    private var tips: [String] {
        var result = [
            "Heat is the enemy: a battery that lives at 35°C+ loses capacity far faster. Charge on a hard, cool surface.",
            "Keep Optimized Battery Charging on. macOS learns your routine and waits at 80% until you need the rest.",
            "Partial charges are fine and count as partial cycles; there is no benefit to draining to 0%.",
            "If the Mac stays plugged in for weeks, let it discharge to around 50% once a month.",
        ]
        if battery.cycleCount > 500 { result.append("At \(battery.cycleCount) cycles, expect roughly \(max(0, 1000 - battery.cycleCount)) more before capacity drops below 80%.") }
        return result
    }
}
