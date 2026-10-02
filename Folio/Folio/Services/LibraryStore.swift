import PDFKit
import UIKit

/// Owns the documents in the app's library: the PDF files, their pristine
/// originals, thumbnails and the JSON index that ties them together.
@MainActor @Observable
final class LibraryStore {
    enum LibraryError: LocalizedError {
        case notAPDF
        case encrypted
        case writeFailed
        case missing

        var errorDescription: String? {
            switch self {
            case .notAPDF: return "That file isn't a PDF Folio can open."
            case .encrypted: return "This PDF is password protected. Remove the password and try again."
            case .writeFailed: return "The document couldn't be saved."
            case .missing: return "That document is no longer in your library."
            }
        }
    }

    private struct Probe {
        let pageCount: Int
        let hasText: Bool
        let snippet: String
        let thumbnail: UIImage?
    }

    private(set) var documents: [DocumentRecord] = []

    let rootURL: URL
    private let fileManager = FileManager.default
    private let thumbnailCache = NSCache<NSString, UIImage>()
    private let encoder: JSONEncoder = {
        let encoder = JSONEncoder()
        encoder.dateEncodingStrategy = .iso8601
        encoder.outputFormatting = [.prettyPrinted, .sortedKeys]
        return encoder
    }()
    private let decoder: JSONDecoder = {
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        return decoder
    }()

    init() {
        let base = fileManager.urls(for: .documentDirectory, in: .userDomainMask)[0]
        rootURL = base.appendingPathComponent("Folio", isDirectory: true)
        for directory in [filesURL, originalsURL, thumbnailsURL] {
            try? fileManager.createDirectory(at: directory, withIntermediateDirectories: true)
        }
        load()
    }

    // MARK: - Paths

    var filesURL: URL { rootURL.appendingPathComponent("Files", isDirectory: true) }
    var originalsURL: URL { rootURL.appendingPathComponent("Originals", isDirectory: true) }
    var thumbnailsURL: URL { rootURL.appendingPathComponent("Thumbnails", isDirectory: true) }
    var indexURL: URL { rootURL.appendingPathComponent("library.json") }

    func fileURL(for id: UUID) -> URL {
        filesURL.appendingPathComponent("\(id.uuidString).pdf")
    }

    func originalURL(for id: UUID) -> URL {
        originalsURL.appendingPathComponent("\(id.uuidString).pdf")
    }

    func thumbnailURL(for id: UUID) -> URL {
        thumbnailsURL.appendingPathComponent("\(id.uuidString).jpg")
    }

    func document(id: UUID) -> DocumentRecord? {
        documents.first { $0.id == id }
    }

    /// A URL whose file name matches the document's display name, for sharing.
    func shareableURL(for record: DocumentRecord) throws -> URL {
        let exportDir = fileManager.temporaryDirectory.appendingPathComponent("Share", isDirectory: true)
        try fileManager.createDirectory(at: exportDir, withIntermediateDirectories: true)
        let safeName = record.name.replacingOccurrences(of: "/", with: "-")
        let url = exportDir.appendingPathComponent("\(safeName).pdf")
        if fileManager.fileExists(atPath: url.path) {
            try fileManager.removeItem(at: url)
        }
        try fileManager.copyItem(at: fileURL(for: record.id), to: url)
        return url
    }

    // MARK: - Index

    private func load() {
        guard let data = try? Data(contentsOf: indexURL),
              let records = try? decoder.decode([DocumentRecord].self, from: data) else {
            documents = []
            return
        }
        documents = records
            .filter { fileManager.fileExists(atPath: fileURL(for: $0.id).path) }
            .sorted { $0.modifiedAt > $1.modifiedAt }
    }

    private func saveIndex() {
        guard let data = try? encoder.encode(documents) else { return }
        try? data.write(to: indexURL, options: .atomic)
    }

