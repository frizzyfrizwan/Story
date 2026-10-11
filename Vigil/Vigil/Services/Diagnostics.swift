import Foundation
import AppKit

/// Produces a plain-text report of every raw reading Vigil can see, so sensor mappings can be
/// validated on hardware without a debugger. Nothing personal beyond the serial number is included.
@MainActor
enum Diagnostics {
    static let fileName = "Vigil-diagnostics.txt"

    static func report(engine: MetricsEngine, settings: AppSettings) -> String {
        var lines: [String] = []
        func section(_ title: String) { lines.append(""); lines.append("== \(title) ==") }
        func row(_ key: String, _ value: Any?) { lines.append("\(key): \(value.map { String(describing: $0) } ?? "nil")") }

        let system = engine.system
        lines.append("Vigil diagnostics · \(Format.dateTime(Date())) · app \(Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? "?")")
        section("Machine")
        row("model", "\(system.modelName) [\(system.modelIdentifier)]")
        row("chip", system.chip)
        row("architecture", system.architecture)
        row("appleSilicon", system.isAppleSilicon)
        row("cores", "physical \(system.physicalCores), logical \(system.logicalCores), P \(system.performanceCores), E \(system.efficiencyCores)")
        row("memory", Format.memory(system.memoryBytes))
        row("macOS", "\(system.osName) \(system.osVersion) (\(system.osBuild)) kernel \(system.kernelVersion)")
        row("gpu", "\(system.gpuName) cores \(system.gpuCores.map { "\($0)" } ?? "?")")
        row("serial", system.serialNumber)
        row("uptime", Format.duration(system.uptime))
        row("displays", system.displays.map { "\($0.name) \($0.pixelWidth)x\($0.pixelHeight)@\($0.scale)x \($0.refreshRate)Hz" }.joined(separator: "; "))
        row("fileVault/firewall/sip", "\(flag(system.fileVaultEnabled)) / \(flag(system.firewallEnabled)) / \(flag(system.sipEnabled))")
        row("timeMachine", "configured \(flag(system.timeMachineConfigured)) last \(system.lastTimeMachineBackup.map { Format.dateTime($0) } ?? "nil")")
        row("pendingUpdates", system.pendingUpdates)
        row("smart", system.smartStatus)
        row("samplingCostPercent", engine.samplingCostPercent)
        row("refreshInterval", settings.refreshInterval)

        section("CPU sample")
        row("total/user/system", "\(engine.cpu.total.rounded1) / \(engine.cpu.user.rounded1) / \(engine.cpu.system.rounded1)")
        row("loadAverage", engine.cpu.loadAverage)
        row("cores", engine.cpu.cores.map { "\($0.kind.label)\($0.index)=\(Int($0.usage))" }.joined(separator: " "))

        section("Memory sample")
        let memory = engine.memory
        row("total/used/app/wired/compressed/cached/free", [memory.total, memory.used, memory.app, memory.wired, memory.compressed, memory.cached, memory.free].map { Format.memory($0) })
        row("swap used/total", "\(Format.memory(memory.swapUsed)) / \(Format.memory(memory.swapTotal))")
        row("pressure", "\(memory.pressure.title) level=\(memory.pressure.rawValue) percent=\(memory.pressurePercent.rounded1)")

        section("Disk")
        for volume in engine.disk.volumes {
            row(volume.name, "root=\(volume.isRoot) internal=\(volume.isInternal) removable=\(volume.isRemovable) total=\(Format.bytes(volume.total)) free=\(Format.bytes(volume.available)) purgeable=\(Format.bytes(volume.purgeable)) fs=\(volume.fileSystem)")
        }
        row("io read/write", "\(Format.rate(engine.disk.readBytesPerSecond)) / \(Format.rate(engine.disk.writeBytesPerSecond)) · totals \(Format.bytes(engine.disk.totalRead)) / \(Format.bytes(engine.disk.totalWrite))")

        section("Network")
        row("primary", engine.network.primaryInterface)
        row("rates in/out", "\(Format.rate(engine.network.inBytesPerSecond)) / \(Format.rate(engine.network.outBytesPerSecond))")
        for interface in engine.network.interfaces {
            row(interface.name, "\(interface.displayName) up=\(interface.isUp) ipv4=\(interface.ipv4 ?? "-") ipv6=\(interface.ipv6 ?? "-") mac=\(interface.macAddress ?? "-")")
        }
        if let wifi = engine.network.wifi {
            row("wifi", "ssid=\(wifi.ssid ?? "nil") rssi=\(wifi.rssi) noise=\(wifi.noise) rate=\(wifi.transmitRate) channel=\(wifi.channel) band=\(wifi.band) security=\(wifi.security) country=\(wifi.countryCode ?? "-")")
        } else {
            row("wifi", "none")
        }
        row("router", NetworkProbe.routerAddress())
        row("dns", NetworkProbe.dnsServers())

        section("Battery (parsed)")
        let battery = engine.battery
        row("present", battery.isPresent)
        if battery.isPresent {
            row("percent", battery.percent)
            row("state", battery.stateDescription)
            row("capacity current/max/nominal/design", "\(battery.currentCapacity) / \(battery.maxCapacity) / \(battery.nominalCapacity) / \(battery.designCapacity) mAh → health \(battery.healthPercent.rounded1)% from \(battery.systemMaxCapacityPercent != nil ? "macOS" : battery.nominalCapacity > 0 ? "nominal" : "raw max") (shown as \(battery.healthPercentRounded)%)")
            row("macOS maximum capacity", "\(battery.systemMaxCapacityPercent.map { "\($0)%" } ?? "not reported") · service state \(battery.serviceState.map { "\($0)" } ?? "nil") (pmset -g ps -xml)")
            row("cycles", "\(battery.cycleCount) of \(battery.ratedCycleCount) rated")
            row("condition", battery.condition)
            row("temperature", battery.temperature)
            row("voltage/amperage/power", "\(battery.voltage) mV / \(battery.amperage) mA / \(battery.powerWatts.rounded1) W")
            row("timeRemaining", battery.timeRemainingMinutes)
            row("adapter", "\(battery.adapterName ?? "-") \(battery.adapterWatts.map { "\($0) W" } ?? "")")
            row("optimizedCharging", battery.optimizedChargingEngaged)
            row("manufactured", battery.manufactureDate.map { Format.dateTime($0) })
        }
        section("Battery (raw AppleSmartBattery)")
        for (key, value) in BatteryProbe.rawProperties().sorted(by: { $0.key < $1.key }) { row(key, value) }

        section("Sensors (parsed)")
        let sensors = engine.sensors
        row("smcAvailable", "\(sensors.smcAvailable) (parameter struct \(SMCProbe.parameterStructSize) bytes, kernel expects 80)")
        row("thermalState", sensors.thermalState.title)
        row("cpu/gpu max", "\(sensors.cpuTemperature.map { "\($0.rounded1)" } ?? "nil") / \(sensors.gpuTemperature.map { "\($0.rounded1)" } ?? "nil")")
        row("power system/cpu/gpu", "\(sensors.systemPowerWatts.map { "\($0.rounded1)" } ?? "nil") / \(sensors.cpuPowerWatts.map { "\($0.rounded1)" } ?? "nil") / \(sensors.gpuPowerWatts.map { "\($0.rounded1)" } ?? "nil")")
        for reading in sensors.temperatures { row(reading.key, "\(reading.group.rawValue) · \(reading.name) · \(reading.celsius.rounded1)°C") }
        for fan in sensors.fans { row("fan \(fan.index)", "\(fan.name) \(Int(fan.rpm)) rpm (min \(Int(fan.minimum)) max \(Int(fan.maximum)) target \(Int(fan.target)))") }

        section("SMC raw keys (T*, F*, P*, V*, I*)")
        let probe = SMCProbe()
        let keys = probe.dumpKeys()
        row("count", keys.count)
        for key in keys {
            lines.append(String(format: "%@  %@  size=%d  value=%@  bytes=%@", key.code, key.type, key.size, key.value.map { String(format: "%.3f", $0) } ?? "nil", key.bytes))
        }

        section("GPU (raw IOAccelerator)")
        for entry in GPUProbe.rawStatistics() {
            for (key, value) in entry.sorted(by: { $0.key < $1.key }) { row(key, value) }
            lines.append("--")
        }
        row("gpu parsed", engine.gpu.map { "\($0.name) util=\($0.utilization) renderer=\($0.rendererUtilization) tiler=\($0.tilerUtilization) vram=\($0.vramUsedBytes.map { Format.memory($0) } ?? "nil")" })

        section("Peripherals")
        for device in engine.peripherals { row(device.name, "\(device.kind) \(device.percent)%") }
        if engine.peripherals.isEmpty { lines.append("none") }

        section("Processes")
        row("count", engine.processes.count)
        for process in engine.processes.prefix(15) {
            lines.append(String(format: "%6d  %6.1f%%  %10@  %@%@", Int(process.pid), process.cpuPercent, Format.memory(process.memoryBytes), process.name, process.isApplication ? " (app)" : ""))
        }

        section("Health")
        row("score", "\(engine.health.score) \(engine.health.grade)")
        for finding in engine.health.findings { lines.append("[\(finding.severity.title)] \(finding.id): \(finding.title)") }

        return lines.joined(separator: "\n")
    }

    /// Writes the report to the Desktop and copies it to the clipboard. Returns the file URL.
    @discardableResult
    static func export(engine: MetricsEngine, settings: AppSettings) -> URL? {
        let text = report(engine: engine, settings: settings)
        NSPasteboard.general.clearContents()
        NSPasteboard.general.setString(text, forType: .string)
        let desktop = FileManager.default.urls(for: .desktopDirectory, in: .userDomainMask).first ?? URL.homeDirectory
        let url = desktop.appendingPathComponent(fileName)
        do {
            try text.write(to: url, atomically: true, encoding: .utf8)
            return url
        } catch {
            return nil
        }
    }

    private static func flag(_ value: Bool?) -> String { value.map { $0 ? "on" : "off" } ?? "unknown" }
}
