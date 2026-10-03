import PDFKit
import SwiftUI

/// All editing state for one open document. Views stay thin; every mutation
/// goes through `perform` so it is undoable and autosaved.
@MainActor @Observable
final class EditorViewModel {
    private(set) var record: DocumentRecord
    private(set) var document: PDFDocument
    private let library: LibraryStore

    // MARK: Mode & tools

    var mode: EditorMode = .read {
        didSet {
            guard mode != oldValue else { return }
            if mode != .sign { pendingSignature = nil }
            Haptics.selection()
        }
    }
    var markupTool: MarkupTool = .pen
    var penColor: InkColor = InkColor.pens[0]
    var highlighterColor: InkColor = InkColor.highlighters[0]
    var penWidth: CGFloat = 2.5
    var highlighterWidth: CGFloat = 14

    // MARK: Document state

    var currentPageIndex = 0
    private(set) var pageCount: Int
    /// Bumped on every mutation so dependent views (pages board) refresh.
    private(set) var contentVersion = 0
    private let thumbnailCache = NSCache<NSString, UIImage>()

    // MARK: Presentation

    var textSession: TextEditSession?
    var pendingSignature: PlacedSignature?
    var activeSheet: EditorSheet?
    var shareItem: ShareItem?
    var exportItem: ShareItem?
    var toast: Toast?
    var isRenaming = false
    var confirmRevert = false
    private(set) var isBusy = false
    private(set) var busyMessage = ""
    private(set) var busyProgress: Double?

    // MARK: Find

    var isFinding = false {
        didSet {
            guard isFinding != oldValue else { return }
            if isFinding {
                mode = .read
            } else {
                clearFind()
            }
        }
    }
    var findQuery = ""
    private(set) var findResults: [PDFSelection] = []
    private(set) var findIndex = 0
    private(set) var isSearching = false
    private var findTask: Task<Void, Never>?

    // MARK: Undo

    private(set) var undoStack: [EditAction] = []
    private(set) var redoStack: [EditAction] = []
    var canUndo: Bool { !undoStack.isEmpty }
    var canRedo: Bool { !redoStack.isEmpty }

    // MARK: Persistence

    weak var pdfView: PDFView?
    private var saveTask: Task<Void, Never>?
    private(set) var hasUnsavedChanges = false
    private(set) var isSaving = false

    init(record: DocumentRecord, document: PDFDocument, library: LibraryStore) {
        self.record = record
        self.document = document
        self.library = library
        self.pageCount = document.pageCount
    }

    func attach(pdfView: PDFView) {
        self.pdfView = pdfView
    }

    var hasPagesWithoutText: Bool {
        document.allPages.contains { !$0.hasText }
    }

    // MARK: - Navigation

    func goTo(page index: Int) {
        guard let page = document.page(at: index) else { return }
        pdfView?.go(to: page)
    }

    // MARK: - Find in document

    func find(_ query: String) {
        findTask?.cancel()
        let trimmed = query.trimmed
        guard trimmed.count >= 2 else {
            findResults = []
            findIndex = 0
            isSearching = false
            pdfView?.highlightedSelections = nil
            return
        }
        isSearching = true
        let document = self.document
        findTask = Task { [weak self] in
            let results = await Task.detached(priority: .userInitiated) {
                document.findString(trimmed, withOptions: [.caseInsensitive])
            }.value
            guard !Task.isCancelled, let self else { return }
            self.findResults = results
            self.findIndex = 0
            self.isSearching = false
            self.applyFindHighlights()
            self.showCurrentFindResult()
        }
    }

    func nextFindResult() {
        guard !findResults.isEmpty else { return }
        findIndex = (findIndex + 1) % findResults.count
        showCurrentFindResult()
        Haptics.selection()
    }

    func previousFindResult() {
        guard !findResults.isEmpty else { return }
        findIndex = (findIndex - 1 + findResults.count) % findResults.count
        showCurrentFindResult()
        Haptics.selection()
    }

    private func applyFindHighlights() {
        for selection in findResults {
            selection.color = UIColor.systemYellow.withAlphaComponent(0.45)
        }
        pdfView?.highlightedSelections = findResults.isEmpty ? nil : findResults
    }

