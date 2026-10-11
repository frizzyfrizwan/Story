import Foundation
import AppKit
import SwiftUI
import ApplicationServices

/// A borderless window that can still become key, so it receives (and swallows) key events.
final class OverlayWindow: NSWindow {
    override var canBecomeKey: Bool { true }
    override var canBecomeMain: Bool { true }
}

/// Full-screen "cleaning" overlays. Keyboard mode swallows key presses; screen mode blacks out the display and ignores input.
@MainActor
final class CleaningModeController: ObservableObject {
    static let shared = CleaningModeController()

    enum Mode { case keyboard, screen }

    @Published private(set) var activeMode: Mode?
    @Published private(set) var secondsLeft = 0
    @Published private(set) var usesGlobalTap = false

    private var windows: [NSWindow] = []
    private var eventTap: CFMachPort?
    private var runLoopSource: CFRunLoopSource?
    private var localMonitor: Any?
    private var timer: Timer?

    func start(_ mode: Mode, seconds: Int = 45) {
        stop()
        activeMode = mode
        secondsLeft = seconds
        for screen in NSScreen.screens {
            let window = OverlayWindow(contentRect: screen.frame, styleMask: [.borderless], backing: .buffered, defer: false, screen: screen)
            window.level = .screenSaver
            window.isOpaque = true
            window.backgroundColor = mode == .screen ? .black : NSColor(calibratedWhite: 0.07, alpha: 1)
            window.collectionBehavior = [.canJoinAllSpaces, .fullScreenAuxiliary, .stationary]
            window.ignoresMouseEvents = false
            window.isReleasedWhenClosed = false
            window.contentView = NSHostingView(rootView: CleaningOverlayView(controller: self, mode: mode))
            window.makeKeyAndOrderFront(nil)
            windows.append(window)
        }
        NSApp.activate(ignoringOtherApps: true)
        if mode == .keyboard { installKeyBlocking() }
        if mode == .screen { NSCursor.hide() }
        timer = Timer.scheduledTimer(withTimeInterval: 1, repeats: true) { [weak self] _ in
            guard let self else { return }
            Task { @MainActor in
                self.secondsLeft -= 1
                if self.secondsLeft <= 0 { self.stop() }
            }
        }
    }

    func extend(by seconds: Int = 30) { secondsLeft += seconds }

    func stop() {
        timer?.invalidate()
        timer = nil
        removeKeyBlocking()
        NSCursor.unhide()
        windows.forEach { $0.orderOut(nil) }
        windows.removeAll()
        activeMode = nil
    }

    // MARK: Key blocking

    private func installKeyBlocking() {
        // Local monitor: blocks keys while a Vigil window is key (always available).
        localMonitor = NSEvent.addLocalMonitorForEvents(matching: [.keyDown, .keyUp, .flagsChanged]) { event in
            // Allow Escape to end the session as a safety hatch.
            if event.type == .keyDown && event.keyCode == 53 { Task { @MainActor in CleaningModeController.shared.stop() } }
            return nil
        }
        // Global event tap: blocks ⌘-Tab, ⌘-Q, media keys etc. Requires Accessibility permission.
        guard AXIsProcessTrusted() else { usesGlobalTap = false; return }
        let mask: CGEventMask = (1 << CGEventType.keyDown.rawValue) | (1 << CGEventType.keyUp.rawValue) | (1 << CGEventType.flagsChanged.rawValue)
        let callback: CGEventTapCallBack = { _, type, event, _ in
            if type == .keyDown, event.getIntegerValueField(.keyboardEventKeycode) == 53 {
                Task { @MainActor in CleaningModeController.shared.stop() }
            }
            return nil
        }
        guard let tap = CGEvent.tapCreate(tap: .cgSessionEventTap, place: .headInsertEventTap, options: .defaultTap,
                                          eventsOfInterest: mask, callback: callback, userInfo: nil) else {
            usesGlobalTap = false
            return
        }
        eventTap = tap
        runLoopSource = CFMachPortCreateRunLoopSource(kCFAllocatorDefault, tap, 0)
        CFRunLoopAddSource(CFRunLoopGetMain(), runLoopSource, .commonModes)
        CGEvent.tapEnable(tap: tap, enable: true)
        usesGlobalTap = true
    }

    private func removeKeyBlocking() {
        if let localMonitor { NSEvent.removeMonitor(localMonitor) }
        localMonitor = nil
        if let eventTap {
            CGEvent.tapEnable(tap: eventTap, enable: false)
            if let runLoopSource { CFRunLoopRemoveSource(CFRunLoopGetMain(), runLoopSource, .commonModes) }
        }
        eventTap = nil
        runLoopSource = nil
        usesGlobalTap = false
    }
}

struct CleaningOverlayView: View {
    @ObservedObject var controller: CleaningModeController
    let mode: CleaningModeController.Mode

    var body: some View {
        ZStack {
            (mode == .screen ? Color.black : Color(white: 0.07)).ignoresSafeArea()
            if mode == .keyboard {
                VStack(spacing: 18) {
                    Image(systemName: "keyboard")
                        .font(.system(size: 72, weight: .thin))
                        .foregroundStyle(.white.opacity(0.9))
                    Text("Keyboard locked for cleaning")
                        .font(.system(size: 30, weight: .semibold))
                        .foregroundStyle(.white)
                    Text(controller.usesGlobalTap
                         ? "Every key is blocked, including ⌘-Tab and ⌘-Q. Wipe away."
                         : "Keys are blocked while this screen is in front. Grant Accessibility access in Settings to also block ⌘-Tab and ⌘-Q.")
                        .font(.title3)
                        .foregroundStyle(.white.opacity(0.7))
                        .multilineTextAlignment(.center)
                        .frame(maxWidth: 560)
                    Text("\(controller.secondsLeft)")
                        .font(.system(size: 64, weight: .light, design: .rounded).monospacedDigit())
                        .foregroundStyle(.white)
                        .padding(.top, 8)
                    HStack(spacing: 14) {
                        Button("Add 30 seconds") { controller.extend() }
                        Button("Done") { controller.stop() }
                            .keyboardShortcut(.defaultAction)
                    }
                    .controlSize(.large)
                    Text("Press Esc with the mouse pointer anywhere to stop early.")
                        .font(.footnote)
                        .foregroundStyle(.white.opacity(0.45))
                }
                .padding(40)
            } else {
                VStack {
                    Spacer()
                    HStack {
                        Spacer()
                        VStack(alignment: .trailing, spacing: 6) {
                            Text("\(controller.secondsLeft)")
                                .font(.system(size: 22, weight: .light, design: .rounded).monospacedDigit())
                            Text("Screen cleaning · click to end")
                                .font(.caption)
                        }
                        .foregroundStyle(.white.opacity(0.18))
                        .padding(24)
                    }
                }
            }
        }
        .contentShape(Rectangle())
        .onTapGesture { if mode == .screen { controller.stop() } }
    }
}
