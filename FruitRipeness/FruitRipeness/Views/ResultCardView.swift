import SwiftUI

struct ResultCardView: View {
    let result: FruitAnalysisResult
    @EnvironmentObject var imageLoader: FruitImageLoader
    @State private var showTips = false

    var body: some View {
        VStack(spacing: 0) {
            // Handle bar
            Capsule()
                .fill(Color.white.opacity(0.3))
                .frame(width: 36, height: 4)
                .padding(.top, 10)
                .padding(.bottom, 2)

            ScrollView(showsIndicators: false) {
                VStack(spacing: 16) {

                    // MARK: Photo / placeholder header
                    photoHeader

                    // MARK: Fruit info row
                    HStack(spacing: 12) {
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

                        RipenessGaugeView(score: result.ripenessScore,
                                          level: result.ripenessLevel)
                    }

                    Rectangle()
                        .fill(Color.white.opacity(0.1))
                        .frame(height: 1)

                    // MARK: Ripeness bar
                    RipenessBarView(score: result.ripenessScore,
                                    level: result.ripenessLevel)

                    // MARK: Description
                    HStack(alignment: .top, spacing: 8) {
                        Image(systemName: "info.circle.fill")
                            .foregroundColor(.white.opacity(0.6))
                            .font(.caption)
                        Text(result.ripenessLevel.description)
                            .font(.subheadline)
                            .foregroundColor(.white.opacity(0.85))
                            .fixedSize(horizontal: false, vertical: true)
                        Spacer()
                    }

                    // MARK: Tips
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

                    // MARK: Engine / confidence badge
                    if result.fruitType != .unknown {
                        HStack(spacing: 8) {
                            HStack(spacing: 4) {
                                Image(systemName: result.usedCoreML ? "cpu.fill" : "paintpalette.fill")
                                    .font(.caption2)
                                Text(result.usedCoreML ? "Core ML Model" : "Color Analysis")
                                    .font(.caption2.weight(.medium))
                            }
                            .foregroundColor(result.usedCoreML ? .cyan.opacity(0.8) : .white.opacity(0.45))
                            .padding(.horizontal, 8)
                            .padding(.vertical, 4)
                            .background(
                                Capsule()
                                    .fill(result.usedCoreML
                                          ? Color.cyan.opacity(0.15)
                                          : Color.white.opacity(0.07))
                            )

                            Text("\(Int(result.detectionConfidence * 100))% confidence")
                                .font(.caption2)
                                .foregroundColor(.white.opacity(0.4))
                        }
                    }
                }
                .padding(.horizontal, 20)
                .padding(.bottom, 34)
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
        .onAppear { imageLoader.load(result.fruitType) }
    }

    // MARK: - Photo Header

    @ViewBuilder
    private var photoHeader: some View {
        ZStack {
            // Gradient placeholder always visible underneath
            result.fruitType.placeholderGradient
                .frame(height: 150)
                .clipShape(RoundedRectangle(cornerRadius: 16))

            if let image = imageLoader.images[result.fruitType] {
                // Real Wikipedia photo
                Image(uiImage: image)
                    .resizable()
                    .aspectRatio(contentMode: .fill)
                    .frame(height: 150)
                    .clipShape(RoundedRectangle(cornerRadius: 16))
                    .transition(.opacity.animation(.easeIn(duration: 0.4)))
            } else {
                // Emoji placeholder while the image loads
                VStack(spacing: 6) {
                    Text(result.fruitType.emoji)
                        .font(.system(size: 56))
                    ProgressView()
                        .tint(.white.opacity(0.6))
                        .scaleEffect(0.7)
                }
            }

            // Ripeness badge overlay (bottom-right)
            VStack {
                Spacer()
                HStack {
                    Spacer()
                    Label(result.ripenessLevel.rawValue,
                          systemImage: result.ripenessLevel.sfSymbol)
                        .font(.caption.weight(.semibold))
                        .foregroundColor(.white)
                        .padding(.horizontal, 10)
                        .padding(.vertical, 5)
                        .background(result.ripenessLevel.color.opacity(0.85))
                        .clipShape(Capsule())
                        .padding(10)
                }
            }
        }
        .frame(height: 150)
    }
}