    private func showCurrentFindResult() {
        guard let pdfView, findResults.indices.contains(findIndex) else { return }
        let selection = findResults[findIndex]
        pdfView.setCurrentSelection(selection, animate: true)
        pdfView.go(to: selection)
    }

    private func clearFind() {
        findTask?.cancel()
        findTask = nil
        findResults = []
        findIndex = 0
        findQuery = ""
        isSearching = false
        pdfView?.highlightedSelections = nil
        pdfView?.clearSelection()
    }

    // MARK: - Undo plumbing

    /// Applies `redo` now and records the pair so it can be undone.
    func perform(
        _ name: String,
        structural: Bool = false,
        redo: @escaping () -> Void,
        undo: @escaping () -> Void
    ) {
        library.backupOriginalIfNeeded(for: record.id)
        if let fresh = library.document(id: record.id) { record = fresh }
        redo()
        undoStack.append(EditAction(name: name, undo: undo, redo: redo))
        if undoStack.count > 80 { undoStack.removeFirst() }
        redoStack.removeAll()
        didMutate(structural: structural)
    }

    func undo() {
        guard let action = undoStack.popLast() else { return }
        action.undo()
        redoStack.append(action)
        didMutate(structural: true)
        Haptics.tap()
    }

    func redo() {
        guard let action = redoStack.popLast() else { return }
        action.redo()
        undoStack.append(action)
        didMutate(structural: true)
        Haptics.tap()
    }

    private func didMutate(structural: Bool) {
        contentVersion += 1
        pageCount = document.pageCount
        thumbnailCache.removeAllObjects()
        hasUnsavedChanges = true
        if structural {
            pdfView?.layoutDocumentView()
        }
        scheduleSave()
    }

    /// Runs a structural change while keeping the reader roughly where it was.
    private func withPreservedPosition(_ body: () -> Void) {
        guard let pdfView else {
            body()
            return
        }
        let pageIndex = pdfView.currentPage.map { document.index(for: $0) } ?? currentPageIndex
        let point = pdfView.currentDestination?.point
        body()
        pdfView.layoutDocumentView()
        let clamped = min(max(0, pageIndex), max(0, document.pageCount - 1))
        guard let page = document.page(at: clamped) else { return }
        if let point {
            pdfView.go(to: PDFDestination(page: page, at: point))
        } else {
            pdfView.go(to: page)
        }
    }

    // MARK: - Thumbnails

    func thumbnail(forPage index: Int, size: CGSize) async -> UIImage? {
        guard let page = document.page(at: index) else { return nil }
        return await thumbnail(for: page, size: size)
    }

    func thumbnail(for page: PDFPage, size: CGSize) async -> UIImage? {
        let key = "\(ObjectIdentifier(page).hashValue)-\(page.rotation)-\(contentVersion)-\(Int(size.width))" as NSString
        if let cached = thumbnailCache.object(forKey: key) { return cached }
        let image = await Task.detached(priority: .userInitiated) {
            page.thumbnail(of: size, for: .cropBox)
        }.value
        thumbnailCache.setObject(image, forKey: key)
        return image
    }

    // MARK: - Taps

    func handleTap(at viewPoint: CGPoint) {
        guard let pdfView, let page = pdfView.page(for: viewPoint, nearest: false) else { return }
        let pagePoint = pdfView.convert(viewPoint, to: page)
        switch mode {
        case .text:
            beginTextEdit(at: pagePoint, on: page)
        case .markup:
            if markupTool == .eraser, eraseAnnotation(at: pagePoint, on: page) {
                Haptics.tap()
            }
        case .read, .sign:
            break
        }
    }

    // MARK: - Annotations

    func addInkStroke(points: [CGPoint], on page: PDFPage) {
        guard !points.isEmpty else { return }
        let isHighlighter = markupTool == .highlighter
        let color = isHighlighter ? highlighterColor.uiColor : penColor.uiColor
        let width = isHighlighter ? highlighterWidth : penWidth

        let path = UIBezierPath.smoothPath(through: points)
        let bounds = path.bounds.expanded(by: width)
        path.apply(CGAffineTransform(translationX: -bounds.minX, y: -bounds.minY))

        let annotation = PDFAnnotation(bounds: bounds, forType: .ink, withProperties: nil)
        annotation.color = color
        let border = PDFBorder()
        border.lineWidth = width
        annotation.border = border
        annotation.add(path)
        addAnnotation(annotation, to: page, name: isHighlighter ? "Highlight" : "Stroke")
    }

