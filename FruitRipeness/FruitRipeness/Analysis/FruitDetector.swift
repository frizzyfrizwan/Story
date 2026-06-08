import SwiftUI
import Vision
import CoreImage

// State-machine based fruit detector.
//
// Flow:  idle → scanning → ambiguous (user picks) OR result (auto-confirmed)
//
// Disambiguation rule:
//   If top confidence ≥ 0.55 AND it is ≥ 1.8× the second candidate → auto-confirm.
//   Otherwise show the top candidates and let the user tap to confirm.
//
// After confirmation the detected fruit is locked for `lockDuration` seconds so
// the card doesn't flicker while the user is reading it.
@MainActor
final class FruitDetector: ObservableObject {

    @Published var scanState: ScanState = .idle
    @Published var isAnalyzing = false

    private let coreML   = CoreMLRipenessClassifier()
    private let analyzer = RipenessAnalyzer()

    private var lastFrame: CIImage?
    private var frameCount = 0
    private let analyzeEvery = 10          // frames between Vision calls (~1 fps at 30 fps)
    private let lockDuration: TimeInterval = 6

    private var lockedFruit: FruitType?    // set when user (or auto) confirms
    private var lockTask: Task<Void, Never>?

    // MARK: - Frame Entry

    func processFrame(_ ciImage: CIImage) {
        lastFrame = ciImage
        frameCount += 1

        if let locked = lockedFruit {
            // Re-run ripeness on the locked fruit every ~2 s while card is visible
            guard frameCount % 60 == 0 else { return }
            Task.detached(priority: .utility) { [weak self] in
                guard let self else { return }
                await self.buildResult(fruitType: locked, image: ciImage,
                                       confidence: 0.95, usedCoreML: false)
            }
            return
        }

        guard frameCount % analyzeEvery == 0 else { return }
        guard !isAnalyzing else { return }
        isAnalyzing = true

        Task.detached(priority: .userInitiated) { [weak self] in
            guard let self else { return }
            let candidates = await self.detectCandidates(ciImage)
            await MainActor.run { self.handleCandidates(candidates, frame: ciImage) }
        }
    }

    // MARK: - User Confirmation (from CandidatePickerView)

    func confirmFruit(_ type: FruitType) {
        UIImpactFeedbackGenerator(style: .medium).impactOccurred()
        guard let frame = lastFrame else { return }
        lockedFruit = type
        isAnalyzing = true
        scheduleLockRelease()

        Task.detached(priority: .userInitiated) { [weak self] in
            guard let self else { return }
            await self.buildResult(fruitType: type, image: frame,
                                   confidence: 1.0, usedCoreML: false)
        }
    }

    func resetScan() {
        lockTask?.cancel()
        lockedFruit = nil
        withAnimation(.easeOut(duration: 0.25)) { scanState = .idle }
    }

    // MARK: - Candidate Evaluation

    private func handleCandidates(_ candidates: [FruitCandidate], frame: CIImage) {
        isAnalyzing = false

        guard let top = candidates.first, top.confidence > 0.08 else {
            withAnimation(.easeOut(duration: 0.3)) { scanState = .idle }
            return
        }

        let second = candidates.dropFirst().first
        let isConfident = top.confidence >= 0.55
            && (second == nil || top.confidence >= second!.confidence * 1.8)

        if isConfident {
            lockedFruit = top.fruitType
            scheduleLockRelease()
            isAnalyzing = true
            Task.detached(priority: .userInitiated) { [weak self] in
                guard let self else { return }
                await self.buildResult(fruitType: top.fruitType, image: frame,
                                       confidence: top.confidence, usedCoreML: false)
            }
        } else {
            let topN = Array(candidates.prefix(4).filter { $0.confidence > 0.07 })
            guard topN.count > 1 else { return }
            withAnimation(.spring(response: 0.38, dampingFraction: 0.75)) {
                scanState = .ambiguous(topN)
            }
        }
    }

    // MARK: - Result Builder

    private func buildResult(fruitType: FruitType, image: CIImage,
                              confidence: Float, usedCoreML: Bool) async {
        let (score, level) = analyzer.analyze(image: image, fruitType: fruitType)
        let tips = RipenessTips.tips(for: fruitType, ripeness: level)
        let result = FruitAnalysisResult(
            fruitType: fruitType,
            detectionConfidence: confidence,
            ripenessLevel: level,
            ripenessScore: score,
            tips: tips,
            usedCoreML: usedCoreML
        )
        await MainActor.run {
            withAnimation(.spring(response: 0.42, dampingFraction: 0.78)) {
                scanState = .result(result)
            }
            isAnalyzing = false
            UINotificationFeedbackGenerator().notificationOccurred(.success)
        }
    }

    // MARK: - Lock Timer

    private func scheduleLockRelease() {
        lockTask?.cancel()
        lockTask = Task { [weak self] in
            try? await Task.sleep(nanoseconds: UInt64(self?.lockDuration ?? 6) * 1_000_000_000)
            guard !Task.isCancelled else { return }
            await MainActor.run { [weak self] in
                self?.lockedFruit = nil
            }
        }
    }

    // MARK: - Vision Detection

    private func detectCandidates(_ image: CIImage) async -> [FruitCandidate] {
        // Core ML path
        if coreML.isAvailable, let pred = await coreML.classify(image) {
            return [FruitCandidate(fruitType: pred.fruitType, confidence: pred.confidence)]
        }

        // Vision built-in classifier
        return await withCheckedContinuation { continuation in
            let request = VNClassifyImageRequest { req, _ in
                let obs = (req.results as? [VNClassificationObservation]) ?? []
                var seen = Set<FruitType>()
                var candidates: [FruitCandidate] = []

                for fruit in FruitType.allCases where fruit != .unknown {
                    for label in fruit.visionLabels {
                        if let match = obs.first(where: {
                            $0.identifier.lowercased().contains(label.lowercased())
                        }), !seen.contains(fruit) {
                            seen.insert(fruit)
                            candidates.append(FruitCandidate(fruitType: fruit,
                                                              confidence: match.confidence))
                        }
                    }
                }
                continuation.resume(returning: candidates.sorted { $0.confidence > $1.confidence })
            }

            let handler = VNImageRequestHandler(ciImage: image, options: [:])
            try? handler.perform([request])
        }
    }
}
