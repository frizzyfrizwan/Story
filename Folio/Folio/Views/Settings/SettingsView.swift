import SwiftUI

struct SettingsView: View {
    @Environment(AppSettings.self) private var settings
    @Environment(StoreService.self) private var store
    @Environment(\.dismiss) private var dismiss
    @State private var restoreMessage: String?
    @State private var showPaywall = false

    private var version: String {
        let short = Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? "1.0"
        let build = Bundle.main.infoDictionary?["CFBundleVersion"] as? String ?? "1"
        return "\(short) (\(build))"
    }

    var body: some View {
        @Bindable var settings = settings
        @Bindable var store = store

        NavigationStack {
            List {
                Section {
                    HStack(spacing: 14) {
                        Image(systemName: store.isPro ? "checkmark.seal.fill" : "sparkles.rectangle.stack.fill")
                            .font(.title2)
                            .foregroundStyle(FolioTheme.pro)
                        VStack(alignment: .leading, spacing: 2) {
                            Text(store.isPro ? "Folio Pro is active" : "Folio Pro")
                                .font(.body.weight(.semibold))
                            Text(store.isPro
                                 ? "OCR, Smart Redact and the signature vault are unlocked."
                                 : "Scan to searchable PDF, Smart Redact and more.")
                                .font(.caption)
                                .foregroundStyle(.secondary)
                        }
                    }
                    .padding(.vertical, 4)
                    if !store.isPro {
                        Button("See what's in Pro") {
                            showPaywall = true
                        }
                    }
                    Button("Restore purchases") {
                        Task {
                            await store.restore()
                            restoreMessage = store.isPro ? "Folio Pro restored." : "No previous purchase was found."
                        }
                    }
                    if store.isPro, let url = URL(string: "https://apps.apple.com/account/subscriptions") {
                        Link("Manage subscription", destination: url)
                    }
                }

                Section {
                    Toggle(isOn: $settings.drawWithFinger) {
                        VStack(alignment: .leading, spacing: 2) {
                            Text("Draw with finger")
                            Text(settings.drawWithFinger
                                 ? "One finger draws, two fingers scroll."
                                 : "Only Apple Pencil draws. Fingers scroll.")
                                .font(.caption)
                                .foregroundStyle(.secondary)
                        }
                    }
                } header: {
                    Text("Marking up")
                }

                Section {
                    Picker("Page size", selection: $settings.scanPageSize) {
                        ForEach(ScanPageSize.allCases) { size in
                            Text(size.title).tag(size)
                        }
                    }
                    Toggle(isOn: $settings.recognizeTextOnScan) {
                        HStack(spacing: 8) {
                            VStack(alignment: .leading, spacing: 2) {
                                Text("Recognize text by default")
                                Text("Pre-selects OCR when reviewing a scan.")
                                    .font(.caption)
                                    .foregroundStyle(.secondary)
                            }
                            if !store.isPro { ProBadge() }
                        }
                    }
                    .disabled(!store.isPro)
                } header: {
                    Text("Scanning")
                } footer: {
                    Text(settings.scanPageSize.subtitle)
                }

                Section {
                    Label {
                        VStack(alignment: .leading, spacing: 2) {
                            Text("Everything stays on this device")
                            Text("Folio has no servers. Documents, signatures and text recognition never leave your iPhone or iPad.")
                                .font(.caption)
                                .foregroundStyle(.secondary)
                        }
                    } icon: {
                        Image(systemName: "lock.shield")
                            .foregroundStyle(.green)
                    }
                    .padding(.vertical, 2)
                } header: {
                    Text("Privacy")
                }

                Section {
                    LabeledContent("Version", value: version)
                } header: {
                    Text("About")
                }

                #if DEBUG
                Section {
                    Toggle("Unlock Pro (debug only)", isOn: $store.debugUnlock)
                } header: {
                    Text("Debug")
                }
                #endif
            }
            .navigationTitle("Settings")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Done") { dismiss() }
                }
            }
            .sheet(isPresented: $showPaywall) {
                PaywallView(feature: nil)
            }
            .alert("Restore purchases", isPresented: Binding(
                get: { restoreMessage != nil },
                set: { if !$0 { restoreMessage = nil } }
            )) {
                Button("OK", role: .cancel) {}
            } message: {
                Text(restoreMessage ?? "")
            }
        }
    }
}
