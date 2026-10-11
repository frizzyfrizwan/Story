import XCTest
import CryptoKit
@testable import Vigil

final class LicenseTests: XCTestCase {
    private var privateKey = Curve25519.Signing.PrivateKey()
    private var issuer: LicenseIssuer { LicenseIssuer(privateKey: privateKey) }
    private var verifier: LicenseVerifier { LicenseVerifier(publicKey: privateKey.publicKey) }

    private var defaults: UserDefaults!
    private let suiteName = "com.faisalrizwan.vigil.tests.license"
    private var temporaryDirectory: URL!
    private var trialURL: URL!

    override func setUpWithError() throws {
        try super.setUpWithError()
        privateKey = Curve25519.Signing.PrivateKey()
        defaults = try XCTUnwrap(UserDefaults(suiteName: suiteName))
        defaults.removePersistentDomain(forName: suiteName)
        temporaryDirectory = FileManager.default.temporaryDirectory.appendingPathComponent("VigilLicenseTests-\(UUID().uuidString)", isDirectory: true)
        try FileManager.default.createDirectory(at: temporaryDirectory, withIntermediateDirectories: true)
        trialURL = temporaryDirectory.appendingPathComponent(".trial")
    }

    override func tearDownWithError() throws {
        defaults?.removePersistentDomain(forName: suiteName)
        if let temporaryDirectory {
            try? FileManager.default.removeItem(at: temporaryDirectory)
        }
        try super.tearDownWithError()
    }

    private func lifetimePayload(email: String = "someone@example.com") -> LicensePayload {
        LicensePayload(email: email, plan: "lifetime", issued: Int(Date().timeIntervalSince1970), expires: nil, seats: 1)
    }

    private func licenseError(from error: Error) -> LicenseError? {
        error as? LicenseError
    }

    // MARK: - Verifier

    func testLifetimePayloadRoundTrips() throws {
        let payload = lifetimePayload(email: "alice@example.com")
        let key = try issuer.issue(payload)
        XCTAssertTrue(key.hasPrefix("VIGIL-"))
        let verified = try verifier.verify(key)
        XCTAssertEqual(verified, payload)
        XCTAssertEqual(verified.email, "alice@example.com")
        XCTAssertEqual(verified.plan, "lifetime")
        XCTAssertTrue(verified.isLifetime)
        XCTAssertNil(verified.expiryDate)
    }

    func testVerifierAcceptsSurroundingWhitespace() throws {
        let key = try issuer.issue(lifetimePayload())
        let verified = try verifier.verify("  \n" + key + "\n ")
        XCTAssertEqual(verified.plan, "lifetime")
    }

    func testKeySignedByAnotherPrivateKeyIsRejected() throws {
        let otherIssuer = LicenseIssuer(privateKey: Curve25519.Signing.PrivateKey())
        let key = try otherIssuer.issue(lifetimePayload())
        XCTAssertThrowsError(try verifier.verify(key)) { error in
            XCTAssertEqual(self.licenseError(from: error), .badSignature)
        }
    }

    func testTamperedSignatureIsRejected() throws {
        let key = try issuer.issue(lifetimePayload())
        let tail = String(key.suffix(8))
        let replacement = tail == "AAAAAAAA" ? "BBBBBBBB" : "AAAAAAAA"
        let tampered = String(key.dropLast(8)) + replacement
        XCTAssertNotEqual(tampered, key)
        XCTAssertThrowsError(try verifier.verify(tampered)) { error in
            guard let licenseError = self.licenseError(from: error) else {
                XCTFail("Expected a LicenseError, got \(error)")
                return
            }
            switch licenseError {
            case .badSignature, .malformed: break
            case .expired: XCTFail("A tampered signature must not be reported as expired")
            }
        }
    }

    func testTamperedPayloadIsRejected() throws {
        let key = try issuer.issue(lifetimePayload(email: "alice@example.com"))
        let forged = try issuer.issue(lifetimePayload(email: "bob@example.com"))
        // Splice the forged payload onto the original signature.
        let originalParts = key.dropFirst("VIGIL-".count).split(separator: ".", maxSplits: 1).map(String.init)
        let forgedParts = forged.dropFirst("VIGIL-".count).split(separator: ".", maxSplits: 1).map(String.init)
        XCTAssertEqual(originalParts.count, 2)
        XCTAssertEqual(forgedParts.count, 2)
        let spliced = "VIGIL-" + forgedParts[0] + "." + originalParts[1]
        XCTAssertThrowsError(try verifier.verify(spliced)) { error in
            XCTAssertEqual(self.licenseError(from: error), .badSignature)
        }
    }

