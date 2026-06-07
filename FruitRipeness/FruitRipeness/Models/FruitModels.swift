import SwiftUI

// MARK: - Fruit Type

enum FruitType: String, CaseIterable {
    case watermelon, apple, banana, orange, mango, strawberry, grape, pear, peach, kiwi, unknown

    var displayName: String { rawValue.capitalized }

    var emoji: String {
        switch self {
        case .watermelon:  return "🍉"
        case .apple:       return "🍎"
        case .banana:      return "🍌"
        case .orange:      return "🍊"
        case .mango:       return "🥭"
        case .strawberry:  return "🍓"
        case .grape:       return "🍇"
        case .pear:        return "🍐"
        case .peach:       return "🍑"
        case .kiwi:        return "🥝"
        case .unknown:     return "🔍"
        }
    }

    // Vision classifier labels that map to each fruit
    var visionLabels: [String] {
        switch self {
        case .watermelon:  return ["watermelon", "melon"]
        case .apple:       return ["apple", "Granny Smith"]
        case .banana:      return ["banana"]
        case .orange:      return ["orange", "mandarin", "tangerine", "clementine"]
        case .mango:       return ["mango"]
        case .strawberry:  return ["strawberry"]
        case .grape:       return ["grape", "grapes"]
        case .pear:        return ["pear"]
        case .peach:       return ["peach", "nectarine"]
        case .kiwi:        return ["kiwi", "kiwifruit"]
        case .unknown:     return []
        }
    }
}

// MARK: - Ripeness Level

enum RipenessLevel: String {
    case unripe     = "Unripe"
    case nearlyRipe = "Nearly Ripe"
    case ripe       = "Ripe"
    case overripe   = "Overripe"

    var color: Color {
        switch self {
        case .unripe:     return Color(red: 0.2, green: 0.7, blue: 0.3)
        case .nearlyRipe: return Color(red: 0.9, green: 0.8, blue: 0.1)
        case .ripe:       return Color(red: 0.2, green: 0.8, blue: 0.4)
        case .overripe:   return Color(red: 0.9, green: 0.3, blue: 0.2)
        }
    }

    var description: String {
        switch self {
        case .unripe:
            return "Not ready yet — needs more time to ripen."
        case .nearlyRipe:
            return "Almost there! Give it 1–2 more days."
        case .ripe:
            return "Perfect! Ready to eat right now."
        case .overripe:
            return "Past its peak. Eat soon or blend into a smoothie."
        }
    }

    var sfSymbol: String {
        switch self {
        case .unripe:     return "leaf.fill"
        case .nearlyRipe: return "clock.fill"
        case .ripe:       return "checkmark.circle.fill"
        case .overripe:   return "exclamationmark.triangle.fill"
        }
    }

    var score: Float {
        switch self {
        case .unripe:     return 0.15
        case .nearlyRipe: return 0.45
        case .ripe:       return 0.80
        case .overripe:   return 0.95
        }
    }
}

// MARK: - Analysis Result

struct FruitAnalysisResult: Identifiable {
    let id = UUID()
    let fruitType: FruitType
    let detectionConfidence: Float   // 0–1, how sure we are it's that fruit
    let ripenessLevel: RipenessLevel
    let ripenessScore: Float         // 0–1 continuous scale
    let tips: [String]
    let timestamp = Date()

    var isHighConfidence: Bool { detectionConfidence > 0.45 }
}

// MARK: - Ripeness Tips

struct RipenessTips {
    static func tips(for fruit: FruitType, ripeness: RipenessLevel) -> [String] {
        switch (fruit, ripeness) {
        case (.watermelon, .unripe):
            return ["Leave at room temp for 3–5 days", "Look for a creamy yellow ground spot", "The skin should be dull, not shiny"]
        case (.watermelon, .ripe):
            return ["Tap it — a hollow sound means it's ripe", "The ground spot should be cream or yellow", "Refrigerate after cutting"]
        case (.banana, .unripe):
            return ["Leave at room temperature", "Avoid refrigerating until ripe", "Green = starchy, not sweet yet"]
        case (.banana, .ripe):
            return ["Best eaten now or frozen for smoothies", "A few brown spots are perfectly fine", "High natural sugar content — great energy boost"]
        case (.banana, .overripe):
            return ["Perfect for banana bread!", "Blend into smoothies", "Freeze peeled for later use"]
        case (.apple, .ripe):
            return ["Firm to the touch is ideal", "Refrigerate to extend freshness", "Store away from other fruits"]
        case (.orange, .ripe):
            return ["Heavy for its size = more juice", "Bright color doesn't always mean riper", "Best consumed within 2 weeks"]
        case (.mango, .nearlyRipe):
            return ["Place in a paper bag to speed ripening", "Slight give when pressed = nearly ready", "Fragrant smell near the stem = good sign"]
        case (.mango, .ripe):
            return ["Sweet aroma near the stem", "Slight give when gently squeezed", "Refrigerate once ripe to last 5 days"]
        case (.strawberry, .ripe):
            return ["Eat within 1–2 days of purchase", "Rinse only right before eating", "Deep red all over = peak sweetness"]
        default:
            return ripeness == .ripe
                ? ["This \(fruit.displayName) looks ready to eat!"]
                : ["Monitor color changes for ripeness cues"]
        }
    }
}
