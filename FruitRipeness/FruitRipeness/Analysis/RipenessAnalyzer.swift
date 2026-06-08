import CoreImage
import UIKit

struct RipenessAnalyzer {

    func analyze(image: CIImage, fruitType: FruitType) -> (score: Float, level: RipenessLevel) {
        let colors = dominantHSBValues(from: image)
        guard !colors.isEmpty else { return (0.5, .nearlyRipe) }

        switch fruitType {
        case .banana:      return analyzeBanana(colors)
        case .apple:       return analyzeApple(colors)
        case .orange:      return analyzeOrange(colors)
        case .mango:       return analyzeMango(colors)
        case .strawberry:  return analyzeStrawberry(colors)
        case .watermelon:  return analyzeWatermelon(colors)
        case .grape:       return analyzeGrape(colors)
        case .pear:        return analyzePear(colors)
        case .peach:       return analyzePeach(colors)
        case .kiwi:        return analyzeKiwi(colors)
        case .avocado:     return analyzeAvocado(colors)
        case .pineapple:   return analyzePineapple(colors)
        case .lemon:       return analyzeLemon(colors)
        case .cherry:      return analyzeCherry(colors)
        case .plum:        return analyzePlum(colors)
        case .blueberry:   return analyzeBlueberry(colors)
        case .raspberry:   return analyzeRaspberry(colors)
        case .tomato:      return analyzeTomato(colors)
        case .papaya:      return analyzePapaya(colors)
        case .pomegranate: return analyzePomegranate(colors)
        case .fig:         return analyzeFig(colors)
        case .apricot:     return analyzeApricot(colors)
        case .cantaloupe:  return analyzeCantaloupe(colors)
        case .coconut:     return analyzeCoconut(colors)
        case .dragonfruit: return analyzeDragonfruit(colors)
        case .guava:       return analyzeGuava(colors)
        case .lychee:      return analyzeLychee(colors)
        case .unknown:     return (0.5, .nearlyRipe)
        }
    }

    // MARK: - Original Fruits

    private func analyzeBanana(_ c: [HSBColor]) -> (Float, RipenessLevel) {
        let avgHue = c.map(\.hue).average
        let brownRatio = c.filter { $0.saturation < 0.3 && $0.brightness < 0.55 }.floatRatio(of: c.count)
        let score: Float
        if avgHue > 0.25      { score = 0.10 + brownRatio * 0.2 }
        else if avgHue > 0.12 { score = 0.60 + brownRatio * 0.3 }
        else                  { score = 0.85 + brownRatio * 0.15 }
        return (score.clamped, levelFromScore(score.clamped))
    }

    private func analyzeApple(_ c: [HSBColor]) -> (Float, RipenessLevel) {
        let redRatio         = c.filter { $0.hue < 0.05 || $0.hue > 0.92 }.floatRatio(of: c.count)
        let yellowGreenRatio = c.filter { $0.hue > 0.15 && $0.hue < 0.22 }.floatRatio(of: c.count)
        let greenRatio       = c.filter { $0.hue > 0.25 && $0.hue < 0.42 }.floatRatio(of: c.count)
        let score: Float = greenRatio > 0.4
            ? (0.2 + yellowGreenRatio * 0.5).clamped
            : (0.5 + redRatio * 0.5).clamped
        return (score, levelFromScore(score))
    }

    private func analyzeOrange(_ c: [HSBColor]) -> (Float, RipenessLevel) {
        let orangeRatio = c.filter { $0.hue > 0.04 && $0.hue < 0.12 && $0.saturation > 0.5 }.floatRatio(of: c.count)
        let greenRatio  = c.filter { $0.hue > 0.25 && $0.hue < 0.42 }.floatRatio(of: c.count)
        let score = (orangeRatio * 0.9 + (1 - greenRatio) * 0.1).clamped
        return (score, levelFromScore(score))
    }

