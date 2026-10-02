import SwiftUI

struct DocumentCard: View {
    let record: DocumentRecord

    @Environment(LibraryStore.self) private var library
    @State private var thumbnail: UIImage?

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            ZStack {
                RoundedRectangle(cornerRadius: 10, style: .continuous)
                    .fill(Color.white)
                if let thumbnail {
                    Image(uiImage: thumbnail)
                        .resizable()
                        .scaledToFit()
                        .padding(4)
                } else {
                    Image(systemName: "doc.text")
                        .font(.largeTitle)
                        .foregroundStyle(.tertiary)
                }
            }
            .frame(height: 180)
            .frame(maxWidth: .infinity)
            .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: 10, style: .continuous)
                    .strokeBorder(Color.primary.opacity(0.08))
            )
            .overlay(alignment: .topTrailing) {
                if record.isScanned {
                    Label("Scan", systemImage: "doc.viewfinder")
                        .font(.caption2.weight(.semibold))
                        .padding(.horizontal, 7)
                        .padding(.vertical, 4)
                        .background(.thinMaterial, in: Capsule())
                        .padding(8)
                }
            }

            VStack(alignment: .leading, spacing: 2) {
                Text(record.name)
                    .font(.subheadline.weight(.semibold))
                    .lineLimit(2)
                    .foregroundStyle(.primary)
                Text(record.summaryLine)
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .lineLimit(1)
            }
        }
        .padding(10)
        .background(FolioTheme.paper, in: RoundedRectangle(cornerRadius: FolioTheme.cardRadius, style: .continuous))
        .contentShape(RoundedRectangle(cornerRadius: FolioTheme.cardRadius, style: .continuous))
        .task(id: record.modifiedAt) {
            thumbnail = await library.thumbnail(for: record.id)
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("\(record.name), \(record.summaryLine)")
        .accessibilityAddTraits(.isButton)
    }
}
