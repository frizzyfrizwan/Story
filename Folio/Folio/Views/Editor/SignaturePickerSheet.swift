import PencilKit
import SwiftUI

/// Pick a saved signature to place, or create a new one.
struct SignaturePickerSheet: View {
    let model: EditorViewModel

    @Environment(SignatureStore.self) private var signatures
    @Environment(StoreService.self) private var store
    @State private var showPad = false
    @State private var showPaywall = false
    @State private var errorMessage: String?

    var body: some View {
        NavigationStack {
            Group {
                if signatures.signatures.isEmpty {
                    ContentUnavailableView {
                        Label("No signatures yet", systemImage: "signature")
                    } description: {
                        Text("Draw or type one once and place it on any page.")
                    } actions: {
                        Button("Create signature") { addNew() }
                            .buttonStyle(.borderedProminent)
                    }
                } else {
                    List {
                        Section {
                            ForEach(signatures.signatures) { signature in
                                Button {
                                    pick(signature)
                                } label: {
                                    row(signature)
                                }
                                .buttonStyle(.plain)
                                .swipeActions(edge: .trailing) {
                                    Button(role: .destructive) {
                                        signatures.delete(signature)
                                    } label: {
                                        Label("Delete", systemImage: "trash")
                                    }
                                }
                            }
                        } footer: {
                            Text("Tap a signature to place it. Signatures are stored only on this device.")
                        }
                    }
                }
            }
            .navigationTitle("Sign")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { model.activeSheet = nil }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button {
                        addNew()
                    } label: {
                        Label("New", systemImage: "plus")
                    }
                }
            }
            .sheet(isPresented: $showPad) {
                SignaturePadView { image, label in
                    do {
                        try signatures.add(image: image, label: label)
                    } catch {
                        errorMessage = error.localizedDescription
                    }
                }
            }
            .sheet(isPresented: $showPaywall) {
                PaywallView(feature: .signatureVault)
            }
            .alert("Couldn't save signature", isPresented: Binding(
                get: { errorMessage != nil },
                set: { if !$0 { errorMessage = nil } }
            )) {
                Button("OK", role: .cancel) {}
            } message: {
                Text(errorMessage ?? "")
            }
        }
        .presentationDetents([.medium, .large])
        .presentationDragIndicator(.visible)
    }

    private func row(_ signature: Signature) -> some View {
        HStack(spacing: 14) {
            ZStack {
                RoundedRectangle(cornerRadius: 10, style: .continuous)
                    .fill(Color.white)
                if let image = signatures.image(for: signature) {
                    Image(uiImage: image)
                        .resizable()
                        .scaledToFit()
                        .padding(8)
                }
            }
            .frame(width: 140, height: 64)
            .overlay(
                RoundedRectangle(cornerRadius: 10, style: .continuous)
                    .strokeBorder(Color.primary.opacity(0.1))
            )
            VStack(alignment: .leading, spacing: 2) {
                Text(signature.label)
                    .font(.body.weight(.medium))
                Text(signature.createdAt.relativeString)
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
            Spacer()
            Image(systemName: "chevron.right")
                .font(.footnote.weight(.semibold))
                .foregroundStyle(.tertiary)
        }
        .contentShape(Rectangle())
    }

    private func addNew() {
        if signatures.signatures.count >= SignatureStore.freeLimit, !store.isPro {
            showPaywall = true
            return
        }
        showPad = true
    }

    private func pick(_ signature: Signature) {
        guard let image = signatures.image(for: signature) else { return }
        Haptics.tap()
        model.startPlacingSignature(image)
    }
}

/// Draw with a finger or Pencil, or type a name in a script face.
struct SignaturePadView: View {
    var onSave: (UIImage, String) -> Void

    @Environment(\.dismiss) private var dismiss
    @State private var method: Method = .draw
    @State private var drawing = PKDrawing()
    @State private var typed = ""
    @State private var label = "Signature"

    enum Method: String, CaseIterable, Identifiable {
        case draw = "Draw"
        case type = "Type"

        var id: String { rawValue }
    }

    private var canSave: Bool {
        switch method {
        case .draw: return !drawing.bounds.isNull && !drawing.bounds.isEmpty
        case .type: return !typed.trimmed.isEmpty
        }
    }

