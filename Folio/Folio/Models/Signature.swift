import Foundation

/// A saved signature or set of initials, stored as a transparent PNG.
struct Signature: Identifiable, Codable, Hashable {
    let id: UUID
    var label: String
    var createdAt: Date

    init(id: UUID = UUID(), label: String, createdAt: Date = .now) {
        self.id = id
        self.label = label
        self.createdAt = createdAt
    }

    var fileName: String { "\(id.uuidString).png" }
}
