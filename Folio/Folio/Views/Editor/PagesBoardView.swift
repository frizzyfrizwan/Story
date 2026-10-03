import PDFKit
import PhotosUI
import SwiftUI
import UniformTypeIdentifiers

/// A grid of every page. Drag to reorder, tap to jump, long-press for
/// actions, or select several pages at once.
struct PagesBoardView: View {
    @Bindable var model: EditorViewModel

    @Environment(StoreService.self) private var store
    @Environment(AppSettings.self) private var settings

    @State private var items: [PageItem] = []
    @State private var dragging: PageItem?
    @State private var isSelecting = false
    @State private var selection: Set<ObjectIdentifier> = []
    @State private var confirmDelete = false
    @State private var showScanner = false
    @State private var showPhotos = false
    @State private var showImporter = false
    @State private var photoItems: [PhotosPickerItem] = []
    @State private var shareItem: ShareItem?

    struct PageItem: Identifiable, Equatable {
        let id: ObjectIdentifier
        let page: PDFPage

        static func == (lhs: PageItem, rhs: PageItem) -> Bool { lhs.id == rhs.id }
    }

    private let columns = [GridItem(.adaptive(minimum: 110, maximum: 150), spacing: 14)]

    var body: some View {
        NavigationStack {
            ScrollView {
                LazyVGrid(columns: columns, spacing: 18) {
                    ForEach(Array(items.enumerated()), id: \.element.id) { position, item in
                        PageCell(
                            model: model,
                            item: item,
                            position: position,
                            isSelecting: isSelecting,
                            isSelected: selection.contains(item.id),
                            isDragging: dragging == item
                        )
                        .onTapGesture { tapped(item) }
                        .contextMenu { pageMenu(for: item) }
                        .onDrag {
                            dragging = item
                            return NSItemProvider(object: "\(position)" as NSString)
                        }
                        .onDrop(of: [UTType.text], delegate: PageDropDelegate(
                            item: item,
                            items: $items,
                            dragging: $dragging,
                            onCommit: commitOrder
                        ))
                    }
                    addTile
                }
                .padding(16)
                .padding(.bottom, 90)
            }
            .onDrop(of: [UTType.text], delegate: BoardDropDelegate(dragging: $dragging, onCommit: commitOrder))
            .background(FolioTheme.canvas)
            .navigationTitle(isSelecting ? "\(selection.count) selected" : "Pages")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button(isSelecting ? "Done" : "Select") {
                        withAnimation(.snappy) {
                            isSelecting.toggle()
                            selection.removeAll()
                        }
                    }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button {
                        model.activeSheet = nil
                    } label: {
                        Image(systemName: "xmark.circle.fill")
                            .symbolRenderingMode(.hierarchical)
                            .font(.title3)
                    }
                    .accessibilityLabel("Close")
                }
            }
            .safeAreaInset(edge: .bottom) {
                if isSelecting {
                    selectionBar
                }
            }
            .onAppear(perform: rebuild)
            .onChange(of: model.contentVersion) { _, _ in rebuild() }
            .confirmationDialog(
                selection.count == 1 ? "Delete this page?" : "Delete \(selection.count) pages?",
                isPresented: $confirmDelete,
                titleVisibility: .visible
            ) {
                Button("Delete", role: .destructive) {
                    model.delete(pages: selectedIndices)
                    selection.removeAll()
                }
            }
            .sheet(item: $shareItem) { item in
                ShareSheet(items: [item.url])
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
                    model.appendPages(fromPDFAt: url, at: model.pageCount)
                }
            }
            .overlay {
                if model.isBusy {
                    BusyOverlay(message: model.busyMessage, progress: model.busyProgress)
                }
            }
        }
    }

    // MARK: - Pieces

    private var addTile: some View {
        Menu {
            if DocumentScannerView.isSupported {
                Button("Scan", systemImage: "doc.viewfinder") { showScanner = true }
            }
            Button("From Photos", systemImage: "photo.on.rectangle") { showPhotos = true }
            Button("From another PDF", systemImage: "doc.badge.plus") { showImporter = true }
            Button("Blank page", systemImage: "doc") {
                model.insertBlankPage(after: model.pageCount - 1)
            }
        } label: {
            VStack(spacing: 8) {
                Image(systemName: "plus")
                    .font(.title2.weight(.semibold))
                Text("Add pages")
                    .font(.caption.weight(.medium))
            }
            .foregroundStyle(Color.accentColor)
            .frame(maxWidth: .infinity)
            .aspectRatio(0.72, contentMode: .fit)
            .background(
                RoundedRectangle(cornerRadius: 12, style: .continuous)
                    .strokeBorder(Color.accentColor.opacity(0.5), style: StrokeStyle(lineWidth: 1.5, dash: [6, 5]))
            )
        }
        .accessibilityLabel("Add pages")
    }

    private var selectionBar: some View {
        HStack(spacing: 8) {
            barButton("Rotate", symbol: "rotate.right") {
                model.rotate(pages: selectedIndices, by: 90)
            }
            barButton("Share", symbol: "square.and.arrow.up") {
                shareItem = model.extract(pages: selectedIndices)
            }
            barButton("Delete", symbol: "trash", role: .destructive) {
                confirmDelete = true
            }
        }
        .disabled(selection.isEmpty)
        .padding(8)
        .floatingSurface(radius: 22)
        .padding(.horizontal, 16)
        .padding(.bottom, 6)
    }

    private func barButton(_ title: String, symbol: String, role: ButtonRole? = nil, action: @escaping () -> Void) -> some View {
        Button(role: role, action: action) {
            VStack(spacing: 4) {
                Image(systemName: symbol)
                    .font(.system(size: 18, weight: .medium))
                Text(title)
                    .font(.caption2.weight(.medium))
            }
            .frame(maxWidth: .infinity)
            .frame(height: 50)
        }
        .buttonStyle(.plain)
        .foregroundStyle(role == .destructive ? Color.red : Color.primary)
    }

    @ViewBuilder
    private func pageMenu(for item: PageItem) -> some View {
        let index = documentIndex(of: item)
        Button("Rotate right", systemImage: "rotate.right") { model.rotate(pages: [index], by: 90) }
        Button("Rotate left", systemImage: "rotate.left") { model.rotate(pages: [index], by: -90) }
        Button("Duplicate", systemImage: "plus.square.on.square") { model.duplicate(page: index) }
        Button("Insert blank page after", systemImage: "doc.badge.plus") { model.insertBlankPage(after: index) }
        Button("Share this page", systemImage: "square.and.arrow.up") { shareItem = model.extract(pages: [index]) }
        Divider()
        Button("Delete page", systemImage: "trash", role: .destructive) { model.delete(pages: [index]) }
    }

    // MARK: - Logic

    private var selectedIndices: [Int] {
        model.document.allPages.enumerated()
            .filter { selection.contains(ObjectIdentifier($0.element)) }
            .map(\.offset)
    }

    private func documentIndex(of item: PageItem) -> Int {
        let index = model.document.index(for: item.page)
        return index >= 0 ? index : 0
    }

    private func rebuild() {
        guard dragging == nil else { return }
        items = model.document.allPages.map { PageItem(id: ObjectIdentifier($0), page: $0) }
        selection = selection.intersection(items.map(\.id))
    }

    private func commitOrder() {
        let current = model.document.allPages
        let indexOf = Dictionary(uniqueKeysWithValues: current.enumerated().map { (ObjectIdentifier($0.element), $0.offset) })
        let order = items.compactMap { indexOf[$0.id] }
        dragging = nil
        guard order.count == current.count else {
            rebuild()
            return
        }
        model.reorder(to: order)
        Haptics.medium()
    }

    private func tapped(_ item: PageItem) {
        if isSelecting {
            Haptics.selection()
            if selection.contains(item.id) {
                selection.remove(item.id)
            } else {
                selection.insert(item.id)
            }
        } else {
            Haptics.tap()
            model.activeSheet = nil
            model.goTo(page: documentIndex(of: item))
        }
    }

    private func addPages(from images: [UIImage]) async {
        await model.appendPages(
            from: images,
            recognizeText: store.isPro && settings.recognizeTextOnScan,
            pageSize: settings.scanPageSize,
            at: model.pageCount
        )
    }

    private func importPhotos(_ pickerItems: [PhotosPickerItem]) async {
        var images: [UIImage] = []
        for pickerItem in pickerItems {
            if let data = try? await pickerItem.loadTransferable(type: Data.self), let image = UIImage(data: data) {
                images.append(image)
            }
        }
        photoItems = []
        await addPages(from: images)
    }
}

