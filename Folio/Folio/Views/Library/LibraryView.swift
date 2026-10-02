import PDFKit
import PhotosUI
import SwiftUI
import UniformTypeIdentifiers

/// The home screen: every document, newest first, with one button to add more.
struct LibraryView: View {
    @Environment(LibraryStore.self) private var library
    @Environment(Router.self) private var router
    @Environment(AppSettings.self) private var settings

    @State private var query = ""
    @State private var showImporter = false
    @State private var showScanner = false
    @State private var showPhotos = false
    @State private var photoItems: [PhotosPickerItem] = []
    @State private var scanDraft: ScanDraft?
    @State private var toast: Toast?
    @State private var renaming: DocumentRecord?
    @State private var renameText = ""
    @State private var deleting: DocumentRecord?
    @State private var shareItem: ShareItem?
    @State private var isImporting = false

    struct ScanDraft: Identifiable {
        let id = UUID()
        let images: [UIImage]
        let suggestedName: String
        let isScan: Bool
    }

    private let columns = [GridItem(.adaptive(minimum: 150, maximum: 210), spacing: 16)]

    var body: some View {
        @Bindable var settings = settings
        let documents = library.sorted(by: settings.librarySort, query: query)

        ScrollView {
            if library.documents.isEmpty {
                emptyState
            } else if documents.isEmpty {
                ContentUnavailableView.search(text: query)
                    .padding(.top, 60)
            } else {
                LazyVGrid(columns: columns, spacing: 18) {
                    ForEach(documents) { record in
                        DocumentCard(record: record)
                            .onTapGesture { open(record) }
                            .contextMenu { documentMenu(record) }
                    }
                }
                .padding(.horizontal, 16)
                .padding(.top, 8)
                .padding(.bottom, 110)
            }
        }
        .background(FolioTheme.canvas)
        .navigationTitle("Folio")
        .searchable(text: $query, prompt: "Search names and first pages")
        .toolbar {
            ToolbarItemGroup(placement: .topBarTrailing) {
                Menu {
                    Picker("Sort by", selection: $settings.librarySort) {
                        ForEach(LibrarySort.allCases) { sort in
                            Text(sort.title).tag(sort)
                        }
                    }
                } label: {
                    Image(systemName: "arrow.up.arrow.down.circle")
                }
                .accessibilityLabel("Sort")

                Button {
                    router.showSettings = true
                } label: {
                    Image(systemName: "gearshape")
                }
                .accessibilityLabel("Settings")
            }
        }
        .overlay(alignment: .bottomTrailing) {
            addButton
        }
        .overlay {
            if isImporting {
                BusyOverlay(message: "Importing…", progress: nil)
            }
        }
        .toast($toast)
        .fileImporter(isPresented: $showImporter, allowedContentTypes: [.pdf], allowsMultipleSelection: true) { result in
            if case .success(let urls) = result {
                Task { await importFiles(urls) }
            }
        }
        .fullScreenCover(isPresented: $showScanner) {
            DocumentScannerView(
                onFinish: { images in
                    showScanner = false
                    scanDraft = ScanDraft(images: images, suggestedName: ScanPipeline.suggestedName(), isScan: true)
                },
                onCancel: { showScanner = false }
            )
            .ignoresSafeArea()
        }
        .photosPicker(isPresented: $showPhotos, selection: $photoItems, maxSelectionCount: 50, matching: .images)
        .onChange(of: photoItems) { _, items in
            guard !items.isEmpty else { return }
            Task { await loadPhotos(items) }
        }
        .sheet(item: $scanDraft) { draft in
            ScanReviewView(images: draft.images, suggestedName: draft.suggestedName) { document, name in
                Task { await create(document, name: name, isScanned: draft.isScan) }
            }
        }
        .sheet(item: $shareItem) { item in
            ShareSheet(items: [item.url])
        }
        .alert("Rename document", isPresented: Binding(
            get: { renaming != nil },
            set: { if !$0 { renaming = nil } }
        )) {
            TextField("Name", text: $renameText)
            Button("Save") {
                if let renaming { library.rename(renaming.id, to: renameText) }
            }
            Button("Cancel", role: .cancel) {}
        }
        .confirmationDialog(
            "Delete “\(deleting?.name ?? "")”?",
            isPresented: Binding(get: { deleting != nil }, set: { if !$0 { deleting = nil } }),
            titleVisibility: .visible
        ) {
            Button("Delete", role: .destructive) {
                if let deleting {
                    library.delete(deleting.id)
                    Haptics.success()
                }
            }
        } message: {
            Text("This removes the document from Folio. It can't be undone.")
        }
    }

    // MARK: - Pieces

