import SwiftUI

@main
struct DossierApp: App {
    @State private var saved = SavedReportsStore()
    @State private var bridge = WebBridge()

    var body: some Scene {
        WindowGroup {
            RootView()
                .environment(saved)
                .environment(bridge)
        }
    }
}
