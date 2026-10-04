import PDFKit
import UIKit

/// Pure PDF operations. Everything here is synchronous and side-effect free;
/// the editor decides what to do with the results.
enum PDFService {
    static let letterSize = CGSize(width: 612, height: 792)
    static let a4Size = CGSize(width: 595.28, height: 841.89)

    // MARK: - Page sizing

    /// Chooses a page size for an image according to the user's preference.
    static func pageSize(for image: UIImage, preference: ScanPageSize) -> CGSize {
        switch preference {
        case .letter:
            return letterSize
        case .a4:
            return a4Size
        case .auto:
            guard image.size.width > 0, image.size.height > 0 else { return letterSize }
            let aspect = image.size.height / image.size.width
            if aspect >= 1 {
                let width = letterSize.width
                return CGSize(width: width, height: (width * aspect).rounded())
            } else {
                let width = letterSize.height
                return CGSize(width: width, height: (width * aspect).rounded())
            }
        }
    }

    static func aspectFit(_ size: CGSize, in rect: CGRect) -> CGRect {
        guard size.width > 0, size.height > 0 else { return rect }
        let scale = min(rect.width / size.width, rect.height / size.height)
        let fitted = CGSize(width: size.width * scale, height: size.height * scale)
        return CGRect(
            x: rect.midX - fitted.width / 2,
            y: rect.midY - fitted.height / 2,
            width: fitted.width,
            height: fitted.height
        )
    }

    // MARK: - Documents from images

    /// Builds a document with one page per image. `textLayers[i]`, when
    /// present, is written as invisible text so the page is searchable.
    static func makeDocument(
        from images: [UIImage],
        pageSize: ScanPageSize,
        textLayers: [[RecognizedLine]?]
    ) -> PDFDocument? {
        let document = PDFDocument()
        for (index, image) in images.enumerated() {
            let lines = index < textLayers.count ? textLayers[index] : nil
            let size = self.pageSize(for: image, preference: pageSize)
            if let page = imagePage(image, size: size, lines: lines) {
                document.insert(page, at: document.pageCount)
            }
        }
        return document.pageCount > 0 ? document : nil
    }

    static func imagePage(_ image: UIImage, size: CGSize, lines: [RecognizedLine]?) -> PDFPage? {
        let data = imagePageData(image, size: size, lines: lines)
        return PDFDocument(data: data)?.page(at: 0)
    }

    static func imagePageData(_ image: UIImage, size: CGSize, lines: [RecognizedLine]?) -> Data {
        let bounds = CGRect(origin: .zero, size: size)
        let renderer = UIGraphicsPDFRenderer(bounds: bounds)
        return renderer.pdfData { context in
            context.beginPage()
            let cg = context.cgContext
            UIColor.white.setFill()
            cg.fill(bounds)
            let fitted = aspectFit(image.size, in: bounds)
            image.draw(in: fitted)
            if let lines, !lines.isEmpty {
                OCRService.drawInvisibleText(lines, in: cg, imageRect: fitted)
            }
        }
    }

    static func blankPage(size: CGSize) -> PDFPage? {
        let bounds = CGRect(origin: .zero, size: size)
        let data = UIGraphicsPDFRenderer(bounds: bounds).pdfData { context in
            context.beginPage()
            UIColor.white.setFill()
            context.cgContext.fill(bounds)
        }
        return PDFDocument(data: data)?.page(at: 0)
    }

    static func blankDocument(size: CGSize = letterSize) -> PDFDocument {
        let document = PDFDocument()
        if let page = blankPage(size: size) {
            document.insert(page, at: 0)
        }
        return document
    }

    // MARK: - Rendering

    /// Renders a page (with its annotations) to a bitmap.
    static func render(page: PDFPage, scale: CGFloat) -> UIImage {
        let size = page.bounds(for: .mediaBox).size
        let format = UIGraphicsImageRendererFormat.default()
        format.scale = scale
        format.opaque = true
        return UIGraphicsImageRenderer(size: size, format: format).image { context in
            let cg = context.cgContext
            UIColor.white.setFill()
            cg.fill(CGRect(origin: .zero, size: size))
            cg.translateBy(x: 0, y: size.height)
            cg.scaleBy(x: 1, y: -1)
            page.draw(with: .mediaBox, to: cg)
        }
    }

    /// Re-draws the page, with all of its annotations, into a fresh PDF page.
    /// Vector content stays vector; annotations become part of the page.
    static func flatten(page: PDFPage) -> PDFPage? {
        pageByRedrawing(page) { _, _ in }
    }

    /// Re-draws the page and adds an invisible OCR text layer on top.
    static func pageWithTextLayer(page: PDFPage, lines: [RecognizedLine]) -> PDFPage? {
        pageByRedrawing(page) { cg, size in
            OCRService.drawInvisibleText(lines, in: cg, imageRect: CGRect(origin: .zero, size: size))
        }
    }

    /// Draws `page` into a new PDF page, then runs `overlay` in UIKit
    /// (top-left origin) coordinates so callers can add content on top.
    private static func pageByRedrawing(
        _ page: PDFPage,
        overlay: (CGContext, CGSize) -> Void
    ) -> PDFPage? {
        let size = page.bounds(for: .mediaBox).size
        guard size.width > 0, size.height > 0 else { return nil }
        let bounds = CGRect(origin: .zero, size: size)
        let data = UIGraphicsPDFRenderer(bounds: bounds).pdfData { context in
            context.beginPage()
            let cg = context.cgContext
            cg.saveGState()
            cg.translateBy(x: 0, y: size.height)
            cg.scaleBy(x: 1, y: -1)
            page.draw(with: .mediaBox, to: cg)
            cg.restoreGState()
            overlay(cg, size)
        }
        return PDFDocument(data: data)?.page(at: 0)
    }

    /// A copy of the document with every annotation burned into the pages.
    static func flattenedCopy(of document: PDFDocument) -> PDFDocument {
        let copy = PDFDocument()
        for page in document.allPages {
            if let flat = flatten(page: page) {
                copy.insert(flat, at: copy.pageCount)
            }
        }
        return copy
    }

    /// A new document containing copies of the given pages, in order.
    static func extract(pages indices: [Int], from document: PDFDocument) -> PDFDocument {
        let result = PDFDocument()
        for index in indices {
            guard let page = document.page(at: index), let copy = page.copy() as? PDFPage else { continue }
            result.insert(copy, at: result.pageCount)
        }
        return result
    }

    /// Thumbnail of the first page of the PDF at `url`.
    static func thumbnail(forFileAt url: URL, maxSize: CGFloat = 480) -> UIImage? {
        guard let document = PDFDocument(url: url), let page = document.page(at: 0) else { return nil }
        return page.thumbnail(of: CGSize(width: maxSize, height: maxSize), for: .cropBox)
    }
}
