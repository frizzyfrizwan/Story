import PDFKit
import UIKit

/// Seeds a sample document when the app is launched with `-demo` (library)
/// or `-demo-open` (library + editor). Used by CI screenshots and for App
/// Store captures; it never runs for real users.
enum DemoSeeder {
    static var isRequested: Bool {
        CommandLine.arguments.contains("-demo") || CommandLine.arguments.contains("-demo-open")
    }

    private static var shouldOpenEditor: Bool {
        CommandLine.arguments.contains("-demo-open")
    }

    @MainActor
    static func seedIfRequested(library: LibraryStore, settings: AppSettings, router: Router) async {
        guard isRequested else { return }
        settings.hasSeenWelcome = true
        let record: DocumentRecord?
        if let existing = library.documents.first(where: { $0.name == "Welcome to Folio" }) {
            record = existing
        } else {
            record = try? await library.add(document: makeSampleDocument(), name: "Welcome to Folio", isScanned: false)
        }
        if shouldOpenEditor, let record {
            router.openEditor(record.id)
        }
    }

    static func makeSampleDocument() -> PDFDocument {
        let bounds = CGRect(origin: .zero, size: PDFService.letterSize)
        let data = UIGraphicsPDFRenderer(bounds: bounds).pdfData { context in
            let title: [NSAttributedString.Key: Any] = [
                .font: UIFont.systemFont(ofSize: 30, weight: .bold),
                .foregroundColor: UIColor.black,
            ]
            let body: [NSAttributedString.Key: Any] = [
                .font: UIFont.systemFont(ofSize: 13),
                .foregroundColor: UIColor.darkGray,
            ]
            let heading: [NSAttributedString.Key: Any] = [
                .font: UIFont.systemFont(ofSize: 17, weight: .semibold),
                .foregroundColor: UIColor.black,
            ]

            context.beginPage()
            ("Welcome to Folio" as NSString).draw(at: CGPoint(x: 64, y: 72), withAttributes: title)
            ("The PDF editor that gets out of your way." as NSString)
                .draw(at: CGPoint(x: 64, y: 112), withAttributes: body)

            var y: CGFloat = 160
            for (head, text) in sections {
                (head as NSString).draw(at: CGPoint(x: 64, y: y), withAttributes: heading)
                y += 26
                (text as NSString).draw(
                    in: CGRect(x: 64, y: y, width: bounds.width - 128, height: 80),
                    withAttributes: body
                )
                y += 72
            }
            ("Contact: jane@example.com · (415) 555-0133" as NSString)
                .draw(at: CGPoint(x: 64, y: bounds.height - 96), withAttributes: body)
            ("Page 1 of 2" as NSString)
                .draw(at: CGPoint(x: bounds.width - 140, y: bounds.height - 60), withAttributes: body)

            context.beginPage()
            ("Signature page" as NSString).draw(at: CGPoint(x: 64, y: 72), withAttributes: title)
            ("Tap Sign in the dock, pick a signature, drag it onto the line below and tap Place." as NSString)
                .draw(in: CGRect(x: 64, y: 116, width: bounds.width - 128, height: 60), withAttributes: body)
            let line = UIBezierPath()
            line.move(to: CGPoint(x: 64, y: 360))
            line.addLine(to: CGPoint(x: 360, y: 360))
            UIColor.gray.setStroke()
            line.lineWidth = 1
            line.stroke()
            ("Signed" as NSString).draw(at: CGPoint(x: 64, y: 368), withAttributes: body)
            ("Page 2 of 2" as NSString)
                .draw(at: CGPoint(x: bounds.width - 140, y: bounds.height - 60), withAttributes: body)
        }
        return PDFDocument(data: data) ?? PDFService.blankDocument()
    }

    private static let sections: [(String, String)] = [
        ("Tap any line to retype it",
         "Switch to Text mode and tap this sentence. Folio measures the line, matches the size and paints a clean patch so you can type over it."),
        ("Mark it up",
         "Mark mode gives you a pen, a highlighter and an eraser. One finger draws, two fingers scroll, or use Apple Pencil only."),
        ("Smart Redact",
         "Folio finds emails, phone numbers, card numbers and names, then removes them for good. Try it on the contact line at the bottom of this page."),
        ("Nothing is lost",
         "Your original file is kept the first time you edit, every change can be undone, and nothing ever leaves this device."),
    ]
}
