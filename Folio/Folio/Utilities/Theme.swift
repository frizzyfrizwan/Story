import SwiftUI

/// Folio's visual language: warm paper, one accent, generous radii.
enum FolioTheme {
    static let cornerRadius: CGFloat = 20
    static let cardRadius: CGFloat = 16
    static let dockRadius: CGFloat = 28

    static var canvas: Color { Color(uiColor: .systemGroupedBackground) }
    static var paper: Color { Color(uiColor: .secondarySystemGroupedBackground) }
    static var surface: Color { Color(uiColor: .systemBackground) }
    static var subtle: Color { Color(uiColor: .tertiarySystemFill) }
    static var ink: Color { Color.primary }
    static var pro: Color { Color(red: 0.98, green: 0.62, blue: 0.14) }
}

/// A floating, blurred surface used for the dock, toolbars and overlays.
struct FloatingSurface: ViewModifier {
    var radius: CGFloat = FolioTheme.dockRadius

    func body(content: Content) -> some View {
        content
            .background(.regularMaterial, in: RoundedRectangle(cornerRadius: radius, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: radius, style: .continuous)
                    .strokeBorder(Color.primary.opacity(0.06), lineWidth: 1)
            )
            .shadow(color: .black.opacity(0.12), radius: 18, y: 8)
    }
}

extension View {
    func floatingSurface(radius: CGFloat = FolioTheme.dockRadius) -> some View {
        modifier(FloatingSurface(radius: radius))
    }
}

/// A capsule "Pro" badge.
struct ProBadge: View {
    var body: some View {
        Text("PRO")
            .font(.caption2.weight(.heavy))
            .foregroundStyle(.white)
            .padding(.horizontal, 6)
            .padding(.vertical, 2)
            .background(FolioTheme.pro, in: Capsule())
            .accessibilityLabel("Pro feature")
    }
}

/// Toast overlay shown at the top of the editor and library.
struct ToastView: View {
    let toast: Toast

    var body: some View {
        HStack(spacing: 10) {
            Image(systemName: symbol)
                .foregroundStyle(tint)
            Text(toast.message)
                .font(.subheadline.weight(.medium))
                .lineLimit(2)
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 12)
        .floatingSurface(radius: 16)
        .padding(.horizontal, 20)
        .transition(.move(edge: .top).combined(with: .opacity))
    }

    private var symbol: String {
        switch toast.style {
        case .info: return "info.circle.fill"
        case .success: return "checkmark.circle.fill"
        case .error: return "exclamationmark.triangle.fill"
        }
    }

    private var tint: Color {
        switch toast.style {
        case .info: return .accentColor
        case .success: return .green
        case .error: return .orange
        }
    }
}

struct ToastModifier: ViewModifier {
    @Binding var toast: Toast?

    func body(content: Content) -> some View {
        content.overlay(alignment: .top) {
            if let toast {
                ToastView(toast: toast)
                    .padding(.top, 8)
                    .task(id: toast.id) {
                        try? await Task.sleep(for: .seconds(2.6))
                        if self.toast?.id == toast.id {
                            withAnimation(.easeInOut(duration: 0.25)) { self.toast = nil }
                        }
                    }
            }
        }
        .animation(.spring(duration: 0.35), value: toast)
    }
}

extension View {
    func toast(_ toast: Binding<Toast?>) -> some View {
        modifier(ToastModifier(toast: toast))
    }
}

/// Full-screen progress overlay for long operations (OCR, redaction).
struct BusyOverlay: View {
    let message: String
    let progress: Double?

    var body: some View {
        ZStack {
            Color.black.opacity(0.25).ignoresSafeArea()
            VStack(spacing: 14) {
                if let progress {
                    ProgressView(value: progress)
                        .progressViewStyle(.linear)
                        .frame(width: 180)
                } else {
                    ProgressView()
                        .controlSize(.large)
                }
                Text(message)
                    .font(.subheadline.weight(.medium))
                    .multilineTextAlignment(.center)
            }
            .padding(24)
            .floatingSurface(radius: 20)
        }
        .transition(.opacity)
    }
}
