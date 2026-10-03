import PDFKit
import XCTest
@testable import Folio

@MainActor
final class EditorViewModelTests: XCTestCase {
    private var library: LibraryStore!
    private var createdIDs: [UUID] = []

    override func setUp() async throws {
        library = LibraryStore()
    }

    override func tearDown() async throws {
        for id in createdIDs { library.delete(id) }
        createdIDs = []
    }

    /// A document whose pages have distinct widths (100, 110, 120, …) so
    /// order can be asserted.
    private func makeModel(pages: Int = 3) async throws -> EditorViewModel {
        let document = PDFDocument()
        for index in 0..<pages {
            let page = try XCTUnwrap(PDFService.blankPage(size: CGSize(width: 100 + 10 * index, height: 200)))
            document.insert(page, at: index)
        }
        let record = try await library.add(document: document, name: "Test \(UUID().uuidString.prefix(6))", isScanned: false)
        createdIDs.append(record.id)
        let loaded = try XCTUnwrap(PDFDocument(url: library.fileURL(for: record.id)))
        return EditorViewModel(record: record, document: loaded, library: library)
    }

    private func widths(_ model: EditorViewModel) -> [Int] {
        model.document.allPages.map { Int($0.bounds(for: .mediaBox).width.rounded()) }
    }

    func testReorderIsUndoableAndRedoable() async throws {
        let model = try await makeModel()
        XCTAssertEqual(widths(model), [100, 110, 120])

        model.reorder(to: [2, 0, 1])
        XCTAssertEqual(widths(model), [120, 100, 110])
        XCTAssertTrue(model.canUndo)
        XCTAssertFalse(model.canRedo)

        model.undo()
        XCTAssertEqual(widths(model), [100, 110, 120])
        XCTAssertTrue(model.canRedo)

        model.redo()
        XCTAssertEqual(widths(model), [120, 100, 110])
    }

    func testDeleteRemovesPagesAndUndoRestoresThem() async throws {
        let model = try await makeModel(pages: 4)
        model.delete(pages: [0, 2])
        XCTAssertEqual(widths(model), [110, 130])
        model.undo()
        XCTAssertEqual(widths(model), [100, 110, 120, 130])
    }

    func testCannotDeleteEveryPage() async throws {
        let model = try await makeModel(pages: 2)
        model.delete(pages: [0, 1])
        XCTAssertEqual(model.pageCount, 2)
        XCTAssertFalse(model.canUndo)
        XCTAssertNotNil(model.toast)
    }

    func testRotateWrapsAndUndoes() async throws {
        let model = try await makeModel(pages: 1)
        let page = try XCTUnwrap(model.document.page(at: 0))
        model.rotate(pages: [0], by: 90)
        XCTAssertEqual(page.rotation, 90)
        model.rotate(pages: [0], by: -180)
        XCTAssertEqual(page.rotation, 270)
        model.undo()
        XCTAssertEqual(page.rotation, 90)
        model.undo()
        XCTAssertEqual(page.rotation, 0)
    }

    func testDuplicateAndBlankPageInsertAfterTarget() async throws {
        let model = try await makeModel(pages: 2)
        model.duplicate(page: 0)
        XCTAssertEqual(widths(model), [100, 100, 110])
        model.insertBlankPage(after: 2)
        XCTAssertEqual(model.pageCount, 4)
        XCTAssertEqual(widths(model).last, 110, "A blank page matches the size of the page before it")
        model.undo()
        model.undo()
        XCTAssertEqual(widths(model), [100, 110])
    }

    func testInkStrokeBecomesAnnotationAndUndoRemovesIt() async throws {
        let model = try await makeModel(pages: 1)
        let page = try XCTUnwrap(model.document.page(at: 0))
        model.mode = .markup
        model.markupTool = .pen
        model.addInkStroke(points: [CGPoint(x: 10, y: 10), CGPoint(x: 40, y: 60), CGPoint(x: 80, y: 30)], on: page)

        XCTAssertEqual(page.annotations.count, 1)
        let annotation = try XCTUnwrap(page.annotations.first)
        XCTAssertEqual(EditorViewModel.normalizedType(of: annotation), "Ink")
        XCTAssertTrue(annotation.bounds.contains(CGPoint(x: 40, y: 60)))

        model.undo()
        XCTAssertTrue(page.annotations.isEmpty)
        model.redo()
        XCTAssertEqual(page.annotations.count, 1)
    }

    func testEraseRemovesOnlyUserAnnotations() async throws {
        let model = try await makeModel(pages: 1)
        let page = try XCTUnwrap(model.document.page(at: 0))
        model.addInkStroke(points: [CGPoint(x: 20, y: 20), CGPoint(x: 60, y: 60)], on: page)
        XCTAssertTrue(model.eraseAnnotation(at: CGPoint(x: 40, y: 40), on: page))
        XCTAssertTrue(page.annotations.isEmpty)
        XCTAssertFalse(model.eraseAnnotation(at: CGPoint(x: 40, y: 40), on: page))
    }

    func testTextBoundsAnchorTopLeftAndCoverOriginal() async throws {
        let model = try await makeModel(pages: 1)
        let page = try XCTUnwrap(model.document.page(at: 0))
        let anchor = CGRect(x: 20, y: 150, width: 50, height: 12)
        let font = EditorViewModel.textFont(size: 12, bold: false)

        let plain = EditorViewModel.textBounds(for: "Hello", font: font, anchoredTo: anchor, cover: nil, page: page)
        XCTAssertEqual(plain.minX, anchor.minX, accuracy: 0.01)
        XCTAssertEqual(plain.maxY, anchor.maxY, accuracy: 0.01)
        XCTAssertLessThanOrEqual(plain.maxX, page.bounds(for: .cropBox).maxX)

        let covering = EditorViewModel.textBounds(for: "Hi", font: font, anchoredTo: anchor, cover: anchor, page: page)
        XCTAssertGreaterThanOrEqual(covering.width, anchor.width)
        XCTAssertGreaterThanOrEqual(covering.height, anchor.height)
        XCTAssertTrue(covering.contains(anchor.insetBy(dx: 0.5, dy: 0.5)))
    }

    func testFindLocatesTextAcrossPages() async throws {
        let sample = DemoSeeder.makeSampleDocument()
        let record = try await library.add(document: sample, name: "Find \(UUID().uuidString.prefix(6))", isScanned: false)
        createdIDs.append(record.id)
        let loaded = try XCTUnwrap(PDFDocument(url: library.fileURL(for: record.id)))
        let model = EditorViewModel(record: record, document: loaded, library: library)

        model.isFinding = true
        model.find("Page")
        for _ in 0..<50 where model.isSearching || model.findResults.isEmpty {
            try await Task.sleep(for: .milliseconds(50))
        }
        XCTAssertGreaterThanOrEqual(model.findResults.count, 2, "Both pages carry a 'Page x of 2' footer")
        let firstIndex = model.findIndex
        model.nextFindResult()
        XCTAssertNotEqual(model.findIndex, firstIndex)

        model.isFinding = false
        XCTAssertTrue(model.findResults.isEmpty)
        XCTAssertEqual(model.findQuery, "")
    }

    func testSampleDocumentHasTwoSearchablePages() {
        let sample = DemoSeeder.makeSampleDocument()
        XCTAssertEqual(sample.pageCount, 2)
        XCTAssertTrue(sample.page(at: 0)?.string?.contains("Welcome to Folio") ?? false)
        XCTAssertTrue(sample.page(at: 1)?.hasText ?? false)
    }
}