    func addAnnotation(_ annotation: PDFAnnotation, to page: PDFPage, name: String) {
        perform(name, redo: { page.addAnnotation(annotation) }, undo: { page.removeAnnotation(annotation) })
    }

    func removeAnnotation(_ annotation: PDFAnnotation, from page: PDFPage, name: String = "Erase") {
        perform(name, redo: { page.removeAnnotation(annotation) }, undo: { page.addAnnotation(annotation) })
    }

    @discardableResult
    func eraseAnnotation(at point: CGPoint, on page: PDFPage) -> Bool {
        guard let hit = page.annotation(at: point), Self.isUserAnnotation(hit) else { return false }
        removeAnnotation(hit, from: page)
        return true
    }

    static func normalizedType(of annotation: PDFAnnotation) -> String {
        (annotation.type ?? "").replacingOccurrences(of: "/", with: "")
    }

    /// Annotations Folio created and the user may erase or carry across a flatten.
    static func isUserAnnotation(_ annotation: PDFAnnotation) -> Bool {
        ["Ink", "FreeText", "Highlight", "Square"].contains(normalizedType(of: annotation))
    }

    // MARK: - Text patch

    func beginTextEdit(at point: CGPoint, on page: PDFPage) {
        let pageIndex = document.index(for: page)

        if let hit = page.annotation(at: point), Self.normalizedType(of: hit) == "FreeText" {
            let fontName = hit.font?.fontName.lowercased() ?? ""
            textSession = TextEditSession(
                page: page,
                pageIndex: pageIndex,
                bounds: hit.bounds,
                text: hit.contents ?? "",
                fontSize: hit.font?.pointSize ?? 14,
                coversOriginal: hit.color.cgColor.alpha > 0.5,
                color: hit.fontColor ?? .black,
                isBold: fontName.contains("bold"),
                existing: hit
            )
            Haptics.tap()
            return
        }

        if let selection = page.selectionForLine(at: point),
           let lineText = selection.string?.trimmed,
           !lineText.isEmpty {
            let bounds = selection.bounds(for: page)
            let fontSize = max(6, (bounds.height / 1.2).rounded(.toNearestOrEven))
            textSession = TextEditSession(
                page: page,
                pageIndex: pageIndex,
                bounds: bounds,
                text: lineText,
                fontSize: fontSize,
                coversOriginal: true,
                color: .black,
                isBold: false,
                existing: nil
            )
            Haptics.tap()
            return
        }

        textSession = TextEditSession(
            page: page,
            pageIndex: pageIndex,
            bounds: CGRect(x: point.x, y: point.y - 18, width: 220, height: 24),
            text: "",
            fontSize: 14,
            coversOriginal: false,
            color: .black,
            isBold: false,
            existing: nil
        )
    }

    func commitTextEdit(_ session: TextEditSession) {
        textSession = nil
        let text = session.text.trimmed
        let font = Self.textFont(size: session.fontSize, bold: session.isBold)

        if let existing = session.existing {
            if text.isEmpty {
                removeAnnotation(existing, from: session.page, name: "Delete text")
                return
            }
            let old = (
                contents: existing.contents,
                font: existing.font,
                fontColor: existing.fontColor,
                color: existing.color,
                bounds: existing.bounds
            )
            let bounds = Self.textBounds(for: text, font: font, anchoredTo: existing.bounds, cover: nil, page: session.page)
            perform("Edit text", redo: {
                existing.contents = text
                existing.font = font
                existing.fontColor = session.color
                existing.color = session.coversOriginal ? .white : .clear
                existing.bounds = bounds
            }, undo: {
                existing.contents = old.contents
                existing.font = old.font
                existing.fontColor = old.fontColor
                existing.color = old.color
                existing.bounds = old.bounds
            })
        } else {
            guard !text.isEmpty else { return }
            let bounds = Self.textBounds(
                for: text,
                font: font,
                anchoredTo: session.bounds,
                cover: session.coversOriginal ? session.bounds : nil,
                page: session.page
            )
            let annotation = PDFAnnotation(bounds: bounds, forType: .freeText, withProperties: nil)
            annotation.contents = text
            annotation.font = font
            annotation.fontColor = session.color
            annotation.color = session.coversOriginal ? .white : .clear
            annotation.alignment = .left
            let border = PDFBorder()
            border.lineWidth = 0
            annotation.border = border
            addAnnotation(annotation, to: session.page, name: "Text")
        }
        Haptics.success()
    }

