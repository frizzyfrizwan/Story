import SwiftUI

// Circular gauge that fills from 0 to the ripeness score and changes color.
struct RipenessGaugeView: View {
    let score: Float
    let level: RipenessLevel

    @State private var animatedScore: Float = 0

    var body: some View {
        ZStack {
            // Background ring
            Circle()
                .stroke(Color.white.opacity(0.15), lineWidth: 10)
                .frame(width: 100, height: 100)

            // Filled arc
            Circle()
                .trim(from: 0, to: CGFloat(animatedScore))
                .stroke(
                    level.color,
                    style: StrokeStyle(lineWidth: 10, lineCap: .round)
                )
                .rotationEffect(.degrees(-90))
                .frame(width: 100, height: 100)
                .animation(.easeOut(duration: 0.8), value: animatedScore)

            // Center content
            VStack(spacing: 2) {
                Image(systemName: level.sfSymbol)
                    .font(.system(size: 18, weight: .bold))
                    .foregroundColor(level.color)

                Text("\(Int(score * 100))%")
                    .font(.system(size: 14, weight: .semibold, design: .rounded))
                    .foregroundColor(.white)
            }
        }
        .onAppear { animatedScore = score }
        .onChange(of: score) { newScore in animatedScore = newScore }
    }
}

// Horizontal bar showing the ripeness spectrum with a marker.
struct RipenessBarView: View {
    let score: Float
    let level: RipenessLevel

    @State private var animatedScore: Float = 0

    private let gradient = LinearGradient(
        colors: [
            Color(red: 0.2, green: 0.75, blue: 0.3),
            Color(red: 0.9, green: 0.85, blue: 0.1),
            Color(red: 0.95, green: 0.5, blue: 0.1),
            Color(red: 0.9, green: 0.2, blue: 0.2)
        ],
        startPoint: .leading,
        endPoint: .trailing
    )

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack {
                Text("Ripeness")
                    .font(.caption)
                    .foregroundColor(.white.opacity(0.7))
                Spacer()
                Text(level.rawValue)
                    .font(.caption.weight(.semibold))
                    .foregroundColor(level.color)
            }

            GeometryReader { geo in
                ZStack(alignment: .leading) {
                    // Background track
                    Capsule()
                        .fill(Color.white.opacity(0.15))
                        .frame(height: 8)

                    // Gradient fill
                    Capsule()
                        .fill(gradient)
                        .frame(width: geo.size.width * CGFloat(animatedScore), height: 8)
                        .animation(.easeOut(duration: 0.8), value: animatedScore)

                    // Marker dot
                    Circle()
                        .fill(Color.white)
                        .frame(width: 14, height: 14)
                        .shadow(color: .black.opacity(0.3), radius: 2)
                        .offset(x: geo.size.width * CGFloat(animatedScore) - 7)
                        .animation(.easeOut(duration: 0.8), value: animatedScore)
                }
                .frame(height: 14)
            }
            .frame(height: 14)

            // Labels
            HStack {
                Text("Unripe")
                Spacer()
                Text("Ripe")
                Spacer()
                Text("Overripe")
            }
            .font(.system(size: 9))
            .foregroundColor(.white.opacity(0.5))
        }
        .onAppear { animatedScore = score }
        .onChange(of: score) { newScore in animatedScore = newScore }
    }
}