    func testExpiredPayloadIsRejected() throws {
        let expiry = Int(Date().timeIntervalSince1970) - 3600
        let payload = LicensePayload(email: "old@example.com", plan: "pro", issued: expiry - 86_400, expires: expiry, seats: 1)
        let key = try issuer.issue(payload)
        XCTAssertThrowsError(try verifier.verify(key)) { error in
            guard let licenseError = self.licenseError(from: error) else {
                XCTFail("Expected a LicenseError, got \(error)")
                return
            }
            if case .expired(let date) = licenseError {
                XCTAssertEqual(Int(date.timeIntervalSince1970), expiry)
            } else {
                XCTFail("Expected .expired, got \(licenseError)")
            }
        }
    }

    func testNotYetExpiredSubscriptionIsAccepted() throws {
        let expiry = Int(Date().timeIntervalSince1970) + 86_400
        let payload = LicensePayload(email: "sub@example.com", plan: "pro", issued: expiry - 86_400 * 30, expires: expiry, seats: 2)
        let key = try issuer.issue(payload)
        let verified = try verifier.verify(key)
        XCTAssertEqual(verified.seats, 2)
        XCTAssertFalse(verified.isLifetime)
        // The same key is rejected once the clock moves past the expiry.
        XCTAssertThrowsError(try verifier.verify(key, now: Date(timeIntervalSince1970: TimeInterval(expiry + 1))))
    }

    func testStringWithoutPrefixIsMalformed() {
        XCTAssertThrowsError(try verifier.verify("not-a-key")) { error in
            XCTAssertEqual(self.licenseError(from: error), .malformed)
        }
        XCTAssertThrowsError(try verifier.verify("")) { error in
            XCTAssertEqual(self.licenseError(from: error), .malformed)
        }
    }

    func testPrefixWithoutSignaturePartIsMalformed() {
        XCTAssertThrowsError(try verifier.verify("VIGIL-abcdef")) { error in
            XCTAssertEqual(self.licenseError(from: error), .malformed)
        }
        XCTAssertThrowsError(try verifier.verify("VIGIL-abcdef.short")) { error in
            XCTAssertEqual(self.licenseError(from: error), .malformed)
        }
    }

    // MARK: - Encoding helpers

    func testBase64URLRoundTripsArbitraryLengths() throws {
        for length in 0...40 {
            let bytes = (0..<length).map { UInt8(truncatingIfNeeded: $0 &* 37 &+ 251) }
            let data = Data(bytes)
            let encoded = data.base64URLEncoded
            XCTAssertFalse(encoded.contains("="), "No padding expected for length \(length)")
            XCTAssertFalse(encoded.contains("+"))
            XCTAssertFalse(encoded.contains("/"))
            let decoded = try XCTUnwrap(Data(base64URL: encoded), "Length \(length) failed to decode")
            XCTAssertEqual(decoded, data, "Length \(length) did not round-trip")
        }
    }

    func testBase64URLUsesURLSafeAlphabet() throws {
        // 0xFB 0xFF 0xBF encodes to "+/+/" in standard base64.
        let data = Data([0xFB, 0xFF, 0xBF])
        XCTAssertEqual(data.base64EncodedString(), "+/+/")
        XCTAssertEqual(data.base64URLEncoded, "-_-_")
        XCTAssertEqual(try XCTUnwrap(Data(base64URL: "-_-_")), data)
    }

    func testHexParsing() throws {
        XCTAssertEqual(try XCTUnwrap(Data(hex: "00ff10")), Data([0x00, 0xFF, 0x10]))
        XCTAssertEqual(try XCTUnwrap(Data(hex: "00FF10")), Data([0x00, 0xFF, 0x10]))
        XCTAssertEqual(try XCTUnwrap(Data(hex: "")), Data())
        XCTAssertNil(Data(hex: "abc"), "Odd length must be rejected")
        XCTAssertNil(Data(hex: "zz"), "Non-hex characters must be rejected")
        XCTAssertEqual(Data([0x00, 0xFF, 0x10]).hexString, "00ff10")
    }

