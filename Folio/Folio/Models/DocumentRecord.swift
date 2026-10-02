import Foundation

/// A document in the user's Folio library. The PDF bytes live on disk; this is
/// the metadata that is indexed and shown in the library grid.
struct DocumentRecord: Identifiable, Codable, Hashable {
    let id: UUID
    var name: String
    var createdAt: Date
    var modifiedAt: Date
    var pageCount: Int
    var fileSize: Int64
    /// True when the document was created from the camera or photos.
    var isScanned: Bool
    /// True when at least the first page has extractable text.
    var hasTextLayer: Bool
    /// True when a pristine copy of the imported file is kept for "Revert".
    var hasOriginalBackup: Bool
    /// A short excerpt of the first page used for library search.
    var textSnippet: String

    init(
        id: UUID = UUID(),
        name: String,
        createdAt: Date = .now,
        modifiedAt: Date = .now,
        pageCount: Int,
        fileSize: Int64,
        isScanned: Bool = false,
        hasTextLayer: Bool = false,
        hasOriginalBackup: Bool = false,
        textSnippet: String = ""
    ) {
        self.id = id
        self.name = name
        self.createdAt = createdAt
        self.modifiedAt = modifiedAt
        self.pageCount = pageCount
        self.fileSize = fileSize
        self.isScanned = isScanned
        self.hasTextLayer = hasTextLayer
        self.hasOriginalBackup = hasOriginalBackup
        self.textSnippet = textSnippet
    }

    var pageCountText: String {
        pageCount == 1 ? "1 page" : "\(pageCount) pages"
    }

    var summaryLine: String {
        "\(pageCountText) · \(fileSize.fileSizeString) · \(modifiedAt.relativeString)"
    }
}
