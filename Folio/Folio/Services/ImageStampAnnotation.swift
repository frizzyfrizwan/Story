import PDFKit
import UIKit

/// A stamp annotation that draws a bitmap. PDFKit cannot persist custom
/// drawing, so these are only ever added temporarily and then flattened into
/// the page by `PDFService.flatten(page:)`.
final class ImageStampAnnotation: PDFAnnotation {
    let image: UIImage

    init(image: UIImage, bounds: CGRect) {
        self.image = image
        super.init(bounds: bounds, forType: .stamp, withProperties: nil)
    }

    @available(*, unavailable)
    required init?(coder: NSCoder) {
        fatalError("ImageStampAnnotation does not support NSCoding")
    }

    override func draw(with box: PDFDisplayBox, in context: CGContext) {
        guard let cgImage = image.cgImage else { return }
        context.saveGState()
        context.interpolationQuality = .high
        context.draw(cgImage, in: bounds)
        context.restoreGState()
    }
}
