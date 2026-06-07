import SwiftUI

// Bottom card that slides up and shows the ripeness analysis result.
struct ResultCardView: View {
    let result: FruitAnalysisResult
    @State private var showTips = false

    var body: some View {
        VStack(spacing: 0) {
            // Handle bar
            Capsule()
                .fill(Color.white.opacity(0.3))
                .frame(width: 36, height: 4)
                .padding(.top, 10)

            ScrollView(showsIndicators: false) {
                VStack(spacing: 16) {
                    // Fruit header
                    HStack(spacing: 12) {
                        Text(result.fruitType.emoji)
                            .font(.system(size: 44))

                        VStack(alignment: .leading, spacing: 4) {
                            Text(result.fruitType.displayName)
                                .font(.title2.weight(.bold))
                                .foregroundColor(.white)

                            HStack(spacing: 4) {
                                Image(systemName: result.ripenessLevel.sfSymbol)
                                    .font(.caption.weight(.semibold))
                                    .foregroundColor(result.ripenessLevel.color)
                                Text(result.ripenessLevel.rawValue)
                                    .font(.subheadline.weight(.semibold))
                                    .foregroundColor(result.ripenessLevel.color)
                            }
                        }

                        Spacer()

                        RipenessGaugeView(score: result.ripenessScore, level: result.ripenessLevel)
                    }
                    .padding(.top, 6)

                    // Divider
                    Rectangle()
                        .fill(Color.white.opacity(0.1))
                        .frame(height: 1)

                    // Ripeness bar
                    RipenessBarView(score: result.ripenessScore, level: result.ripenessLevel)

                    // Description
                    HStack {
                        Image(systemName: "info.circle.fill")
                            .foregroundColor(.white.opacity(0.6))
                            .font(.caption)
                        Text(result.ripenessLevel.description)
                            .font(.subheadline)
                            .foregroundColor(.white.opacity(0.85))
                            .fixedSize(horizontal: false, vertical: true)
                        Spacer()
                    }

                    // Tips section
                    if !result.tips.isEmpty {
                        VStack(alignment: .leading, spacing: 8) {
                            Button {
                                withAnimation(.spring(response: 0.3)) { showTips.toggle() }
                            } label: {
                                HStack {
                                    Image(systemName: "lightbulb.fill")
                                        .foregroundColor(.yellow)
                                    Text("Tips")
                                        .font(.subheadline.weight(.semibold))
                                        .foregroundColor(.white)
                                    Spacer()
                                    Image(systemName: showTips ? "chevron.up" : "chevron.down")
                                        .font(.caption)
                                        .foregroundColor(.white.opacity(0.6))
                                }
                            }
                            .buttonStyle(.plain)

                            if showTips {
                                ForEach(result.tips, id: \.self) { tip in
                                    HStack(alignment: .top, spacing: 8) {
                                        Circle()
                                            .fill(result.ripenessLevel.color)
                                            .frame(width: 6, height: 6)
                                            .padding(.top, 5)
                                        Text(tip)
                                            .font(.subheadline)
                                            .foregroundColor(.white.opacity(0.8))
                                            .fixedSize(horizontal: false, vertical: true)
                                    }
                                }
                                .transition(.opacity.combined(with: .move(edge: .top)))
                            }
                        }
                        .padding(12)
                        .background(Color.white.opacity(0.07))
                        .clipShape(RoundedRectangle(cornerRadius: 12))
                    }

                    // Confidence badge
                    if result.fruitType != .unknown {
                        HStack(spacing: 6) {
                            Image(systemName: "brain")
                                .font(.caption2)
                                .foregroundColor(.white.opacity(0.5))
                            Text("Detection confidence: \(Int(result.detectionConfidence * 100))%")
                                .font(.caption2)
                                .foregroundColor(.white.opacity(0.5))
                        }
                    }
                }
                .padding(.horizontal, 20)
                .padding(.bottom, 30)
            }
        }
        .background(
            RoundedRectangle(cornerRadius: 28)
                .fill(.ultraThinMaterial)
                .overlay(
                    RoundedRectangle(cornerRadius: 28)
                        .stroke(Color.white.opacity(0.15), lineWidth: 1)
                )
        )
        .shadow(color: .black.opacity(0.4), radius: 20, y: -5)
    }
}
