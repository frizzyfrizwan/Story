import CoreImage
import UIKit

// Analyzes a CIImage for fruit ripeness by examining color distributions.
// Each fruit type has its own heuristic based on how color changes as it ripens.
struct RipenessAnalyzer {

    // Returns a ripeness score (0.0–1.0) and level.
    // Score meaning: 0 = completely unripe, ~0.75 = ripe, 1.0 = overripe.
    func analyze(image: CIImage, fruitType: FruitType) -> (score: Float, level: RipenessLevel) {
        let colors = dominantHSBValues(from: image)
        guard !colors.isEmpty else {
            return (0.5, .nearlyRipe)
        }

        switch fruitType {
        case .banana:   return analyzeBanana(colors: colors)
        case .apple:    return analyzeApple(colors: colors)
        case .orange:   return analyzeOrange(colors: colors)
        case .mango:    return analyzeMango(colors: colors)
        case .strawberry: return analyzeStrawberry(colors: colors)
        case .watermelon: return analyzeWatermelon(colors: colors)
        case .grape:    return analyzeGrape(colors: colors)
        case .pear:     return analyzePear(colors: colors)
        case .peach:    return analyzePeach(colors: colors)
        case .kiwi:     return analyzeKiwi(colors: colors)
        case .unknown:  return (0.5, .nearlyRipe)
        }
    }

    // MARK: - Fruit-Specific Heuristics

    private func analyzeBanana(colors: [HSBColor]) -> (Float, RipenessLevel) {
        let avgHue = colors.map(\.hue).average
        let avgSat = colors.map(\.saturation).average

        // Banana hue: green (~0.33) → yellow (~0.15) → orange-brown (~0.07)
        // Plus brown spot ratio (low saturation + low brightness = brown)
        let brownRatio = colors.filter { $0.saturation < 0.3 && $0.brightness < 0.55 }.count.asFloat / Float(colors.count)

        let score: Float
        if avgHue > 0.25 { // greenish
            score = 0.1 + brownRatio * 0.2
        } else if avgHue > 0.12 { // yellow
            score = 0.6 + brownRatio * 0.3
        } else { // orange-brown
            score = 0.85 + brownRatio * 0.15
        }
        return (score.clamped, levelFromScore(score.clamped))
    }

    private func analyzeApple(colors: [HSBColor]) -> (Float, RipenessLevel) {
        // Red apples: more red (hue near 0 or >0.9) = riper
        // Green apples: yellower green = riper
        let redRatio = colors.filter { $0.hue < 0.05 || $0.hue > 0.92 }.count.asFloat / Float(colors.count)
        let yellowGreenRatio = colors.filter { $0.hue > 0.15 && $0.hue < 0.22 }.count.asFloat / Float(colors.count)
        let greenRatio = colors.filter { $0.hue > 0.25 && $0.hue < 0.42 }.count.asFloat / Float(colors.count)

        let score: Float
        if greenRatio > 0.4 {
            score = 0.2 + yellowGreenRatio * 0.5
        } else {
            score = 0.5 + redRatio * 0.5
        }
        return (score.clamped, levelFromScore(score.clamped))
    }

    private func analyzeOrange(colors: [HSBColor]) -> (Float, RipenessLevel) {
        // Orange hue ~0.06–0.10 with high saturation = ripe
        let orangeRatio = colors.filter { $0.hue > 0.04 && $0.hue < 0.12 && $0.saturation > 0.5 }.count.asFloat / Float(colors.count)
        let greenRatio = colors.filter { $0.hue > 0.25 && $0.hue < 0.42 }.count.asFloat / Float(colors.count)

        let score = (orangeRatio * 0.9 + (1 - greenRatio) * 0.1).clamped
        return (score, levelFromScore(score))
    }

