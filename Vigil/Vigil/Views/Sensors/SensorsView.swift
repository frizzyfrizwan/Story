import SwiftUI

struct SensorsView: View {
    @Environment(MetricsEngine.self) private var engine
    @Environment(AppSettings.self) private var settings

    private var sensors: SensorSample { engine.sensors }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: Theme.gridSpacing) {
                PageHeader(title: "Temperatures & Fans", subtitle: "Thermal state: \(sensors.thermalState.title). \(sensors.thermalState.explanation)")
                HStack(spacing: Theme.gridSpacing) {
                    StatTile(title: "CPU", value: sensors.cpuTemperature.map { Format.temperature($0, unit: settings.temperatureUnit) } ?? "—", detail: "hottest CPU sensor", color: Theme.thermal, sparkline: engine.recent.map(\.temperature), systemImage: "cpu")
                    StatTile(title: "GPU", value: sensors.gpuTemperature.map { Format.temperature($0, unit: settings.temperatureUnit) } ?? "—", detail: "hottest GPU sensor", color: Theme.gpu, systemImage: "cube.transparent")
                    if let battery = sensors.maximum(in: .battery) ?? (engine.battery.isPresent ? engine.battery.temperature : nil) {
                        StatTile(title: "Battery", value: Format.temperature(battery, unit: settings.temperatureUnit), detail: battery > 40 ? "hot — avoid charging under load" : "normal", color: Theme.battery, systemImage: "battery.75percent")
                    }
                    ForEach(sensors.fans) { fan in
                        StatTile(title: fan.name, value: Format.rpm(fan.rpm), detail: "min \(Int(fan.minimum)) · max \(Int(fan.maximum))", color: Theme.cpu, fraction: fan.fraction, systemImage: "fan")
                    }
                    if sensors.fans.isEmpty && sensors.smcAvailable {
                        StatTile(title: "Fans", value: "None", detail: "Fanless design: cooling is passive, so sustained load throttles sooner", color: Theme.cpu, systemImage: "fan.slash")
                    }
                }
                if !sensors.smcAvailable {
                    EmptyState(systemImage: "thermometer.medium.slash", title: "Sensor data unavailable", message: "Vigil could not open the System Management Controller. This happens inside virtual machines and on some managed Macs.")
                        .card()
                } else if sensors.temperatures.isEmpty {
                    EmptyState(systemImage: "thermometer.medium", title: "No temperature sensors found", message: "This Mac does not expose readable temperature keys. The thermal state above still comes from macOS.")
                        .card()
                } else {
                    VStack(alignment: .leading, spacing: 8) {
                        SectionHeader(title: "CPU temperature", subtitle: "Last \(Format.duration(Double(engine.recent.count) * settings.refreshInterval))")
                        MetricChart(points: engine.recent, keyPath: \.temperature, color: Theme.thermal, maximum: 110, unit: "°", primaryLabel: "CPU",
                                    format: { Format.temperature($0, unit: settings.temperatureUnit) })
                            .frame(height: 160)
                    }
                    .card()
                    sensorGroups
                }
                explainer
            }
            .padding(20)
        }
        .accessibilityIdentifier("page.sensors")
    }

    private var sensorGroups: some View {
        LazyVGrid(columns: [GridItem(.adaptive(minimum: 300), spacing: Theme.gridSpacing)], alignment: .leading, spacing: Theme.gridSpacing) {
            ForEach(SensorGroup.allCases) { group in
                let readings = sensors.temperatures.filter { $0.group == group }.sorted { $0.celsius > $1.celsius }
                if !readings.isEmpty {
                    VStack(alignment: .leading, spacing: 6) {
                        SectionHeader(title: group.rawValue, subtitle: "\(readings.count) sensor\(readings.count == 1 ? "" : "s") · average \(Format.temperature(readings.map(\.celsius).average, unit: settings.temperatureUnit))")
                        ForEach(readings) { reading in
                            HStack {
                                Text(reading.name).font(.callout).lineLimit(1)
                                Text(reading.key).font(.caption2.monospaced()).foregroundStyle(.tertiary)
                                Spacer()
                                ProgressBar(fraction: reading.celsius / 110, color: Theme.severity(reading.celsius / 110, warn: 0.75, critical: 0.9), height: 5).frame(width: 100)
                                Text(Format.temperature(reading.celsius, unit: settings.temperatureUnit)).font(.callout.monospacedDigit()).frame(width: 56, alignment: .trailing)
                            }
                        }
                    }
                    .card()
                }
            }
        }
    }

    private var explainer: some View {
        VStack(alignment: .leading, spacing: 8) {
            SectionHeader(title: "What is normal?", systemImage: "questionmark.circle")
            Text("Idle CPU temperatures of 35–55°C are typical; 80–100°C under sustained load is by design on Apple Silicon and Intel laptops. The number to watch is the **thermal state**: once macOS reports *Serious*, it is actively slowing the chip. Fans spin up well before that. If the Mac throttles while idle, something is wrong: a runaway process, blocked vents, or a hot charger. Fanless MacBook Airs throttle sooner by design and recover when the case cools.")
                .font(.callout).foregroundStyle(.secondary).fixedSize(horizontal: false, vertical: true)
        }
        .card()
    }
}
