import SwiftUI

struct DocumentInfoSheet: View {
    let model: EditorViewModel

    var body: some View {
        NavigationStack {
            List {
                Section {
                    LabeledContent("Name", value: model.record.name)
                    LabeledContent("Pages", value: "\(model.pageCount)")
                    LabeledContent("Size", value: model.record.fileSize.fileSizeString)
                    LabeledContent("Created", value: model.record.createdAt.fullString)
                    LabeledContent("Modified", value: model.record.modifiedAt.fullString)
                }
                Section {
                    LabeledContent("Selectable text") {
                        Text(model.hasPagesWithoutText ? "Some pages are image-only" : "Yes")
                            .foregroundStyle(model.hasPagesWithoutText ? .orange : .secondary)
                    }
                    LabeledContent("Source", value: model.record.isScanned ? "Scanned in Folio" : "Imported")
                } footer: {
                    if model.hasPagesWithoutText {
                        Text("Use Recognize text from the More menu to make image-only pages searchable.")
                    }
                }
                Section {
                    if model.record.hasOriginalBackup {
                        Button("Restore original file", role: .destructive) {
                            model.activeSheet = nil
                            Task {
                                try? await Task.sleep(for: .milliseconds(450))
                                model.confirmRevert = true
                            }
                        }
                    }
                } header: {
                    Text("Safe edits")
                } footer: {
                    Text(model.record.hasOriginalBackup
                         ? "Folio kept the file exactly as it was imported. Restoring it discards every edit."
                         : "The original file will be kept the first time you edit this document.")
                }
            }
            .navigationTitle("Document info")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Done") { model.activeSheet = nil }
                }
            }
        }
        .presentationDetents([.medium, .large])
        .presentationDragIndicator(.visible)
    }
}
