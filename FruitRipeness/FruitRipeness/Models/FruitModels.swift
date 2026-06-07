import SwiftUI

// MARK: - Fruit Type

enum FruitType: String, CaseIterable {
    case watermelon, apple, banana, orange, mango, strawberry, grape,
         pear, peach, kiwi,
         avocado, pineapple, lemon, cherry, plum,
         blueberry, raspberry, tomato, papaya, pomegranate,
         fig, apricot, cantaloupe, coconut, dragonfruit, guava, lychee,
         unknown

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
        case .avocado:     return "🥑"
        case .pineapple:   return "🍍"
        case .lemon:       return "🍋"
        case .cherry:      return "🍒"
        case .plum:        return "🍑"
        case .blueberry:   return "🫐"
        case .raspberry:   return "🍓"
        case .tomato:      return "🍅"
        case .papaya:      return "🍈"
        case .pomegranate: return "🍎"
        case .fig:         return "🍈"
        case .apricot:     return "🍑"
        case .cantaloupe:  return "🍈"
        case .coconut:     return "🥥"
        case .dragonfruit: return "🐉"
        case .guava:       return "🍏"
        case .lychee:      return "🍒"
        case .unknown:     return "🔍"
        }
    }

    var wikipediaTitle: String {
        switch self {
        case .watermelon:  return "Watermelon"
        case .apple:       return "Apple"
        case .banana:      return "Banana"
        case .orange:      return "Orange_(fruit)"
        case .mango:       return "Mango"
        case .strawberry:  return "Strawberry"
        case .grape:       return "Grape"
        case .pear:        return "Pear"
        case .peach:       return "Peach"
        case .kiwi:        return "Kiwifruit"
        case .avocado:     return "Avocado"
        case .pineapple:   return "Pineapple"
        case .lemon:       return "Lemon"
        case .cherry:      return "Cherry"
        case .plum:        return "Plum"
        case .blueberry:   return "Blueberry"
        case .raspberry:   return "Raspberry"
        case .tomato:      return "Tomato"
        case .papaya:      return "Papaya"
        case .pomegranate: return "Pomegranate"
        case .fig:         return "Common_fig"
        case .apricot:     return "Apricot"
        case .cantaloupe:  return "Cantaloupe"
        case .coconut:     return "Coconut"
        case .dragonfruit: return "Pitaya"
        case .guava:       return "Guava"
        case .lychee:      return "Lychee"
        case .unknown:     return ""
        }
    }

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
        case .avocado:     return ["avocado"]
        case .pineapple:   return ["pineapple", "ananas"]
        case .lemon:       return ["lemon"]
        case .cherry:      return ["cherry"]
        case .plum:        return ["plum"]
        case .blueberry:   return ["blueberry"]
        case .raspberry:   return ["raspberry"]
        case .tomato:      return ["tomato"]
        case .papaya:      return ["papaya"]
        case .pomegranate: return ["pomegranate"]
        case .fig:         return ["fig"]
        case .apricot:     return ["apricot"]
        case .cantaloupe:  return ["cantaloupe", "muskmelon", "rockmelon"]
        case .coconut:     return ["coconut"]
        case .dragonfruit: return ["dragonfruit", "dragon fruit", "pitaya", "pitahaya"]
        case .guava:       return ["guava"]
        case .lychee:      return ["lychee", "litchi", "lichi"]
        case .unknown:     return []
        }
    }

    // Background gradient shown behind the fruit photo while it loads
    var placeholderGradient: LinearGradient {
        switch self {
        case .watermelon:  return LinearGradient(colors: [.green, Color(red:0.1,green:0.6,blue:0.2)], startPoint: .topLeading, endPoint: .bottomTrailing)
        case .apple:       return LinearGradient(colors: [.red, .pink], startPoint: .topLeading, endPoint: .bottomTrailing)
        case .banana:      return LinearGradient(colors: [.yellow, Color(red:0.9,green:0.8,blue:0.1)], startPoint: .topLeading, endPoint: .bottomTrailing)
        case .orange:      return LinearGradient(colors: [.orange, Color(red:0.95,green:0.5,blue:0.1)], startPoint: .topLeading, endPoint: .bottomTrailing)
        case .mango:       return LinearGradient(colors: [Color(red:1,green:0.7,blue:0), .orange], startPoint: .topLeading, endPoint: .bottomTrailing)
        case .strawberry:  return LinearGradient(colors: [.red, Color(red:0.8,green:0.1,blue:0.2)], startPoint: .topLeading, endPoint: .bottomTrailing)
        case .grape:       return LinearGradient(colors: [.purple, Color(red:0.5,green:0,blue:0.7)], startPoint: .topLeading, endPoint: .bottomTrailing)
        case .pear:        return LinearGradient(colors: [Color(red:0.7,green:0.85,blue:0.3), .yellow], startPoint: .topLeading, endPoint: .bottomTrailing)
        case .peach:       return LinearGradient(colors: [Color(red:1,green:0.7,blue:0.5), .orange], startPoint: .topLeading, endPoint: .bottomTrailing)
        case .kiwi:        return LinearGradient(colors: [Color(red:0.5,green:0.7,blue:0.2), .green], startPoint: .topLeading, endPoint: .bottomTrailing)
        case .avocado:     return LinearGradient(colors: [Color(red:0.2,green:0.5,blue:0.1), Color(red:0.4,green:0.6,blue:0.2)], startPoint: .topLeading, endPoint: .bottomTrailing)
        case .pineapple:   return LinearGradient(colors: [Color(red:0.9,green:0.8,blue:0.1), Color(red:0.8,green:0.6,blue:0.1)], startPoint: .topLeading, endPoint: .bottomTrailing)
        case .lemon:       return LinearGradient(colors: [.yellow, Color(red:1,green:0.95,blue:0.3)], startPoint: .topLeading, endPoint: .bottomTrailing)
        case .cherry:      return LinearGradient(colors: [Color(red:0.6,green:0,blue:0.1), .red], startPoint: .topLeading, endPoint: .bottomTrailing)
        case .plum:        return LinearGradient(colors: [Color(red:0.4,green:0,blue:0.5), .purple], startPoint: .topLeading, endPoint: .bottomTrailing)
        case .blueberry:   return LinearGradient(colors: [Color(red:0.2,green:0.2,blue:0.7), .blue], startPoint: .topLeading, endPoint: .bottomTrailing)
        case .raspberry:   return LinearGradient(colors: [Color(red:0.8,green:0.1,blue:0.3), .red], startPoint: .topLeading, endPoint: .bottomTrailing)
        case .tomato:      return LinearGradient(colors: [.red, Color(red:0.8,green:0.1,blue:0.1)], startPoint: .topLeading, endPoint: .bottomTrailing)
        case .papaya:      return LinearGradient(colors: [Color(red:1,green:0.6,blue:0.2), .orange], startPoint: .topLeading, endPoint: .bottomTrailing)
        case .pomegranate: return LinearGradient(colors: [Color(red:0.7,green:0.05,blue:0.15), .red], startPoint: .topLeading, endPoint: .bottomTrailing)
        case .fig:         return LinearGradient(colors: [Color(red:0.4,green:0.1,blue:0.4), .purple], startPoint: .topLeading, endPoint: .bottomTrailing)
        case .apricot:     return LinearGradient(colors: [Color(red:1,green:0.6,blue:0.3), .orange], startPoint: .topLeading, endPoint: .bottomTrailing)
        case .cantaloupe:  return LinearGradient(colors: [Color(red:0.95,green:0.75,blue:0.4), Color(red:0.8,green:0.6,blue:0.2)], startPoint: .topLeading, endPoint: .bottomTrailing)
        case .coconut:     return LinearGradient(colors: [Color(red:0.6,green:0.4,blue:0.2), Color(red:0.4,green:0.3,blue:0.15)], startPoint: .topLeading, endPoint: .bottomTrailing)
        case .dragonfruit: return LinearGradient(colors: [Color(red:0.9,green:0.2,blue:0.5), .pink], startPoint: .topLeading, endPoint: .bottomTrailing)
        case .guava:       return LinearGradient(colors: [Color(red:0.6,green:0.85,blue:0.4), .green], startPoint: .topLeading, endPoint: .bottomTrailing)
        case .lychee:      return LinearGradient(colors: [Color(red:0.9,green:0.3,blue:0.4), .pink], startPoint: .topLeading, endPoint: .bottomTrailing)
        case .unknown:     return LinearGradient(colors: [.gray, .secondary], startPoint: .topLeading, endPoint: .bottomTrailing)
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
        case .unripe:     return "Not ready yet — needs more time to ripen."
        case .nearlyRipe: return "Almost there! Give it 1–2 more days."
        case .ripe:       return "Perfect! Ready to eat right now."
        case .overripe:   return "Past its peak. Eat soon or blend into a smoothie."
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

// MARK: - Scan State Machine

/// Drives the entire detection flow in ContentView.
enum ScanState {
    case idle                           // nothing in frame
    case scanning                       // Vision is running
    case ambiguous([FruitCandidate])    // multiple plausible fruits — ask user
    case result(FruitAnalysisResult)    // confirmed result
}

/// One candidate returned by the Vision pipeline.
struct FruitCandidate: Identifiable {
    let id = UUID()
    let fruitType: FruitType
    let confidence: Float               // 0–1 from VNClassificationObservation
}

// MARK: - Analysis Result

struct FruitAnalysisResult: Identifiable {
    let id = UUID()
    let fruitType: FruitType
    let detectionConfidence: Float
    let ripenessLevel: RipenessLevel
    let ripenessScore: Float
    let tips: [String]
    let usedCoreML: Bool
    let timestamp = Date()

    var isHighConfidence: Bool { detectionConfidence > 0.45 }
}

// MARK: - Ripeness Tips

struct RipenessTips {
    static func tips(for fruit: FruitType, ripeness: RipenessLevel) -> [String] {
        switch (fruit, ripeness) {

        // Watermelon
        case (.watermelon, .unripe):
            return ["Leave at room temp 3–5 more days", "Skin should be dull, not shiny", "Ground spot should turn yellow"]
        case (.watermelon, .ripe):
            return ["Tap it — hollow sound means it's ready", "Yellow ground spot is a great sign", "Refrigerate after cutting"]
        case (.watermelon, .overripe):
            return ["Use quickly — blend into juice or smoothie", "Check for mushy spots before eating"]

        // Banana
        case (.banana, .unripe):
            return ["Leave at room temperature", "Avoid refrigerating until ripe", "Green = starchy, not sweet yet"]
        case (.banana, .ripe):
            return ["Best eaten now or frozen for smoothies", "A few brown spots are perfectly fine"]
        case (.banana, .overripe):
            return ["Perfect for banana bread!", "Freeze peeled for later use in smoothies"]

        // Apple
        case (.apple, .unripe):
            return ["Leave at room temp to finish ripening", "Tastes tart — good for cooking"]
        case (.apple, .ripe):
            return ["Firm to the touch is ideal", "Refrigerate to extend freshness to 4–6 weeks"]
        case (.apple, .overripe):
            return ["Good for applesauce or apple butter", "Avoid eating raw if very soft"]

        // Avocado
        case (.avocado, .unripe):
            return ["Place in a paper bag to speed ripening", "Adding a banana to the bag helps even more", "Usually ready in 2–5 days at room temp"]
        case (.avocado, .ripe):
            return ["Gentle squeeze should give slightly", "Refrigerate to pause ripening for 2 days", "Stem tip: pull it — green underneath = ready"]
        case (.avocado, .overripe):
            return ["Brown inside = use in guacamole or smoothies", "Add lemon juice to slow browning after cutting"]

        // Pineapple
        case (.pineapple, .unripe):
            return ["Leave at room temp 1–2 days", "Try pulling a center leaf — easy pull = riper"]
        case (.pineapple, .ripe):
            return ["Sweet smell at the base is the best indicator", "Refrigerate cut pineapple in water"]
        case (.pineapple, .overripe):
            return ["Use in smoothies or cooked dishes", "Fermented smell = too far gone"]

        // Mango
        case (.mango, .nearlyRipe):
            return ["Place in a paper bag to speed ripening", "Slight give when pressed = nearly ready"]
        case (.mango, .ripe):
            return ["Sweet aroma near the stem", "Slight give when gently squeezed", "Refrigerate once ripe — lasts 5 days"]
        case (.mango, .overripe):
            return ["Great for mango lassi or sorbet", "Check for sour smell before eating"]

        // Strawberry
        case (.strawberry, .ripe):
            return ["Eat within 1–2 days of purchase", "Rinse only right before eating", "Deep red all over = peak sweetness"]
        case (.strawberry, .overripe):
            return ["Use in jams, sauces, or smoothies immediately"]

        // Lemon
        case (.lemon, .unripe):
            return ["Still sour but less juicy", "Good for zesting"]
        case (.lemon, .ripe):
            return ["Heavy for its size = more juice", "Roll on counter before squeezing", "Stores up to 4 weeks in the fridge"]

        // Cherry
        case (.cherry, .ripe):
            return ["Deep red color = peak sweetness", "Firm with a slight give", "Refrigerate and consume within 5 days"]

        // Blueberry
        case (.blueberry, .ripe):
            return ["Deep blue-purple with white waxy coating = perfect", "Rinse just before eating", "Freeze for up to 6 months"]

        // Tomato
        case (.tomato, .unripe):
            return ["Store stem-side down at room temp", "Never refrigerate unripe tomatoes"]
        case (.tomato, .ripe):
            return ["Slight give when squeezed = ready", "Best stored at room temp, not the fridge", "Use within 5 days"]
        case (.tomato, .overripe):
            return ["Use in sauces, soups, or salsa immediately"]

        // Papaya
        case (.papaya, .ripe):
            return ["Skin should be mostly yellow-orange", "Gentle squeeze should give slightly", "Refrigerate cut papaya up to 3 days"]

        // Pomegranate
        case (.pomegranate, .ripe):
            return ["Skin should be firm and slightly cracked", "Heavy for its size = more seeds", "Stores 2 months in the fridge"]

        // Coconut
        case (.coconut, .ripe):
            return ["Shake it — plenty of sloshing liquid = fresh", "Brown exterior = mature, ready for flesh", "Green = young coconut, good for water"]

        // Dragonfruit
        case (.dragonfruit, .ripe):
            return ["Bright even color, wings just starting to brown", "Slight give when pressed", "Eat within 2 days once cut"]

        // Avocado catch-all, Guava, Lychee
        case (.guava, .ripe):
            return ["Yellow-green skin, strong sweet aroma", "Slight give when pressed", "Rich in Vitamin C"]
        case (.lychee, .ripe):
            return ["Bright pink-red bumpy skin", "Avoid brown or cracked skins", "Refrigerate for up to a week"]

        default:
            return ripeness == .ripe
                ? ["\(fruit.displayName) looks ready to eat!"]
                : ["Watch for color changes and softness as ripeness cues"]
        }
    }
}
