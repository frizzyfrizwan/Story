import SwiftUI

/// First-run sheet: what Vigil does, which permissions are optional, and launch-at-login.
struct OnboardingView: View {
    @Environment(AppState.self) private var state
    @Environment(AppSettings.self) private var settings
    @Environment(\.dismiss) private var dismiss
    @State private var launchAtLogin = true
    @State private var page = 0

    var body: some View {
        VStack(spacing: 20) {
            TabView(selection: $page) {
                welcome.tag(0)
                permissions.tag(1)
                finish.tag(2)
            }
            .tabViewStyle(.automatic)
            .frame(height: 360)
            HStack {
                if page > 0 { Button("Back") { page -= 1 } }
                Spacer()
                if page < 2 {
                    Button("Continue") { page += 1 }.buttonStyle(.borderedProminent).keyboardShortcut(.defaultAction)
                } else {
                    Button("Start using Vigil") { complete() }.buttonStyle(.borderedProminent).keyboardShortcut(.defaultAction)
                }
            }
        }
        .padding(28)
        .frame(width: 620)
        .accessibilityIdentifier("onboarding")
    }

    private var welcome: some View {
        VStack(alignment: .leading, spacing: 14) {
            Image(systemName: "waveform.path.ecg.rectangle").font(.system(size: 44)).foregroundStyle(Color.accentColor)
            Text("Welcome to Vigil").font(.largeTitle.weight(.bold))
            Text("Your Mac, explained. Vigil lives in the menu bar and watches CPU, memory, storage, network, battery and temperatures, keeps a history of what used them, and tells you in plain English what to do about it.")
                .font(.body).foregroundStyle(.secondary).fixedSize(horizontal: false, vertical: true)
            VStack(alignment: .leading, spacing: 8) {
                bullet("heart.text.square", "A health score with concrete fixes that make your Mac last longer")
                bullet("clock.arrow.circlepath", "History that answers \"what was using my Mac an hour ago?\"")
                bullet("sparkles", "Clean-up that shows exactly what it will remove, and uses the Trash for your files")
                bullet("slider.horizontal.3", "Hidden macOS settings and a toolbox of one-click fixes")
            }
            Spacer()
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private var permissions: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Optional permissions").font(.title.weight(.semibold))
            Text("Everything works without them. Each one unlocks a little more; Vigil asks only when you use the feature.").font(.callout).foregroundStyle(.secondary)
            ForEach(Permissions.Kind.allCases) { kind in
                HStack(alignment: .top, spacing: 10) {
                    Image(systemName: kind.symbol).frame(width: 22).foregroundStyle(Color.accentColor)
                    VStack(alignment: .leading, spacing: 1) {
                        Text(kind.title).font(.callout.weight(.semibold))
                        Text(kind.reason).font(.caption).foregroundStyle(.secondary).fixedSize(horizontal: false, vertical: true)
                    }
                }
            }
            Spacer()
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private var finish: some View {
        VStack(alignment: .leading, spacing: 14) {
            Text("Ready").font(.title.weight(.semibold))
            Toggle("Open Vigil at login so history is always complete", isOn: $launchAtLogin)
            Toggle("Send me alerts (disk almost full, overheating, runaway processes)", isOn: Binding(get: { settings.alertsEnabled }, set: { settings.alertsEnabled = $0 }))
            Text("Your 14-day Pro trial starts now. Monitoring, the health score and 24 hours of history stay free forever.").font(.callout).foregroundStyle(.secondary)
            Text("Vigil never sends anything off your Mac.").font(.caption).foregroundStyle(.tertiary)
            Spacer()
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private func bullet(_ symbol: String, _ text: String) -> some View {
        HStack(alignment: .top, spacing: 8) {
            Image(systemName: symbol).foregroundStyle(Color.accentColor).frame(width: 20)
            Text(text).font(.callout)
        }
    }

    private func complete() {
        settings.launchAtLogin = launchAtLogin
        settings.hasCompletedOnboarding = true
        if settings.alertsEnabled { Task { _ = await state.notifications.requestAuthorization() } }
        state.showOnboarding = false
        dismiss()
    }
}
