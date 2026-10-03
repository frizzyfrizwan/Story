import SwiftUI

/// Find text anywhere in the document; matches are highlighted on the page.
struct FindBar: View {
    @Bindable var model: EditorViewModel
    @FocusState private var isFocused: Bool

    private var countText: String {
        if model.isSearching { return "…" }
        if model.findResults.isEmpty { return model.findQuery.trimmed.count >= 2 ? "0" : "" }
        return "\(model.findIndex + 1) of \(model.findResults.count)"
    }

    var body: some View {
        HStack(spacing: 10) {
            Image(systemName: "magnifyingglass")
                .foregroundStyle(.secondary)
            TextField("Find in document", text: $model.findQuery)
                .textFieldStyle(.plain)
                .focused($isFocused)
                .submitLabel(.search)
                .autocorrectionDisabled()
                .textInputAutocapitalization(.never)
                .onSubmit { model.nextFindResult() }
            if !countText.isEmpty {
                Text(countText)
                    .font(.caption.monospacedDigit())
                    .foregroundStyle(.secondary)
                    .contentTransition(.numericText())
            }
            Button {
                model.previousFindResult()
            } label: {
                Image(systemName: "chevron.up")
            }
            .disabled(model.findResults.isEmpty)
            .accessibilityLabel("Previous match")
            Button {
                model.nextFindResult()
            } label: {
                Image(systemName: "chevron.down")
            }
            .disabled(model.findResults.isEmpty)
            .accessibilityLabel("Next match")
            Button("Done") {
                model.isFinding = false
            }
            .fontWeight(.semibold)
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 8)
        .background(.bar)
        .overlay(alignment: .bottom) {
            Divider()
        }
        .onChange(of: model.findQuery) { _, query in
            model.find(query)
        }
        .onAppear { isFocused = true }
    }
}
