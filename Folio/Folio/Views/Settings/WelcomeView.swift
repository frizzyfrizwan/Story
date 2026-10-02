import SwiftUI

/// A one-time, three-line introduction. No carousel, no sign-up.
struct WelcomeView: View {
    @Environment(AppSettings.self) private var settings

    var body: some View {
        VStack(spacing: 32) {
            VStack(spacing: 10) {
                Image(systemName: "doc.richtext.fill")
                    .font(.system(size: 56))
                    .foregroundStyle(Color.accentColor)
                Text("Welcome to Folio")
                    .font(.largeTitle.weight(.bold))
                Text("The PDF editor that gets out of your way.")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
            }
            .padding(.top, 40)

            VStack(alignment: .leading, spacing: 22) {
                row("textformat", title: "Tap any line to retype it", detail: "Text mode turns every line on the page into something you can edit.")
                row("signature", title: "Sign anywhere", detail: "Draw once, then drag your signature onto any page. It's burned in, so it looks right everywhere.")
                row("eye.slash", title: "Redact for real", detail: "Smart Redact finds emails, numbers and names, then removes them so they can't be recovered.")
                row("arrow.uturn.backward.circle", title: "Nothing is lost", detail: "Folio keeps your original file and every edit can be undone.")
            }
            .padding(.horizontal, 8)

            Spacer()

            Button {
                Haptics.success()
                settings.hasSeenWelcome = true
            } label: {
                Text("Get started")
                    .fontWeight(.semibold)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 8)
            }
            .buttonStyle(.borderedProminent)
            .controlSize(.large)
        }
        .padding(24)
        .background(FolioTheme.canvas)
    }

    private func row(_ symbol: String, title: String, detail: String) -> some View {
        HStack(alignment: .top, spacing: 16) {
            Image(systemName: symbol)
                .font(.title2)
                .frame(width: 44, height: 44)
                .background(Color.accentColor.opacity(0.12), in: RoundedRectangle(cornerRadius: 12, style: .continuous))
                .foregroundStyle(Color.accentColor)
            VStack(alignment: .leading, spacing: 3) {
                Text(title)
                    .font(.body.weight(.semibold))
                Text(detail)
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
            }
        }
    }
}
