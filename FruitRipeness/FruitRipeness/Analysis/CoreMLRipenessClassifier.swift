import Vision
import CoreML
import CoreImage

// Loads and runs a custom Core ML image classifier for fruit ripeness.
//
// To add your own model:
//   1. Open Create ML (Xcode menu → Open Developer Tool → Create ML)
//   2. New project → Image Classification
//   3. Create folders named exactly: apple_ripe, apple_unripe, apple_overripe,
//      banana_ripe, banana_unripe, banana_overripe, watermelon_ripe,
//      watermelon_unripe, orange_ripe, mango_ripe, mango_unripe, etc.
//   4. Add ~30-100 photos per folder (search Google Images or take your own)
//   5. Train → export as "FruitRipenessModel.mlmodel"
//   6. Drag the .mlmodel file into your Xcode project (check "Add to target")
//   7. Build and run — the app will automatically use the model
//
// Supported label format:  {fruitname}_{ripeness}
// Ripeness tokens:  unripe | nearly_ripe | ripe | overripe
// Examples:  watermelon_ripe, banana_overripe, apple_unripe

final class CoreMLRipenessClassifier {

    private var visionModel: VNCoreMLModel?

    init() {
        guard let url = Bundle.main.url(forResource: "FruitRipenessModel", withExtension: "mlmodelc")
               ?? Bundle.main.url(forResource: "FruitRipenessModel", withExtension: "mlpackage")
               ?? Bundle.main.url(forResource: "FruitRipenessModel", withExtension: "mlmodel") else {
            print("[CoreML] FruitRipenessModel not found in bundle — using fallback")
            return
        }
        do {
            let mlModel = try MLModel(contentsOf: url)
            visionModel = try VNCoreMLModel(for: mlModel)
            print("[CoreML] Model loaded successfully from \(url.lastPathComponent)")
        } catch {
            print("[CoreML] Failed to load model: \(error)")
        }
    }

    var isAvailable: Bool { visionModel != nil }

    // Returns the top prediction or nil if the model isn't loaded / fails.
    func classify(_ image: CIImage) async -> CoreMLPrediction? {
        guard let visionModel else { return nil }

        return await withCheckedContinuation { continuation in
            let request = VNCoreMLRequest(model: visionModel) { req, error in
                guard error == nil,
                      let observations = req.results as? [VNClassificationObservation],
                      let top = observations.first,
                      top.confidence > 0.35 else {
                    continuation.resume(returning: nil)
                    return
                }
                continuation.resume(returning: CoreMLPrediction(from: top))
            }
            request.imageCropAndScaleOption = .centerCrop

            let handler = VNImageRequestHandler(ciImage: image, options: [:])
            do {
                try handler.perform([request])
            } catch {
                print("[CoreML] Request failed: \(error)")
                continuation.resume(returning: nil)
            }
        }
    }
}

// MARK: - Prediction

struct CoreMLPrediction {
    let fruitType: FruitType
    let ripenessLevel: RipenessLevel
    let confidence: Float
    let rawLabel: String

    init?(from observation: VNClassificationObservation) {
        rawLabel = observation.identifier
        confidence = observation.confidence

        // Parse "fruit_ripeness" or "fruit_nearly_ripe" etc.
        let parts = observation.identifier.lowercased().split(separator: "_", maxSplits: 1)
        guard parts.count == 2 else { return nil }

        let fruitToken   = String(parts[0])
        let ripenessToken = String(parts[1])

        fruitType = FruitType(rawValue: fruitToken) ?? .unknown
        switch ripenessToken {
        case "unripe":       ripenessLevel = .unripe
        case "nearly_ripe":  ripenessLevel = .nearlyRipe
        case "ripe":         ripenessLevel = .ripe
        case "overripe":     ripenessLevel = .overripe
        default:             ripenessLevel = .ripe
        }
    }
}
