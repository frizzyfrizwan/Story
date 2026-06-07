import SwiftUI

struct ScanningOverlayView: View {
    let scanState: ScanState

    @State private var scanLineY: CGFloat = -1
    @State private var glowOpacity: Double = 0.4
    @State private var bracketScale: CGFloat = 0.92
    @State private var bracketOpacity: Double = 0.6

    private let frameSize: CGFloat = 264

    var body: some View {
        ZStack {
            // Dim everything outside the frame
            Color.black.opacity(0.38)
                .mask(
                    Rectangle()
                        .overlay(
                            RoundedRectangle(cornerRadius: 22)
                                .frame(width: frameSize, height: frameSize)
                                .blendMode(.destinationOut)
                        )
                        .compositingGroup()
                )
                .allowsHitTesting(false)

            // Glow ring — brightens when a result arrives
            RoundedRectangle(cornerRadius: 22)
                .stroke(bracketColor.opacity(glowOpacity * 0.6), lineWidth: 18)
                .frame(width: frameSize, height: frameSize)
                .blur(radius: 10)
                .allowsHitTesting(false)

            // Corner brackets
            RoundedRectangleBrackets(size: frameSize, cornerLength: 30,
                                      lineWidth: 3.5, radius: 8)
                .foregroundColor(bracketColor)
                .opacity(bracketOpacity)
                .scaleEffect(bracketScale)
                .allowsHitTesting(false)

            // Scan line (only while scanning)
            if isScanning {
                Rectangle()
                    .fill(
                        LinearGradient(
                            colors: [.clear, .yellow.opacity(0.9), .clear],
                            startPoint: .leading, endPoint: .trailing
                        )
                    )
                    .frame(width: frameSize - 24, height: 2)
                    .offset(y: scanLineY * (frameSize / 2 - 14))
                    .mask(
                        RoundedRectangle(cornerRadius: 22)
                            .frame(width: frameSize, height: frameSize)
                    )
                    .allowsHitTesting(false)
            }

            // Label below the frame
            VStack {
                Spacer().frame(height: frameSize / 2 + 22)
                Text(labelText)
                    .font(.caption.weight(.medium))
                    .foregroundColor(.white.opacity(0.8))
                    .padding(.horizontal, 14)
                    .padding(.vertical, 6)
                    .background(Color.black.opacity(0.45))
                    .clipShape(Capsule())
                    .animation(.easeInOut(duration: 0.25), value: labelText)
            }
        }
        .onAppear  { startAnimations() }
        .onChange(of: isScanning) { _ in startAnimations() }
        .onChange(of: hasResult)  { _ in startAnimations() }
    }

    // MARK: - Derived state

    private var isScanning: Bool {
        if case .scanning = scanState { return true }
        return false
    }

    private var hasResult: Bool {
        if case .result = scanState { return true }
        return false
    }

    private var isAmbiguous: Bool {
        if case .ambiguous = scanState { return true }
        return false
    }

    private var bracketColor: Color {
        switch scanState {
        case .idle:      return .white
        case .scanning:  return .yellow
        case .ambiguous: return .orange
        case .result:    return .green
        }
    }

    private var labelText: String {
        switch scanState {
        case .idle:      return "Point at a fruit to scan"
        case .scanning:  return "Analyzing..."
        case .ambiguous: return "Help us out — tap your fruit below"
        case .result:    return "Swipe up for details"
        }
    }

    // MARK: - Animations

    private func startAnimations() {
        // Scan line bounce
        withAnimation(.easeInOut(duration: 1.5).repeatForever(autoreverses: true)) {
            scanLineY = 1
        }
        // Bracket pulse
        let speed = isScanning ? 0.7 : 1.4
        withAnimation(.easeInOut(duration: speed).repeatForever(autoreverses: true)) {
            bracketScale   = isScanning ? 1.03 : (hasResult ? 1.01 : 0.98)
            bracketOpacity = isScanning ? 1.0  : (hasResult ? 0.9  : 0.55)
            glowOpacity    = hasResult ? 0.9 : (isScanning ? 0.55 : 0.35)
        }
    }
}

// MARK: - Corner Brackets Shape (unchanged)

struct RoundedRectangleBrackets: Shape {
    let size: CGFloat
    let cornerLength: CGFloat
    let lineWidth: CGFloat
    let radius: CGFloat

    func path(in rect: CGRect) -> Path {
        let cx = rect.midX, cy = rect.midY
        let half = size / 2
        let tl = CGPoint(x: cx - half, y: cy - half)
        let tr = CGPoint(x: cx + half, y: cy - half)
        let bl = CGPoint(x: cx - half, y: cy + half)
        let br = CGPoint(x: cx + half, y: cy + half)

        var p = Path()

        // top-left
        p.move(to:   CGPoint(x: tl.x + cornerLength, y: tl.y))
        p.addLine(to: CGPoint(x: tl.x + radius, y: tl.y))
        p.addQuadCurve(to: CGPoint(x: tl.x, y: tl.y + radius), control: tl)
        p.addLine(to: CGPoint(x: tl.x, y: tl.y + cornerLength))

        // top-right
        p.move(to:   CGPoint(x: tr.x - cornerLength, y: tr.y))
        p.addLine(to: CGPoint(x: tr.x - radius, y: tr.y))
        p.addQuadCurve(to: CGPoint(x: tr.x, y: tr.y + radius), control: tr)
        p.addLine(to: CGPoint(x: tr.x, y: tr.y + cornerLength))

        // bottom-left
        p.move(to:   CGPoint(x: bl.x, y: bl.y - cornerLength))
        p.addLine(to: CGPoint(x: bl.x, y: bl.y - radius))
        p.addQuadCurve(to: CGPoint(x: bl.x + radius, y: bl.y), control: bl)
        p.addLine(to: CGPoint(x: bl.x + cornerLength, y: bl.y))

        // bottom-right
        p.move(to:   CGPoint(x: br.x, y: br.y - cornerLength))
        p.addLine(to: CGPoint(x: br.x, y: br.y - radius))
        p.addQuadCurve(to: CGPoint(x: br.x - radius, y: br.y), control: br)
        p.addLine(to: CGPoint(x: br.x - cornerLength, y: br.y))

        return p
    }
}
