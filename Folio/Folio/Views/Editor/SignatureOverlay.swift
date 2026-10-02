import SwiftUI

/// Lets the user drag and pinch a signature into position over the page
/// before it is burned in.
struct SignaturePlacementOverlay: View {
    @Bindable var model: EditorViewModel
    let signature: PlacedSignature

    @State private var dragOffset: CGSize = .zero
    @State private var magnification: CGFloat = 1

    var body: some View {
        let frame = signature.frame(scale: magnification, offset: dragOffset)

        ZStack(alignment: .topLeading) {
            Image(uiImage: signature.image)
                .resizable()
                .interpolation(.high)
                .frame(width: frame.width, height: frame.height)
                .padding(6)
                .background(Color.accentColor.opacity(0.08), in: RoundedRectangle(cornerRadius: 8))
                .overlay(
                    RoundedRectangle(cornerRadius: 8)
                        .strokeBorder(Color.accentColor, style: StrokeStyle(lineWidth: 1.5, dash: [6, 4]))
                )
                .offset(x: frame.minX - 6, y: frame.minY - 6)
                .gesture(dragGesture)
                .simultaneousGesture(magnifyGesture)
                .accessibilityLabel("Signature. Drag to move, pinch to resize.")
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .overlay(alignment: .top) {
            controls(frame: frame)
        }
    }

    private var dragGesture: some Gesture {
        DragGesture(minimumDistance: 1)
            .onChanged { value in
                dragOffset = value.translation
            }
            .onEnded { value in
                model.pendingSignature?.center.x += value.translation.width
                model.pendingSignature?.center.y += value.translation.height
                dragOffset = .zero
            }
    }

    private var magnifyGesture: some Gesture {
        MagnifyGesture()
            .onChanged { value in
                magnification = value.magnification
            }
            .onEnded { value in
                let width = model.pendingSignature?.width ?? 120
                model.pendingSignature?.width = min(600, max(40, width * value.magnification))
                magnification = 1
            }
    }

    private func controls(frame: CGRect) -> some View {
        HStack(spacing: 12) {
            Button("Cancel") {
                model.cancelSignature()
            }
            Spacer()
            Text("Drag to move · Pinch to resize")
                .font(.caption)
                .foregroundStyle(.secondary)
                .lineLimit(1)
                .minimumScaleFactor(0.8)
            Spacer()
            Button {
                model.commitSignature(viewFrame: frame)
            } label: {
                Text("Place")
                    .fontWeight(.semibold)
            }
            .buttonStyle(.borderedProminent)
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 8)
        .floatingSurface(radius: 18)
        .padding(.horizontal, 16)
        .padding(.top, 10)
    }
}
