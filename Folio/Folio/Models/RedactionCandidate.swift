import CoreGraphics
import Foundation

/// A piece of sensitive text Smart Redact found in the document.
struct RedactionCandidate: Identifiable, Hashable {
    enum Kind: String, CaseIterable, Identifiable {
        case email, phone, url, address, cardNumber, idNumber, custom

        var id: String { rawValue }

        var title: String {
            switch self {
            case .email: return "Email addresses"
            case .phone: return "Phone numbers"
            case .url: return "Links"
            case .address: return "Street addresses"
            case .cardNumber: return "Card numbers"
            case .idNumber: return "ID numbers"
            case .custom: return "Your terms"
            }
        }

        var symbol: String {
            switch self {
            case .email: return "envelope"
            case .phone: return "phone"
            case .url: return "link"
            case .address: return "mappin.and.ellipse"
            case .cardNumber: return "creditcard"
            case .idNumber: return "person.text.rectangle"
            case .custom: return "textformat.abc"
            }
        }
    }

    let id: UUID
    let kind: Kind
    let text: String
    let pageIndex: Int
    /// Page-space bounds of the matched text.
    let bounds: CGRect
    var isSelected: Bool

    init(kind: Kind, text: String, pageIndex: Int, bounds: CGRect, isSelected: Bool = true) {
        self.id = UUID()
        self.kind = kind
        self.text = text
        self.pageIndex = pageIndex
        self.bounds = bounds
        self.isSelected = isSelected
    }
}
