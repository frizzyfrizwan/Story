import XCTest

/// Drives the app through its screens and attaches screenshots; CI exports them as PNGs for the App Store listing.
final class ScreenshotTests: XCTestCase {
    override func setUpWithError() throws {
        continueAfterFailure = false
    }

    private func snapshot(_ name: String, _ app: XCUIApplication) {
        RunLoop.current.run(until: Date(timeIntervalSinceNow: 1.5))
        let attachment = XCTAttachment(screenshot: app.screenshot())
        attachment.name = name
        attachment.lifetime = .keepAlways
        add(attachment)
    }

    func test01Report() {
        let app = XCUIApplication()
        app.launch()
        XCTAssertTrue(app.navigationBars["Dossier"].waitForExistence(timeout: 20))
        // The bundled page renders the researched sample on load.
        XCTAssertTrue(app.webViews.staticTexts.matching(NSPredicate(format: "label CONTAINS 'Colony Club'")).firstMatch.waitForExistence(timeout: 30))
        snapshot("01-report", app)
    }

    func test02FindDeals() {
        let app = XCUIApplication()
        app.launch()
        XCTAssertTrue(app.buttons["findDeals"].waitForExistence(timeout: 20))
        app.buttons["findDeals"].tap()
        XCTAssertTrue(app.webViews.staticTexts.matching(NSPredicate(format: "label CONTAINS 'Find deals for you'")).firstMatch.waitForExistence(timeout: 15))
        snapshot("02-find-deals", app)
    }

    func test03Saved() {
        let app = XCUIApplication()
        app.launch()
        XCTAssertTrue(app.tabBars.buttons["Saved"].waitForExistence(timeout: 20))
        app.tabBars.buttons["Saved"].tap()
        snapshot("03-saved", app)
    }

    func test04About() {
        let app = XCUIApplication()
        app.launch()
        XCTAssertTrue(app.tabBars.buttons["About"].waitForExistence(timeout: 20))
        app.tabBars.buttons["About"].tap()
        XCTAssertTrue(app.staticTexts["Honesty"].waitForExistence(timeout: 5))
        snapshot("04-about", app)
    }
}
