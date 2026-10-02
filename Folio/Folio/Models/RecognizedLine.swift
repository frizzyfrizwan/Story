import CoreGraphics
import Foundation

/// A line of text found by OCR. `box` is normalised to the image it was found
/// in, with the origin at the bottom-left (Vision's convention).
struct RecognizedLine: Codable, Hashable {
    var text: String
    var box: CGRect

    /// The line's rectangle in a top-left-origin space of the given size.
    func rect(in size: CGSize) -> CGRect {
        CGRect(
            x: box.minX * size.width,
            y: (1 - box.maxY) * size.height,
            width: box.width * size.width,
            height: box.height * size.height
        )
    }
}
