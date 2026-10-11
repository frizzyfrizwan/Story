#!/usr/bin/env swift
// Issues Vigil licence keys. Run on a Mac:
//
//   swift Tools/make-license.swift keygen                     # prints a new private/public key pair (hex)
//   swift Tools/make-license.swift issue <private-key-hex> <email> [lifetime|yearly] [seats]
//   swift Tools/make-license.swift verify <public-key-hex> <key>
//
// Store the private key in your payment provider's webhook / fulfilment secrets, never in the app.
// Paste the public key into `LicenseVerifier.productionPublicKeyHex` in Vigil/Services/LicenseManager.swift.

import Foundation
import CryptoKit

struct Payload: Codable {
    var email: String
    var plan: String
    var issued: Int
    var expires: Int?
    var seats: Int
}

func base64URL(_ data: Data) -> String {
    data.base64EncodedString().replacingOccurrences(of: "+", with: "-").replacingOccurrences(of: "/", with: "_").replacingOccurrences(of: "=", with: "")
}

func dataFromBase64URL(_ string: String) -> Data? {
    var text = string.replacingOccurrences(of: "-", with: "+").replacingOccurrences(of: "_", with: "/")
    while text.count % 4 != 0 { text.append("=") }
    return Data(base64Encoded: text)
}

func dataFromHex(_ hex: String) -> Data? {
    var bytes: [UInt8] = []
    var index = hex.startIndex
    while index < hex.endIndex {
        guard let next = hex.index(index, offsetBy: 2, limitedBy: hex.endIndex), let byte = UInt8(hex[index..<next], radix: 16) else { return nil }
        bytes.append(byte)
        index = next
    }
    return Data(bytes)
}

func hex(_ data: Data) -> String { data.map { String(format: "%02x", $0) }.joined() }

let arguments = CommandLine.arguments.dropFirst()
guard let command = arguments.first else {
    print("usage: make-license.swift keygen | issue <private-hex> <email> [lifetime|yearly] [seats] | verify <public-hex> <key>")
    exit(1)
}

switch command {
case "keygen":
    let key = Curve25519.Signing.PrivateKey()
    print("private: \(hex(key.rawRepresentation))")
    print("public:  \(hex(key.publicKey.rawRepresentation))")

case "issue":
    let args = Array(arguments.dropFirst())
    guard args.count >= 2, let raw = dataFromHex(args[0]), let privateKey = try? Curve25519.Signing.PrivateKey(rawRepresentation: raw) else {
        print("issue needs <private-hex> <email> [lifetime|yearly] [seats]"); exit(1)
    }
    let plan = args.count >= 3 ? args[2] : "lifetime"
    let seats = args.count >= 4 ? Int(args[3]) ?? 1 : 1
    let now = Int(Date().timeIntervalSince1970)
    let expires: Int? = plan == "lifetime" ? nil : now + 366 * 86_400
    let payload = Payload(email: args[1], plan: plan == "lifetime" ? "lifetime" : "pro", issued: now, expires: expires, seats: seats)
    let encoder = JSONEncoder()
    encoder.outputFormatting = [.sortedKeys, .withoutEscapingSlashes]
    let data = try! encoder.encode(payload)
    let signature = try! privateKey.signature(for: data)
    print("VIGIL-" + base64URL(data) + "." + base64URL(signature))

case "verify":
    let args = Array(arguments.dropFirst())
    guard args.count >= 2, let raw = dataFromHex(args[0]), let publicKey = try? Curve25519.Signing.PublicKey(rawRepresentation: raw) else {
        print("verify needs <public-hex> <key>"); exit(1)
    }
    let key = args[1].trimmingCharacters(in: .whitespacesAndNewlines)
    guard key.hasPrefix("VIGIL-") else { print("not a Vigil key"); exit(2) }
    let parts = key.dropFirst(6).split(separator: ".", maxSplits: 1).map(String.init)
    guard parts.count == 2, let payloadData = dataFromBase64URL(parts[0]), let signature = dataFromBase64URL(parts[1]) else { print("malformed"); exit(2) }
    guard publicKey.isValidSignature(signature, for: payloadData) else { print("BAD SIGNATURE"); exit(3) }
    let payload = try! JSONDecoder().decode(Payload.self, from: payloadData)
    print("valid: \(payload.email) plan=\(payload.plan) seats=\(payload.seats) expires=\(payload.expires.map { String($0) } ?? "never")")

default:
    print("unknown command \(command)")
    exit(1)
}
