import SwiftUI

/// App-wide navigation and modal state.
@MainActor @Observable
final class Router {
    enum Route: Hashable {
        case editor(UUID)
    }

    var path: [Route] = []
    var showPaywall = false
    var paywallFeature: ProFeature?
    var showSettings = false
    var alertMessage: String?
    /// A screen the editor should open on appear (demo/screenshot mode only).
    var pendingDemoScreen: String?

    func openEditor(_ id: UUID) {
        path = [.editor(id)]
    }

    func popToLibrary() {
        path.removeAll()
    }

    /// Returns true when the feature can be used right now. Otherwise the
    /// paywall is presented and false is returned.
    @discardableResult
    func requirePro(_ feature: ProFeature, store: StoreService) -> Bool {
        if store.isPro { return true }
        paywallFeature = feature
        showPaywall = true
        return false
    }

    func open(externalURL url: URL, library: LibraryStore) async {
        do {
            let record = try await library.importFile(at: url)
            openEditor(record.id)
        } catch {
            alertMessage = error.localizedDescription
        }
    }
}
