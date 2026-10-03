import SwiftUI

struct RootView: View {
    @Environment(Router.self) private var router
    @Environment(AppSettings.self) private var settings
    @Environment(StoreService.self) private var store
    @Environment(LibraryStore.self) private var library

    var body: some View {
        @Bindable var router = router
        @Bindable var settings = settings

        NavigationStack(path: $router.path) {
            LibraryView()
                .navigationDestination(for: Router.Route.self) { route in
                    switch route {
                    case .editor(let id):
                        EditorScreen(documentID: id)
                    }
                }
        }
        .tint(.accentColor)
        .task {
            await DemoSeeder.seedIfRequested(library: library, settings: settings, router: router)
        }
        .sheet(isPresented: $router.showPaywall) {
            PaywallView(feature: router.paywallFeature)
        }
        .sheet(isPresented: $router.showSettings) {
            SettingsView()
        }
        .sheet(isPresented: Binding(
            get: { !settings.hasSeenWelcome && !DemoSeeder.isRequested },
            set: { if !$0 { settings.hasSeenWelcome = true } }
        )) {
            WelcomeView()
                .interactiveDismissDisabled()
        }
        .alert("Something went wrong", isPresented: Binding(
            get: { router.alertMessage != nil },
            set: { if !$0 { router.alertMessage = nil } }
        )) {
            Button("OK", role: .cancel) {}
        } message: {
            Text(router.alertMessage ?? "")
        }
    }
}