    private func analyzeMango(_ c: [HSBColor]) -> (Float, RipenessLevel) {
        let deepOrange = c.filter { $0.hue > 0.04 && $0.hue < 0.09 && $0.saturation > 0.6 }.floatRatio(of: c.count)
        let yellow     = c.filter { $0.hue > 0.09 && $0.hue < 0.18 && $0.saturation > 0.4 }.floatRatio(of: c.count)
        let green      = c.filter { $0.hue > 0.28 && $0.hue < 0.42 }.floatRatio(of: c.count)
        let score = (deepOrange * 0.85 + yellow * 0.55 + green * 0.1).clamped
        return (score, levelFromScore(score))
    }

    private func analyzeStrawberry(_ c: [HSBColor]) -> (Float, RipenessLevel) {
        let deepRed  = c.filter { ($0.hue < 0.04 || $0.hue > 0.95) && $0.saturation > 0.55 && $0.brightness > 0.35 }.floatRatio(of: c.count)
        let pinkRatio = c.filter { $0.hue > 0.90 && $0.saturation < 0.45 }.floatRatio(of: c.count)
        let score = (deepRed * 0.85 + (1 - pinkRatio) * 0.15).clamped
        return (score, levelFromScore(score))
    }

    private func analyzeWatermelon(_ c: [HSBColor]) -> (Float, RipenessLevel) {
        let deepGreen  = c.filter { $0.hue > 0.28 && $0.hue < 0.42 && $0.saturation > 0.4 && $0.brightness < 0.55 }.floatRatio(of: c.count)
        let cream      = c.filter { $0.saturation < 0.2 && $0.brightness > 0.75 }.floatRatio(of: c.count)
        let lightGreen = c.filter { $0.hue > 0.28 && $0.hue < 0.42 && $0.brightness > 0.65 }.floatRatio(of: c.count)
        let score = (deepGreen * 0.5 + cream * 0.4 + (1 - lightGreen) * 0.1).clamped
        return (score, levelFromScore(score))
    }

    private func analyzeGrape(_ c: [HSBColor]) -> (Float, RipenessLevel) {
        let purple      = c.filter { $0.hue > 0.70 && $0.hue < 0.88 && $0.saturation > 0.3 }.floatRatio(of: c.count)
        let yellowGreen = c.filter { $0.hue > 0.18 && $0.hue < 0.28 }.floatRatio(of: c.count)
        let brightGreen = c.filter { $0.hue > 0.30 && $0.hue < 0.42 && $0.saturation > 0.5 }.floatRatio(of: c.count)
        let score: Float = purple > 0.2
            ? (purple * 0.9 + 0.1).clamped
            : (yellowGreen * 0.7 + brightGreen * 0.1).clamped
        return (score, levelFromScore(score))
    }

    private func analyzePear(_ c: [HSBColor]) -> (Float, RipenessLevel) {
        let golden = c.filter { $0.hue > 0.10 && $0.hue < 0.18 && $0.saturation > 0.3 }.floatRatio(of: c.count)
        let green  = c.filter { $0.hue > 0.28 && $0.hue < 0.42 && $0.saturation > 0.35 }.floatRatio(of: c.count)
        let score = (golden * 0.8 + (1 - green) * 0.2).clamped
        return (score, levelFromScore(score))
    }

    private func analyzePeach(_ c: [HSBColor]) -> (Float, RipenessLevel) {
        let peach = c.filter { $0.hue > 0.03 && $0.hue < 0.10 && $0.saturation > 0.3 }.floatRatio(of: c.count)
        let score = (peach * 0.9).clamped
        return (score, levelFromScore(score))
    }

    private func analyzeKiwi(_ c: [HSBColor]) -> (Float, RipenessLevel) {
        let brown = c.filter { $0.hue > 0.06 && $0.hue < 0.12 && $0.saturation > 0.2 && $0.saturation < 0.55 && $0.brightness < 0.55 }.floatRatio(of: c.count)
        let score = (brown * 0.85 + 0.1).clamped
        return (score, levelFromScore(score))
    }

    // MARK: - New Fruits

    private func analyzeAvocado(_ c: [HSBColor]) -> (Float, RipenessLevel) {
        // Ripe: very dark green / almost black-purple; unripe: bright green
        let darkGreen  = c.filter { $0.hue > 0.28 && $0.hue < 0.42 && $0.brightness < 0.35 }.floatRatio(of: c.count)
        let brightGreen = c.filter { $0.hue > 0.28 && $0.hue < 0.42 && $0.brightness > 0.55 }.floatRatio(of: c.count)
        let score = (darkGreen * 0.85 + (1 - brightGreen) * 0.15).clamped
        return (score, levelFromScore(score))
    }

