import Foundation
import AppKit
import Observation

/// Owns every probe, runs the sampling loop and publishes the latest readings to the UI.
@MainActor
@Observable
final class MetricsEngine {
    // Latest readings
    private(set) var cpu = CPUSample()
    private(set) var memory = MemorySample()
    private(set) var disk = DiskSample()
    private(set) var network = NetworkSample()
    private(set) var battery = BatterySample()
    private(set) var sensors = SensorSample()
    private(set) var gpu: GPUSample?
    private(set) var processes: [ProcessSample] = []
    private(set) var peripherals: [PeripheralBattery] = []
    private(set) var system = SystemInfo()
    private(set) var health = HealthReport()
    private(set) var lastSampleAt: Date?
    private(set) var samplingCostPercent: Double = 0
    private(set) var isRunning = false

    /// Short in-memory history for sparklines (last ~10 minutes at the current interval).
    private(set) var recent: [MetricPoint] = []
    private let recentLimit = 300

    let history: HistoryStore
    let settings: AppSettings
    let notifications: NotificationService

    private let cpuProbe = CPUProbe()
    private let memoryProbe = MemoryProbe()
    private let diskProbe = DiskProbe()
    private let networkProbe = NetworkProbe()
    private let batteryProbe = BatteryProbe()
    private let smcProbe = SMCProbe()
    private let gpuProbe = GPUProbe()
    private let processProbe = ProcessProbe()
    private let healthEngine = HealthEngine()

    private var loopTask: Task<Void, Never>?
    private var tick = 0
    private var lastPersistedAt: Date?
    private var lastProcessPersistAt: Date?
    private var lastHealthAt: Date?
    private var lastPruneAt: Date?
    private var sustainedHighCPUSince: Date?
    private var lastThermalState: ProcessInfo.ThermalState = .nominal
    private var lastPressure: MemoryPressure = .normal
    private var wasPluggedIn: Bool?
    private var publicIPFetchedAt: Date?

    init(history: HistoryStore, settings: AppSettings, notifications: NotificationService) {
        self.history = history
        self.settings = settings
        self.notifications = notifications
        self.system = SystemInfoProbe.collect()
        sensors.smcAvailable = smcProbe.isAvailable
    }

    // MARK: - Lifecycle

    func start() {
        guard loopTask == nil else { return }
        isRunning = true
        loopTask = Task { [weak self] in
            await self?.runSlowSystemChecks()
            while !Task.isCancelled {
                guard let self else { return }
                let interval = max(1, self.settings.refreshInterval)
                await self.sampleOnce()
                try? await Task.sleep(nanoseconds: UInt64(interval * 1_000_000_000))
            }
        }
    }

    func stop() {
        loopTask?.cancel()
        loopTask = nil
        isRunning = false
    }

    func refreshSystemInfo() {
        system = SystemInfoProbe.collect()
        Task { await runSlowSystemChecks() }
    }

    private func runSlowSystemChecks() async {
        let base = system
        let updated: SystemInfo = await Task.detached(priority: .utility) {
            var copy = base
            SystemInfoProbe.collectSlow(into: &copy)
            return copy
        }.value
        var merged = updated
        merged.displays = SystemInfoProbe.displays()
        system = merged
        peripherals = await Task.detached(priority: .utility) { PeripheralProbe.batteries() }.value
        health = healthEngine.evaluate(context: healthContext())
    }

    // MARK: - Sampling

    private struct Readings {
        var cpu: CPUSample?
        var memory: MemorySample?
        var disk: DiskSample
        var network: NetworkSample
        var battery: BatterySample
        var sensors: SensorSample
        var gpu: GPUSample?
        var processes: [ProcessSample]?
        var peripherals: [PeripheralBattery]?
        var cost: Double
    }

