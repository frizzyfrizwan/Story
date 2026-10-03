import PDFKit
import SwiftUI

/// Loads a document from the library and hands it to the editor.
struct EditorScreen: View {
    let documentID: UUID

    @Environment(LibraryStore.self) private var library
    @State private var model: EditorViewModel?
    @State private var loadError: String?

    var body: some View {
        Group {
            if let model {
                EditorView(model: model)
            } else if let loadError {
                ContentUnavailableView(
                    "Couldn't open document",
                    systemImage: "doc.questionmark",
                    description: Text(loadError)
                )
            } else {
                ProgressView("Opening…")
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                    .background(FolioTheme.canvas)
            }
        }
        .task(id: documentID) { await load() }
    }

    private func load() async {
        guard model == nil else { return }
        guard let record = library.document(id: documentID) else {
            loadError = "That document is no longer in your library."
            return
        }
        let url = library.fileURL(for: record.id)
        let document = await Task.detached(priority: .userInitiated) {
            PDFDocument(url: url)
        }.value
        guard let document else {
            loadError = "The file could not be read."
            return
        }
        model = EditorViewModel(record: record, document: document, library: library)
    }
}
