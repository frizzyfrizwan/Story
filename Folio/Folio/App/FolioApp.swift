import SwiftUI

@main
struct FolioApp: App {
    @State private var library = LibraryStore()
    @State private var store = StoreService()
    @State private var signatures = SignatureStore()
    @State private var router = Router()
    @State private var settings = AppSettings()

    var body: some Scene {
        WindowGroup {
            RootView()
                .environment(library)
                .environment(store)
                .environment(signatures)
                .environment(router)
                .environment(settings)
                .task { await store.start() }
                .onOpenURL { url in
                    Task { await router.open(externalURL: url, library: library) }
                }
        }
    }
}