    private func analyzeMango(colors: [HSBColor]) -> (Float, RipenessLevel) {
        // Green → yellow-green → yellow-orange → deep orange
        let deepOrangeRatio = colors.filter { $0.hue > 0.04 && $0.hue < 0.09 && $0.saturation > 0.6 }.count.asFloat / Float(colors.count)
        let yellowRatio = colors.filter { $0.hue > 0.09 && $0.hue < 0.18 && $0.saturation > 0.4 }.count.asFloat / Float(colors.count)
        let greenRatio = colors.filter { $0.hue > 0.28 && $0.hue < 0.42 }.count.asFloat / Float(colors.count)

        let score = (deepOrangeRatio * 0.85 + yellowRatio * 0.55 + greenRatio * 0.1).clamped
        return (score, levelFromScore(score))
    }

    private func analyzeStrawberry(colors: [HSBColor]) -> (Float, RipenessLevel) {
        // Deep red (hue ~0.0 or >0.95, high sat) = ripe. Pink/white = unripe.
        let deepRedRatio = colors.filter { ($0.hue < 0.04 || $0.hue > 0.95) && $0.saturation > 0.55 && $0.brightness > 0.35 }.count.asFloat / Float(colors.count)
        let pinkRatio = colors.filter { $0.hue > 0.90 && $0.saturation < 0.45 }.count.asFloat / Float(colors.count)

        let score = (deepRedRatio * 0.85 + (1 - pinkRatio) * 0.15).clamped
        return (score, levelFromScore(score))
    }

    private func analyzeWatermelon(colors: [HSBColor]) -> (Float, RipenessLevel) {
        // Exterior: deep green with contrasting stripes. Cream/yellow patch = ripe.
        // We look for: green saturation depth + presence of cream tones.
        let deepGreenRatio = colors.filter { $0.hue > 0.28 && $0.hue < 0.42 && $0.saturation > 0.4 && $0.brightness < 0.55 }.count.asFloat / Float(colors.count)
        let creamRatio = colors.filter { $0.saturation < 0.2 && $0.brightness > 0.75 }.count.asFloat / Float(colors.count)
        let lightGreenRatio = colors.filter { $0.hue > 0.28 && $0.hue < 0.42 && $0.brightness > 0.65 }.count.asFloat / Float(colors.count)

        // Ripe watermelon: deep green with some cream (ground spot)
        let score = (deepGreenRatio * 0.5 + creamRatio * 0.4 + (1 - lightGreenRatio) * 0.1).clamped
        return (score, levelFromScore(score))
    }

    private func analyzeGrape(colors: [HSBColor]) -> (Float, RipenessLevel) {
        // Purple/dark grapes: hue ~0.75–0.85, high saturation = ripe
        // Green grapes: yellow-green = ripe, bright green = unripe
        let purpleRatio = colors.filter { $0.hue > 0.70 && $0.hue < 0.88 && $0.saturation > 0.3 }.count.asFloat / Float(colors.count)
        let yellowGreenRatio = colors.filter { $0.hue > 0.18 && $0.hue < 0.28 }.count.asFloat / Float(colors.count)
        let brightGreenRatio = colors.filter { $0.hue > 0.30 && $0.hue < 0.42 && $0.saturation > 0.5 }.count.asFloat / Float(colors.count)

        let score: Float
        if purpleRatio > 0.2 {
            score = (purpleRatio * 0.9 + 0.1).clamped
        } else {
            score = (yellowGreenRatio * 0.7 + brightGreenRatio * 0.1).clamped
        }
        return (score, levelFromScore(score))
    }

    private func analyzePear(colors: [HSBColor]) -> (Float, RipenessLevel) {
        // Green → yellow-green → golden yellow
        let goldenRatio = colors.filter { $0.hue > 0.10 && $0.hue < 0.18 && $0.saturation > 0.3 }.count.asFloat / Float(colors.count)
        let greenRatio = colors.filter { $0.hue > 0.28 && $0.hue < 0.42 && $0.saturation > 0.35 }.count.asFloat / Float(colors.count)

        let score = (goldenRatio * 0.8 + (1 - greenRatio) * 0.2).clamped
        return (score, levelFromScore(score))
    }

