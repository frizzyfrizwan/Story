import Foundation
import PDFKit

/// Finds sensitive text in a document for Smart Redact.
enum RedactionFinder {
    /// Scans the whole document. Safe to call off the main thread.
    static func find(in document: PDFDocument, customTerms: [String]) -> [RedactionCandidate] {
        var found: [(kind: RedactionCandidate.Kind, text: String)] = []
        var seenText = Set<String>()

        let detectorTypes: NSTextCheckingResult.CheckingType = [.link, .phoneNumber, .address]
        let detector = try? NSDataDetector(types: detectorTypes.rawValue)

        for index in document.pageIndices {
            guard let text = document.page(at: index)?.string, !text.isEmpty else { continue }
            let nsText = text as NSString
            let fullRange = NSRange(location: 0, length: nsText.length)

            // Card and ID numbers first: the data detector also reports them as
            // phone numbers, and the more specific kind should win.
            for match in matches(of: Patterns.cardNumber, in: text) where Luhn.isValid(match) {
                let key = "card|\(match)"
                if seenText.insert(key).inserted { found.append((.cardNumber, match)) }
            }
            for match in matches(of: Patterns.ssn, in: text) {
                let key = "id|\(match)"
                if seenText.insert(key).inserted { found.append((.idNumber, match)) }
            }

            detector?.enumerateMatches(in: text, options: [], range: fullRange) { result, _, _ in
                guard let result else { return }
                let matched = nsText.substring(with: result.range).trimmed
                guard matched.count >= 5 else { return }
                let kind: RedactionCandidate.Kind
                switch result.resultType {
                case .link:
                    kind = result.url?.scheme?.lowercased() == "mailto" ? .email : .url
                case .phoneNumber:
                    if Luhn.isValid(matched) || Self.looksLikeID(matched) { return }
                    kind = .phone
                case .address:
                    kind = .address
                default:
                    return
                }
                let key = "\(kind.rawValue)|\(matched.lowercased())"
                if seenText.insert(key).inserted {
                    found.append((kind, matched))
                }
            }
        }

        for term in customTerms.map(\.trimmed) where !term.isEmpty {
            let key = "custom|\(term.lowercased())"
            if seenText.insert(key).inserted { found.append((.custom, term)) }
        }

        // Locate every occurrence on its page.
        var candidates: [RedactionCandidate] = []
        var seenRects = Set<String>()
        for item in found {
            let selections = document.findString(item.text, withOptions: [.caseInsensitive])
            for selection in selections {
                guard let page = selection.pages.first else { continue }
                let pageIndex = document.index(for: page)
                guard pageIndex >= 0, pageIndex < document.pageCount else { continue }
                let bounds = selection.bounds(for: page)
                guard bounds.width > 0, bounds.height > 0 else { continue }
                let rectKey = "\(pageIndex)|\(Int(bounds.minX))|\(Int(bounds.minY))|\(Int(bounds.width))|\(Int(bounds.height))"
                guard seenRects.insert(rectKey).inserted else { continue }
                candidates.append(RedactionCandidate(
                    kind: item.kind,
                    text: item.text,
                    pageIndex: pageIndex,
                    bounds: bounds
                ))
            }
        }

        return candidates.sorted {
            if $0.pageIndex != $1.pageIndex { return $0.pageIndex < $1.pageIndex }
            return $0.bounds.maxY > $1.bounds.maxY
        }
    }

    private enum Patterns {
        static let cardNumber = try! NSRegularExpression(pattern: #"(?<!\d)(?:\d[ -]?){12,18}\d(?!\d)"#)
        static let ssn = try! NSRegularExpression(pattern: #"\b\d{3}-\d{2}-\d{4}\b"#)
    }

    private static func looksLikeID(_ text: String) -> Bool {
        let range = NSRange(location: 0, length: (text as NSString).length)
        return Patterns.ssn.firstMatch(in: text, options: [], range: range) != nil
    }

    private static func matches(of regex: NSRegularExpression, in text: String) -> [String] {
        let nsText = text as NSString
        let range = NSRange(location: 0, length: nsText.length)
        return regex.matches(in: text, options: [], range: range).map { nsText.substring(with: $0.range) }
    }

    enum Luhn {
        static func isValid(_ raw: String) -> Bool {
            let digits = raw.compactMap { $0.wholeNumberValue }
            guard digits.count >= 13, digits.count <= 19 else { return false }
            var sum = 0
            for (offset, digit) in digits.reversed().enumerated() {
                if offset % 2 == 1 {
                    let doubled = digit * 2
                    sum += doubled > 9 ? doubled - 9 : doubled
                } else {
                    sum += digit
                }
            }
            return sum % 10 == 0
        }
    }
}