    private func sampleOnce() async {
        tick += 1
        let sampleProcesses = true
        let samplePeripherals = tick % 30 == 0
        let cpuProbe = cpuProbe, memoryProbe = memoryProbe, diskProbe = diskProbe, networkProbe = networkProbe
        let batteryProbe = batteryProbe, smcProbe = smcProbe, gpuProbe = gpuProbe, processProbe = processProbe

        let readings: Readings = await Task.detached(priority: .utility) {
            let started = Date()
            let cpu = cpuProbe.sample()
            let memory = memoryProbe.sample()
            let disk = diskProbe.sample()
            let network = networkProbe.sample()
            let battery = batteryProbe.sample()
            let sensors = smcProbe.sample()
            let gpu = gpuProbe.sample()
            let processes = sampleProcesses ? processProbe.sample() : nil
            let peripherals = samplePeripherals ? PeripheralProbe.batteries() : nil
            let elapsed = Date().timeIntervalSince(started)
            return Readings(cpu: cpu, memory: memory, disk: disk, network: network, battery: battery, sensors: sensors,
                            gpu: gpu, processes: processes, peripherals: peripherals, cost: elapsed)
        }.value

        if let cpu = readings.cpu { self.cpu = cpu }
        if let memory = readings.memory { self.memory = memory }
        disk = readings.disk
        var network = readings.network
        network.publicIP = self.network.publicIP
        self.network = network
        battery = readings.battery
        sensors = readings.sensors
        gpu = readings.gpu
        if let processes = readings.processes {
            self.processes = processes.sorted { $0.cpuPercent > $1.cpuPercent }
            self.cpu.processCount = processes.count
            self.cpu.threadCount = processes.reduce(0) { $0 + $1.threads }
        }
        if let peripherals = readings.peripherals { self.peripherals = peripherals }
        lastSampleAt = Date()
        samplingCostPercent = (readings.cost / max(1, settings.refreshInterval) * 100).rounded1

        appendRecent()
        persistIfDue()
        detectEvents()
        if lastHealthAt == nil || Date().timeIntervalSince(lastHealthAt!) > 30 {
            health = healthEngine.evaluate(context: healthContext())
            lastHealthAt = Date()
        }
        if settings.publicIPLookup, publicIPFetchedAt == nil || Date().timeIntervalSince(publicIPFetchedAt!) > 600 {
            publicIPFetchedAt = Date()
            Task { await fetchPublicIP() }
        }
    }

    private func currentPoint() -> MetricPoint {
        MetricPoint(time: Date(),
                    cpu: cpu.total,
                    memoryUsed: Int64(clamping: memory.used),
                    memoryPressure: memory.pressure.rawValue,
                    swapUsed: Int64(clamping: memory.swapUsed),
                    diskRead: disk.readBytesPerSecond,
                    diskWrite: disk.writeBytesPerSecond,
                    networkIn: network.inBytesPerSecond,
                    networkOut: network.outBytesPerSecond,
                    battery: battery.isPresent ? battery.percent : -1,
                    isCharging: battery.isCharging,
                    temperature: sensors.cpuTemperature ?? sensors.hottest?.celsius ?? 0,
                    fanRPM: sensors.fans.map(\.rpm).max() ?? 0,
                    gpu: gpu?.utilization ?? 0,
                    power: sensors.systemPowerWatts ?? abs(battery.powerWatts))
    }

    private func appendRecent() {
        recent.append(currentPoint())
        if recent.count > recentLimit { recent.removeFirst(recent.count - recentLimit) }
    }

    private func persistIfDue() {
        let now = Date()
        if lastPersistedAt == nil || now.timeIntervalSince(lastPersistedAt!) >= 10 {
            history.insert(currentPoint())
            lastPersistedAt = now
        }
        if lastProcessPersistAt == nil || now.timeIntervalSince(lastProcessPersistAt!) >= 60 {
            let top = processes.prefix(12).map {
                ProcessPoint(time: now, name: $0.name, bundleIdentifier: $0.bundleIdentifier, cpu: $0.cpuPercent, memory: Int64(clamping: $0.memoryBytes))
            }
            history.insert(processes: Array(top))
            lastProcessPersistAt = now
        }
        if lastPruneAt == nil || now.timeIntervalSince(lastPruneAt!) >= 3600 {
            history.prune(retentionDays: settings.historyRetentionDays)
            lastPruneAt = now
        }
    }

