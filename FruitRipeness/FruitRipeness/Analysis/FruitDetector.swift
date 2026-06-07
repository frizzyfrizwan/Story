import Vision
import CoreImage
import Combine

// Uses Apple's built-in Vision classifier to detect fruits in a frame.
// Emits FruitAnalysisResult via the resultPublisher subject.
@MainActor
final class FruitDetector: ObservableObject {

    @Published var latestResult: FruitAnalysisResult?
    @Published var isAnalyzing = false

    private let analyzer = RipenessAnalyzer()
    private var frameCount = 0
    private let analyzeEveryNFrames = 15   // ~0.5 fps on a 30fps feed

    // MARK: - Process Frame

    func processFrame(_ ciImage: CIImage) {
        frameCount += 1
        guard frameCount % analyzeEveryNFrames == 0 else { return }

        isAnalyzing = true

        // Run Vision off the main thread
        Task.detached(priority: .userInitiated) { [weak self] in
            guard let self else { return }
            let result = await self.classify(ciImage)
            await MainActor.run {
                self.latestResult = result
                self.isAnalyzing = false
            }
        }
    }

    // MARK: - Vision Classification

    private func classify(_ image: CIImage) async -> FruitAnalysisResult? {
        return await withCheckedContinuation { continuation in
            let request = VNClassifyImageRequest { [weak self] request, error in
                guard let self else { continuation.resume(returning: nil); return }

                if let error {
                    print("[FruitDetector] Vision error: \(error)")
                    continuation.resume(returning: nil)
                    return
                }

                let observations = (request.results as? [VNClassificationObservation]) ?? []

                // Find the best matching fruit
                var bestFruit: FruitType = .unknown
                var bestConfidence: Float = 0

                for fruit in FruitType.allCases where fruit != .unknown {
                    for label in fruit.visionLabels {
                        if let obs = observations.first(where: {
                            $0.identifier.lowercased().contains(label.lowercased())
                        }) {
                            if obs.confidence > bestConfidence {
                                bestConfidence = obs.confidence
                                bestFruit = fruit
                            }
                        }
                    }
                }

                // If no fruit found with decent confidence, report unknown
                guard bestFruit != .unknown, bestConfidence > 0.1 else {
                    continuation.resume(returning: FruitAnalysisResult(
                        fruitType: .unknown,
                        detectionConfidence: 0,
                        ripenessLevel: .ripe,
                        ripenessScore: 0.5,
                        tips: ["Point the camera at a fruit"]
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
                    tips: tips
                ))
            }

            let handler = VNImageRequestHandler(ciImage: image, options: [:])
            do {
                try handler.perform([request])
            } catch {
                print("[FruitDetector] Handler error: \(error)")
                continuation.resume(returning: nil)
            }
        }
    }
}
