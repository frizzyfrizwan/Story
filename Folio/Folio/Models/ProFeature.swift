import Foundation

/// Features reserved for Folio Pro. Used to contextualise the paywall.
enum ProFeature: String, CaseIterable, Identifiable {
    case ocrScan
    case recognizeText
    case smartRedact
    case signatureVault

    var id: String { rawValue }

    var title: String {
        switch self {
        case .ocrScan: return "Scan to searchable PDF"
        case .recognizeText: return "Recognize text"
        case .smartRedact: return "Smart Redact"
        case .signatureVault: return "Signature vault"
        }
    }

    var detail: String {
        switch self {
        case .ocrScan:
            return "Every scan gets an invisible text layer so you can search, select and copy it."
        case .recognizeText:
            return "Give any image-only PDF real text with on-device OCR."
        case .smartRedact:
            return "Find emails, phone numbers, card numbers and names, then black them out for good."
        case .signatureVault:
            return "Keep as many signatures and initials as you like, ready to place."
        }
    }

    var symbol: String {
        switch self {
        case .ocrScan: return "doc.text.viewfinder"
        case .recognizeText: return "text.magnifyingglass"
        case .smartRedact: return "eye.slash"
        case .signatureVault: return "signature"
        }
    }
}