    static func textFont(size: CGFloat, bold: Bool) -> UIFont {
        UIFont(name: bold ? "Helvetica-Bold" : "Helvetica", size: size)
            ?? UIFont.systemFont(ofSize: size, weight: bold ? .bold : .regular)
    }

    /// Computes a free text annotation's bounds. The top-left corner stays
    /// anchored to `anchor`; when `cover` is given the box grows to hide it.
    static func textBounds(
        for text: String,
        font: UIFont,
        anchoredTo anchor: CGRect,
        cover: CGRect?,
        page: PDFPage
    ) -> CGRect {
        let pageBounds = page.bounds(for: .cropBox)
        let padding: CGFloat = 3
        let originX = anchor.minX - (cover == nil ? 0 : 1.5)
        let top = anchor.maxY + (cover == nil ? 0 : 1.5)
        let maxWidth = max(40, pageBounds.maxX - originX - padding)

        let measured = (text as NSString).boundingRect(
            with: CGSize(width: maxWidth - padding * 2, height: .greatestFiniteMagnitude),
            options: [.usesLineFragmentOrigin, .usesFontLeading],
            attributes: [.font: font],
            context: nil
        )
        var width = measured.width + padding * 2 + 4
        var height = max(font.lineHeight, measured.height) + padding * 2
        if let cover {
            width = max(width, cover.width + 3)
            height = max(height, cover.height + 3)
        }
        width = min(width, maxWidth)
        return CGRect(x: originX, y: top - height, width: width, height: height)
    }

    // MARK: - Signatures

    func startPlacingSignature(_ image: UIImage) {
        let viewBounds = pdfView?.bounds ?? CGRect(x: 0, y: 0, width: 390, height: 700)
        let width = min(260, max(120, viewBounds.width * 0.45))
        pendingSignature = PlacedSignature(
            image: image,
            center: CGPoint(x: viewBounds.midX, y: viewBounds.midY - 40),
            width: width
        )
        mode = .sign
        activeSheet = nil
    }

    func cancelSignature() {
        pendingSignature = nil
        mode = .read
    }

    /// Burns the pending signature into the page under `viewFrame`.
    func commitSignature(viewFrame: CGRect) {
        guard let pdfView, let signature = pendingSignature else { return }
        guard let page = pdfView.page(for: viewFrame.center, nearest: true) else {
            toast = .error("Move the signature over a page first.")
            return
        }
        let index = document.index(for: page)
        guard index >= 0, index < document.pageCount else { return }

        let pageRect = pdfView.convert(viewFrame, to: page)
        let carried = page.annotations.filter(Self.isUserAnnotation)
        carried.forEach(page.removeAnnotation)
        let stamp = ImageStampAnnotation(image: signature.image, bounds: pageRect)
        page.addAnnotation(stamp)
        let flattened = PDFService.flatten(page: page)
        page.removeAnnotation(stamp)
        carried.forEach(page.addAnnotation)

        guard let flattened else {
            toast = .error("The signature couldn't be placed.")
            return
        }
        replacePage(at: index, with: flattened, carrying: carried, name: "Signature")
        pendingSignature = nil
        mode = .read
        toast = .success("Signed")
        Haptics.success()
    }

    // MARK: - Page operations

