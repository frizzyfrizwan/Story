import PDFKit
import UIKit

/// Turns camera scans or photos into a PDF, optionally with OCR.
enum ScanPipeline {
    enum ScanError: LocalizedError {
        case empty

        var errorDescription: String? { "No pages could be created from those images." }
    }

    struct Page {
        let image: UIImage
        let lines: [RecognizedLine]?
    }

    /// Prepares images (orientation, size, JPEG) and optionally recognises
    /// text in each. Progress is reported on the main actor in 0...1.
    static func preparePages(
        from images: [UIImage],
        recognizeText: Bool,
        progress: @escaping @MainActor (Double) -> Void
    ) async throws -> [Page] {
        var pages: [Page] = []
        for (index, raw) in images.enumerated() {
            try Task.checkCancellation()
            let image = await Task.detached(priority: .userInitiated) {
                raw.normalized().downscaled(maxDimension: 2200).jpegBacked(quality: 0.82)
            }.value
            var lines: [RecognizedLine]?
            if recognizeText {
                lines = try await OCRService.recognize(image)
            }
            pages.append(Page(image: image, lines: lines))
            await progress(Double(index + 1) / Double(images.count))
        }
        return pages
    }

    static func build(
        images: [UIImage],
        recognizeText: Bool,
        pageSize: ScanPageSize,
        progress: @escaping @MainActor (Double) -> Void
    ) async throws -> PDFDocument {
        let pages = try await preparePages(from: images, recognizeText: recognizeText, progress: progress)
        guard let document = PDFService.makeDocument(
            from: pages.map(\.image),
            pageSize: pageSize,
            textLayers: pages.map(\.lines)
        ) else {
            throw ScanError.empty
        }
        return document
    }

    /// Suggested document name for a new scan.
    static func suggestedName(prefix: String = "Scan") -> String {
        let formatter = DateFormatter()
        formatter.dateFormat = "d MMM yyyy, HH.mm"
        return "\(prefix) \(formatter.string(from: .now))"
    }
}
