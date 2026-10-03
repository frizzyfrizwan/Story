import UIKit

/// Saved signatures, kept as transparent PNGs in Application Support.
@MainActor @Observable
final class SignatureStore {
    enum SignatureError: LocalizedError {
        case encodingFailed

        var errorDescription: String? { "The signature couldn't be saved." }
    }

    /// Free users keep one signature; Pro keeps the vault.
    static let freeLimit = 1

    private(set) var signatures: [Signature] = []
    private var cache: [UUID: UIImage] = [:]
    private let fileManager = FileManager.default
    private let directory: URL

    init() {
        let support = fileManager.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
        directory = support.appendingPathComponent("Folio/Signatures", isDirectory: true)
        try? fileManager.createDirectory(at: directory, withIntermediateDirectories: true)
        load()
    }

    private var indexURL: URL { directory.appendingPathComponent("signatures.json") }

    private func load() {
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        guard let data = try? Data(contentsOf: indexURL),
              let list = try? decoder.decode([Signature].self, from: data) else { return }
        signatures = list.filter { fileManager.fileExists(atPath: directory.appendingPathComponent($0.fileName).path) }
    }

    private func saveIndex() {
        let encoder = JSONEncoder()
        encoder.dateEncodingStrategy = .iso8601
        guard let data = try? encoder.encode(signatures) else { return }
        try? data.write(to: indexURL, options: .atomic)
    }

    func image(for signature: Signature) -> UIImage? {
        if let cached = cache[signature.id] { return cached }
        let url = directory.appendingPathComponent(signature.fileName)
        guard let data = try? Data(contentsOf: url), let image = UIImage(data: data) else { return nil }
        cache[signature.id] = image
        return image
    }

    @discardableResult
    func add(image: UIImage, label: String) throws -> Signature {
        guard let data = image.pngData() else { throw SignatureError.encodingFailed }
        let signature = Signature(label: label.trimmed.isEmpty ? "Signature" : label.trimmed)
        try data.write(to: directory.appendingPathComponent(signature.fileName), options: .atomic)
        cache[signature.id] = image
        signatures.insert(signature, at: 0)
        saveIndex()
        return signature
    }

    func delete(_ signature: Signature) {
        signatures.removeAll { $0.id == signature.id }
        cache[signature.id] = nil
        try? fileManager.removeItem(at: directory.appendingPathComponent(signature.fileName))
        saveIndex()
    }
}