    /// Swaps a page for a re-rendered version. `carrying` annotations move
    /// with the swap so they stay editable.
    func replacePage(at index: Int, with newPage: PDFPage, carrying annotations: [PDFAnnotation], name: String) {
        guard let oldPage = document.page(at: index) else { return }
        perform(name, structural: true, redo: { [self] in
            withPreservedPosition {
                for annotation in annotations {
                    oldPage.removeAnnotation(annotation)
                    newPage.addAnnotation(annotation)
                }
                document.removePage(at: index)
                document.insert(newPage, at: index)
            }
        }, undo: { [self] in
            withPreservedPosition {
                for annotation in annotations {
                    newPage.removeAnnotation(annotation)
                    oldPage.addAnnotation(annotation)
                }
                document.removePage(at: index)
                document.insert(oldPage, at: index)
            }
        })
    }

    func rotate(pages indices: [Int], by degrees: Int) {
        let pages = indices.compactMap { document.page(at: $0) }
        guard !pages.isEmpty else { return }
        perform("Rotate", structural: true, redo: {
            for page in pages { page.rotation = Self.normalizedRotation(page.rotation + degrees) }
        }, undo: {
            for page in pages { page.rotation = Self.normalizedRotation(page.rotation - degrees) }
        })
    }

    private static func normalizedRotation(_ value: Int) -> Int {
        ((value % 360) + 360) % 360
    }

    func delete(pages indices: [Int]) {
        let sorted = Array(Set(indices)).sorted()
        let pages = sorted.compactMap { document.page(at: $0) }
        guard !pages.isEmpty else { return }
        guard pages.count < document.pageCount else {
            toast = .info("A document needs at least one page.")
            return
        }
        perform(pages.count == 1 ? "Delete page" : "Delete pages", structural: true, redo: { [self] in
            for index in sorted.reversed() { document.removePage(at: index) }
        }, undo: { [self] in
            for (index, page) in zip(sorted, pages) { document.insert(page, at: index) }
        })
    }

    func duplicate(page index: Int) {
        guard let page = document.page(at: index), let copy = page.copy() as? PDFPage else { return }
        insert(pages: [copy], at: index + 1, name: "Duplicate page")
    }

    func insertBlankPage(after index: Int) {
        let size = document.page(at: index)?.displaySize ?? PDFService.letterSize
        guard let page = PDFService.blankPage(size: size) else { return }
        insert(pages: [page], at: index + 1, name: "Blank page")
    }

    func insert(pages: [PDFPage], at index: Int, name: String) {
        guard !pages.isEmpty else { return }
        let position = min(max(0, index), document.pageCount)
        perform(name, structural: true, redo: { [self] in
            for (offset, page) in pages.enumerated() { document.insert(page, at: position + offset) }
        }, undo: { [self] in
            for _ in pages { document.removePage(at: position) }
        })
    }

    func insert(document other: PDFDocument, at index: Int, name: String) {
        let copies = other.allPages.compactMap { $0.copy() as? PDFPage }
        insert(pages: copies, at: index, name: name)
    }

    /// `newOrder[i]` is the current index of the page that should end up at `i`.
    func reorder(to newOrder: [Int]) {
        let pages = document.allPages
        let identity = Array(pages.indices)
        guard newOrder.count == pages.count, Set(newOrder) == Set(identity), newOrder != identity else { return }
        let apply: ([Int]) -> Void = { [self] order in
            for index in stride(from: document.pageCount - 1, through: 0, by: -1) {
                document.removePage(at: index)
            }
            for (position, original) in order.enumerated() {
                document.insert(pages[original], at: position)
            }
        }
        perform("Reorder pages", structural: true, redo: { apply(newOrder) }, undo: { apply(identity) })
    }

    func extract(pages indices: [Int]) -> ShareItem? {
        let sorted = indices.sorted()
        guard !sorted.isEmpty else { return nil }
        let extracted = PDFService.extract(pages: sorted, from: document)
        let name = sorted.count == 1 ? "\(record.name) – page \(sorted[0] + 1)" : "\(record.name) – \(sorted.count) pages"
        return writeTemporary(extracted, name: name)
    }

    // MARK: - Adding pages from outside

