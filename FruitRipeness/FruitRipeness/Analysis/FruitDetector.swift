import Vision
import CoreImage

// Detects fruit and assesses ripeness using:
//   1. Core ML model (FruitRipenessModel.mlmodel) — if present in the bundle
//   2. Vision built-in classifier + color-histogram analysis — always available fallback
@MainActor
final class FruitDetector: ObservableObject {

    @Published var latestResult: FruitAnalysisResult?
    @Published var isAnalyzing = false
    @Published var usingCoreML = false

    private let coreML  = CoreMLRipenessClassifier()
    private let analyzer = RipenessAnalyzer()
    private var frameCount = 0
    private let analyzeEveryNFrames = 15   // ~0.5 fps at 30fps

    // MARK: - Frame Entry Point

    func processFrame(_ ciImage: CIImage) {
        frameCount += 1
        guard frameCount % analyzeEveryNFrames == 0 else { return }
        isAnalyzing = true

        Task.detached(priority: .userInitiated) { [weak self] in
            guard let self else { return }

            let result: FruitAnalysisResult?
            if await self.coreML.isAvailable {
                result = await self.runCoreML(on: ciImage)
            } else {
                result = await self.runVisionFallback(on: ciImage)
            }

            await MainActor.run {
                if let result { self.latestResult = result }
                self.usingCoreML = self.coreML.isAvailable
                self.isAnalyzing = false
            }
        }
    }

    // MARK: - Core ML Path

    private func runCoreML(on image: CIImage) async -> FruitAnalysisResult? {
        guard let prediction = await coreML.classify(image) else {
            // Core ML returned nothing — fall back silently
            return await runVisionFallback(on: image)
        }

        let tips = RipenessTips.tips(for: prediction.fruitType, ripeness: prediction.ripenessLevel)
        return FruitAnalysisResult(
            fruitType: prediction.fruitType,
            detectionConfidence: prediction.confidence,
            ripenessLevel: prediction.ripenessLevel,
            ripenessScore: prediction.ripenessLevel.score,
            tips: tips,
            usedCoreML: true
        )
    }

    // MARK: - Vision + Color Fallback

    private func runVisionFallback(on image: CIImage) async -> FruitAnalysisResult? {
        return await withCheckedContinuation { continuation in
            let request = VNClassifyImageRequest { [weak self] req, error in
                guard let self else { continuation.resume(returning: nil); return }

                if let error {
                    print("[Detector] Vision error: \(error)")
                    continuation.resume(returning: nil)
                    return
                }

                let observations = (req.results as? [VNClassificationObservation]) ?? []

                var bestFruit: FruitType = .unknown
                var bestConfidence: Float = 0

                for fruit in FruitType.allCases where fruit != .unknown {
                    for label in fruit.visionLabels {
                        if let obs = observations.first(where: {
                            $0.identifier.lowercased().contains(label.lowercased())
                        }), obs.confidence > bestConfidence {
                            bestConfidence = obs.confidence
                            bestFruit = fruit
                        }
                    }
                }

                guard bestFruit != .unknown, bestConfidence > 0.1 else {
                    continuation.resume(returning: FruitAnalysisResult(
                        fruitType: .unknown,
                        detectionConfidence: 0,
                        ripenessLevel: .ripe,
                        ripenessScore: 0.5,
                        tips: ["Point the camera at a fruit"],
                        usedCoreML: false
                    ))
                    return
                }

                let (score, level) = self.analyzer.analyze(image: image, fruitType: bestFruit)
                let tips = RipenessTips.tips(for: bestFruit, ripeness: level)

                continuation.resume(returning: FruitAnalysisResult(
                    fruitType: bestFruit,
                    detectionConfidence: bestConfidence,
                    ripenessLevel: level,
                    ripenessScore: score,
                    tips: tips,
                    usedCoreML: false
                ))
            }

            let handler = VNImageRequestHandler(ciImage: image, options: [:])
            do {
                try handler.perform([request])
            } catch {
                print("[Detector] Handler error: \(error)")
                continuation.resume(returning: nil)
            }
        }
    }
}
