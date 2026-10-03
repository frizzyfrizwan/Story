import PDFKit
import SwiftUI

/// The editor shows exactly one mode at a time. Tools for the mode live in a
/// strip above the dock; everything else stays out of the way.
enum EditorMode: String, CaseIterable, Identifiable {
    case read, markup, text, sign

    var id: String { rawValue }

    var title: String {
        switch self {
        case .read: return "Read"
        case .markup: return "Mark"
        case .text: return "Text"
        case .sign: return "Sign"
        }
    }

    var symbol: String {
        switch self {
        case .read: return "book"
        case .markup: return "pencil.tip"
        case .text: return "textformat"
        case .sign: return "signature"
        }
    }

    var hint: String {
        switch self {
        case .read: return "Scroll, pinch to zoom, long-press to select text."
        case .markup: return "Draw with one finger. Scroll with two."
        case .text: return "Tap any line of text to retype it, or tap empty space to add text."
        case .sign: return "Drag your signature into place, pinch to resize, then tap Place."
        }
    }
}

enum MarkupTool: String, CaseIterable, Identifiable {
    case pen, highlighter, eraser

    var id: String { rawValue }

    var title: String {
        switch self {
        case .pen: return "Pen"
        case .highlighter: return "Highlighter"
        case .eraser: return "Eraser"
        }
    }

    var symbol: String {
        switch self {
        case .pen: return "pencil.tip"
        case .highlighter: return "highlighter"
        case .eraser: return "eraser"
        }
    }
}

struct InkColor: Identifiable, Hashable {
    let id: String
    let name: String
    let uiColor: UIColor

    var color: Color { Color(uiColor: uiColor) }

    static let pens: [InkColor] = [
        InkColor(id: "ink", name: "Ink", uiColor: UIColor(red: 0.10, green: 0.10, blue: 0.12, alpha: 1)),
        InkColor(id: "blue", name: "Blue", uiColor: UIColor(red: 0.15, green: 0.39, blue: 0.92, alpha: 1)),
        InkColor(id: "red", name: "Red", uiColor: UIColor(red: 0.86, green: 0.15, blue: 0.15, alpha: 1)),
        InkColor(id: "green", name: "Green", uiColor: UIColor(red: 0.09, green: 0.64, blue: 0.29, alpha: 1)),
        InkColor(id: "orange", name: "Orange", uiColor: UIColor(red: 0.96, green: 0.55, blue: 0.05, alpha: 1)),
        InkColor(id: "purple", name: "Purple", uiColor: UIColor(red: 0.49, green: 0.23, blue: 0.93, alpha: 1)),
    ]

    static let highlighters: [InkColor] = [
        InkColor(id: "hl-yellow", name: "Yellow", uiColor: UIColor(red: 1.0, green: 0.88, blue: 0.0, alpha: 0.40)),
        InkColor(id: "hl-green", name: "Green", uiColor: UIColor(red: 0.30, green: 0.90, blue: 0.40, alpha: 0.40)),
        InkColor(id: "hl-pink", name: "Pink", uiColor: UIColor(red: 1.0, green: 0.40, blue: 0.70, alpha: 0.40)),
        InkColor(id: "hl-blue", name: "Blue", uiColor: UIColor(red: 0.30, green: 0.65, blue: 1.0, alpha: 0.40)),
    ]
}

/// An in-progress text edit. Created when the user taps a line of text (or
/// empty space) in Text mode and resolved by the Text Patch sheet.
struct TextEditSession: Identifiable {
    let id = UUID()
    let page: PDFPage
    let pageIndex: Int
    /// Page-space rectangle of the original line (or the tap location).
    var bounds: CGRect
    var text: String
    var fontSize: CGFloat
    /// Whether a white patch should be painted under the new text.
    var coversOriginal: Bool
    var color: UIColor
    var isBold: Bool
    /// An existing free text annotation being edited, if any.
    var existing: PDFAnnotation?

    var isNew: Bool { existing == nil }
}

/// A signature the user is positioning over the page. Coordinates are in the
/// PDF view's coordinate space (points) so SwiftUI can draw the overlay.
struct PlacedSignature: Identifiable {
    let id = UUID()
    let image: UIImage
    var center: CGPoint
    var width: CGFloat

    var aspect: CGFloat {
        guard image.size.width > 0 else { return 0.4 }
        return image.size.height / image.size.width
    }

    func frame(scale: CGFloat = 1, offset: CGSize = .zero) -> CGRect {
        let w = max(40, width * scale)
        let h = w * aspect
        return CGRect(
            x: center.x + offset.width - w / 2,
            y: center.y + offset.height - h / 2,
            width: w,
            height: h
        )
    }
}

enum EditorSheet: String, Identifiable {
    case pages
    case signaturePicker
    case smartRedact
    case info

    var id: String { rawValue }
}

struct Toast: Identifiable, Equatable {
    enum Style { case info, success, error }

    let id = UUID()
    let message: String
    let style: Style

    static func info(_ message: String) -> Toast { Toast(message: message, style: .info) }
    static func success(_ message: String) -> Toast { Toast(message: message, style: .success) }
    static func error(_ message: String) -> Toast { Toast(message: message, style: .error) }
}

/// A reversible edit. The editor keeps its own stack so undo works across
/// annotations and page operations alike.
struct EditAction {
    let name: String
    let undo: () -> Void
    let redo: () -> Void
}

/// Something to hand to the share sheet.
struct ShareItem: Identifiable {
    let id = UUID()
    let url: URL
    let title: String
}