    var body: some View {
        NavigationStack {
            VStack(spacing: 16) {
                Picker("Method", selection: $method) {
                    ForEach(Method.allCases) { Text($0.rawValue).tag($0) }
                }
                .pickerStyle(.segmented)

                ZStack {
                    RoundedRectangle(cornerRadius: 16, style: .continuous)
                        .fill(Color.white)
                        .overlay(
                            RoundedRectangle(cornerRadius: 16, style: .continuous)
                                .strokeBorder(Color.primary.opacity(0.1))
                        )
                    VStack {
                        Spacer()
                        Rectangle()
                            .fill(Color.gray.opacity(0.25))
                            .frame(height: 1)
                            .padding(.horizontal, 24)
                            .padding(.bottom, 44)
                    }
                    if method == .draw {
                        SignatureCanvas(drawing: $drawing)
                            .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
                    } else {
                        Text(typed.isEmpty ? "Your name" : typed)
                            .font(.custom("SnellRoundhand-Bold", size: 46))
                            .foregroundStyle(typed.isEmpty ? Color.gray.opacity(0.4) : Color.black)
                            .lineLimit(1)
                            .minimumScaleFactor(0.3)
                            .padding(.horizontal, 24)
                    }
                }
                .frame(height: 230)

                if method == .type {
                    TextField("Type your name", text: $typed)
                        .textFieldStyle(.roundedBorder)
                        .textInputAutocapitalization(.words)
                }

                TextField("Label, e.g. Signature or Initials", text: $label)
                    .textFieldStyle(.roundedBorder)

                HStack {
                    Button("Clear") {
                        drawing = PKDrawing()
                        typed = ""
                    }
                    .disabled(!canSave)
                    Spacer()
                    Text(method == .draw ? "Sign above the line" : "Rendered in a script face")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
                Spacer()
            }
            .padding(20)
            .navigationTitle("New signature")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Save") { save() }
                        .fontWeight(.semibold)
                        .disabled(!canSave)
                }
            }
        }
    }

    private func save() {
        let image: UIImage?
        switch method {
        case .draw:
            let bounds = drawing.bounds.insetBy(dx: -10, dy: -10)
            image = drawing.image(from: bounds, scale: 3)
        case .type:
            image = Self.renderTyped(typed.trimmed)
        }
        guard let image else { return }
        onSave(image.trimmedToOpaqueBounds(), label)
        Haptics.success()
        dismiss()
    }

    static func renderTyped(_ text: String) -> UIImage? {
        guard !text.isEmpty else { return nil }
        let font = UIFont(name: "SnellRoundhand-Bold", size: 120) ?? UIFont.italicSystemFont(ofSize: 120)
        let attributes: [NSAttributedString.Key: Any] = [.font: font, .foregroundColor: UIColor.black]
        let measured = (text as NSString).size(withAttributes: attributes)
        let size = CGSize(width: ceil(measured.width) + 48, height: ceil(measured.height) + 48)
        let format = UIGraphicsImageRendererFormat.default()
        format.opaque = false
        format.scale = 2
        return UIGraphicsImageRenderer(size: size, format: format).image { _ in
            (text as NSString).draw(at: CGPoint(x: 24, y: 24), withAttributes: attributes)
        }
    }
}

struct SignatureCanvas: UIViewRepresentable {
    @Binding var drawing: PKDrawing

    func makeUIView(context: Context) -> PKCanvasView {
        let canvas = PKCanvasView()
        canvas.drawingPolicy = .anyInput
        canvas.tool = PKInkingTool(.pen, color: .black, width: 4)
        canvas.backgroundColor = .clear
        canvas.isOpaque = false
        canvas.overrideUserInterfaceStyle = .light
        canvas.delegate = context.coordinator
        canvas.drawing = drawing
        return canvas
    }

    func updateUIView(_ canvas: PKCanvasView, context: Context) {
        context.coordinator.parent = self
        if canvas.drawing.strokes.count != drawing.strokes.count {
            canvas.drawing = drawing
        }
    }

    func makeCoordinator() -> Coordinator { Coordinator(parent: self) }

    final class Coordinator: NSObject, PKCanvasViewDelegate {
        var parent: SignatureCanvas

        init(parent: SignatureCanvas) {
            self.parent = parent
        }

        func canvasViewDrawingDidChange(_ canvasView: PKCanvasView) {
            parent.drawing = canvasView.drawing
        }
    }
}
