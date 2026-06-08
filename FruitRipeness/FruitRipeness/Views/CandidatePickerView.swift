import SwiftUI

/// Shown when the Vision classifier is not confident enough to auto-select.
/// Displays the top candidates as tappable cards so the user can confirm.
struct CandidatePickerView: View {
    let candidates: [FruitCandidate]
    let onConfirm: (FruitType) -> Void
    let onDismiss: () -> Void

    @State private var appeared = false

    var body: some View {
        VStack(spacing: 0) {
            // Handle bar
            Capsule()
                .fill(Color.white.opacity(0.3))
                .frame(width: 36, height: 4)
                .padding(.top, 10)

            VStack(spacing: 18) {
                // Header
                VStack(spacing: 6) {
                    Text("We're seeing a few options...")
                        .font(.headline)
                        .foregroundColor(.white)
                    Text("Which fruit is this?")
                        .font(.subheadline)
                        .foregroundColor(.white.opacity(0.65))
                }
                .padding(.top, 8)

                // Candidate cards
                HStack(spacing: 12) {
                    ForEach(Array(candidates.prefix(3).enumerated()), id: \.element.id) { index, candidate in
                        CandidateCard(
                            candidate: candidate,
                            rank: index,
                            onTap: { onConfirm(candidate.fruitType) }
                        )
                        .opacity(appeared ? 1 : 0)
                        .offset(y: appeared ? 0 : 20)
                        .animation(
                            .spring(response: 0.45, dampingFraction: 0.72)
                                .delay(Double(index) * 0.07),
                            value: appeared
                        )
                    }
                }

                // "None of these" button
                Button {
                    UIImpactFeedbackGenerator(style: .light).impactOccurred()
                    onDismiss()
                } label: {
                    HStack(spacing: 6) {
                        Image(systemName: "arrow.counterclockwise")
                        Text("None of these — scan again")
                    }
                    .font(.subheadline)
                    .foregroundColor(.white.opacity(0.55))
                }
                .padding(.bottom, 8)
            }
            .padding(.horizontal, 20)
            .padding(.bottom, 20)
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
        .onAppear { appeared = true }
    }
}

// MARK: - Individual Candidate Card

private struct CandidateCard: View {
    let candidate: FruitCandidate
    let rank: Int
    let onTap: () -> Void

    @State private var pressed = false

    var body: some View {
        Button(action: {
            UIImpactFeedbackGenerator(style: .medium).impactOccurred()
            onTap()
        }) {
            VStack(spacing: 10) {
                // Emoji in circle
                ZStack {
                    Circle()
                        .fill(candidate.fruitType.placeholderGradient)
                        .frame(width: 64, height: 64)
                    Text(candidate.fruitType.emoji)
                        .font(.system(size: 32))
                }

                Text(candidate.fruitType.displayName)
                    .font(.subheadline.weight(.semibold))
                    .foregroundColor(.white)

                // Confidence bar
                VStack(spacing: 3) {
                    GeometryReader { geo in
                        ZStack(alignment: .leading) {
                            Capsule()
                                .fill(Color.white.opacity(0.12))
                                .frame(height: 4)
                            Capsule()
                                .fill(
                                    rank == 0
                                    ? LinearGradient(colors: [.green, .mint], startPoint: .leading, endPoint: .trailing)
                                    : LinearGradient(colors: [.white.opacity(0.5), .white.opacity(0.3)], startPoint: .leading, endPoint: .trailing)
                                )
                                .frame(width: geo.size.width * CGFloat(candidate.confidence), height: 4)
                        }
                    }
                    .frame(height: 4)

                    Text("\(Int(candidate.confidence * 100))%")
                        .font(.caption2)
                        .foregroundColor(.white.opacity(0.5))
                }
            }
            .padding(.vertical, 14)
            .padding(.horizontal, 10)
            .frame(maxWidth: .infinity)
            .background(
                RoundedRectangle(cornerRadius: 16)
                    .fill(rank == 0
                          ? Color.white.opacity(0.13)
                          : Color.white.opacity(0.07))
                    .overlay(
                        RoundedRectangle(cornerRadius: 16)
                            .stroke(
                                rank == 0 ? Color.green.opacity(0.5) : Color.white.opacity(0.1),
                                lineWidth: rank == 0 ? 1.5 : 1
                            )
                    )
            )
            .scaleEffect(pressed ? 0.94 : 1.0)
            .animation(.spring(response: 0.2, dampingFraction: 0.6), value: pressed)
        }
        .buttonStyle(.plain)
        .simultaneousGesture(
            DragGesture(minimumDistance: 0)
                .onChanged { _ in pressed = true }
                .onEnded   { _ in pressed = false }
        )
    }
}
