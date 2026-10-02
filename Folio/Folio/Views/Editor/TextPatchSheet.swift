import SwiftUI

/// Retype a line of text, or add new text, without leaving the page.
struct TextPatchSheet: View {
    let session: TextEditSession
    let model: EditorViewModel

    @Environment(\.dismiss) private var dismiss
    @State private var text: String
    @State private var fontSize: CGFloat
    @State private var coversOriginal: Bool
    @State private var isBold: Bool
    @State private var color: InkColor
    @FocusState private var isFocused: Bool

    init(session: TextEditSession, model: EditorViewModel) {
        self.session = session
        self.model = model
        _text = State(initialValue: session.text)
        _fontSize = State(initialValue: session.fontSize)
        _coversOriginal = State(initialValue: session.coversOriginal)
        _isBold = State(initialValue: session.isBold)
        let match = InkColor.pens.first { $0.uiColor.isEqual(session.color) } ?? InkColor.pens[0]
        _color = State(initialValue: match)
    }

    private var title: String {
        if session.existing != nil { return "Edit text" }
        return session.text.isEmpty ? "Add text" : "Retype line"
    }

    var body: some View {
        NavigationStack {
            VStack(alignment: .leading, spacing: 18) {
                TextField("Type here", text: $text, axis: .vertical)
                    .font(.system(size: min(28, max(15, fontSize * 1.1)), weight: isBold ? .bold : .regular))
                    .foregroundStyle(color.color)
                    .lineLimit(1...6)
                    .focused($isFocused)
                    .padding(14)
                    .background(FolioTheme.paper, in: RoundedRectangle(cornerRadius: 14, style: .continuous))
                    .submitLabel(.done)

                HStack(spacing: 12) {
                    Text("Size")
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                    Slider(value: $fontSize, in: 6...72, step: 0.5)
                    Text("\(Int(fontSize.rounded()))")
                        .font(.subheadline.monospacedDigit())
                        .frame(width: 30, alignment: .trailing)
                }

                HStack(spacing: 14) {
                    Toggle(isOn: $isBold) {
                        Text("Bold").font(.subheadline.weight(.bold))
                    }
                    .toggleStyle(.button)
                    .buttonStyle(.bordered)

                    Spacer()

                    ForEach(InkColor.pens) { pen in
                        Button {
                            color = pen
                        } label: {
                            Circle()
                                .fill(pen.color)
                                .frame(width: 22, height: 22)
                                .overlay(
                                    Circle().strokeBorder(Color.primary.opacity(color == pen ? 0.9 : 0.12), lineWidth: color == pen ? 2.5 : 1)
                                )
                        }
                        .buttonStyle(.plain)
                        .accessibilityLabel(pen.name)
                    }
                }

                if session.existing != nil || !session.text.isEmpty {
                    Toggle(isOn: $coversOriginal) {
                        VStack(alignment: .leading, spacing: 2) {
                            Text("Cover the original text")
                            Text("Paints a white patch behind the new text.")
                                .font(.caption)
                                .foregroundStyle(.secondary)
                        }
                    }
                }

                Spacer(minLength: 0)
            }
            .padding(20)
            .navigationTitle(title)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { model.textSession = nil }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button(session.existing == nil ? "Add" : "Save") { save() }
                        .fontWeight(.semibold)
                        .disabled(text.trimmed.isEmpty && session.existing == nil)
                }
                if session.existing != nil {
                    ToolbarItem(placement: .bottomBar) {
                        Button("Remove text", role: .destructive) {
                            var updated = session
                            updated.text = ""
                            model.commitTextEdit(updated)
                        }
                    }
                }
            }
            .onAppear { isFocused = true }
        }
        .presentationDetents([.medium, .large])
        .presentationBackgroundInteraction(.enabled(upThrough: .medium))
        .presentationDragIndicator(.visible)
    }

    private func save() {
        var updated = session
        updated.text = text
        updated.fontSize = fontSize
        updated.coversOriginal = coversOriginal
        updated.isBold = isBold
        updated.color = color.uiColor
        model.commitTextEdit(updated)
    }
}
