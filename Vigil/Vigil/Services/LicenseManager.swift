import Foundation
import CryptoKit
import Observation

/// Offline licence keys: `VIGIL-<base64url payload>.<base64url Ed25519 signature>`.
/// The payload is canonical JSON (sorted keys, no whitespace). Keys are issued by `Tools/make-license.swift`.
struct LicensePayload: Codable, Equatable {
    var email: String
    var plan: String          // "pro" (subscription) or "lifetime"
    var issued: Int           // Unix seconds
    var expires: Int?         // Unix seconds, nil for lifetime
    var seats: Int

    var expiryDate: Date? { expires.map { Date(timeIntervalSince1970: TimeInterval($0)) } }
    var isLifetime: Bool { plan == "lifetime" }
}

enum LicenseError: LocalizedError, Equatable {
    case malformed
    case badSignature
    case expired(Date)

    var errorDescription: String? {
        switch self {
        case .malformed: return "That doesn't look like a Vigil licence key. Keys start with VIGIL- and are sent by email after purchase."
        case .badSignature: return "The licence key is not valid for this app. Check for missing characters."
        case .expired(let date): return "This licence expired on \(Format.dateTime(date)). Renew it to keep Pro features."
        }
    }
}

struct LicenseVerifier {
    let publicKey: Curve25519.Signing.PublicKey

    /// Public key matching the private key used to issue production licences.
    static let productionPublicKeyHex = "e70ca83339835482a09f5b3204ce59d9ba1e2ed473416681cbf80f94de36bd77"

    static let production: LicenseVerifier = {
        let bytes = Data(hex: productionPublicKeyHex) ?? Data()
        let key = (try? Curve25519.Signing.PublicKey(rawRepresentation: bytes)) ?? Curve25519.Signing.PrivateKey().publicKey
        return LicenseVerifier(publicKey: key)
    }()

    func verify(_ key: String, now: Date = Date()) throws -> LicensePayload {
        let trimmed = key.trimmingCharacters(in: .whitespacesAndNewlines)
        guard trimmed.uppercased().hasPrefix("VIGIL-") else { throw LicenseError.malformed }
        let body = trimmed.dropFirst("VIGIL-".count)
        let parts = body.split(separator: ".", maxSplits: 1).map(String.init)
        guard parts.count == 2, let payloadData = Data(base64URL: parts[0]), let signature = Data(base64URL: parts[1]) else { throw LicenseError.malformed }
        guard signature.count == 64 else { throw LicenseError.malformed }
        guard publicKey.isValidSignature(signature, for: payloadData) else { throw LicenseError.badSignature }
        guard let payload = try? JSONDecoder().decode(LicensePayload.self, from: payloadData) else { throw LicenseError.malformed }
        if let expiry = payload.expiryDate, expiry < now { throw LicenseError.expired(expiry) }
        return payload
    }
}

/// Signing helper used by the licence tool and the tests.
struct LicenseIssuer {
    let privateKey: Curve25519.Signing.PrivateKey

    func issue(_ payload: LicensePayload) throws -> String {
        let encoder = JSONEncoder()
        encoder.outputFormatting = [.sortedKeys, .withoutEscapingSlashes]
        let data = try encoder.encode(payload)
        let signature = try privateKey.signature(for: data)
        return "VIGIL-" + data.base64URLEncoded + "." + signature.base64URLEncoded
    }
}

enum LicenseState: Equatable {
    case trial(daysLeft: Int)
    case trialExpired
    case licensed(LicensePayload)

    var isPro: Bool {
        switch self {
        case .trial(let daysLeft): return daysLeft > 0
        case .trialExpired: return false
        case .licensed: return true
        }
    }

    var title: String {
        switch self {
        case .trial(let daysLeft): return daysLeft == 1 ? "Trial: 1 day left" : "Trial: \(daysLeft) days left"
        case .trialExpired: return "Trial ended"
        case .licensed(let payload): return payload.isLifetime ? "Vigil Pro · Lifetime" : "Vigil Pro"
        }
    }
}