// MARK: - Cell

private struct PageCell: View {
    let model: EditorViewModel
    let item: PagesBoardView.PageItem
    let position: Int
    let isSelecting: Bool
    let isSelected: Bool
    let isDragging: Bool

    @State private var thumbnail: UIImage?

    var body: some View {
        VStack(spacing: 6) {
            ZStack {
                RoundedRectangle(cornerRadius: 8, style: .continuous)
                    .fill(Color.white)
                if let thumbnail {
                    Image(uiImage: thumbnail)
                        .resizable()
                        .scaledToFit()
                        .padding(2)
                } else {
                    ProgressView()
                }
            }
            .aspectRatio(0.72, contentMode: .fit)
            .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: 8, style: .continuous)
                    .strokeBorder(isSelected ? Color.accentColor : Color.primary.opacity(0.1), lineWidth: isSelected ? 3 : 1)
            )
            .overlay(alignment: .topTrailing) {
                if isSelecting {
                    Image(systemName: isSelected ? "checkmark.circle.fill" : "circle")
                        .font(.title3)
                        .symbolRenderingMode(.palette)
                        .foregroundStyle(.white, isSelected ? Color.accentColor : Color.gray)
                        .padding(6)
                }
            }
            .shadow(color: .black.opacity(0.08), radius: 4, y: 2)

