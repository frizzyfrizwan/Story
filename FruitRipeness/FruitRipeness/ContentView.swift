import SwiftUI

struct ContentView: View {
    @StateObject private var camera      = CameraManager()
    @StateObject private var detector    = FruitDetector()
    @StateObject private var imageLoader = FruitImageLoader()

    // Card drag state
    @State private var cardHeight: CGFloat = 260
    private let collapsedHeight: CGFloat   = 260
    private let expandedHeight: CGFloat    = 520

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
            imageLoader.preloadAll()
        }
        .onDisappear { camera.stopSession() }
    }

    // MARK: - Main view

    private var scannerView: some View {
        ZStack(alignment: .bottom) {
            // Live camera feed
            CameraPreviewView(session: camera.captureSession)
                .ignoresSafeArea()

            // Animated scan frame — adapts to ScanState
            ScanningOverlayView(scanState: detector.scanState)
                .ignoresSafeArea()

            // Top status bar
            VStack { topBar; Spacer() }

            // Bottom sheet area — switches between idle pill / picker / result
            bottomContent
        }
        .preferredColorScheme(.dark)
    }

    // MARK: - Bottom content (state-driven)

    @ViewBuilder
    private var bottomContent: some View {
        switch detector.scanState {

        case .idle:
            idlePill
                .transition(.opacity.combined(with: .move(edge: .bottom)))

        case .scanning:
            // Keep showing whatever was there before; scanning is silent
            EmptyView()

        case .ambiguous(let candidates):
            CandidatePickerView(
                candidates: candidates,
                onConfirm: { detector.confirmFruit($0) },
                onDismiss: { detector.resetScan() }
            )
            .padding(.horizontal, 12)
            .padding(.bottom, 28)
            .transition(.move(edge: .bottom).combined(with: .opacity))

        case .result(let result):
            ResultCardView(result: result)
                .environmentObject(imageLoader)
                .frame(height: cardHeight)
                .padding(.horizontal, 0)
                .transition(.move(edge: .bottom).combined(with: .opacity))
                .gesture(
                    DragGesture()
                        .onChanged { drag in
                            let newH = cardHeight - drag.translation.height
                            cardHeight = max(collapsedHeight, min(expandedHeight, newH))
                        }
                        .onEnded { drag in
                            withAnimation(.spring(response: 0.35, dampingFraction: 0.78)) {
                                cardHeight = drag.translation.height < -60
                                    ? expandedHeight : collapsedHeight
                            }
                        }
                )
        }
    }

    // MARK: - Top bar

    private var topBar: some View {
        HStack {
            VStack(alignment: .leading, spacing: 2) {
                Text("FruitRipeness")
                    .font(.title3.weight(.bold))
                    .foregroundColor(.white)
                Text("Point your camera at any fruit")
                    .font(.caption)
                    .foregroundColor(.white.opacity(0.6))
            }
            Spacer()

            if detector.isAnalyzing {
                HStack(spacing: 6) {
                    ProgressView().tint(.white).scaleEffect(0.75)
                    Text("Scanning")
                        .font(.caption.weight(.medium))
                        .foregroundColor(.white)
                }
                .padding(.horizontal, 10)
                .padding(.vertical, 6)
                .background(Color.white.opacity(0.15))
                .clipShape(Capsule())
                .transition(.opacity)
            }

            // Rescan button when a result is showing
            if case .result = detector.scanState {
                Button { detector.resetScan() } label: {
                    Image(systemName: "arrow.counterclockwise.circle.fill")
                        .font(.title2)
                        .foregroundColor(.white.opacity(0.75))
                }
                .transition(.scale.combined(with: .opacity))
            }
        }
        .padding(.horizontal, 20)
        .padding(.top, 60)
        .padding(.bottom, 12)
        .background(
            LinearGradient(colors: [.black.opacity(0.6), .clear],
                           startPoint: .top, endPoint: .bottom)
        )
        .animation(.easeInOut(duration: 0.25), value: detector.isAnalyzing)
    }

    // MARK: - Idle pill

    private var idlePill: some View {
        HStack(spacing: 8) {
            Image(systemName: "camera.viewfinder")
                .foregroundColor(.white.opacity(0.7))
            Text("Point at a fruit to scan")
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
