import XCTest

/// Walks every dashboard section and attaches a screenshot of each. Missing elements never fail the test;
/// only a failure to launch does.
final class ScreenshotTests: XCTestCase {
    private let sections: [String] = [
        "sidebar.overview", "sidebar.health", "sidebar.activity", "sidebar.cpu", "sidebar.memory", "sidebar.storage",
        "sidebar.network", "sidebar.power", "sidebar.sensors", "sidebar.history", "sidebar.startup", "sidebar.toolbox",
        "sidebar.tweaks", "sidebar.system",
    ]

    override func setUpWithError() throws {
        try super.setUpWithError()
        continueAfterFailure = true
    }

    func testCaptureEverySection() throws {
        let app = XCUIApplication()
        app.launchArguments = ["-dashboard", "-uitesting"]

        // Dismiss any system permission dialog (notifications, automation) that appears mid-run.
        _ = addUIInterruptionMonitor(withDescription: "System dialog") { alert in
            for label in ["Allow", "OK", "Don't Allow", "Not Now"] {
                let button = alert.buttons[label]
                if button.exists {
                    button.click()
                    return true
                }
            }
            return false
        }

        app.launch()
        XCTAssertTrue(app.wait(for: .runningForeground, timeout: 30), "Vigil did not reach the foreground")

        dismissOnboardingIfPresent(in: app)
        // Give the dashboard window a moment to appear and settle.
        _ = app.windows.firstMatch.waitForExistence(timeout: 10)
        Thread.sleep(forTimeInterval: 1.5)

        for (index, identifier) in sections.enumerated() {
            let name = identifier.replacingOccurrences(of: "sidebar.", with: "")
            let fileName = String(format: "%02d", index + 1) + "-" + name + ".png"
            let element = app.descendants(matching: .any).matching(identifier: identifier).firstMatch
            guard element.waitForExistence(timeout: 2) else {
                continue
            }
            click(element)
            Thread.sleep(forTimeInterval: 1.5)
            attachScreenshot(of: app, named: fileName)
        }

        attachScreenshot(of: app, named: "99-final.png")
    }

    // MARK: - Helpers

    private func dismissOnboardingIfPresent(in app: XCUIApplication) {
        let onboarding = app.descendants(matching: .any).matching(identifier: "onboarding").firstMatch
        guard onboarding.waitForExistence(timeout: 5) else { return }
        for _ in 0..<2 {
            let next = app.buttons["Continue"].firstMatch
            if next.waitForExistence(timeout: 3) {
                click(next)
                Thread.sleep(forTimeInterval: 0.5)
            }
        }
        let start = app.buttons["Start using Vigil"].firstMatch
        if start.waitForExistence(timeout: 3) {
            click(start)
            Thread.sleep(forTimeInterval: 1)
        }
        // Tapping into the app lets any interruption monitor fire for dialogs raised by onboarding.
        app.activate()
    }

    /// Clicks an element without failing the test when it is not hittable.
    private func click(_ element: XCUIElement) {
        guard element.exists else { return }
        if element.isHittable {
            element.click()
        } else {
            element.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.5)).click()
        }
    }

    private func attachScreenshot(of app: XCUIApplication, named name: String) {
        let attachment = XCTAttachment(screenshot: app.screenshot())
        attachment.name = name
        attachment.lifetime = .keepAlways
        add(attachment)
    }
}
