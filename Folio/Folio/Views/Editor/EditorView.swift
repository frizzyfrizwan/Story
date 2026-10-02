import PDFKit
import PhotosUI
import SwiftUI
import UniformTypeIdentifiers

/// The document editor. The page is the hero; a single floating dock holds
/// the four modes and the pages board. Everything else is reachable from
/// the title or the More menu.
struct EditorView: View {
    @Bindable var model: EditorViewModel

    @Environment(\.scenePhase) private var scenePhase
    @Environment(StoreService.self) private var store
    @Environment(Router.self) private var router
    @Environment(AppSettings.self) private var settings

    @State private var renameText = ""
    @State private var showScanner = false
    @State private var showPhotos = false
    @State private var showImporter = false
    @State private var photoItems: [PhotosPickerItem] = []
    @State private var confirmRecognize = false

    var body: some View {
        ZStack {
            PDFKitView(model: model, drawWithFinger: settings.drawWithFinger)
            if let signature = model.pendingSignature {
                SignaturePlacementOverlay(model: model, signature: signature)
            }
        }
        .safeAreaInset(edge: .bottom, spacing: 0) {
            bottomControls
        }
        .overlay {
            if model.isBusy {
                BusyOverlay(message: model.busyMessage, progress: model.busyProgress)
            }
        }
        .animation(.easeInOut(duration: 0.2), value: model.isBusy)
        .toast($model.toast)
        .navigationBarTitleDisplayMode(.inline)
        .toolbarBackground(.visible, for: .navigationBar)
        .toolbar { toolbarContent }
        .sheet(item: $model.textSession) { session in
            TextPatchSheet(session: session, model: model)
        }
        .sheet(item: $model.activeSheet) { sheet in
            sheetContent(sheet)
        }
        .sheet(item: $model.shareItem) { item in
            ShareSheet(items: [item.url])
        }
        .sheet(item: $model.exportItem) { item in
            DocumentExporter(url: item.url)
        }
        .fullScreenCover(isPresented: $showScanner) {
            DocumentScannerView(
                onFinish: { images in
                    showScanner = false
                    Task { await addPages(from: images) }
                },
                onCancel: { showScanner = false }
            )
            .ignoresSafeArea()
        }
        .photosPicker(isPresented: $showPhotos, selection: $photoItems, maxSelectionCount: 30, matching: .images)
        .onChange(of: photoItems) { _, items in
            guard !items.isEmpty else { return }
            Task { await importPhotos(items) }
        }
        .fileImporter(isPresented: $showImporter, allowedContentTypes: [.pdf]) { result in
            if case .success(let url) = result {
                model.appendPages(fromPDFAt: url)
            }
        }
        .alert("Rename document", isPresented: $model.isRenaming) {
            TextField("Name", text: $renameText)
            Button("Save") { model.rename(to: renameText) }
            Button("Cancel", role: .cancel) {}
        }
        .confirmationDialog("Restore the original file?", isPresented: $model.confirmRevert, titleVisibility: .visible) {
            Button("Restore original", role: .destructive) {
                Task { await model.revertToOriginal() }
            }
        } message: {
            Text("Every edit made in Folio will be discarded. This can't be undone.")
        }
        .confirmationDialog("Recognize text on this document?", isPresented: $confirmRecognize, titleVisibility: .visible) {
            Button("Recognize text") {
                Task { await model.recognizeText() }
            }
        } message: {
            Text("Pages without selectable text are scanned on your device and given an invisible text layer. The page's look doesn't change.")
        }
        .onChange(of: scenePhase) { _, phase in
            if phase != .active {
                Task { await model.saveNow() }
            }
        }
        .onDisappear {
            Task { await model.saveNow() }
        }
    }

    // MARK: - Chrome

    @ToolbarContentBuilder
    private var toolbarContent: some ToolbarContent {
        ToolbarItem(placement: .principal) {
            Button {
                renameText = model.record.name
                model.isRenaming = true
            } label: {
                VStack(spacing: 1) {
                    Text(model.record.name)
                        .font(.headline)
                        .lineLimit(1)
                    Text("Page \(model.currentPageIndex + 1) of \(model.pageCount)")
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                        .contentTransition(.numericText())
                }
                .foregroundStyle(.primary)
            }
            .accessibilityLabel("Rename \(model.record.name)")
        }

        ToolbarItemGroup(placement: .topBarTrailing) {
            Button {
                model.undo()
            } label: {
                Image(systemName: "arrow.uturn.backward")
            }
            .disabled(!model.canUndo)
            .accessibilityLabel("Undo")

            Button {
                model.redo()
            } label: {
                Image(systemName: "arrow.uturn.forward")
            }
            .disabled(!model.canRedo)
            .accessibilityLabel("Redo")

            moreMenu
        }
    }