    /// Inserts scanned or photographed pages. `index` defaults to right after
    /// the page being read.
    func appendPages(from images: [UIImage], recognizeText: Bool, pageSize: ScanPageSize, at index: Int? = nil) async {
        guard !images.isEmpty else { return }
        beginBusy(recognizeText ? "Recognizing text…" : "Adding pages…", progress: 0)
        defer { endBusy() }
        do {
            let scanned = try await ScanPipeline.build(
                images: images,
                recognizeText: recognizeText,
                pageSize: pageSize
            ) { [weak self] value in
                self?.busyProgress = value
            }
            insert(document: scanned, at: index ?? (currentPageIndex + 1), name: "Add pages")
            toast = .success(scanned.pageCount == 1 ? "1 page added" : "\(scanned.pageCount) pages added")
            Haptics.success()
        } catch {
            toast = .error(error.localizedDescription)
        }
    }

    func appendPages(fromPDFAt url: URL, at index: Int? = nil) {
        do {
            let other = try library.loadExternalPDF(at: url)
            insert(document: other, at: index ?? (currentPageIndex + 1), name: "Merge")
            toast = .success(other.pageCount == 1 ? "1 page merged" : "\(other.pageCount) pages merged")
            Haptics.success()
        } catch {
            toast = .error(error.localizedDescription)
        }
    }

    // MARK: - Pro operations

    func recognizeText() async {
        let indices = document.pageIndices.filter { !(document.page(at: $0)?.hasText ?? true) }
        guard !indices.isEmpty else {
            toast = .info("Every page already has selectable text.")
            return
        }
        beginBusy("Recognizing text…", progress: 0)
        defer { endBusy() }

        var swaps: [PageSwap] = []
        do {
            for (step, index) in indices.enumerated() {
                guard let page = document.page(at: index) else { continue }
                let carried = page.annotations.filter(Self.isUserAnnotation)
                carried.forEach(page.removeAnnotation)
                let image = await Task.detached(priority: .userInitiated) {
                    PDFService.render(page: page, scale: 2.5)
                }.value
                let lines = try await OCRService.recognize(image)
                let replacement = lines.isEmpty ? nil : PDFService.pageWithTextLayer(page: page, lines: lines)
                carried.forEach(page.addAnnotation)
                if let replacement {
                    swaps.append(PageSwap(index: index, old: page, new: replacement, carried: carried))
                }
                busyProgress = Double(step + 1) / Double(indices.count)
            }
        } catch {
            toast = .error(error.localizedDescription)
            return
        }

        guard !swaps.isEmpty else {
            toast = .info("No readable text was found.")
            return
        }
        performSwaps(swaps, name: "Recognize text")
        toast = .success(swaps.count == 1 ? "Text recognized on 1 page" : "Text recognized on \(swaps.count) pages")
        Haptics.success()
    }

    func applyRedactions(_ items: [RedactionCandidate]) async {
        let selected = items.filter(\.isSelected)
        guard !selected.isEmpty else { return }
        let grouped = Dictionary(grouping: selected, by: \.pageIndex).sorted { $0.key < $1.key }

        beginBusy("Redacting…", progress: 0)
        defer { endBusy() }

        var swaps: [PageSwap] = []
        for (step, entry) in grouped.enumerated() {
            let index = entry.key
            guard let page = document.page(at: index) else { continue }
            let carried = page.annotations.filter(Self.isUserAnnotation)
            carried.forEach(page.removeAnnotation)

            let boxes: [PDFAnnotation] = entry.value.map { candidate in
                let box = PDFAnnotation(bounds: candidate.bounds.expanded(by: 2), forType: .square, withProperties: nil)
                box.color = .black
                box.interiorColor = .black
                let border = PDFBorder()
                border.lineWidth = 1
                box.border = border
                return box
            }
            boxes.forEach(page.addAnnotation)
            let image = await Task.detached(priority: .userInitiated) {
                PDFService.render(page: page, scale: 200.0 / 72.0)
            }.value
            boxes.forEach(page.removeAnnotation)
            carried.forEach(page.addAnnotation)

            // The page becomes a bitmap so the text underneath is truly gone,
            // then OCR restores a text layer for everything still visible.
            let lines = (try? await OCRService.recognize(image)) ?? []
            let size = page.bounds(for: .mediaBox).size
            guard let replacement = PDFService.imagePage(image.jpegBacked(quality: 0.85), size: size, lines: lines) else { continue }
            swaps.append(PageSwap(index: index, old: page, new: replacement, carried: carried))
            busyProgress = Double(step + 1) / Double(grouped.count)
        }

        guard !swaps.isEmpty else { return }
        performSwaps(swaps, name: "Redact")
        toast = .success(selected.count == 1 ? "1 item redacted" : "\(selected.count) items redacted")
        Haptics.success()
    }

