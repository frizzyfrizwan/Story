import SwiftUI

/// The floating dock: four modes plus the pages board.
struct ToolDock: View {
    @Bindable var model: EditorViewModel

    var body: some View {
        HStack(spacing: 2) {
            ForEach(EditorMode.allCases) { mode in
                Button {
                    select(mode)
                } label: {
                    dockLabel(mode.title, symbol: mode.symbol, selected: model.mode == mode)
                }
                .buttonStyle(.plain)
                .accessibilityLabel(mode.title)
                .accessibilityAddTraits(model.mode == mode ? .isSelected : [])
            }

            Divider()
                .frame(height: 28)
                .padding(.horizontal, 2)

            Button {
                Haptics.tap()
                model.activeSheet = .pages
            } label: {
                dockLabel("Pages", symbol: "square.grid.2x2", selected: false)
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Pages")
        }
        .padding(6)
        .floatingSurface()
        .padding(.horizontal, 16)
    }

    private func select(_ mode: EditorMode) {
        switch mode {
        case .sign:
            model.activeSheet = .signaturePicker
        case .read, .markup, .text:
            withAnimation(.snappy(duration: 0.25)) {
                model.mode = mode
            }
        }
    }

    private func dockLabel(_ title: String, symbol: String, selected: Bool) -> some View {
        VStack(spacing: 3) {
            Image(systemName: symbol)
                .font(.system(size: 18, weight: .medium))
                .symbolVariant(selected ? .fill : .none)
            Text(title)
                .font(.caption2.weight(.medium))
        }
        .frame(width: 56, height: 50)
        .foregroundStyle(selected ? Color.accentColor : Color.primary)
        .background(
            selected ? Color.accentColor.opacity(0.14) : Color.clear,
            in: RoundedRectangle(cornerRadius: 18, style: .continuous)
        )
        .contentShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
    }
}

/// Tools for Mark mode: pen, highlighter, eraser, colors and widths.
struct MarkupToolbar: View {
    @Bindable var model: EditorViewModel

    private var colors: [InkColor] {
        model.markupTool == .highlighter ? InkColor.highlighters : InkColor.pens
    }

    private var widths: [CGFloat] {
        model.markupTool == .highlighter ? [10, 14, 20] : [1.5, 2.5, 4.5]
    }

    var body: some View {
        HStack(spacing: 10) {
            HStack(spacing: 2) {
                ForEach(MarkupTool.allCases) { tool in
                    Button {
                        Haptics.selection()
                        model.markupTool = tool
                    } label: {
                        Image(systemName: tool.symbol)
                            .font(.system(size: 16, weight: .semibold))
                            .frame(width: 40, height: 36)
                            .foregroundStyle(model.markupTool == tool ? Color.white : Color.primary)
                            .background(
                                model.markupTool == tool ? Color.accentColor : Color.clear,
                                in: RoundedRectangle(cornerRadius: 12, style: .continuous)
                            )
                    }
                    .buttonStyle(.plain)
                    .accessibilityLabel(tool.title)
                }
            }

            if model.markupTool != .eraser {
                Divider().frame(height: 24)

                HStack(spacing: 8) {
                    ForEach(colors) { color in
                        colorDot(color)
                    }
                }

                Divider().frame(height: 24)

                HStack(spacing: 6) {
                    ForEach(widths, id: \.self) { width in
                        widthButton(width)
                    }
                }
            }
        }
        .padding(.horizontal, 10)
        .padding(.vertical, 6)
        .floatingSurface(radius: 22)
        .padding(.horizontal, 16)
    }

    private var selectedColor: InkColor {
        model.markupTool == .highlighter ? model.highlighterColor : model.penColor
    }

    private var selectedWidth: CGFloat {
        model.markupTool == .highlighter ? model.highlighterWidth : model.penWidth
    }

    private func colorDot(_ color: InkColor) -> some View {
        let isSelected = selectedColor == color
        return Button {
            Haptics.selection()
            if model.markupTool == .highlighter {
                model.highlighterColor = color
            } else {
                model.penColor = color
            }
        } label: {
            Circle()
                .fill(Color(uiColor: color.uiColor.withAlphaComponent(1)))
                .frame(width: 22, height: 22)
                .overlay(
                    Circle()
                        .strokeBorder(Color.primary.opacity(isSelected ? 0.9 : 0.12), lineWidth: isSelected ? 2.5 : 1)
                )
                .scaleEffect(isSelected ? 1.12 : 1)
        }
        .buttonStyle(.plain)
        .accessibilityLabel(color.name)
        .accessibilityAddTraits(isSelected ? .isSelected : [])
    }

    private func widthButton(_ width: CGFloat) -> some View {
        let isSelected = abs(selectedWidth - width) < 0.01
        let dot = min(18, max(5, width * (model.markupTool == .highlighter ? 0.8 : 2.4)))
        return Button {
            Haptics.selection()
            if model.markupTool == .highlighter {
                model.highlighterWidth = width
            } else {
                model.penWidth = width
            }
        } label: {
            Circle()
                .fill(Color.primary.opacity(isSelected ? 1 : 0.4))
                .frame(width: dot, height: dot)
                .frame(width: 28, height: 28)
                .background(
                    isSelected ? Color.primary.opacity(0.1) : Color.clear,
                    in: Circle()
                )
        }
        .buttonStyle(.plain)
        .accessibilityLabel("Width \(Int(width))")
        .accessibilityAddTraits(isSelected ? .isSelected : [])
    }
}
