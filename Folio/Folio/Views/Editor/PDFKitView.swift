import PDFKit
import SwiftUI
import UIKit
import UIKit.UIGestureRecognizerSubclass

/// Hosts PDFKit's `PDFView` and wires the editor's gestures into it.
struct PDFKitView: UIViewRepresentable {
    let model: EditorViewModel
    let drawWithFinger: Bool

    func makeUIView(context: Context) -> PDFView {
        let view = FittingPDFView()
        view.document = model.document
        view.autoScales = true
        view.displayMode = .singlePageContinuous
        view.displayDirection = .vertical
        view.displaysPageBreaks = true
        view.pageBreakMargins = UIEdgeInsets(top: 12, left: 0, bottom: 12, right: 0)
        view.pageShadowsEnabled = true
        view.backgroundColor = UIColor.systemGroupedBackground
        context.coordinator.install(on: view)
        model.attach(pdfView: view)
        return view
    }

    func updateUIView(_ view: PDFView, context: Context) {
        if view.document !== model.document {
            view.document = model.document
        }
        let ink = context.coordinator.ink
        switch model.mode {
        case .markup:
            ink.mode = model.markupTool == .eraser ? .erase : .draw
        case .read, .text, .sign:
            ink.mode = .off
        }
        ink.pencilOnly = !drawWithFinger
        let highlighter = model.markupTool == .highlighter
        ink.strokeColor = highlighter ? model.highlighterColor.uiColor : model.penColor.uiColor
        ink.strokeWidth = highlighter ? model.highlighterWidth : model.penWidth
        context.coordinator.tap.isEnabled = model.mode == .text
    }

    func makeCoordinator() -> Coordinator {
        Coordinator(model: model)
    }

    @MainActor
    final class Coordinator: NSObject, UIGestureRecognizerDelegate {
        let model: EditorViewModel
        let ink = InkController()
        let tap = UITapGestureRecognizer()

        init(model: EditorViewModel) {
            self.model = model
            super.init()
        }

        func install(on view: PDFView) {
            ink.install(on: view)
            ink.onStroke = { [weak self] points, page in
                self?.model.addInkStroke(points: points, on: page)
            }
            ink.onErase = { [weak self] point, page in
                if self?.model.eraseAnnotation(at: point, on: page) == true {
                    Haptics.tap()
                }
            }

            tap.addTarget(self, action: #selector(handleTap(_:)))
            tap.delegate = self
            tap.isEnabled = false
            view.addGestureRecognizer(tap)

            // Selector-based observers are removed automatically on dealloc.
            NotificationCenter.default.addObserver(
                self,
                selector: #selector(pageChanged(_:)),
                name: .PDFViewPageChanged,
                object: view
            )
        }

        @objc private func pageChanged(_ notification: Notification) {
            guard let view = notification.object as? PDFView,
                  let page = view.currentPage,
                  let document = view.document else { return }
            let index = document.index(for: page)
            if index >= 0, index != model.currentPageIndex {
                model.currentPageIndex = index
            }
        }

        @objc private func handleTap(_ recognizer: UITapGestureRecognizer) {
            guard let view = recognizer.view else { return }
            model.handleTap(at: recognizer.location(in: view))
        }

        func gestureRecognizer(
            _ gestureRecognizer: UIGestureRecognizer,
            shouldRecognizeSimultaneouslyWith otherGestureRecognizer: UIGestureRecognizer
        ) -> Bool {
            true
        }
    }
}

// MARK: - Fit to width

/// PDFView's `autoScales` fits the page using whatever size the view had
/// when the document was set, which inside SwiftUI is often not the final
/// size. This subclass re-fits whenever its size changes or a new document
/// is assigned, and keeps the fit as the minimum zoom.
final class FittingPDFView: PDFView {
    private var lastFitSize: CGSize = .zero

    override var document: PDFDocument? {
        didSet {
            lastFitSize = .zero
            setNeedsLayout()
        }
    }

    override func layoutSubviews() {
        super.layoutSubviews()
        guard document != nil, bounds.width > 0, bounds.height > 0, bounds.size != lastFitSize else { return }
        let fit = scaleFactorForSizeToFit
        guard fit > 0 else { return }
        lastFitSize = bounds.size
        minScaleFactor = fit
        maxScaleFactor = max(fit * 6, 4)
        scaleFactor = fit
    }
}

// MARK: - Ink capture

/// Captures one-finger (or Pencil) strokes over the PDF view, previews them
/// with a shape layer and hands the finished stroke back in page space.
/// Two-finger gestures keep scrolling and zooming the document.
@MainActor
final class InkController: NSObject, UIGestureRecognizerDelegate {
    enum Mode { case off, draw, erase }

    var mode: Mode = .off {
        didSet {
            guard mode != oldValue else { return }
            recognizer.isEnabled = mode != .off
            cancelStroke()
            updateScrollTouches()
        }
    }

    var pencilOnly = false {
        didSet {
            guard pencilOnly != oldValue else { return }
            updateTouchTypes()
            updateScrollTouches()
        }
    }

    var strokeColor: UIColor = .black
    var strokeWidth: CGFloat = 2.5
    var onStroke: (@MainActor ([CGPoint], PDFPage) -> Void)?
    var onErase: (@MainActor (CGPoint, PDFPage) -> Void)?