    /// Turns state changes into history events and (optionally) alerts.
    private func detectEvents() {
        if sensors.thermalState != lastThermalState {
            history.record(.thermal, title: "Thermal state: \(sensors.thermalState.title)", detail: sensors.thermalState.explanation)
            if sensors.thermalState == .critical || sensors.thermalState == .serious {
                notifications.alert(id: "thermal", title: "Your Mac is throttling", body: sensors.thermalState.explanation, enabled: settings.alertsEnabled)
            }
            lastThermalState = sensors.thermalState
        }
        if memory.pressure != lastPressure {
            history.record(.memoryPressure, title: "Memory pressure: \(memory.pressure.title)", detail: "\(Format.memory(memory.used)) used, \(Format.memory(memory.swapUsed)) swap")
            if memory.pressure == .critical, settings.alertMemoryPressure {
                let top = processes.max(by: { $0.memoryBytes < $1.memoryBytes })
                notifications.alert(id: "memory", title: "Memory pressure is critical",
                                    body: top.map { "\($0.name) is using \(Format.memory($0.memoryBytes)). Quit apps you are not using." } ?? "Quit apps you are not using.",
                                    enabled: settings.alertsEnabled)
            }
            lastPressure = memory.pressure
        }
        if battery.isPresent {
            if let wasPluggedIn, wasPluggedIn != battery.isPluggedIn {
                history.record(.battery, title: battery.isPluggedIn ? "Plugged in" : "Unplugged", detail: "\(Int(battery.percent))% charged")
            }
            wasPluggedIn = battery.isPluggedIn
            if battery.temperature >= settings.alertBatteryTemperature {
                notifications.alert(id: "batteryTemp", title: "Battery is hot",
                                    body: "Battery is at \(Format.temperature(battery.temperature, unit: settings.temperatureUnit)). Heat ages batteries faster: unplug, close heavy apps or give it airflow.",
                                    enabled: settings.alertsEnabled)
            }
        }
        if let temp = sensors.cpuTemperature, temp >= settings.alertCPUTemperature {
            notifications.alert(id: "cpuTemp", title: "CPU is running hot",
                                body: "CPU at \(Format.temperature(temp, unit: settings.temperatureUnit)). \(processes.first.map { "\($0.name) is using \(Int($0.cpuPercent))% CPU." } ?? "")",
                                enabled: settings.alertsEnabled)
        }
        if let root = disk.root, root.freeFraction * 100 < settings.alertDiskFreePercent {
            notifications.alert(id: "disk", title: "Startup disk is almost full",
                                body: "Only \(Format.bytes(root.available)) free. Open Vigil → Storage to clean up.", enabled: settings.alertsEnabled)
        }
        if cpu.total > 85 {
            if sustainedHighCPUSince == nil { sustainedHighCPUSince = Date() }
            if let since = sustainedHighCPUSince, Date().timeIntervalSince(since) > 300 {
                let top = processes.first
                history.record(.cpuSpike, title: "CPU above 85% for 5 minutes", detail: top.map { "\($0.name) at \(Int($0.cpuPercent))%" } ?? "")
                sustainedHighCPUSince = Date()
            }
        } else {
            sustainedHighCPUSince = nil
        }
        if settings.alertRunawayProcess, let runaway = processes.first, runaway.cpuPercent >= settings.alertRunawayCPUPercent, runaway.name.lowercased() != "kernel_task" {
            notifications.alert(id: "runaway-\(runaway.pid)", title: "\(runaway.name) is using \(Int(runaway.cpuPercent))% CPU",
                                body: ProcessDictionary.explanation(for: runaway.name, bundleIdentifier: runaway.bundleIdentifier, isApplication: runaway.isApplication).summary,
                                enabled: settings.alertsEnabled)
        }
    }

    private func fetchPublicIP() async {
        guard let url = URL(string: "https://api.ipify.org") else { return }
        var request = URLRequest(url: url)
        request.timeoutInterval = 8
        guard let (data, _) = try? await URLSession.shared.data(for: request) else { return }
        let text = String(decoding: data, as: UTF8.self).trimmingCharacters(in: .whitespacesAndNewlines)
        if !text.isEmpty, text.count < 64 { network.publicIP = text }
    }

    // MARK: - Derived data for views

    func healthContext() -> HealthContext {
        HealthContext(cpu: cpu, memory: memory, disk: disk, battery: battery, sensors: sensors, system: system,
                      processes: processes, startupItemCount: nil, now: Date())
    }

    var topCPUProcesses: [ProcessSample] { Array(processes.prefix(8)) }
    var topMemoryProcesses: [ProcessSample] { Array(processes.sorted { $0.memoryBytes > $1.memoryBytes }.prefix(8)) }
    var visibleProcesses: [ProcessSample] { settings.showAllProcesses ? processes : processes.filter { $0.isApplication || $0.cpuPercent >= 0.5 || $0.memoryBytes > 50_000_000 } }

    func icon(for process: ProcessSample) -> NSImage? { processProbe.icon(for: process) }

    /// Terminates a process. Returns an error message on failure.
    func terminate(_ process: ProcessSample, force: Bool) -> String? {
        if process.isApplication, let app = NSRunningApplication(processIdentifier: process.pid) {
            let ok = force ? app.forceTerminate() : app.terminate()
            if ok { history.record(.appQuit, title: "\(force ? "Force quit" : "Quit") \(process.name)", detail: "From Vigil"); return nil }
        }
        let result = kill(process.pid, force ? SIGKILL : SIGTERM)
        if result == 0 {
            history.record(.appQuit, title: "\(force ? "Killed" : "Terminated") \(process.name)", detail: "pid \(process.pid)")
            return nil
        }
        if errno == EPERM { return "\(process.name) belongs to another user. Use Force Quit as administrator." }
        return String(cString: strerror(errno))
    }

    func terminateAsAdministrator(_ process: ProcessSample) -> String? {
        do {
            try Shell.runPrivileged("/bin/kill -9 \(process.pid)")
            history.record(.appQuit, title: "Killed \(process.name) as administrator", detail: "pid \(process.pid)")
            return nil
        } catch {
            return error.localizedDescription
        }
    }
}