    private func analyzePineapple(_ c: [HSBColor]) -> (Float, RipenessLevel) {
        // Ripe: golden yellow (hue 0.10–0.16, high sat); unripe: green
        let golden = c.filter { $0.hue > 0.10 && $0.hue < 0.16 && $0.saturation > 0.5 }.floatRatio(of: c.count)
        let green  = c.filter { $0.hue > 0.28 && $0.hue < 0.40 }.floatRatio(of: c.count)
        let score  = (golden * 0.8 + (1 - green) * 0.2).clamped
        return (score, levelFromScore(score))
    }

    private func analyzeLemon(_ c: [HSBColor]) -> (Float, RipenessLevel) {
        // Ripe: bright vivid yellow (hue 0.13–0.17, high sat); unripe: greenish
        let brightYellow = c.filter { $0.hue > 0.13 && $0.hue < 0.17 && $0.saturation > 0.7 }.floatRatio(of: c.count)
        let green        = c.filter { $0.hue > 0.25 && $0.hue < 0.40 }.floatRatio(of: c.count)
        let score = (brightYellow * 0.8 + (1 - green) * 0.2).clamped
        return (score, levelFromScore(score))
    }

    private func analyzeCherry(_ c: [HSBColor]) -> (Float, RipenessLevel) {
        // Ripe: deep red/burgundy; unripe: pale pink
        let deepRed = c.filter { ($0.hue < 0.03 || $0.hue > 0.95) && $0.saturation > 0.6 && $0.brightness < 0.55 }.floatRatio(of: c.count)
        let pink    = c.filter { $0.hue > 0.88 && $0.saturation < 0.4 }.floatRatio(of: c.count)
        let score = (deepRed * 0.85 + (1 - pink) * 0.15).clamped
        return (score, levelFromScore(score))
    }

    private func analyzePlum(_ c: [HSBColor]) -> (Float, RipenessLevel) {
        // Ripe: deep purple/blue-red (hue 0.72–0.85); unripe: greenish or light
        let deepPurple = c.filter { $0.hue > 0.72 && $0.hue < 0.85 && $0.saturation > 0.4 }.floatRatio(of: c.count)
        let redPurple  = c.filter { $0.hue > 0.88 && $0.saturation > 0.4 }.floatRatio(of: c.count)
        let score = ((deepPurple + redPurple) * 0.85 + 0.1).clamped
        return (score, levelFromScore(score))
    }

    private func analyzeBlueberry(_ c: [HSBColor]) -> (Float, RipenessLevel) {
        // Ripe: deep blue/blue-purple (hue 0.62–0.72)
        let deepBlue = c.filter { $0.hue > 0.62 && $0.hue < 0.72 && $0.saturation > 0.3 }.floatRatio(of: c.count)
        let pinkGreen = c.filter { ($0.hue > 0.28 && $0.hue < 0.42) || ($0.hue > 0.88) }.floatRatio(of: c.count)
        let score = (deepBlue * 0.85 + (1 - pinkGreen) * 0.15).clamped
        return (score, levelFromScore(score))
    }

    private func analyzeRaspberry(_ c: [HSBColor]) -> (Float, RipenessLevel) {
        // Ripe: bright red-pink (hue near 0.95–0.02, high sat, medium brightness)
        let brightRed = c.filter { ($0.hue < 0.03 || $0.hue > 0.93) && $0.saturation > 0.6 && $0.brightness > 0.4 }.floatRatio(of: c.count)
        let score = (brightRed * 0.9).clamped
        return (score, levelFromScore(score))
    }

    private func analyzeTomato(_ c: [HSBColor]) -> (Float, RipenessLevel) {
        // Green → orange → red
        let brightRed  = c.filter { ($0.hue < 0.04 || $0.hue > 0.94) && $0.saturation > 0.65 }.floatRatio(of: c.count)
        let orangeRed  = c.filter { $0.hue > 0.04 && $0.hue < 0.08 }.floatRatio(of: c.count)
        let green      = c.filter { $0.hue > 0.28 && $0.hue < 0.42 }.floatRatio(of: c.count)
        let score = (brightRed * 0.8 + orangeRed * 0.4 + green * 0.05).clamped
        return (score, levelFromScore(score))
    }