    func testProductionPublicKeyIsValidHex() {
        let bytes = Data(hex: LicenseVerifier.productionPublicKeyHex)
        XCTAssertEqual(bytes?.count, 32)
    }

    // MARK: - LicenseManager

    private func makeManager() -> LicenseManager {
        LicenseManager(defaults: defaults, verifier: verifier, trialStartURL: trialURL)
    }

    func testFreshManagerStartsFourteenDayTrial() {
        let manager = makeManager()
        XCTAssertEqual(manager.state, .trial(daysLeft: LicenseManager.trialLength))
        XCTAssertEqual(manager.state, .trial(daysLeft: 14))
        XCTAssertTrue(manager.isPro)
        XCTAssertNil(manager.licenseKey)
        XCTAssertTrue(FileManager.default.fileExists(atPath: trialURL.path), "The trial start should be persisted to the hidden file")
        XCTAssertNotNil(defaults.object(forKey: "trialStart"))
    }

    func testActivateWithValidKeyLicensesTheApp() throws {
        let manager = makeManager()
        let key = try issuer.issue(lifetimePayload(email: "buyer@example.com"))
        let payload = try manager.activate(key)
        XCTAssertEqual(payload.email, "buyer@example.com")
        XCTAssertTrue(manager.isPro)
        XCTAssertEqual(manager.licenseKey, key)
        if case .licensed(let stored) = manager.state {
            XCTAssertEqual(stored, payload)
        } else {
            XCTFail("Expected .licensed, got \(manager.state)")
        }
        XCTAssertEqual(defaults.string(forKey: "licenseKey"), key)

        // A new manager over the same defaults picks the licence up again.
        let reloaded = makeManager()
        XCTAssertEqual(reloaded.state, .licensed(payload))
    }

    func testActivateWithInvalidKeyThrowsAndKeepsTrial() {
        let manager = makeManager()
        XCTAssertThrowsError(try manager.activate("VIGIL-garbage"))
        XCTAssertEqual(manager.state, .trial(daysLeft: 14))
        XCTAssertNil(defaults.string(forKey: "licenseKey"))
    }

    func testDeactivateReturnsToTrial() throws {
        let manager = makeManager()
        let key = try issuer.issue(lifetimePayload())
        try manager.activate(key)
        XCTAssertTrue(manager.isPro)
        manager.deactivate()
        XCTAssertEqual(manager.state, .trial(daysLeft: 14))
        XCTAssertNil(manager.licenseKey)
        XCTAssertNil(defaults.string(forKey: "licenseKey"))
    }

    func testOldTrialFileExpiresTheTrial() throws {
        let manager = makeManager()
        XCTAssertTrue(manager.isPro)
        let start = Date().addingTimeInterval(-20 * 86_400)
        try "\(start.timeIntervalSince1970)".write(to: trialURL, atomically: true, encoding: .utf8)
        manager.reload()
        XCTAssertEqual(manager.state, .trialExpired)
        XCTAssertFalse(manager.isPro)
        XCTAssertEqual(manager.state.title, "Trial ended")
    }

    func testTrialFileWrittenBeforeFirstLaunchIsHonoured() throws {
        let start = Date().addingTimeInterval(-10 * 86_400)
        try "\(start.timeIntervalSince1970)".write(to: trialURL, atomically: true, encoding: .utf8)
        let manager = makeManager()
        XCTAssertEqual(manager.state, .trial(daysLeft: 4))
        XCTAssertTrue(manager.isPro)
    }

    func testReloadWithFutureClockCountsDown() {
        let manager = makeManager()
        manager.reload(now: Date().addingTimeInterval(5 * 86_400 + 60))
        XCTAssertEqual(manager.state, .trial(daysLeft: 9))
        manager.reload(now: Date().addingTimeInterval(14 * 86_400 + 60))
        XCTAssertEqual(manager.state, .trialExpired)
    }

    func testLicensedStateTitles() {
        XCTAssertEqual(LicenseState.trial(daysLeft: 1).title, "Trial: 1 day left")
        XCTAssertEqual(LicenseState.trial(daysLeft: 5).title, "Trial: 5 days left")
        XCTAssertEqual(LicenseState.licensed(lifetimePayload()).title, "Vigil Pro · Lifetime")
        XCTAssertFalse(LicenseState.trial(daysLeft: 0).isPro)
    }
}
