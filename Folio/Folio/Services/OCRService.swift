import CoreText
import UIKit
import Vision

/// On-device text recognition and the invisible text layer that makes
/// image-only pages searchable.
enum OCRService {
    enum OCRError: LocalizedError {
        case noImage

        var errorDescription: String? {
            switch self {
            case .noImage: return "The page couldn't be rendered for text recognition."
            }
        }
    }

    static func recognize(_ image: UIImage) async throws -> [RecognizedLine] {
        guard let cgImage = image.cgImage else { throw OCRError.noImage }
        let orientation = CGImagePropertyOrientation.from(uiOrientation: image.imageOrientation)
        return try await recognize(cgImage, orientation: orientation)
    }

    static func recognize(
        _ cgImage: CGImage,
        orientation: CGImagePropertyOrientation = .up
    ) async throws -> [RecognizedLine] {
        try await withCheckedThrowingContinuation { continuation in
            DispatchQueue.global(qos: .userInitiated).async {
                let request = VNRecognizeTextRequest()
                request.recognitionLevel = .accurate
                request.usesLanguageCorrection = true
                request.automaticallyDetectsLanguage = true
                let handler = VNImageRequestHandler(cgImage: cgImage, orientation: orientation, options: [:])
                do {
                    try handler.perform([request])
                    let observations = request.results ?? []
                    let lines = observations.compactMap { observation -> RecognizedLine? in
                        guard let candidate = observation.topCandidates(1).first else { return nil }
                        let text = candidate.string.trimmed
                        guard !text.isEmpty else { return nil }
                        return RecognizedLine(text: text, box: observation.boundingBox)
                    }
                    continuation.resume(returning: lines)
                } catch {
                    continuation.resume(throwing: error)
                }
            }
        }
    }

    /// Draws each recognised line as invisible text (PDF text render mode 3)
    /// so the page can be searched and selected but looks unchanged.
    ///
    /// - Parameters:
    ///   - context: A UIKit-oriented context (origin top-left), e.g. from
    ///     `UIGraphicsPDFRenderer`.
    ///   - imageRect: Where the image the lines were recognised in was drawn.
    static func drawInvisibleText(_ lines: [RecognizedLine], in context: CGContext, imageRect: CGRect) {
        context.saveGState()
        defer { context.restoreGState() }
        context.setTextDrawingMode(.invisible)

        for line in lines {
            var rect = line.rect(in: imageRect.size)
            rect.origin.x += imageRect.minX
            rect.origin.y += imageRect.minY
            guard rect.width > 0.5, rect.height > 0.5 else { continue }

            let fontSize = max(rect.height * 0.8, 1.5)
            let font = UIFont(name: "Helvetica", size: fontSize) ?? UIFont.systemFont(ofSize: fontSize)
            let attributed = NSAttributedString(string: line.text, attributes: [.font: font])
            let ctLine = CTLineCreateWithAttributedString(attributed)
            let naturalWidth = CGFloat(CTLineGetTypographicBounds(ctLine, nil, nil, nil))
            guard naturalWidth > 0 else { continue }

            // Stretch horizontally so the invisible glyphs sit on the printed ones.
            let horizontalScale = rect.width / naturalWidth
            context.textMatrix = CGAffineTransform(scaleX: horizontalScale, y: -1)
            context.textPosition = CGPoint(x: rect.minX, y: rect.maxY - fontSize * 0.22)
            CTLineDraw(ctLine, context)
        }
    }
}
