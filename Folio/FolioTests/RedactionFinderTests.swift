import PDFKit
import XCTest
@testable import Folio

final class RedactionFinderTests: XCTestCase {
    /// Builds a one-page PDF with real (extractable) text.
    private func document(withText text: String) throws -> PDFDocument {
        let bounds = CGRect(origin: .zero, size: PDFService.letterSize)
        let data = UIGraphicsPDFRenderer(bounds: bounds).pdfData { context in
            context.beginPage()
            let attributes: [NSAttributedString.Key: Any] = [.font: UIFont.systemFont(ofSize: 14)]
            (text as NSString).draw(in: bounds.insetBy(dx: 60, dy: 80), withAttributes: attributes)
        }
        return try XCTUnwrap(PDFDocument(data: data))
    }

    func testLuhnAcceptsValidCardNumbers() {
        XCTAssertTrue(RedactionFinder.Luhn.isValid("4111 1111 1111 1111"))
        XCTAssertTrue(RedactionFinder.Luhn.isValid("5500-0000-0000-0004"))
    }

    func testLuhnRejectsInvalidNumbers() {
        XCTAssertFalse(RedactionFinder.Luhn.isValid("4111 1111 1111 1112"))
        XCTAssertFalse(RedactionFinder.Luhn.isValid("1234"))
        XCTAssertFalse(RedactionFinder.Luhn.isValid("2024 2025 2026 2027"))
    }

    func testFindsEmailPhoneAndCustomTerms() throws {
        let document = try document(withText: """
        Contact Jane Appleseed at jane@example.com or call (415) 555-0133.
        Card on file: 4111 1111 1111 1111. Reference SSN 123-45-6789.
        """)

        let candidates = RedactionFinder.find(in: document, customTerms: ["Appleseed"])
        let kinds = Set(candidates.map(\.kind))

        XCTAssertTrue(kinds.contains(.email), "Expected an email candidate in \(candidates)")
        XCTAssertTrue(kinds.contains(.phone), "Expected a phone candidate in \(candidates)")
        XCTAssertTrue(kinds.contains(.cardNumber), "Expected a card candidate in \(candidates)")
        XCTAssertTrue(kinds.contains(.idNumber), "Expected an ID candidate in \(candidates)")
        XCTAssertTrue(candidates.contains { $0.kind == .custom && $0.text == "Appleseed" })

        for candidate in candidates {
            XCTAssertEqual(candidate.pageIndex, 0)
            XCTAssertGreaterThan(candidate.bounds.width, 0)
            XCTAssertGreaterThan(candidate.bounds.height, 0)
            XCTAssertTrue(candidate.isSelected)
        }
    }

    func testReturnsNothingForPlainText() throws {
        let document = try document(withText: "Nothing to see here. Just a sentence about the weather in October.")
        let candidates = RedactionFinder.find(in: document, customTerms: [])
        XCTAssertTrue(candidates.isEmpty, "Unexpected candidates: \(candidates)")
    }

    func testDoesNotReportDuplicateRectangles() throws {
        let document = try document(withText: "Write to hello@folio.app today. Again: hello@folio.app")
        let candidates = RedactionFinder.find(in: document, customTerms: ["hello@folio.app"])
        let emailRects = candidates.map { "\(Int($0.bounds.minX))-\(Int($0.bounds.minY))" }
        XCTAssertEqual(emailRects.count, Set(emailRects).count, "Each on-page occurrence should appear once")
    }
}