    func sorted(by sort: LibrarySort, query: String) -> [DocumentRecord] {
        let trimmedQuery = query.trimmed.lowercased()
        let filtered = trimmedQuery.isEmpty ? documents : documents.filter {
            $0.name.lowercased().contains(trimmedQuery) || $0.textSnippet.lowercased().contains(trimmedQuery)
        }
        switch sort {
        case .recent: return filtered.sorted { $0.modifiedAt > $1.modifiedAt }
        case .name: return filtered.sorted { $0.name.localizedStandardCompare($1.name) == .orderedAscending }
        case .size: return filtered.sorted { $0.fileSize > $1.fileSize }
        }
    }

    // MARK: - Adding documents

    /// Copies a PDF from anywhere (Files, Mail, AirDrop) into the library.
    func importFile(at url: URL, name: String? = nil) async throws -> DocumentRecord {
        let accessing = url.startAccessingSecurityScopedResource()
        defer { if accessing { url.stopAccessingSecurityScopedResource() } }
        let data = try coordinatedRead(from: url)
        let documentName = name ?? url.lastPathComponent.asDocumentName
        return try await add(data: data, name: documentName, isScanned: false)
    }

    /// Opens a PDF outside the library (for merging pages into a document).
    func loadExternalPDF(at url: URL) throws -> PDFDocument {
        let accessing = url.startAccessingSecurityScopedResource()
        defer { if accessing { url.stopAccessingSecurityScopedResource() } }
        let data = try coordinatedRead(from: url)
        guard let document = PDFDocument(data: data) else { throw LibraryError.notAPDF }
        if document.isLocked { throw LibraryError.encrypted }
        return document
    }

    func add(document: PDFDocument, name: String, isScanned: Bool) async throws -> DocumentRecord {
        guard let data = document.dataRepresentation() else { throw LibraryError.writeFailed }
        return try await add(data: data, name: name, isScanned: isScanned)
    }

    private func add(data: Data, name: String, isScanned: Bool) async throws -> DocumentRecord {
        let probe = try await Self.probe(data)
        let id = UUID()
        try data.write(to: fileURL(for: id), options: .atomic)
        if let thumbnail = probe.thumbnail {
            writeThumbnail(thumbnail, for: id)
        }
        let record = DocumentRecord(
            id: id,
            name: uniqueName(for: name),
            pageCount: probe.pageCount,
            fileSize: Int64(data.count),
            isScanned: isScanned,
            hasTextLayer: probe.hasText,
            textSnippet: probe.snippet
        )
        documents.insert(record, at: 0)
        saveIndex()
        return record
    }

    private static func probe(_ data: Data) async throws -> Probe {
        try await Task.detached(priority: .userInitiated) { () throws -> Probe in
            guard let document = PDFDocument(data: data) else { throw LibraryError.notAPDF }
            if document.isLocked { throw LibraryError.encrypted }
            guard document.pageCount > 0 else { throw LibraryError.notAPDF }
            let first = document.page(at: 0)
            let snippet = String((first?.string ?? "").trimmed.prefix(1500))
            let thumbnail = first?.thumbnail(of: CGSize(width: 480, height: 480), for: .cropBox)
            return Probe(
                pageCount: document.pageCount,
                hasText: first?.hasText ?? false,
                snippet: snippet,
                thumbnail: thumbnail
            )
        }.value
    }

    private func uniqueName(for proposed: String) -> String {
        let base = proposed.trimmed.isEmpty ? "Untitled" : proposed.trimmed
        let existing = Set(documents.map { $0.name.lowercased() })
        guard existing.contains(base.lowercased()) else { return base }
        var counter = 2
        while existing.contains("\(base) \(counter)".lowercased()) { counter += 1 }
        return "\(base) \(counter)"
    }

    private func coordinatedRead(from url: URL) throws -> Data {
        var coordinatorError: NSError?
        var result: Data?
        var readError: Error?
        NSFileCoordinator().coordinate(readingItemAt: url, options: [], error: &coordinatorError) { readURL in
            do {
                result = try Data(contentsOf: readURL)
            } catch {
                readError = error
            }
        }
        if let coordinatorError { throw coordinatorError }
        if let readError { throw readError }
        guard let result else { throw LibraryError.notAPDF }
        return result
    }

    // MARK: - Saving edits

