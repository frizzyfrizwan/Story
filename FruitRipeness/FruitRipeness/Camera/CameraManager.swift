import AVFoundation
import CoreImage
import UIKit

// Manages the AVCaptureSession and delivers frames to the FruitDetector.
@MainActor
final class CameraManager: NSObject, ObservableObject {

    @Published var permissionGranted = false
    @Published var isRunning = false
    @Published var error: CameraError?

    // Exposed so CameraPreviewView can attach the preview layer
    let captureSession = AVCaptureSession()

    private let videoOutput = AVCaptureVideoDataOutput()
    private let sessionQueue = DispatchQueue(label: "camera.session", qos: .userInitiated)

    // The detector receives raw CIImage frames
    weak var detector: FruitDetector?

    // MARK: - Setup

    func requestPermissionAndStart() {
        switch AVCaptureDevice.authorizationStatus(for: .video) {
        case .authorized:
            permissionGranted = true
            startSession()
        case .notDetermined:
            AVCaptureDevice.requestAccess(for: .video) { [weak self] granted in
                Task { @MainActor [weak self] in
                    self?.permissionGranted = granted
                    if granted { self?.startSession() }
                }
            }
        case .denied, .restricted:
            permissionGranted = false
            error = .permissionDenied
        @unknown default:
            break
        }
    }

    private func startSession() {
        sessionQueue.async { [weak self] in
            guard let self else { return }
            self.configureSession()
            self.captureSession.startRunning()
            Task { @MainActor [weak self] in
                self?.isRunning = true
            }
        }
    }

    private func configureSession() {
        captureSession.beginConfiguration()
        captureSession.sessionPreset = .high

        // Back camera
        guard let device = AVCaptureDevice.default(.builtInWideAngleCamera, for: .video, position: .back),
              let input = try? AVCaptureDeviceInput(device: device),
              captureSession.canAddInput(input) else {
            Task { @MainActor [weak self] in self?.error = .deviceUnavailable }
            captureSession.commitConfiguration()
            return
        }
        captureSession.addInput(input)

        // Video output for frame delivery
        videoOutput.setSampleBufferDelegate(self, queue: sessionQueue)
        videoOutput.alwaysDiscardsLateVideoFrames = true
        if captureSession.canAddOutput(videoOutput) {
            captureSession.addOutput(videoOutput)
        }

        // Lock to portrait
        if let connection = videoOutput.connection(with: .video) {
            if connection.isVideoOrientationSupported {
                connection.videoOrientation = .portrait
            }
        }

        captureSession.commitConfiguration()
    }

    func stopSession() {
        sessionQueue.async { [weak self] in
            self?.captureSession.stopRunning()
            Task { @MainActor [weak self] in self?.isRunning = false }
        }
    }
}

// MARK: - Sample Buffer Delegate

extension CameraManager: AVCaptureVideoDataOutputSampleBufferDelegate {
    nonisolated func captureOutput(_ output: AVCaptureOutput,
                                    didOutput sampleBuffer: CMSampleBuffer,
                                    from connection: AVCaptureConnection) {
        guard let pixelBuffer = CMSampleBufferGetImageBuffer(sampleBuffer) else { return }
        let ciImage = CIImage(cvPixelBuffer: pixelBuffer)
        Task { @MainActor [weak self] in
            self?.detector?.processFrame(ciImage)
        }
    }
}

// MARK: - Error

enum CameraError: Error, LocalizedError {
    case permissionDenied
    case deviceUnavailable

    var errorDescription: String? {
        switch self {
        case .permissionDenied:   return "Camera access was denied. Enable it in Settings."
        case .deviceUnavailable:  return "Could not access the camera on this device."
        }
    }
}
