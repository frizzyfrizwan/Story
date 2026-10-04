import PDFKit
import SwiftUI

/// Review scanned pages, name the document and choose whether to run OCR.
struct ScanReviewView: View {
    let images: [UIImage]
    let suggestedName: String
    let onCreate: (PDFDocument, String) -> Void

    @Environment(\.dismiss) private var dismiss
    @Environment(StoreService.self) private var store
    @Environment(AppSettings.self) private var settings

    @State private var name: String
    @State private var recognize = false
    @State private var pageSize: ScanPageSize = .auto
    @State private var isBuilding = false
    @State private var progress = 0.0
    @State private var errorMessage: String?
    @State private var showPaywall = false

    init(images: [UIImage], suggestedName: String, onCreate: @escaping (PDFDocument, String) -> Void) {
        self.images = images
        self.suggestedName = suggestedName
        self.onCreate = onCreate
        _name = State(initialValue: suggestedName)
    }

    private var recognizeBinding: Binding<Bool> {
        Binding(
            get: { recognize },
            set: { newValue in
                if newValue, !store.isPro {
                    showPaywall = true
                } else {
                    recognize = newValue
                }
            }
        )
    }

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    ScrollView(.horizontal, showsIndicators: false) {
                        HStack(spacing: 12) {
                            ForEach(images.indices, id: \.self) { index in
                                Image(uiImage: images[index])
                                    .resizable()
                                    .scaledToFit()
                                    .frame(height: 150)
                                    .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))
                                    .overlay(
                                        RoundedRectangle(cornerRadius: 8, style: .continuous)
                                            .strokeBorder(Color.primary.opacity(0.1))
                                    )
                                    .overlay(alignment: .bottomTrailing) {
                                        Text("\(index + 1)")
                                            .font(.caption2.weight(.semibold))
                                            .padding(5)
                                            .background(.thinMaterial, in: Capsule())
                                            .padding(5)
                                    }
                            }
                        }
                        .padding(.vertical, 4)
                    }
                    .listRowInsets(EdgeInsets(top: 8, leading: 16, bottom: 8, trailing: 16))
                }

                Section("Name") {
                    TextField("Document name", text: $name)
                }

                Section {
                    Toggle(isOn: recognizeBinding) {
                        HStack(spacing: 8) {
                            VStack(alignment: .leading, spacing: 2) {
                                Text("Recognize text")
                                Text("Makes the PDF searchable and its text selectable.")
                                    .font(.caption)
                                    .foregroundStyle(.secondary)
                            }
                            if !store.isPro {
                                ProBadge()
                            }
                        }
                    }
                    Picker("Page size", selection: $pageSize) {
                        ForEach(ScanPageSize.allCases) { size in
                            Text(size.title).tag(size)
                        }
                    }
                } footer: {
                    Text(pageSize.subtitle)
                }
            }
            .navigationTitle(images.count == 1 ? "1 page" : "\(images.count) pages")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                        .disabled(isBuilding)
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Create") { create() }
                        .fontWeight(.semibold)
                        .disabled(isBuilding || name.trimmed.isEmpty)
                }
            }
            .overlay {
                if isBuilding {
                    BusyOverlay(message: recognize ? "Recognizing text…" : "Creating PDF…", progress: progress)
                }
            }
            .interactiveDismissDisabled(isBuilding)
            .sheet(isPresented: $showPaywall) {
                PaywallView(feature: .ocrScan)
            }
            .alert("Couldn't create PDF", isPresented: Binding(
                get: { errorMessage != nil },
                set: { if !$0 { errorMessage = nil } }
            )) {
                Button("OK", role: .cancel) {}
            } message: {
                Text(errorMessage ?? "")
            }
            .onAppear {
                recognize = store.isPro && settings.recognizeTextOnScan
                pageSize = settings.scanPageSize
            }
            .onChange(of: store.isPro) { _, isPro in
                if isPro, settings.recognizeTextOnScan { recognize = true }
            }
        }
    }

    private func create() {
        isBuilding = true
        progress = 0
        Task {
            do {
                let document = try await ScanPipeline.build(
                    images: images,
                    recognizeText: recognize && store.isPro,
                    pageSize: pageSize
                ) { value in
                    progress = value
                }
                isBuilding = false
                onCreate(document, name.trimmed)
                dismiss()
            } catch {
                isBuilding = false
                errorMessage = error.localizedDescription
            }
        }
    }
}
