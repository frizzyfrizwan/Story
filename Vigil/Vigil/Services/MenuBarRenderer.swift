import Foundation
import AppKit

/// Renders the menu bar status image: a monochrome template icon, optionally with a value or a tiny CPU graph.
enum MenuBarRenderer {
    static let height: CGFloat = 18

    static func image(style: MenuBarStyle, cpu: Double, memoryPressure: Double, temperature: Double?, netIn: Double, netOut: Double,
                      battery: BatterySample, recentCPU: [Double], unit: TemperatureUnit) -> NSImage {
        switch style {
        case .icon: return iconOnly()
        case .cpu: return labelled(String(format: "%.0f%%", cpu))
        case .memory: return labelled(String(format: "%.0f%%", memoryPressure), symbol: "memorychip")
        case .temperature: return labelled(temperature.map { Format.temperature($0, unit: unit) } ?? "—", symbol: "thermometer.medium")
        case .network: return networkLabel(netIn: netIn, netOut: netOut)
        case .battery: return labelled(battery.isPresent ? "\(Int(battery.percent))%" : "—", symbol: battery.isCharging ? "battery.100percent.bolt" : "battery.75percent")
        case .graph: return graph(recentCPU)
        }
    }

    static func iconOnly() -> NSImage {
        let image = NSImage(systemSymbolName: "waveform.path.ecg", accessibilityDescription: "Vigil") ?? NSImage()
        image.isTemplate = true
        return image
    }

    private static func labelled(_ text: String, symbol: String = "waveform.path.ecg") -> NSImage {
        let font = NSFont.monospacedDigitSystemFont(ofSize: 11, weight: .medium)
        let attributes: [NSAttributedString.Key: Any] = [.font: font, .foregroundColor: NSColor.black]
        let string = NSAttributedString(string: text, attributes: attributes)
        let textSize = string.size()
        let symbolImage = NSImage(systemSymbolName: symbol, accessibilityDescription: nil)?
            .withSymbolConfiguration(NSImage.SymbolConfiguration(pointSize: 12, weight: .medium))
        let symbolWidth = symbolImage?.size.width ?? 0
        let width = ceil(symbolWidth + 3 + textSize.width)
        let image = NSImage(size: NSSize(width: width, height: height), flipped: false) { rect in
            if let symbolImage {
                let symbolRect = NSRect(x: 0, y: (rect.height - symbolImage.size.height) / 2, width: symbolImage.size.width, height: symbolImage.size.height)
                symbolImage.draw(in: symbolRect)
            }
            string.draw(at: NSPoint(x: symbolWidth + 3, y: (rect.height - textSize.height) / 2))
            return true
        }
        image.isTemplate = true
        return image
    }

    private static func networkLabel(netIn: Double, netOut: Double) -> NSImage {
        let font = NSFont.monospacedDigitSystemFont(ofSize: 8, weight: .medium)
        let attributes: [NSAttributedString.Key: Any] = [.font: font, .foregroundColor: NSColor.black]
        let down = NSAttributedString(string: "↓ " + compactRate(netIn), attributes: attributes)
        let up = NSAttributedString(string: "↑ " + compactRate(netOut), attributes: attributes)
        let width = ceil(max(down.size().width, up.size().width))
        let image = NSImage(size: NSSize(width: width, height: height), flipped: false) { _ in
            up.draw(at: NSPoint(x: 0, y: height / 2))
            down.draw(at: NSPoint(x: 0, y: 0))
            return true
        }
        image.isTemplate = true
        return image
    }

    static func compactRate(_ bytesPerSecond: Double) -> String {
        let value = max(0, bytesPerSecond)
        if value < 1_000 { return "0 K" }
        if value < 1_000_000 { return String(format: "%.0f K", value / 1_000) }
        if value < 1_000_000_000 { return String(format: value < 10_000_000 ? "%.1f M" : "%.0f M", value / 1_000_000) }
        return String(format: "%.1f G", value / 1_000_000_000)
    }

    /// A 28-point-wide bar graph of recent CPU usage.
    static func graph(_ values: [Double], width: CGFloat = 30, bars: Int = 15) -> NSImage {
        let samples = Array(values.suffix(bars))
        let image = NSImage(size: NSSize(width: width, height: height), flipped: false) { rect in
            let path = NSBezierPath(roundedRect: rect.insetBy(dx: 0.5, dy: 1.5), xRadius: 3, yRadius: 3)
            path.lineWidth = 1
            NSColor.black.withAlphaComponent(0.9).setStroke()
            path.stroke()
            guard !samples.isEmpty else { return true }
            let inner = rect.insetBy(dx: 2.5, dy: 3.5)
            let barWidth = inner.width / CGFloat(bars)
            NSColor.black.setFill()
            for (index, value) in samples.enumerated() {
                let offset = bars - samples.count + index
                let barHeight = max(1, inner.height * CGFloat(value / 100))
                let bar = NSRect(x: inner.minX + CGFloat(offset) * barWidth + 0.5, y: inner.minY, width: max(0.5, barWidth - 1), height: barHeight)
                bar.fill()
            }
            return true
        }
        image.isTemplate = true
        return image
    }
}
