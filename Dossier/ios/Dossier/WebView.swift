import SwiftUI
import WebKit
import Combine

/// Messages crossing between the bundled web app and SwiftUI.
enum BridgeEvent {
    case save(SavedReport)
    case share(String)
}

/// Owns the one WKWebView for the app and the JS bridge on top of it.
@Observable
final class WebBridge: NSObject, WKScriptMessageHandler, WKNavigationDelegate {
    let events = PassthroughSubject<BridgeEvent, Never>()
    private(set) var webView: WKWebView?
    private var pendingScripts: [String] = []
    private var loaded = false

    func makeWebView() -> WKWebView {
        if let webView { return webView }
        let config = WKWebViewConfiguration()
        config.userContentController.add(self, name: "dossier")
        config.defaultWebpagePreferences.allowsContentJavaScript = true
        let wv = WKWebView(frame: .zero, configuration: config)
        wv.navigationDelegate = self
        wv.allowsBackForwardNavigationGestures = false
        wv.scrollView.contentInsetAdjustmentBehavior = .automatic
        wv.isOpaque = false
        wv.backgroundColor = UIColor(named: "LaunchBackground")
        if let url = Bundle.main.url(forResource: "dossier", withExtension: "html") {
            wv.loadFileURL(url, allowingReadAccessTo: url.deletingLastPathComponent())
        } else {
            wv.loadHTMLString("<p style='font-family:-apple-system;padding:2em'>The report engine is missing from this build. Run <code>node bin/build-site.js</code> and rebuild.</p>", baseURL: nil)
        }
        webView = wv
        return wv
    }

    // MARK: Native -> JS

    func navigate(_ route: String) { run("window.dossierNative && window.dossierNative.navigate(\(json(route)))") }
    func requestSave() { run("window.dossierNative && window.dossierNative.requestSave()") }
    func requestShare() { run("window.dossierNative && window.dossierNative.requestShare()") }
    func load(facts: String) { run("window.dossierNative && window.dossierNative.loadFacts(\(facts))") }

    private func run(_ script: String) {
        guard loaded, let webView else { pendingScripts.append(script); return }
        webView.evaluateJavaScript(script) { _, _ in }
    }

    private func json(_ s: String) -> String {
        let data = try! JSONSerialization.data(withJSONObject: [s])
        let arr = String(data: data, encoding: .utf8)!
        return String(arr.dropFirst().dropLast())
    }

    // MARK: JS -> native

    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        guard let body = message.body as? [String: Any], let type = body["type"] as? String else { return }
        switch type {
        case "save":
            guard let facts = body["facts"], let data = try? JSONSerialization.data(withJSONObject: facts), let factsJSON = String(data: data, encoding: .utf8) else { return }
            let report = SavedReport(
                id: body["id"] as? String ?? UUID().uuidString,
                title: body["title"] as? String ?? "Report",
                price: body["price"] as? String,
                stance: body["stance"] as? String ?? "",
                summary: body["summary"] as? String ?? "",
                factsJSON: factsJSON,
                savedAt: Date()
            )
            events.send(.save(report))
        case "share":
            events.send(.share(body["text"] as? String ?? ""))
        default:
            break
        }
    }

    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        loaded = true
        let scripts = pendingScripts
        pendingScripts = []
        for s in scripts { run(s) }
    }

    // Open external links in Safari, keep the app inside the bundle.
    func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction, decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        if let url = navigationAction.request.url, ["http", "https"].contains(url.scheme ?? "") {
            UIApplication.shared.open(url)
            decisionHandler(.cancel)
            return
        }
        decisionHandler(.allow)
    }
}

struct WebView: UIViewRepresentable {
    let bridge: WebBridge
    func makeUIView(context: Context) -> WKWebView { bridge.makeWebView() }
    func updateUIView(_ uiView: WKWebView, context: Context) {}
}

struct ShareSheet: UIViewControllerRepresentable {
    let items: [Any]
    func makeUIViewController(context: Context) -> UIActivityViewController {
        UIActivityViewController(activityItems: items, applicationActivities: nil)
    }
    func updateUIViewController(_ uiViewController: UIActivityViewController, context: Context) {}
}