    private func analyzePapaya(_ c: [HSBColor]) -> (Float, RipenessLevel) {
        // Ripe: yellow-orange (hue 0.08–0.14)
        let yellowOrange = c.filter { $0.hue > 0.08 && $0.hue < 0.14 && $0.saturation > 0.5 }.floatRatio(of: c.count)
        let green        = c.filter { $0.hue > 0.28 && $0.hue < 0.40 }.floatRatio(of: c.count)
        let score = (yellowOrange * 0.8 + (1 - green) * 0.2).clamped
        return (score, levelFromScore(score))
    }

    private func analyzePomegranate(_ c: [HSBColor]) -> (Float, RipenessLevel) {
        // Ripe: deep red, slightly cracked skin
        let deepRed = c.filter { ($0.hue < 0.03 || $0.hue > 0.95) && $0.saturation > 0.55 }.floatRatio(of: c.count)
        let score = (deepRed * 0.9 + 0.05).clamped
        return (score, levelFromScore(score))
    }

    private func analyzeFig(_ c: [HSBColor]) -> (Float, RipenessLevel) {
        // Ripe: deep purple/brown; unripe: light green-purple
        let deepPurple = c.filter { $0.hue > 0.72 && $0.hue < 0.85 && $0.brightness < 0.5 }.floatRatio(of: c.count)
        let lightGreen = c.filter { $0.hue > 0.28 && $0.hue < 0.42 && $0.brightness > 0.5 }.floatRatio(of: c.count)
        let score = (deepPurple * 0.8 + (1 - lightGreen) * 0.2).clamped
        return (score, levelFromScore(score))
    }

    private func analyzeApricot(_ c: [HSBColor]) -> (Float, RipenessLevel) {
        // Ripe: golden orange (hue 0.07–0.11, sat > 0.55)
        let golden = c.filter { $0.hue > 0.07 && $0.hue < 0.11 && $0.saturation > 0.55 }.floatRatio(of: c.count)
        let pale   = c.filter { $0.saturation < 0.3 }.floatRatio(of: c.count)
        let score = (golden * 0.85 + (1 - pale) * 0.15).clamped
        return (score, levelFromScore(score))
    }

    private func analyzeCantaloupe(_ c: [HSBColor]) -> (Float, RipenessLevel) {
        // Ripe: creamy tan/golden (hue 0.09–0.14, moderate sat)
        let tan   = c.filter { $0.hue > 0.09 && $0.hue < 0.14 && $0.saturation > 0.2 && $0.saturation < 0.6 }.floatRatio(of: c.count)
        let green = c.filter { $0.hue > 0.28 && $0.hue < 0.42 }.floatRatio(of: c.count)
        let score = (tan * 0.7 + (1 - green) * 0.3).clamped
        return (score, levelFromScore(score))
    }

    private func analyzeCoconut(_ c: [HSBColor]) -> (Float, RipenessLevel) {
        // Mature: brown (hue 0.07–0.11, low sat, low-medium brightness)
        let brown = c.filter { $0.hue > 0.06 && $0.hue < 0.12 && $0.saturation > 0.15 && $0.brightness < 0.60 }.floatRatio(of: c.count)
        let green = c.filter { $0.hue > 0.28 && $0.hue < 0.42 }.floatRatio(of: c.count)
        let score = (brown * 0.7 + (1 - green) * 0.3).clamped
        return (score, levelFromScore(score))
    }

    private func analyzeDragonfruit(_ c: [HSBColor]) -> (Float, RipenessLevel) {
        // Ripe: vivid pink/magenta (hue 0.88–0.97, high sat)
        let vividPink  = c.filter { $0.hue > 0.88 && $0.hue < 0.97 && $0.saturation > 0.55 }.floatRatio(of: c.count)
        let greenTinge = c.filter { $0.hue > 0.28 && $0.hue < 0.40 && $0.saturation > 0.4 }.floatRatio(of: c.count)
        let score = (vividPink * 0.85 + (1 - greenTinge) * 0.15).clamped
        return (score, levelFromScore(score))
    }