    private weak var pdfView: PDFView?
    private let recognizer = StrokeGestureRecognizer()
    private let previewLayer = CAShapeLayer()
    private var points: [CGPoint] = []
    private var activePage: PDFPage?

    private var scrollView: UIScrollView? {
        pdfView?.subviews.first { $0 is UIScrollView } as? UIScrollView
    }

    func install(on view: PDFView) {
        pdfView = view
        recognizer.addTarget(self, action: #selector(handle(_:)))
        recognizer.delegate = self
        recognizer.isEnabled = false
        view.addGestureRecognizer(recognizer)

        previewLayer.fillColor = nil
        previewLayer.lineCap = .round
        previewLayer.lineJoin = .round
        previewLayer.zPosition = 1000
        view.layer.addSublayer(previewLayer)
        updateTouchTypes()
    }

    private func updateTouchTypes() {
        let pencil = NSNumber(value: UITouch.TouchType.pencil.rawValue)
        let direct = NSNumber(value: UITouch.TouchType.direct.rawValue)
        recognizer.allowedTouchTypes = pencilOnly ? [pencil] : [direct, pencil]
    }

    private func updateScrollTouches() {
        let drawingWithFinger = mode != .off && !pencilOnly
        scrollView?.panGestureRecognizer.minimumNumberOfTouches = drawingWithFinger ? 2 : 1
    }

    @objc private func handle(_ gesture: StrokeGestureRecognizer) {
        guard let view = pdfView else { return }
        let location = gesture.location(in: view)
        previewLayer.frame = view.bounds

        switch gesture.state {
        case .began:
            guard let page = view.page(for: location, nearest: false) else {
                activePage = nil
                return
            }
            activePage = page
            points = [location]
            previewLayer.strokeColor = strokeColor.cgColor
            previewLayer.lineWidth = strokeWidth * view.scaleFactor
            if mode == .erase {
                erase(at: location)
            } else {
                updatePreview()
            }
        case .changed:
            guard activePage != nil else { return }
            if let last = points.last, last.distance(to: location) < 1 { return }
            points.append(location)
            if mode == .erase {
                erase(at: location)
            } else {
                updatePreview()
            }
        case .ended:
            finishStroke()
        case .cancelled, .failed:
            cancelStroke()
        default:
            break
        }
    }

    private func updatePreview() {
        guard mode == .draw else { return }
        previewLayer.path = UIBezierPath.smoothPath(through: points).cgPath
    }

    private func finishStroke() {
        defer { cancelStroke() }
        guard mode == .draw, let view = pdfView, let page = activePage, !points.isEmpty else { return }
        let pagePoints = points.map { view.convert($0, to: page) }
        onStroke?(pagePoints, page)
    }

    private func cancelStroke() {
        points.removeAll()
        activePage = nil
        previewLayer.path = nil
    }

    private func erase(at location: CGPoint) {
        guard let view = pdfView, let page = view.page(for: location, nearest: false) else { return }
        onErase?(view.convert(location, to: page), page)
    }

    // MARK: UIGestureRecognizerDelegate

    func gestureRecognizer(
        _ gestureRecognizer: UIGestureRecognizer,
        shouldRecognizeSimultaneouslyWith otherGestureRecognizer: UIGestureRecognizer
    ) -> Bool {
        otherGestureRecognizer is UIPanGestureRecognizer || otherGestureRecognizer is UIPinchGestureRecognizer
    }

    func gestureRecognizer(
        _ gestureRecognizer: UIGestureRecognizer,
        shouldBeRequiredToFailBy otherGestureRecognizer: UIGestureRecognizer
    ) -> Bool {
        !(otherGestureRecognizer is UIPanGestureRecognizer || otherGestureRecognizer is UIPinchGestureRecognizer)
    }
}

/// Begins on the very first touch so strokes start exactly where the finger
/// lands. A second finger cancels the stroke and lets the scroll view take over.
final class StrokeGestureRecognizer: UIGestureRecognizer {
    private var trackedTouch: UITouch?

    override func touchesBegan(_ touches: Set<UITouch>, with event: UIEvent) {
        super.touchesBegan(touches, with: event)
        if trackedTouch == nil, touches.count == 1, let touch = touches.first {
            trackedTouch = touch
            state = .began
        } else {
            state = state == .possible ? .failed : .cancelled
        }
    }

    override func touchesMoved(_ touches: Set<UITouch>, with event: UIEvent) {
        super.touchesMoved(touches, with: event)
        guard let trackedTouch, touches.contains(trackedTouch) else { return }
        if state == .began || state == .changed {
            state = .changed
        }
    }

    override func touchesEnded(_ touches: Set<UITouch>, with event: UIEvent) {
        super.touchesEnded(touches, with: event)
        guard let trackedTouch, touches.contains(trackedTouch) else { return }
        state = state == .possible ? .failed : .ended
    }

    override func touchesCancelled(_ touches: Set<UITouch>, with event: UIEvent) {
        super.touchesCancelled(touches, with: event)
        state = state == .possible ? .failed : .cancelled
    }

    override func reset() {
        super.reset()
        trackedTouch = nil
    }

    override func location(in view: UIView?) -> CGPoint {
        if let trackedTouch {
            return trackedTouch.location(in: view)
        }
        return super.location(in: view)
    }
}
