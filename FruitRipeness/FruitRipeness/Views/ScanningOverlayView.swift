import SwiftUI

// Animated scanning frame drawn over the camera feed.
struct ScanningOverlayView: View {
    let isAnalyzing: Bool
    let hasResult: Bool

    @State private var scanLineOffset: CGFloat = -1
    @State private var pulseScale: CGFloat = 1.0
    @State private var cornerOpacity: Double = 1.0

    private let frameSize: CGFloat = 260
    private let cornerLength: CGFloat = 28
    private let cornerWidth: CGFloat = 4
    private let cornerRadius: CGFloat = 6

    var body: some View {
        ZStack {
            // Dimmed area outside the scan frame
            Color.black.opacity(0.35)
                .mask(
                    Rectangle()
                        .overlay(
                            RoundedRectangle(cornerRadius: 20)
                                .frame(width: frameSize, height: frameSize)
                                .blendMode(.destinationOut)
                        )
                        .compositingGroup()
                )
                .allowsHitTesting(false)

            // Corner brackets
            RoundedRectangleBrackets(size: frameSize, cornerLength: cornerLength,
                                      lineWidth: cornerWidth, radius: cornerRadius)
                .foregroundColor(isAnalyzing ? .yellow : (hasResult ? .green : .white))
                .opacity(cornerOpacity)
                .scaleEffect(pulseScale)
                .animation(.easeInOut(duration: 0.6).repeatForever(autoreverses: true),
                            value: pulseScale)

            // Scanning line (visible only while analyzing)
            if isAnalyzing {
                Rectangle()
                    .fill(
                        LinearGradient(
                            colors: [.clear, .yellow.opacity(0.85), .clear],
                            startPoint: .leading,
                            endPoint: .trailing
                        )
                    )
                    .frame(width: frameSize - 20, height: 2)
                    .offset(y: scanLineOffset * (frameSize / 2 - 10))
                    .mask(
                        RoundedRectangle(cornerRadius: 20)
                            .frame(width: frameSize, height: frameSize)
                    )
                    .animation(
                        .easeInOut(duration: 1.4).repeatForever(autoreverses: true),
                        value: scanLineOffset
                    )
            }

            // Instruction label
            VStack {
                Spacer()
                    .frame(height: frameSize / 2 + 20)

                Text(instructionText)
                    .font(.caption.weight(.medium))
                    .foregroundColor(.white.opacity(0.8))
                    .padding(.horizontal, 12)
                    .padding(.vertical, 6)
                    .background(Color.black.opacity(0.45))
                    .clipShape(Capsule())
            }
        }
        .onAppear {
            scanLineOffset = -1
            withAnimation { scanLineOffset = 1 }
            withAnimation(.easeInOut(duration: 1.2).repeatForever(autoreverses: true)) {
                pulseScale = isAnalyzing ? 1.04 : 1.0
                cornerOpacity = 0.7
            }
        }
        .onChange(of: isAnalyzing) { analyzing in
            withAnimation(.easeInOut(duration: 0.8).repeatForever(autoreverses: true)) {
                pulseScale = analyzing ? 1.04 : 1.0
            }
        }
    }

    private var instructionText: String {
        if isAnalyzing { return "Analyzing..." }
        if hasResult   { return "Hold steady for a new scan" }
        return "Point at a fruit to scan"
    }
}

// MARK: - Corner Brackets Shape

struct RoundedRectangleBrackets: Shape {
    let size: CGFloat
    let cornerLength: CGFloat
    let lineWidth: CGFloat
    let radius: CGFloat

    func path(in rect: CGRect) -> Path {
        let cx = rect.midX
        let cy = rect.midY
        let half = size / 2
        let tl = CGPoint(x: cx - half, y: cy - half)
        let tr = CGPoint(x: cx + half, y: cy - half)
        let bl = CGPoint(x: cx - half, y: cy + half)
        let br = CGPoint(x: cx + half, y: cy + half)

        var path = Path()

        // Top-left
        path.move(to: CGPoint(x: tl.x + cornerLength, y: tl.y))
        path.addLine(to: CGPoint(x: tl.x + radius, y: tl.y))
        path.addQuadCurve(to: CGPoint(x: tl.x, y: tl.y + radius),
                          control: CGPoint(x: tl.x, y: tl.y))
        path.addLine(to: CGPoint(x: tl.x, y: tl.y + cornerLength))

        // Top-right
        path.move(to: CGPoint(x: tr.x - cornerLength, y: tr.y))
        path.addLine(to: CGPoint(x: tr.x - radius, y: tr.y))
        path.addQuadCurve(to: CGPoint(x: tr.x, y: tr.y + radius),
                          control: CGPoint(x: tr.x, y: tr.y))
        path.addLine(to: CGPoint(x: tr.x, y: tr.y + cornerLength))

        // Bottom-left
        path.move(to: CGPoint(x: bl.x, y: bl.y - cornerLength))
        path.addLine(to: CGPoint(x: bl.x, y: bl.y - radius))
        path.addQuadCurve(to: CGPoint(x: bl.x + radius, y: bl.y),
                          control: CGPoint(x: bl.x, y: bl.y))
        path.addLine(to: CGPoint(x: bl.x + cornerLength, y: bl.y))

        // Bottom-right
        path.move(to: CGPoint(x: br.x, y: br.y - cornerLength))
        path.addLine(to: CGPoint(x: br.x, y: br.y - radius))
        path.addQuadCurve(to: CGPoint(x: br.x - radius, y: br.y),
                          control: CGPoint(x: br.x, y: br.y))
        path.addLine(to: CGPoint(x: br.x - cornerLength, y: br.y))

        return path
    }
}