            Text("\(position + 1)")
                .font(.caption.weight(.medium))
                .foregroundStyle(.secondary)
        }
        .opacity(isDragging ? 0.4 : 1)
        .contentShape(Rectangle())
        .task(id: "\(model.contentVersion)-\(item.page.rotation)") {
            thumbnail = await model.thumbnail(for: item.page, size: CGSize(width: 300, height: 300))
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("Page \(position + 1)")
        .accessibilityAddTraits(isSelected ? .isSelected : [])
    }
}

// MARK: - Drag & drop

private struct PageDropDelegate: DropDelegate {
    let item: PagesBoardView.PageItem
    @Binding var items: [PagesBoardView.PageItem]
    @Binding var dragging: PagesBoardView.PageItem?
    let onCommit: () -> Void

    func dropEntered(info: DropInfo) {
        guard let dragging, dragging != item,
              let from = items.firstIndex(of: dragging),
              let to = items.firstIndex(of: item) else { return }
        withAnimation(.snappy(duration: 0.2)) {
            items.move(fromOffsets: IndexSet(integer: from), toOffset: to > from ? to + 1 : to)
        }
    }

    func dropUpdated(info: DropInfo) -> DropProposal? {
        DropProposal(operation: .move)
    }

    func performDrop(info: DropInfo) -> Bool {
        onCommit()
        return true
    }
}

private struct BoardDropDelegate: DropDelegate {
    @Binding var dragging: PagesBoardView.PageItem?
    let onCommit: () -> Void

    func dropUpdated(info: DropInfo) -> DropProposal? {
        DropProposal(operation: .move)
    }

    func performDrop(info: DropInfo) -> Bool {
        onCommit()
        return true
    }
}
