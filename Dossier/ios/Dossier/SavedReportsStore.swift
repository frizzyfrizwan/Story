import Foundation
import Observation

struct SavedReport: Codable, Identifiable, Equatable {
    var id: String
    var title: String
    var price: String?
    var stance: String
    var summary: String
    var factsJSON: String
    var savedAt: Date

    var shareText: String {
        [title, price.map { "Asking \($0)" }, stance, summary].compactMap { $0 }.joined(separator: "\n")
    }
}

/// Reports the person chose to keep. Stored as one JSON file in Application Support; nothing leaves the device.
@Observable
final class SavedReportsStore {
    private(set) var reports: [SavedReport] = []
    private let url: URL

    init(directory: URL? = nil) {
        let base = directory ?? FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0].appendingPathComponent("Dossier", isDirectory: true)
        try? FileManager.default.createDirectory(at: base, withIntermediateDirectories: true)
        url = base.appendingPathComponent("saved-reports.json")
        load()
    }

    func upsert(_ report: SavedReport) {
        reports.removeAll { $0.id == report.id }
        reports.insert(report, at: 0)
        save()
    }

    func remove(_ report: SavedReport) {
        reports.removeAll { $0.id == report.id }
        save()
    }

    private func load() {
        guard let data = try? Data(contentsOf: url), let decoded = try? JSONDecoder().decode([SavedReport].self, from: data) else { return }
        reports = decoded
    }

    private func save() {
        guard let data = try? JSONEncoder().encode(reports) else { return }
        try? data.write(to: url, options: .atomic)
    }
}