    private func analyzePeach(colors: [HSBColor]) -> (Float, RipenessLevel) {
        // Peachy orange-pink: hue ~0.05–0.09, good saturation = ripe
        let peachRatio = colors.filter { $0.hue > 0.03 && $0.hue < 0.10 && $0.saturation > 0.3 }.count.asFloat / Float(colors.count)
        let score = (peachRatio * 0.9).clamped
        return (score, levelFromScore(score))
    }

    private func analyzeKiwi(colors: [HSBColor]) -> (Float, RipenessLevel) {
        // Brown exterior; analyzing exterior: dark brown = ripe, lighter = less ripe
        let brownRatio = colors.filter { $0.hue > 0.06 && $0.hue < 0.12 && $0.saturation > 0.2 && $0.saturation < 0.55 && $0.brightness < 0.55 }.count.asFloat / Float(colors.count)
        let score = (brownRatio * 0.85 + 0.1).clamped
        return (score, levelFromScore(score))
    }

    // MARK: - Score → Level Mapping

    private func levelFromScore(_ score: Float) -> RipenessLevel {
        switch score {
        case 0.0..<0.3:   return .unripe
        case 0.3..<0.55:  return .nearlyRipe
        case 0.55..<0.88: return .ripe
        default:           return .overripe
        }
    }

    // MARK: - Color Sampling

    private func dominantHSBValues(from ciImage: CIImage) -> [HSBColor] {
        // Downsample to 20×20 for fast processing
        let scale = 20.0 / max(ciImage.extent.width, ciImage.extent.height)
        let scaledImage = ciImage.transformed(by: CGAffineTransform(scaleX: scale, y: scale))

        let context = CIContext()
        guard let cgImage = context.createCGImage(scaledImage, from: scaledImage.extent) else { return [] }

        let width = cgImage.width
        let height = cgImage.height
        guard width > 0, height > 0 else { return [] }

        var pixelData = [UInt8](repeating: 0, count: width * height * 4)
        guard let colorSpace = CGColorSpace(name: CGColorSpace.sRGB),
              let ctx = CGContext(data: &pixelData, width: width, height: height,
                                  bitsPerComponent: 8, bytesPerRow: width * 4,
                                  space: colorSpace,
                                  bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue) else { return [] }
        ctx.draw(cgImage, in: CGRect(x: 0, y: 0, width: width, height: height))

        var results: [HSBColor] = []
        for i in stride(from: 0, to: pixelData.count, by: 4) {
            let r = Float(pixelData[i])     / 255.0
            let g = Float(pixelData[i + 1]) / 255.0
            let b = Float(pixelData[i + 2]) / 255.0
            let a = Float(pixelData[i + 3]) / 255.0
            guard a > 0.1 else { continue }
            let hsb = rgbToHSB(r: r, g: g, b: b)
            results.append(hsb)
        }
        return results
    }

    private func rgbToHSB(r: Float, g: Float, b: Float) -> HSBColor {
        let maxVal = max(r, g, b)
        let minVal = min(r, g, b)
        let delta = maxVal - minVal

        let brightness = maxVal
        let saturation = maxVal == 0 ? 0 : delta / maxVal

        var hue: Float = 0
        if delta > 0 {
            if maxVal == r {
                hue = (g - b) / delta
            } else if maxVal == g {
                hue = 2 + (b - r) / delta
            } else {
                hue = 4 + (r - g) / delta
            }
            hue /= 6
            if hue < 0 { hue += 1 }
        }
        return HSBColor(hue: hue, saturation: saturation, brightness: brightness)
    }
}

// MARK: - Supporting Types

struct HSBColor {
    let hue: Float
    let saturation: Float
    let brightness: Float
}

private extension Array where Element == Float {
    var average: Float {
        isEmpty ? 0 : reduce(0, +) / Float(count)
    }
}

private extension Int {
    var asFloat: Float { Float(self) }
}

private extension Float {
    var clamped: Float { max(0, min(1, self)) }
}