    private var moreMenu: some View {
        Menu {
            Section {
                Button("Rename", systemImage: "pencil") {
                    renameText = model.record.name
                    model.isRenaming = true
                }
                Button(proTitle("Recognize text"), systemImage: "text.magnifyingglass") {
                    guard router.requirePro(.recognizeText, store: store) else { return }
                    confirmRecognize = true
                }
                Button(proTitle("Smart Redact"), systemImage: "eye.slash") {
                    guard router.requirePro(.smartRedact, store: store) else { return }
                    model.activeSheet = .smartRedact
                }
            }
            Section("Add pages") {
                if DocumentScannerView.isSupported {
                    Button("Scan", systemImage: "doc.viewfinder") { showScanner = true }
                }
                Button("From Photos", systemImage: "photo.on.rectangle") { showPhotos = true }
                Button("From another PDF", systemImage: "doc.badge.plus") { showImporter = true }
                Button("Blank page", systemImage: "doc") {
                    model.insertBlankPage(after: model.currentPageIndex)
                }
            }
            Section("Share") {
                Button("Share PDF", systemImage: "square.and.arrow.up") {
                    Task { await model.prepareShare(flattened: false) }
                }
                Button("Share flattened copy", systemImage: "square.and.arrow.up.on.square") {
                    Task { await model.prepareShare(flattened: true) }
                }
                Button("Save to Files", systemImage: "folder") {
                    Task { await model.prepareExportToFiles() }
                }
            }
            Section {
                if model.record.hasOriginalBackup {
                    Button("Restore original", systemImage: "arrow.uturn.backward.circle", role: .destructive) {
                        model.confirmRevert = true
                    }
                }
                Button("Document info", systemImage: "info.circle") {
                    model.activeSheet = .info
                }
            }
        } label: {
            Image(systemName: "ellipsis.circle")
        }
        .accessibilityLabel("More")
    }

    private func proTitle(_ title: String) -> String {
        store.isPro ? title : "\(title) · Pro"
    }

    private var bottomControls: some View {
        VStack(spacing: 10) {
            if model.mode == .markup {
                MarkupToolbar(model: model)
                    .transition(.move(edge: .bottom).combined(with: .opacity))
            }
            if let hint = modeHint {
                Text(hint)
                    .font(.caption.weight(.medium))
                    .foregroundStyle(.secondary)
                    .padding(.horizontal, 12)
                    .padding(.vertical, 6)
                    .background(.thinMaterial, in: Capsule())
                    .transition(.opacity)
            }
            if model.pendingSignature == nil {
                ToolDock(model: model)
            }
        }
        .padding(.bottom, 6)
        .animation(.snappy(duration: 0.25), value: model.mode)
        .animation(.snappy(duration: 0.25), value: model.pendingSignature?.id)
    }

    private var modeHint: String? {
        switch model.mode {
        case .text:
            return "Tap a line to retype it · Tap empty space to add text"
        case .markup where model.markupTool == .eraser:
            return "Tap or drag over a stroke to erase it"
        case .markup:
            return settings.drawWithFinger ? "One finger draws · Two fingers scroll" : "Apple Pencil draws · Finger scrolls"
        case .read, .sign:
            return nil
        }
    }

    @ViewBuilder
    private func sheetContent(_ sheet: EditorSheet) -> some View {
        switch sheet {
        case .pages:
            PagesBoardView(model: model)
        case .signaturePicker:
            SignaturePickerSheet(model: model)
        case .smartRedact:
            SmartRedactSheet(model: model)
        case .info:
            DocumentInfoSheet(model: model)
        }
    }

    // MARK: - Adding pages

    private func addPages(from images: [UIImage]) async {
        await model.appendPages(
            from: images,
            recognizeText: store.isPro && settings.recognizeTextOnScan,
            pageSize: settings.scanPageSize
        )
    }

    private func importPhotos(_ items: [PhotosPickerItem]) async {
        var images: [UIImage] = []
        for item in items {
            if let data = try? await item.loadTransferable(type: Data.self), let image = UIImage(data: data) {
                images.append(image)
            }
        }
        photoItems = []
        guard !images.isEmpty else {
            model.toast = .error("Those photos couldn't be loaded.")
            return
        }
        await addPages(from: images)
    }
}