@Observable
final class LicenseManager {
    static let trialLength = 14
    private(set) var state: LicenseState = .trial(daysLeft: LicenseManager.trialLength)
    private(set) var licenseKey: String?
    private let defaults: UserDefaults
    private let verifier: LicenseVerifier
    private let trialStartURL: URL?

    init(defaults: UserDefaults = .standard, verifier: LicenseVerifier = .production, trialStartURL: URL? = LicenseManager.defaultTrialURL) {
        self.defaults = defaults
        self.verifier = verifier
        self.trialStartURL = trialStartURL
        reload()
    }

    static let defaultTrialURL: URL = {
        let support = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask).first!
        let directory = support.appendingPathComponent("Vigil", isDirectory: true)
        try? FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        return directory.appendingPathComponent(".trial")
    }()

    var isPro: Bool { state.isPro }

    func reload(now: Date = Date()) {
        if let key = defaults.string(forKey: "licenseKey"), let payload = try? verifier.verify(key, now: now) {
            licenseKey = key
            state = .licensed(payload)
            return
        }
        licenseKey = nil
        let start = trialStart(now: now)
        let elapsedDays = Int(now.timeIntervalSince(start) / 86_400)
        let left = Self.trialLength - elapsedDays
        state = left > 0 ? .trial(daysLeft: left) : .trialExpired
    }

    @discardableResult
    func activate(_ key: String, now: Date = Date()) throws -> LicensePayload {
        let payload = try verifier.verify(key, now: now)
        defaults.set(key.trimmingCharacters(in: .whitespacesAndNewlines), forKey: "licenseKey")
        licenseKey = key
        state = .licensed(payload)
        return payload
    }

    func deactivate() {
        defaults.removeObject(forKey: "licenseKey")
        reload()
    }

    /// The trial start is written both to defaults and to a hidden file so that deleting preferences does not restart it.
    private func trialStart(now: Date) -> Date {
        var candidates: [Date] = []
        if let stored = defaults.object(forKey: "trialStart") as? Date { candidates.append(stored) }
        if let url = trialStartURL, let text = try? String(contentsOf: url, encoding: .utf8), let interval = TimeInterval(text.trimmingCharacters(in: .whitespacesAndNewlines)) {
            candidates.append(Date(timeIntervalSince1970: interval))
        }
        let start = candidates.min() ?? now
        if defaults.object(forKey: "trialStart") == nil { defaults.set(start, forKey: "trialStart") }
        if let url = trialStartURL, !FileManager.default.fileExists(atPath: url.path) {
            try? "\(start.timeIntervalSince1970)".write(to: url, atomically: true, encoding: .utf8)
        }
        return start
    }
}

// MARK: - Encoding helpers

extension Data {
    init?(hex: String) {
        let characters = Array(hex.utf8)
        guard characters.count % 2 == 0 else { return nil }
        var bytes: [UInt8] = []
        bytes.reserveCapacity(characters.count / 2)
        var index = 0
        while index < characters.count {
            guard let high = Data.hexValue(characters[index]), let low = Data.hexValue(characters[index + 1]) else { return nil }
            bytes.append(high << 4 | low)
            index += 2
        }
        self.init(bytes)
    }

    private static func hexValue(_ character: UInt8) -> UInt8? {
        switch character {
        case UInt8(ascii: "0")...UInt8(ascii: "9"): return character - UInt8(ascii: "0")
        case UInt8(ascii: "a")...UInt8(ascii: "f"): return character - UInt8(ascii: "a") + 10
        case UInt8(ascii: "A")...UInt8(ascii: "F"): return character - UInt8(ascii: "A") + 10
        default: return nil
        }
    }

    var hexString: String { map { String(format: "%02x", $0) }.joined() }

    init?(base64URL: String) {
        var text = base64URL.replacingOccurrences(of: "-", with: "+").replacingOccurrences(of: "_", with: "/")
        while text.count % 4 != 0 { text.append("=") }
        self.init(base64Encoded: text)
    }

    var base64URLEncoded: String {
        base64EncodedString().replacingOccurrences(of: "+", with: "-").replacingOccurrences(of: "/", with: "_").replacingOccurrences(of: "=", with: "")
    }
}
