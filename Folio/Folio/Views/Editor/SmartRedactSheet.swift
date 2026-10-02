import SwiftUI

/// Finds sensitive text across the document and redacts it for good.
struct SmartRedactSheet: View {
    let model: EditorViewModel

    @State private var candidates: [RedactionCandidate] = []
    @State private var isScanning = true
    @State private var customTerm = ""
    @State private var customTerms: [String] = []
    @State private var confirm = false

    private var selectedCount: Int { candidates.filter(\.isSelected).count }

    private var kinds: [RedactionCandidate.Kind] {
        RedactionCandidate.Kind.allCases.filter { kind in candidates.contains { $0.kind == kind } }
    }

    var body: some View {
        NavigationStack {
            List {
                Section {
                    HStack {
                        TextField("A name or word to redact", text: $customTerm)
                            .textInputAutocapitalization(.never)
                            .onSubmit(addTerm)
                        Button("Add", action: addTerm)
                            .disabled(customTerm.trimmed.isEmpty)
                    }
                    if !customTerms.isEmpty {
                        ScrollView(.horizontal, showsIndicators: false) {
                            HStack(spacing: 8) {
                                ForEach(customTerms, id: \.self) { term in
                                    HStack(spacing: 4) {
                                        Text(term)
                                        Button {
                                            customTerms.removeAll { $0 == term }
                                        } label: {
                                            Image(systemName: "xmark.circle.fill")
                                        }
                                        .buttonStyle(.plain)
                                    }
                                    .font(.footnote)
                                    .padding(.horizontal, 10)
                                    .padding(.vertical, 6)
                                    .background(FolioTheme.subtle, in: Capsule())
                                }
                            }
                        }
                    }
                } header: {
                    Text("Search for more")
                } footer: {
                    Text("Folio automatically looks for email addresses, phone numbers, links, street addresses, card numbers and ID numbers.")
                }

                if isScanning {
                    Section {
                        HStack(spacing: 12) {
                            ProgressView()
                            Text("Scanning document…")
                                .foregroundStyle(.secondary)
                        }
                    }
                } else if candidates.isEmpty {
                    Section {
                        ContentUnavailableView(
                            "Nothing sensitive found",
                            systemImage: "checkmark.shield",
                            description: Text("Add a term above to redact specific words.")
                        )
                    }
                } else {
                    ForEach(kinds) { kind in
                        Section {
                            ForEach(indices(for: kind), id: \.self) { index in
                                Toggle(isOn: $candidates[index].isSelected) {
                                    VStack(alignment: .leading, spacing: 2) {
                                        Text(candidates[index].text)
                                            .lineLimit(1)
                                        Text("Page \(candidates[index].pageIndex + 1)")
                                            .font(.caption)
                                            .foregroundStyle(.secondary)
                                    }
                                }
                            }
                        } header: {
                            Label(kind.title, systemImage: kind.symbol)
                        }
                    }
                }
            }
            .navigationTitle("Smart Redact")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { model.activeSheet = nil }
                }
                ToolbarItem(placement: .confirmationAction) {
                    if !candidates.isEmpty {
                        Button(selectedCount == candidates.count ? "None" : "All") {
                            let selectAll = selectedCount != candidates.count
                            for index in candidates.indices { candidates[index].isSelected = selectAll }
                        }
                    }
                }
            }
            .safeAreaInset(edge: .bottom) {
                Button {
                    confirm = true
                } label: {
                    Text(selectedCount == 0 ? "Redact" : "Redact \(selectedCount) item\(selectedCount == 1 ? "" : "s")")
                        .fontWeight(.semibold)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 6)
                }
                .buttonStyle(.borderedProminent)
                .disabled(selectedCount == 0 || isScanning)
                .padding(16)
                .background(.bar)
            }
            .task(id: customTerms) { await scan() }
            .confirmationDialog(
                "Redact \(selectedCount) item\(selectedCount == 1 ? "" : "s")?",
                isPresented: $confirm,
                titleVisibility: .visible
            ) {
                Button("Redact permanently", role: .destructive) { apply() }
            } message: {
                Text("Affected pages are converted to images so the hidden text can't be recovered, then re-scanned so everything else stays searchable. You can still undo before closing the document.")
            }
        }
        .presentationDragIndicator(.visible)
    }

    private func indices(for kind: RedactionCandidate.Kind) -> [Int] {
        candidates.indices.filter { candidates[$0].kind == kind }
    }

    private func addTerm() {
        let term = customTerm.trimmed
        guard !term.isEmpty, !customTerms.contains(where: { $0.caseInsensitiveCompare(term) == .orderedSame }) else { return }
        customTerms.append(term)
        customTerm = ""
    }

    private func scan() async {
        isScanning = true
        let document = model.document
        let terms = customTerms
        let previouslyDeselected = Set(candidates.filter { !$0.isSelected }.map { "\($0.pageIndex)|\($0.text)" })
        let found = await Task.detached(priority: .userInitiated) {
            RedactionFinder.find(in: document, customTerms: terms)
        }.value
        candidates = found.map { candidate in
            var copy = candidate
            if previouslyDeselected.contains("\(candidate.pageIndex)|\(candidate.text)") {
                copy.isSelected = false
            }
            return copy
        }
        isScanning = false
    }

    private func apply() {
        let items = candidates
        model.activeSheet = nil
        Task { await model.applyRedactions(items) }
    }
}
