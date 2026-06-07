import SwiftUI

struct ContentView: View {
    @StateObject private var camera  = CameraManager()
    @StateObject private var detector = FruitDetector()

    // Card height states
    @State private var cardHeight: CGFloat = 220
    private let collapsedHeight: CGFloat  = 220
    private let expandedHeight: CGFloat   = 440

    var body: some View {
        Group {
            if camera.permissionGranted {
                scannerView
            } else {
                PermissionView()
            }
        }
        .onAppear {
            camera.detector = detector
            camera.requestPermissionAndStart()
        }
        .onDisappear {
            camera.stopSession()
        }
    }

    // MARK: - Main Scanner

    private var scannerView: some View {
        ZStack(alignment: .bottom) {
            // Full-screen camera feed
            CameraPreviewView(session: camera.captureSession)
                .ignoresSafeArea()

            // Scanning overlay
            ScanningOverlayView(
                isAnalyzing: detector.isAnalyzing,
                hasResult: detector.latestResult != nil
            )
            .ignoresSafeArea()

            // Top bar
            VStack {
                topBar
                Spacer()
            }

            // Result card (always visible at bottom; grows when a result arrives)
            VStack(spacing: 0) {
                if let result = detector.latestResult {
                    ResultCardView(result: result)
                        .frame(height: cardHeight)
                        .transition(.move(edge: .bottom).combined(with: .opacity))
                        .animation(.spring(response: 0.45, dampingFraction: 0.8), value: result.id)
                        .gesture(
                            DragGesture()
                                .onChanged { drag in
                                    let newHeight = cardHeight - drag.translation.height
                                    cardHeight = max(collapsedHeight, min(expandedHeight, newHeight))
                                }
                                .onEnded { drag in
                                    withAnimation(.spring(response: 0.35)) {
                                        cardHeight = drag.translation.height < -60
                                            ? expandedHeight
                                            : collapsedHeight
                                    }
                                }
                        )
                } else {
                    nothingDetectedPill
                }
            }
        }
        .preferredColorScheme(.dark)
    }

    // MARK: - Top Bar

    private var topBar: some View {
        HStack {
            VStack(alignment: .leading, spacing: 2) {
                Text("FruitRipeness")
                    .font(.title3.weight(.bold))
                    .foregroundColor(.white)
                Text("AI-powered ripeness scanner")
                    .font(.caption)
                    .foregroundColor(.white.opacity(0.65))
            }
            Spacer()

            if detector.isAnalyzing {
                HStack(spacing: 6) {
                    ProgressView()
                        .tint(.white)
                        .scaleEffect(0.75)
                    Text("Scanning")
                        .font(.caption.weight(.medium))
                        .foregroundColor(.white)
                }
                .padding(.horizontal, 10)
                .padding(.vertical, 6)
                .background(Color.white.opacity(0.15))
                .clipShape(Capsule())
            }
        }
        .padding(.horizontal, 20)
        .padding(.top, 60)
        .padding(.bottom, 12)
        .background(
            LinearGradient(
                colors: [.black.opacity(0.6), .clear],
                startPoint: .top,
                endPoint: .bottom
            )
        )
    }

    // MARK: - Nothing Detected Pill

    private var nothingDetectedPill: some View {
        HStack(spacing: 8) {
            Image(systemName: "camera.viewfinder")
                .foregroundColor(.white.opacity(0.7))
            Text("Point the camera at a fruit")
                .font(.subheadline)
                .foregroundColor(.white.opacity(0.7))
        }
        .padding(.horizontal, 20)
        .padding(.vertical, 12)
        .background(.ultraThinMaterial)
        .clipShape(Capsule())
        .padding(.bottom, 40)
    }
}