    private struct PageSwap {
        let index: Int
        let old: PDFPage
        let new: PDFPage
        let carried: [PDFAnnotation]
    }

    private func performSwaps(_ swaps: [PageSwap], name: String) {
        perform(name, structural: true, redo: { [self] in
            withPreservedPosition {
                for swap in swaps {
                    for annotation in swap.carried {
                        swap.old.removeAnnotation(annotation)
                        swap.new.addAnnotation(annotation)
                    }
                    document.removePage(at: swap.index)
                    document.insert(swap.new, at: swap.index)
                }
            }
        }, undo: { [self] in
            withPreservedPosition {
                for swap in swaps {
                    for annotation in swap.carried {
                        swap.new.removeAnnotation(annotation)
                        swap.old.addAnnotation(annotation)
                    }
                    document.removePage(at: swap.index)
                    document.insert(swap.old, at: swap.index)
                }
            }
        })
    }

    // MARK: - Busy state

    private func beginBusy(_ message: String, progress: Double?) {
        busyMessage = message
        busyProgress = progress
        isBusy = true
    }

    private func endBusy() {
        isBusy = false
        busyProgress = nil
    }

    // MARK: - Persistence

    func scheduleSave() {
        saveTask?.cancel()
        saveTask = Task { [weak self] in
            try? await Task.sleep(for: .seconds(1))
            guard !Task.isCancelled else { return }
            await self?.saveNow()
        }
    }

    func saveNow() async {
        saveTask?.cancel()
        saveTask = nil
        guard hasUnsavedChanges, !isSaving else { return }
        isSaving = true
        hasUnsavedChanges = false
        do {
            record = try await library.persist(document, for: record.id)
        } catch {
            hasUnsavedChanges = true
            toast = .error("Couldn't save: \(error.localizedDescription)")
        }
        isSaving = false
    }

    func rename(to newName: String) {
        library.rename(record.id, to: newName)
        if let fresh = library.document(id: record.id) { record = fresh }
    }

    func revertToOriginal() async {
        beginBusy("Restoring original…", progress: nil)
        defer { endBusy() }
        do {
            let restored = try await library.revertToOriginal(record.id)
            document = restored
            pdfView?.document = restored
            undoStack.removeAll()
            redoStack.removeAll()
            thumbnailCache.removeAllObjects()
            pageCount = restored.pageCount
            contentVersion += 1
            hasUnsavedChanges = false
            if let fresh = library.document(id: record.id) { record = fresh }
            toast = .success("Original restored")
            Haptics.success()
        } catch {
            toast = .error(error.localizedDescription)
        }
    }

    // MARK: - Sharing

    func prepareShare(flattened: Bool) async {
        await saveNow()
        if flattened {
            let copy = PDFService.flattenedCopy(of: document)
            shareItem = writeTemporary(copy, name: "\(record.name) (flattened)")
        } else {
            do {
                shareItem = ShareItem(url: try library.shareableURL(for: record), title: record.name)
            } catch {
                toast = .error(error.localizedDescription)
            }
        }
    }

    func prepareExportToFiles() async {
        await saveNow()
        do {
            exportItem = ShareItem(url: try library.shareableURL(for: record), title: record.name)
        } catch {
            toast = .error(error.localizedDescription)
        }
    }

    private func writeTemporary(_ document: PDFDocument, name: String) -> ShareItem? {
        let directory = FileManager.default.temporaryDirectory.appendingPathComponent("Share", isDirectory: true)
        try? FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        let safeName = name.replacingOccurrences(of: "/", with: "-")
        let url = directory.appendingPathComponent("\(safeName).pdf")
        try? FileManager.default.removeItem(at: url)
        guard document.write(to: url) else {
            toast = .error("The PDF couldn't be exported.")
            return nil
        }
        return ShareItem(url: url, title: name)
    }
}
