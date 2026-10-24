import XCTest
@testable import Dossier

final class DossierTests: XCTestCase {
    func testBundledEngineIsPresentAndComplete() throws {
        let url = try XCTUnwrap(Bundle.main.url(forResource: "dossier", withExtension: "html"), "dossier.html must be bundled; run node bin/build-site.js")
        let html = try String(contentsOf: url, encoding: .utf8)
        XCTAssertTrue(html.contains("window.DOSSIER_SAMPLE"), "sample facts are embedded")
        XCTAssertTrue(html.contains("window.DOSSIER_CANDIDATES"), "candidate pool is embedded")
        XCTAssertTrue(html.contains("window.dossierNative"), "native bridge is present")
        XCTAssertTrue(html.contains("$${"), "dollar template literals survived the build (a string replacer once ate them)")
    }

    func testSavedReportsRoundTrip() throws {
        let dir = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString, isDirectory: true)
        let store = SavedReportsStore(directory: dir)
        XCTAssertTrue(store.reports.isEmpty)
        let report = SavedReport(id: "a", title: "3204 Colony Club Rd Apt 6", price: "$299,900", stance: "Conditional", summary: "Test", factsJSON: "{}", savedAt: Date())
        store.upsert(report)
        store.upsert(report)
        XCTAssertEqual(store.reports.count, 1, "upsert replaces by id")
        let reloaded = SavedReportsStore(directory: dir)
        XCTAssertEqual(reloaded.reports.first?.title, report.title)
        reloaded.remove(report)
        XCTAssertTrue(reloaded.reports.isEmpty)
        XCTAssertTrue(report.shareText.contains("Asking $299,900"))
    }
}