    private var addButton: some View {
        Menu {
            Button("Import PDF", systemImage: "folder") { showImporter = true }
            if DocumentScannerView.isSupported {
                Button("Scan document", systemImage: "doc.viewfinder") { showScanner = true }
            }
            Button("From Photos", systemImage: "photo.on.rectangle") { showPhotos = true }
            Button("Blank document", systemImage: "doc") {
                Task { await create(PDFService.blankDocument(), name: "Untitled", isScanned: false) }
            }
        } label: {
            Image(systemName: "plus")
                .font(.title2.weight(.semibold))
                .foregroundStyle(.white)
                .frame(width: 60, height: 60)
                .background(Color.accentColor, in: Circle())
                .shadow(color: Color.accentColor.opacity(0.35), radius: 14, y: 6)
        }
        .accessibilityLabel("Add document")
        .padding(.trailing, 20)
        .padding(.bottom, 20)
    }

    private var emptyState: some View {
        VStack(spacing: 28) {
            VStack(spacing: 10) {
                Image(systemName: "doc.richtext")
                    .font(.system(size: 54, weight: .light))
                    .foregroundStyle(Color.accentColor)
                Text("Your documents live here")
                    .font(.title2.weight(.semibold))
                Text("Import a PDF, scan some paper, or start from a blank page. Everything stays on your device.")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                    .multilineTextAlignment(.center)
                    .frame(maxWidth: 320)
            }

            VStack(spacing: 12) {
                bigAction("Import a PDF", detail: "From Files, Mail or AirDrop", symbol: "folder") { showImporter = true }
                if DocumentScannerView.isSupported {
                    bigAction("Scan paper", detail: "Auto-crop, straighten, OCR with Pro", symbol: "doc.viewfinder") { showScanner = true }
                }
                bigAction("Photos to PDF", detail: "Pick images from your library", symbol: "photo.on.rectangle") { showPhotos = true }
            }
            .frame(maxWidth: 420)
        }
        .padding(.horizontal, 24)
        .padding(.top, 60)
        .padding(.bottom, 120)
    }

    private func bigAction(_ title: String, detail: String, symbol: String, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            HStack(spacing: 14) {
                Image(systemName: symbol)
                    .font(.title2)
                    .frame(width: 44, height: 44)
                    .background(Color.accentColor.opacity(0.12), in: RoundedRectangle(cornerRadius: 12, style: .continuous))
                    .foregroundStyle(Color.accentColor)
                VStack(alignment: .leading, spacing: 2) {
                    Text(title)
                        .font(.body.weight(.semibold))
                    Text(detail)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
                Spacer()
                Image(systemName: "chevron.right")
                    .font(.footnote.weight(.semibold))
                    .foregroundStyle(.tertiary)
            }
            .padding(14)
            .background(FolioTheme.paper, in: RoundedRectangle(cornerRadius: FolioTheme.cardRadius, style: .continuous))
        }
        .buttonStyle(.plain)
        .foregroundStyle(.primary)
    }

    @ViewBuilder
    private func documentMenu(_ record: DocumentRecord) -> some View {
        Button("Open", systemImage: "doc.text") { open(record) }
        Button("Rename", systemImage: "pencil") {
            renameText = record.name
            renaming = record
        }
        Button("Duplicate", systemImage: "plus.square.on.square") {
            Task {
                do {
                    _ = try await library.duplicate(record.id)
                    toast = .success("Duplicated")
                } catch {
                    toast = .error(error.localizedDescription)
                }
            }
        }
        Button("Share", systemImage: "square.and.arrow.up") {
            do {
                shareItem = ShareItem(url: try library.shareableURL(for: record), title: record.name)
            } catch {
                toast = .error(error.localizedDescription)
            }
        }
        Divider()
        Button("Delete", systemImage: "trash", role: .destructive) { deleting = record }
    }

    // MARK: - Actions

    private func open(_ record: DocumentRecord) {
        Haptics.tap()
        router.openEditor(record.id)
    }

    private func importFiles(_ urls: [URL]) async {
        isImporting = true
        defer { isImporting = false }
        var imported: [DocumentRecord] = []
        var failures: [String] = []
        for url in urls {
            do {
                imported.append(try await library.importFile(at: url))
            } catch {
                failures.append(error.localizedDescription)
            }
        }
        if let failure = failures.first {
            toast = .error(failure)
        }
        if imported.count == 1, failures.isEmpty, let record = imported.first {
            open(record)
        } else if imported.count > 1 {
            toast = .success("\(imported.count) documents imported")
        }
    }

    private func loadPhotos(_ items: [PhotosPickerItem]) async {
        var images: [UIImage] = []
        for item in items {
            if let data = try? await item.loadTransferable(type: Data.self), let image = UIImage(data: data) {
                images.append(image)
            }
        }
        photoItems = []
        guard !images.isEmpty else {
            toast = .error("Those photos couldn't be loaded.")
            return
        }
        scanDraft = ScanDraft(images: images, suggestedName: ScanPipeline.suggestedName(prefix: "Photos"), isScan: false)
    }

    private func create(_ document: PDFDocument, name: String, isScanned: Bool) async {
        do {
            let record = try await library.add(document: document, name: name, isScanned: isScanned)
            Haptics.success()
            open(record)
        } catch {
            toast = .error(error.localizedDescription)
        }
    }
}
