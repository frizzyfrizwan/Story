import XCTest

/// Drives the real app through its main screens, asserting each one appears
/// and attaching a screenshot. CI exports the attachments as PNGs.
final class ScreenshotTests: XCTestCase {
    override func setUpWithError() throws {
        continueAfterFailure = false
    }

    private func launch(_ arguments: [String]) -> XCUIApplication {
        let app = XCUIApplication()
        app.launchArguments = arguments
        app.launch()
        return app
    }

    private func snapshot(_ name: String, _ app: XCUIApplication) {
        // Let animations settle before capturing.
        RunLoop.current.run(until: Date(timeIntervalSinceNow: 1.2))
        let attachment = XCTAttachment(screenshot: app.screenshot())
        attachment.name = name
        attachment.lifetime = .keepAlways
        add(attachment)
    }

    private func element(labelled text: String, in app: XCUIApplication) -> XCUIElement {
        app.descendants(matching: .any)
            .matching(NSPredicate(format: "label CONTAINS %@", text))
            .firstMatch
    }

    func test01Library() {
        let app = launch(["-demo"])
        XCTAssertTrue(element(labelled: "Welcome to Folio", in: app).waitForExistence(timeout: 15))
        XCTAssertTrue(app.buttons["Add document"].waitForExistence(timeout: 5))
        snapshot("01-library", app)
    }

    func test02Editor() {
        let app = launch(["-demo-open"])
        XCTAssertTrue(app.buttons["Read"].waitForExistence(timeout: 15))
        XCTAssertTrue(app.buttons["Pages"].exists)
        XCTAssertTrue(app.buttons["Find in document"].exists)
        snapshot("02-editor", app)
    }

    func test03MarkMode() {
        let app = launch(["-demo-open"])
        XCTAssertTrue(app.buttons["Mark"].waitForExistence(timeout: 15))
        app.buttons["Mark"].tap()
        XCTAssertTrue(app.buttons["Pen"].waitForExistence(timeout: 5))
        XCTAssertTrue(app.buttons["Highlighter"].exists)
        XCTAssertTrue(app.buttons["Eraser"].exists)
        snapshot("03-mark", app)
    }

    func test04TextMode() {
        let app = launch(["-demo-open"])
        XCTAssertTrue(app.buttons["Text"].waitForExistence(timeout: 15))
        app.buttons["Text"].tap()
        XCTAssertTrue(app.staticTexts["Tap a line to retype it · Tap empty space to add text"].waitForExistence(timeout: 5))
        snapshot("04-text", app)
    }

    func test05PagesBoard() {
        let app = launch(["-demo-open"])
        XCTAssertTrue(app.buttons["Pages"].waitForExistence(timeout: 15))
        app.buttons["Pages"].tap()
        XCTAssertTrue(app.navigationBars["Pages"].waitForExistence(timeout: 5))
        XCTAssertTrue(app.buttons["Add pages"].waitForExistence(timeout: 5))
        snapshot("05-pages", app)
    }

    func test06Find() {
        let app = launch(["-demo-open"])
        XCTAssertTrue(app.buttons["Find in document"].waitForExistence(timeout: 15))
        app.buttons["Find in document"].tap()
        let field = app.textFields["Find in document"]
        XCTAssertTrue(field.waitForExistence(timeout: 5))
        field.typeText("Folio")
        let count = app.staticTexts.matching(NSPredicate(format: "label BEGINSWITH '1 of '")).firstMatch
        XCTAssertTrue(count.waitForExistence(timeout: 10), "Expected a match counter after searching")
        snapshot("06-find", app)
    }

    func test07SmartRedact() {
        let app = launch(["-demo-open", "redact"])
        XCTAssertTrue(app.navigationBars["Smart Redact"].waitForExistence(timeout: 15))
        XCTAssertTrue(element(labelled: "jane@example.com", in: app).waitForExistence(timeout: 20))
        snapshot("07-redact", app)
    }

    func test08Settings() {
        let app = launch(["-demo"])
        XCTAssertTrue(app.buttons["Settings"].waitForExistence(timeout: 15))
        app.buttons["Settings"].tap()
        XCTAssertTrue(app.navigationBars["Settings"].waitForExistence(timeout: 5))
        snapshot("08-settings", app)
    }
}
