import PDFKit
import XCTest
@testable import Folio

final class PDFServiceTests: XCTestCase {
    private func sampleImage(size: CGSize = CGSize(width: 600, height: 800)) -> UIImage {
        let format = UIGraphicsImageRendererFormat.default()
        format.scale = 1
        return UIGraphicsImageRenderer(size: size, format: format).image { context in
            UIColor.white.setFill()
            context.fill(CGRect(origin: .zero, size: size))
            UIColor.black.setFill()
            context.fill(CGRect(x: 60, y: 160, width: 300, height: 40))
        }
    }

    func testImagePageCarriesInvisibleTextLayer() throws {
        let lines = [
            RecognizedLine(text: "Hello Folio", box: CGRect(x: 0.1, y: 0.75, width: 0.5, height: 0.05)),
            RecognizedLine(text: "Second line", box: CGRect(x: 0.1, y: 0.65, width: 0.4, height: 0.05)),
        ]
        let page = try XCTUnwrap(PDFService.imagePage(sampleImage(), size: PDFService.letterSize, lines: lines))
        let text = try XCTUnwrap(page.string)
        XCTAssertTrue(text.contains("Hello Folio"), "Expected the OCR text layer to be extractable, got: \(text)")
        XCTAssertTrue(text.contains("Second line"))
        XCTAssertTrue(page.hasText)
    }

    func testImagePageWithoutLinesHasNoText() throws {
        let page = try XCTUnwrap(PDFService.imagePage(sampleImage(), size: PDFService.letterSize, lines: nil))
        XCTAssertFalse(page.hasText)
    }

    func testMakeDocumentCreatesOnePagePerImage() throws {
        let images = [sampleImage(), sampleImage(size: CGSize(width: 800, height: 600)), sampleImage()]
        let document = try XCTUnwrap(PDFService.makeDocument(from: images, pageSize: .auto, textLayers: [nil, nil, nil]))
        XCTAssertEqual(document.pageCount, 3)

        let landscape = try XCTUnwrap(document.page(at: 1))
        let size = landscape.bounds(for: .mediaBox).size
        XCTAssertGreaterThan(size.width, size.height, "Auto page size should follow the image's orientation")
    }

    func testAutoPageSizeMatchesImageAspect() {
        let image = sampleImage(size: CGSize(width: 1000, height: 1500))
        let size = PDFService.pageSize(for: image, preference: .auto)
        XCTAssertEqual(size.width, PDFService.letterSize.width, accuracy: 0.01)
        XCTAssertEqual(size.height / size.width, 1.5, accuracy: 0.01)
    }

    func testFlattenPreservesPageSize() throws {
        let page = try XCTUnwrap(PDFService.blankPage(size: PDFService.a4Size))
        let annotation = PDFAnnotation(bounds: CGRect(x: 50, y: 50, width: 100, height: 20), forType: .square, withProperties: nil)
        annotation.color = .red
        page.addAnnotation(annotation)

        let flattened = try XCTUnwrap(PDFService.flatten(page: page))
        XCTAssertEqual(flattened.bounds(for: .mediaBox).width, PDFService.a4Size.width, accuracy: 0.5)
        XCTAssertEqual(flattened.bounds(for: .mediaBox).height, PDFService.a4Size.height, accuracy: 0.5)
        XCTAssertTrue(flattened.annotations.isEmpty, "Flattening should burn annotations into the page content")
    }

    func testExtractCopiesSelectedPagesInOrder() throws {
        let document = PDFDocument()
        for size in [CGSize(width: 100, height: 200), CGSize(width: 200, height: 300), CGSize(width: 300, height: 400)] {
            document.insert(try XCTUnwrap(PDFService.blankPage(size: size)), at: document.pageCount)
        }
        let extracted = PDFService.extract(pages: [2, 0], from: document)
        XCTAssertEqual(extracted.pageCount, 2)
        XCTAssertEqual(extracted.page(at: 0)?.bounds(for: .mediaBox).width ?? 0, 300, accuracy: 0.5)
        XCTAssertEqual(extracted.page(at: 1)?.bounds(for: .mediaBox).width ?? 0, 100, accuracy: 0.5)
        XCTAssertEqual(document.pageCount, 3, "Extracting must not modify the source document")
    }

    func testPageWithTextLayerKeepsSizeAndAddsText() throws {
        let page = try XCTUnwrap(PDFService.blankPage(size: PDFService.letterSize))
        let lines = [RecognizedLine(text: "Invoice 42", box: CGRect(x: 0.2, y: 0.8, width: 0.3, height: 0.04))]
        let result = try XCTUnwrap(PDFService.pageWithTextLayer(page: page, lines: lines))
        XCTAssertEqual(result.bounds(for: .mediaBox).size.width, PDFService.letterSize.width, accuracy: 0.5)
        XCTAssertTrue(result.string?.contains("Invoice 42") ?? false)
    }

    func testRenderProducesBitmapOfPageSize() throws {
        let page = try XCTUnwrap(PDFService.blankPage(size: CGSize(width: 300, height: 400)))
        let image = PDFService.render(page: page, scale: 2)
        XCTAssertEqual(image.size.width, 300, accuracy: 0.5)
        XCTAssertEqual(image.size.height, 400, accuracy: 0.5)
        XCTAssertEqual(image.cgImage?.width, 600)
    }
}