    /// Writes the edited document to disk and refreshes its metadata.
    @discardableResult
    func persist(_ document: PDFDocument, for id: UUID) async throws -> DocumentRecord {
        guard var record = self.document(id: id) else { throw LibraryError.missing }
        guard let data = document.dataRepresentation() else { throw LibraryError.writeFailed }
        let destination = fileURL(for: id)
        try await Task.detached(priority: .utility) {
            let temp = FileManager.default.temporaryDirectory.appendingPathComponent("\(UUID().uuidString).pdf")
            try data.write(to: temp, options: .atomic)
            _ = try FileManager.default.replaceItemAt(destination, withItemAt: temp)
        }.value

        let probe = try await Self.probe(data)
        record.modifiedAt = .now
        record.pageCount = probe.pageCount
        record.fileSize = Int64(data.count)
        record.hasTextLayer = probe.hasText
        record.textSnippet = probe.snippet
        if let thumbnail = probe.thumbnail {
            writeThumbnail(thumbnail, for: id)
        }
        update(record)
        return record
    }

    func update(_ record: DocumentRecord) {
        guard let index = documents.firstIndex(where: { $0.id == record.id }) else { return }
        documents[index] = record
        saveIndex()
    }

    func rename(_ id: UUID, to newName: String) {
        guard var record = document(id: id) else { return }
        let trimmedName = newName.trimmed
        guard !trimmedName.isEmpty, trimmedName != record.name else { return }
        record.name = uniqueName(for: trimmedName)
        update(record)
    }

    func delete(_ id: UUID) {
        documents.removeAll { $0.id == id }
        try? fileManager.removeItem(at: fileURL(for: id))
        try? fileManager.removeItem(at: originalURL(for: id))
        try? fileManager.removeItem(at: thumbnailURL(for: id))
        thumbnailCache.removeObject(forKey: id.uuidString as NSString)
        saveIndex()
    }

    func duplicate(_ id: UUID) async throws -> DocumentRecord {
        guard let record = document(id: id) else { throw LibraryError.missing }
        let data = try Data(contentsOf: fileURL(for: id))
        return try await add(data: data, name: "\(record.name) copy", isScanned: record.isScanned)
    }

    // MARK: - Originals

    /// Keeps a pristine copy before the first edit so the user can always go back.
    func backupOriginalIfNeeded(for id: UUID) {
        guard var record = document(id: id), !record.hasOriginalBackup else { return }
        let source = fileURL(for: id)
        let destination = originalURL(for: id)
        do {
            if fileManager.fileExists(atPath: destination.path) {
                try fileManager.removeItem(at: destination)
            }
            try fileManager.copyItem(at: source, to: destination)
            record.hasOriginalBackup = true
            update(record)
        } catch {
            // Reverting simply won't be offered.
        }
    }

    func revertToOriginal(_ id: UUID) async throws -> PDFDocument {
        guard let record = document(id: id), record.hasOriginalBackup else { throw LibraryError.missing }
        let data = try Data(contentsOf: originalURL(for: id))
        guard let document = PDFDocument(data: data) else { throw LibraryError.notAPDF }
        try await persist(document, for: id)
        return document
    }

    // MARK: - Thumbnails

    func thumbnail(for id: UUID) async -> UIImage? {
        let key = id.uuidString as NSString
        if let cached = thumbnailCache.object(forKey: key) { return cached }
        let url = thumbnailURL(for: id)
        let image = await Task.detached(priority: .utility) { () -> UIImage? in
            guard let data = try? Data(contentsOf: url) else { return nil }
            return UIImage(data: data)
        }.value
        if let image { thumbnailCache.setObject(image, forKey: key) }
        return image
    }

    private func writeThumbnail(_ image: UIImage, for id: UUID) {
        let key = id.uuidString as NSString
        thumbnailCache.setObject(image, forKey: key)
        let url = thumbnailURL(for: id)
        Task.detached(priority: .utility) {
            guard let data = image.jpegData(compressionQuality: 0.8) else { return }
            try? data.write(to: url, options: .atomic)
        }
    }
}
