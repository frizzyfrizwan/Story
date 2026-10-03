import ImageIO
import PDFKit
import SwiftUI
import UIKit

// MARK: - Formatting

extension Int64 {
    var fileSizeString: String {
        ByteCountFormatter.string(fromByteCount: self, countStyle: .file)
    }
}

extension Date {
    var relativeString: String {
        let calendar = Calendar.current
        if calendar.isDateInToday(self) {
            let formatter = DateFormatter()
            formatter.timeStyle = .short
            formatter.dateStyle = .none
            return "Today, \(formatter.string(from: self))"
        }
        if calendar.isDateInYesterday(self) { return "Yesterday" }
        let days = calendar.dateComponents([.day], from: self, to: .now).day ?? 0
        if days < 7 {
            let formatter = DateFormatter()
            formatter.dateFormat = "EEEE"
            return formatter.string(from: self)
        }
        let formatter = DateFormatter()
        formatter.dateStyle = .medium
        formatter.timeStyle = .none
        return formatter.string(from: self)
    }

    var fullString: String {
        let formatter = DateFormatter()
        formatter.dateStyle = .long
        formatter.timeStyle = .short
        return formatter.string(from: self)
    }
}

extension String {
    var trimmed: String { trimmingCharacters(in: .whitespacesAndNewlines) }

    /// A sensible document name derived from a file name.
    var asDocumentName: String {
        let base = (self as NSString).deletingPathExtension
        let cleaned = base
            .replacingOccurrences(of: "_", with: " ")
            .replacingOccurrences(of: "-", with: " ")
            .trimmed
        return cleaned.isEmpty ? "Untitled" : cleaned
    }
}

// MARK: - Geometry

extension CGRect {
    func expanded(by amount: CGFloat) -> CGRect {
        insetBy(dx: -amount, dy: -amount)
    }

    var center: CGPoint { CGPoint(x: midX, y: midY) }
}

extension CGPoint {
    func distance(to other: CGPoint) -> CGFloat {
        hypot(other.x - x, other.y - y)
    }
}

extension UIBezierPath {
    /// Builds a smooth path through the given points using quadratic curves
    /// through midpoints. A single point becomes a dot.
    static func smoothPath(through points: [CGPoint]) -> UIBezierPath {
        let path = UIBezierPath()
        guard let first = points.first else { return path }
        path.lineCapStyle = .round
        path.lineJoinStyle = .round
        if points.count == 1 {
            path.move(to: first)
            path.addLine(to: CGPoint(x: first.x + 0.5, y: first.y + 0.5))
            return path
        }
        path.move(to: first)
        if points.count == 2 {
            path.addLine(to: points[1])
            return path
        }
        for i in 1..<(points.count - 1) {
            let current = points[i]
            let next = points[i + 1]
            let mid = CGPoint(x: (current.x + next.x) / 2, y: (current.y + next.y) / 2)
            path.addQuadCurve(to: mid, controlPoint: current)
        }
        path.addLine(to: points[points.count - 1])
        return path
    }
}

// MARK: - Images

extension UIImage {
    /// Scales the image down so its longest side is at most `maxDimension`.
    func downscaled(maxDimension: CGFloat) -> UIImage {
        let longest = max(size.width, size.height)
        guard longest > maxDimension, longest > 0 else { return self }
        let ratio = maxDimension / longest
        let newSize = CGSize(width: (size.width * ratio).rounded(), height: (size.height * ratio).rounded())
        let format = UIGraphicsImageRendererFormat.default()
        format.scale = 1
        format.opaque = false
        return UIGraphicsImageRenderer(size: newSize, format: format).image { _ in
            draw(in: CGRect(origin: .zero, size: newSize))
        }
    }

    /// Re-encodes the image as JPEG so PDF rendering embeds compressed data
    /// instead of raw bitmaps.
    func jpegBacked(quality: CGFloat = 0.82) -> UIImage {
        guard let data = jpegData(compressionQuality: quality), let image = UIImage(data: data) else {
            return self
        }
        return image
    }

    /// Renders the image with orientation baked in at scale 1.
    func normalized() -> UIImage {
        guard imageOrientation != .up || scale != 1 else { return self }
        let format = UIGraphicsImageRendererFormat.default()
        format.scale = 1
        format.opaque = false
        return UIGraphicsImageRenderer(size: size, format: format).image { _ in
            draw(in: CGRect(origin: .zero, size: size))
        }
    }

    /// Crops away fully transparent borders. Used for signatures.
    func trimmedToOpaqueBounds(padding: CGFloat = 8) -> UIImage {
        guard let cgImage = cgImage else { return self }
        let width = cgImage.width
        let height = cgImage.height
        guard width > 0, height > 0 else { return self }

        let bytesPerPixel = 4
        let bytesPerRow = bytesPerPixel * width
        var pixels = [UInt8](repeating: 0, count: height * bytesPerRow)

        var minX = width, minY = height, maxX = -1, maxY = -1
        let rendered: Bool = pixels.withUnsafeMutableBytes { buffer in
            guard let base = buffer.baseAddress,
                  let context = CGContext(
                    data: base,
                    width: width,
                    height: height,
                    bitsPerComponent: 8,
                    bytesPerRow: bytesPerRow,
                    space: CGColorSpaceCreateDeviceRGB(),
                    bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue
                  ) else { return false }
            context.draw(cgImage, in: CGRect(x: 0, y: 0, width: width, height: height))
            let bytes = base.assumingMemoryBound(to: UInt8.self)
            for y in 0..<height {
                for x in 0..<width {
                    let alpha = bytes[y * bytesPerRow + x * bytesPerPixel + 3]
                    if alpha > 8 {
                        if x < minX { minX = x }
                        if x > maxX { maxX = x }
                        if y < minY { minY = y }
                        if y > maxY { maxY = y }
                    }
                }
            }
            return true
        }
        guard rendered, maxX >= minX, maxY >= minY else { return self }
        let pad = Int(padding * scale)
        let cropRect = CGRect(
            x: max(0, minX - pad),
            y: max(0, minY - pad),
            width: min(width, maxX + pad) - max(0, minX - pad),
            height: min(height, maxY + pad) - max(0, minY - pad)
        )
        guard let cropped = cgImage.cropping(to: cropRect) else { return self }
        return UIImage(cgImage: cropped, scale: scale, orientation: .up)
    }
}

extension CGImagePropertyOrientation {
    static func from(uiOrientation orientation: UIImage.Orientation) -> CGImagePropertyOrientation {
        switch orientation {
        case .up: return .up
        case .upMirrored: return .upMirrored
        case .down: return .down
        case .downMirrored: return .downMirrored
        case .left: return .left
        case .leftMirrored: return .leftMirrored
        case .right: return .right
        case .rightMirrored: return .rightMirrored
        @unknown default: return .up
        }
    }
}

// MARK: - PDFKit

extension PDFPage {
    /// True when the page has at least some extractable text.
    var hasText: Bool {
        guard let string = string else { return false }
        return !string.trimmed.isEmpty
    }

    /// The page's display size (accounts for rotation).
    var displaySize: CGSize {
        bounds(for: .cropBox).size
    }
}

extension PDFDocument {
    var pageIndices: Range<Int> { 0..<pageCount }

    var allPages: [PDFPage] {
        pageIndices.compactMap { page(at: $0) }
    }
}

// MARK: - SwiftUI helpers

extension View {
    @ViewBuilder
    func `if`<Content: View>(_ condition: Bool, transform: (Self) -> Content) -> some View {
        if condition { transform(self) } else { self }
    }
}
