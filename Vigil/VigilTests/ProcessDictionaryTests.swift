import XCTest
@testable import Vigil

final class ProcessDictionaryTests: XCTestCase {
    func testKernelTaskIsExplainedAsThermalThrottling() {
        let explanation = ProcessDictionary.explanation(for: "kernel_task")
        XCTAssertEqual(explanation.verdict, .investigate)
        XCTAssertEqual(explanation.title, "kernel_task")
        XCTAssertTrue(explanation.summary.lowercased().contains("hot"), "Summary should mention heat: \(explanation.summary)")
        XCTAssertEqual(explanation.category, "Core")
    }

    func testLookupIsCaseInsensitive() {
        let mixed = ProcessDictionary.explanation(for: "WindowServer")
        let lower = ProcessDictionary.explanation(for: "windowserver")
        let upper = ProcessDictionary.explanation(for: "WINDOWSERVER")
        XCTAssertEqual(mixed.title, "WindowServer")
        XCTAssertEqual(mixed, lower)
        XCTAssertEqual(mixed, upper)
        XCTAssertEqual(mixed.verdict, .investigate)
    }

    func testChromeRendererResolvesToTabEntry() {
        let exact = ProcessDictionary.explanation(for: "Google Chrome Helper (Renderer)")
        XCTAssertEqual(exact.title, "Chrome tab")
        XCTAssertEqual(exact.verdict, .safeToQuit)
        XCTAssertEqual(exact.category, "Browser")

        // Longer names fall back to the longest matching prefix.
        let suffixed = ProcessDictionary.explanation(for: "Google Chrome Helper (Renderer) --type=renderer")
        XCTAssertEqual(suffixed.title, "Chrome tab")

        let gpu = ProcessDictionary.explanation(for: "Google Chrome Helper (GPU)")
        XCTAssertEqual(gpu.title, "Chrome GPU")

        let plain = ProcessDictionary.explanation(for: "Google Chrome Helper (Plugin)")
        XCTAssertEqual(plain.title, "Chrome Helper")
    }

    func testPrefixMatchesForOtherBrowsers() {
        XCTAssertEqual(ProcessDictionary.explanation(for: "Arc Helper (Renderer)").title, "Arc")
        XCTAssertEqual(ProcessDictionary.explanation(for: "FirefoxCP Web Content").title, "Firefox")
        XCTAssertEqual(ProcessDictionary.explanation(for: "Code Helper (Plugin)").title, "VS Code extensions")
        XCTAssertEqual(ProcessDictionary.explanation(for: "mdworker_shared").title, "mdworker_shared")
        XCTAssertEqual(ProcessDictionary.explanation(for: "swift-driver").title, "swift-frontend")
    }

    func testUnknownApplicationIsSafeToQuit() {
        let explanation = ProcessDictionary.explanation(for: "My Unknown App", bundleIdentifier: "com.example.unknown", isApplication: true)
        XCTAssertEqual(explanation.verdict, .safeToQuit)
        XCTAssertEqual(explanation.title, "My Unknown App")
        XCTAssertEqual(explanation.category, "App")
        XCTAssertFalse(explanation.summary.isEmpty)
    }

    func testUnknownDaemonIsFlaggedForInvestigation() {
        let explanation = ProcessDictionary.explanation(for: "foobard")
        XCTAssertEqual(explanation.verdict, .investigate)
        XCTAssertEqual(explanation.title, "foobard")
        XCTAssertEqual(explanation.category, "Background")
        XCTAssertTrue(explanation.summary.lowercased().contains("daemon"))
    }

    func testUnknownHelperIsFlaggedForInvestigation() {
        let explanation = ProcessDictionary.explanation(for: "SomeHelper")
        XCTAssertEqual(explanation.verdict, .investigate)
        XCTAssertEqual(explanation.category, "Background")
    }

    func testWebKitBundleIdentifierResolvesToSafariWebContent() {
        let explanation = ProcessDictionary.explanation(for: "WebKit Content", bundleIdentifier: "com.apple.WebKit.WebContent", isApplication: false)
        XCTAssertEqual(explanation.title, "Safari web content")
        XCTAssertEqual(explanation.verdict, .safeToQuit)
        XCTAssertEqual(explanation.category, "Browser")

        let byName = ProcessDictionary.explanation(for: "com.apple.WebKit.WebContent")
        XCTAssertEqual(byName, explanation)
    }

    func testAppleBundleIdentifierIsTreatedAsSystem() {
        let explanation = ProcessDictionary.explanation(for: "SomeAppleThing", bundleIdentifier: "com.apple.SomeAppleThing", isApplication: false)
        XCTAssertEqual(explanation.verdict, .system)
        XCTAssertEqual(explanation.category, "macOS")
        XCTAssertEqual(explanation.title, "SomeAppleThing")
    }

    func testKnownNameWinsOverBundleIdentifier() {
        let explanation = ProcessDictionary.explanation(for: "Finder", bundleIdentifier: "com.apple.finder", isApplication: true)
        XCTAssertEqual(explanation.title, "Finder")
        XCTAssertEqual(explanation.verdict, .safeToQuit)
    }

    func testEveryEntryHasTitleAndSummary() {
        XCTAssertGreaterThan(ProcessDictionary.entries.count, 100)
        for (key, entry) in ProcessDictionary.entries {
            XCTAssertFalse(key.isEmpty)
            XCTAssertEqual(key, key.lowercased(), "Dictionary keys must be lowercased: \(key)")
            XCTAssertFalse(entry.title.isEmpty, "Entry \(key) has no title")
            XCTAssertFalse(entry.summary.isEmpty, "Entry \(key) has no summary")
            XCTAssertFalse(entry.category.isEmpty, "Entry \(key) has no category")
        }
    }

    func testVigilKnowsItself() {
        let explanation = ProcessDictionary.explanation(for: "Vigil")
        XCTAssertEqual(explanation.verdict, .safeToQuit)
        XCTAssertTrue(explanation.summary.contains("this app"))
    }
}