    private func analyzeGuava(_ c: [HSBColor]) -> (Float, RipenessLevel) {
        // Ripe: yellow-green to soft yellow (hue 0.17–0.25)
        let yellowGreen = c.filter { $0.hue > 0.17 && $0.hue < 0.25 && $0.saturation > 0.3 }.floatRatio(of: c.count)
        let brightGreen = c.filter { $0.hue > 0.28 && $0.hue < 0.40 && $0.saturation > 0.5 }.floatRatio(of: c.count)
        let score = (yellowGreen * 0.75 + (1 - brightGreen) * 0.25).clamped
        return (score, levelFromScore(score))
    }

    private func analyzeLychee(_ c: [HSBColor]) -> (Float, RipenessLevel) {
        // Ripe: bright pink-red (hue 0.93–0.99 or < 0.02, high sat)
        let pinkRed = c.filter { ($0.hue > 0.93 || $0.hue < 0.02) && $0.saturation > 0.5 }.floatRatio(of: c.count)
        let brown   = c.filter { $0.hue > 0.06 && $0.hue < 0.10 && $0.saturation < 0.4 }.floatRatio(of: c.count)
        let score = (pinkRed * 0.75 + (1 - brown) * 0.25).clamped
        return (score, levelFromScore(score))
    }

    // MARK: - Helpers

    private func levelFromScore(_ s: Float) -> RipenessLevel {
        switch s {
        case 0.0..<0.30:  return .unripe
        case 0.30..<0.55: return .nearlyRipe
        case 0.55..<0.88: return .ripe
        default:           return .overripe
        }
    }

    private func dominantHSBValues(from ciImage: CIImage) -> [HSBColor] {
        let scale = 20.0 / max(ciImage.extent.width, ciImage.extent.height)
        let scaled = ciImage.transformed(by: CGAffineTransform(scaleX: scale, y: scale))
        let context = CIContext()
        guard let cgImage = context.createCGImage(scaled, from: scaled.extent) else { return [] }

        let w = cgImage.width, h = cgImage.height
        guard w > 0, h > 0 else { return [] }

        var px = [UInt8](repeating: 0, count: w * h * 4)
        guard let cs = CGColorSpace(name: CGColorSpace.sRGB),
              let ctx = CGContext(data: &px, width: w, height: h,
                                  bitsPerComponent: 8, bytesPerRow: w * 4,
                                  space: cs,
                                  bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue) else { return [] }
        ctx.draw(cgImage, in: CGRect(x: 0, y: 0, width: w, height: h))

        return stride(from: 0, to: px.count, by: 4).compactMap { i -> HSBColor? in
            guard px[i + 3] > 25 else { return nil }
            return rgbToHSB(r: Float(px[i])/255, g: Float(px[i+1])/255, b: Float(px[i+2])/255)
        }
    }

    private func rgbToHSB(r: Float, g: Float, b: Float) -> HSBColor {
        let maxV = max(r, g, b), minV = min(r, g, b), delta = maxV - minV
        var hue: Float = 0
        if delta > 0 {
            if maxV == r      { hue = (g - b) / delta }
            else if maxV == g { hue = 2 + (b - r) / delta }
            else              { hue = 4 + (r - g) / delta }
            hue /= 6
            if hue < 0 { hue += 1 }
        }
        return HSBColor(hue: hue,
                        saturation: maxV == 0 ? 0 : delta / maxV,
                        brightness: maxV)
    }
}

// MARK: - Supporting Types

struct HSBColor {
    let hue: Float
    let saturation: Float
    let brightness: Float
}

private extension Array where Element == Float {
    var average: Float { isEmpty ? 0 : reduce(0, +) / Float(count) }
}

private extension Array where Element == HSBColor {
    func floatRatio(of total: Int) -> Float {
        total == 0 ? 0 : Float(count) / Float(total)
    }
}

private extension Float {
    var clamped: Float { max(0, min(1, self)) }
}
