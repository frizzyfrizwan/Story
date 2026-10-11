import Foundation
import CoreFoundation

/// Hidden macOS settings exposed as switches. Every tweak records its default so it can be reverted.
struct Tweak: Identifiable, Equatable {
    enum Kind: Equatable {
        case toggle(on: TweakValue, off: TweakValue)
        case choice([(label: String, value: TweakValue)])
        case number(range: ClosedRange<Double>, step: Double)

        static func == (lhs: Kind, rhs: Kind) -> Bool {
            switch (lhs, rhs) {
            case (.toggle(let a, let b), .toggle(let c, let d)): return a == c && b == d
            case (.choice(let a), .choice(let b)): return a.map { $0.value } == b.map { $0.value }
            case (.number(let a, let s1), .number(let b, let s2)): return a == b && s1 == s2
            default: return false
            }
        }
    }

    enum Restart: String {
        case none, finder = "Finder", dock = "Dock", systemUIServer = "SystemUIServer", logout = "Log out"
    }

    enum Category: String, CaseIterable, Identifiable {
        case finder = "Finder", dock = "Dock & Mission Control", screenshots = "Screenshots", keyboard = "Keyboard & Text", trackpad = "Trackpad & Mouse", appearance = "Appearance & Windows", system = "System"
        var id: String { rawValue }
        var symbol: String {
            switch self {
            case .finder: return "folder"
            case .dock: return "dock.rectangle"
            case .screenshots: return "camera.viewfinder"
            case .keyboard: return "keyboard"
            case .trackpad: return "cursorarrow.motionlines"
            case .appearance: return "macwindow"
            case .system: return "gearshape"
            }
        }
    }

    let id: String
    let title: String
    let detail: String
    let category: Category
    let domain: String
    let key: String
    let kind: Kind
    /// The macOS default (what "Reset" writes back by deleting the key).
    let defaultValue: TweakValue
    let restart: Restart
    var currentHost: Bool = false
}

enum TweakValue: Equatable, CustomStringConvertible {
    case bool(Bool)
    case int(Int)
    case double(Double)
    case string(String)

    var description: String {
        switch self {
        case .bool(let value): return value ? "On" : "Off"
        case .int(let value): return "\(value)"
        case .double(let value): return value == value.rounded() ? "\(Int(value))" : String(format: "%.2f", value)
        case .string(let value): return value
        }
    }

    var propertyListValue: Any {
        switch self {
        case .bool(let value): return value
        case .int(let value): return value
        case .double(let value): return value
        case .string(let value): return value
        }
    }

    var doubleValue: Double? {
        switch self {
        case .int(let value): return Double(value)
        case .double(let value): return value
        case .bool(let value): return value ? 1 : 0
        case .string(let value): return Double(value)
        }
    }

    init?(any: Any?) {
        guard let any else { return nil }
        if let number = any as? NSNumber {
            if CFGetTypeID(number) == CFBooleanGetTypeID() { self = .bool(number.boolValue); return }
            if number.doubleValue == number.doubleValue.rounded() && !String(cString: number.objCType).contains("d") && !String(cString: number.objCType).contains("f") {
                self = .int(number.intValue)
            } else {
                self = .double(number.doubleValue)
            }
            return
        }
        if let string = any as? String { self = .string(string); return }
        return nil
    }

    /// Loose comparison used to decide which choice is selected (ints vs doubles vs strings).
    func matches(_ other: TweakValue) -> Bool {
        if self == other { return true }
        switch (self, other) {
        case (.int(let a), .double(let b)), (.double(let b), .int(let a)): return Double(a) == b
        case (.bool(let a), .int(let b)), (.int(let b), .bool(let a)): return (a ? 1 : 0) == b
        case (.string(let a), .int(let b)), (.int(let b), .string(let a)): return Int(a) == b
        case (.string(let a), .double(let b)), (.double(let b), .string(let a)): return Double(a) == b
        case (.string(let a), .bool(let b)), (.bool(let b), .string(let a)): return (a.lowercased() == "true" || a == "1") == b
        default: return false
        }
    }
}

enum TweakCatalog {
    static let global = "NSGlobalDomain"

    static let all: [Tweak] = [
        // Finder
        Tweak(id: "finder.hidden", title: "Show hidden files", detail: "Reveal dot-files and system folders in Finder.", category: .finder, domain: "com.apple.finder", key: "AppleShowAllFiles", kind: .toggle(on: .bool(true), off: .bool(false)), defaultValue: .bool(false), restart: .finder),
        Tweak(id: "finder.extensions", title: "Always show file extensions", detail: "Show .pdf, .jpg and friends for every file.", category: .finder, domain: global, key: "AppleShowAllExtensions", kind: .toggle(on: .bool(true), off: .bool(false)), defaultValue: .bool(false), restart: .finder),
        Tweak(id: "finder.pathbar", title: "Show path bar", detail: "A breadcrumb trail at the bottom of every Finder window.", category: .finder, domain: "com.apple.finder", key: "ShowPathbar", kind: .toggle(on: .bool(true), off: .bool(false)), defaultValue: .bool(false), restart: .finder),
        Tweak(id: "finder.statusbar", title: "Show status bar", detail: "Item count and free space at the bottom of Finder windows.", category: .finder, domain: "com.apple.finder", key: "ShowStatusBar", kind: .toggle(on: .bool(true), off: .bool(false)), defaultValue: .bool(false), restart: .finder),
        Tweak(id: "finder.posixtitle", title: "Full path in window title", detail: "Show the complete folder path in the Finder title bar.", category: .finder, domain: "com.apple.finder", key: "_FXShowPosixPathInTitle", kind: .toggle(on: .bool(true), off: .bool(false)), defaultValue: .bool(false), restart: .finder),
        Tweak(id: "finder.foldersfirst", title: "Keep folders on top", detail: "Sort folders before files when sorting by name.", category: .finder, domain: "com.apple.finder", key: "_FXSortFoldersFirst", kind: .toggle(on: .bool(true), off: .bool(false)), defaultValue: .bool(false), restart: .finder),
        Tweak(id: "finder.extwarning", title: "Warn when changing an extension", detail: "Turn off the \"Are you sure you want to change the extension\" dialog.", category: .finder, domain: "com.apple.finder", key: "FXEnableExtensionChangeWarning", kind: .toggle(on: .bool(true), off: .bool(false)), defaultValue: .bool(true), restart: .finder),
        Tweak(id: "finder.searchscope", title: "Default search scope", detail: "Where ⌘F searches first.", category: .finder, domain: "com.apple.finder", key: "FXDefaultSearchScope", kind: .choice([(label: "This Mac", value: .string("SCev")), (label: "Current folder", value: .string("SCcf")), (label: "Previous scope", value: .string("SCsp"))]), defaultValue: .string("SCev"), restart: .finder),
        Tweak(id: "finder.quit", title: "Quit Finder menu item", detail: "Add ⌘Q to Finder so you can quit it like any other app.", category: .finder, domain: "com.apple.finder", key: "QuitMenuItem", kind: .toggle(on: .bool(true), off: .bool(false)), defaultValue: .bool(false), restart: .finder),
        Tweak(id: "finder.trash30", title: "Empty Trash after 30 days", detail: "Automatically delete items that have been in the Trash for a month.", category: .finder, domain: "com.apple.finder", key: "FXRemoveOldTrashItems", kind: .toggle(on: .bool(true), off: .bool(false)), defaultValue: .bool(false), restart: .finder),
        Tweak(id: "finder.dsstore.network", title: "No .DS_Store on network drives", detail: "Stop Finder littering shared drives with .DS_Store files.", category: .finder, domain: "com.apple.desktopservices", key: "DSDontWriteNetworkStores", kind: .toggle(on: .bool(true), off: .bool(false)), defaultValue: .bool(false), restart: .finder),
        Tweak(id: "finder.dsstore.usb", title: "No .DS_Store on USB drives", detail: "Same for USB sticks and SD cards.", category: .finder, domain: "com.apple.desktopservices", key: "DSDontWriteUSBStores", kind: .toggle(on: .bool(true), off: .bool(false)), defaultValue: .bool(false), restart: .finder),
        Tweak(id: "finder.desktopicons", title: "Show desktop icons", detail: "Turn off for a clean desktop; the files stay in ~/Desktop.", category: .finder, domain: "com.apple.finder", key: "CreateDesktop", kind: .toggle(on: .bool(true), off: .bool(false)), defaultValue: .bool(true), restart: .finder),
        Tweak(id: "finder.savelocal", title: "Save new documents to this Mac", detail: "Default the Save dialog to local folders instead of iCloud Drive.", category: .finder, domain: global, key: "NSDocumentSaveNewDocumentsToCloud", kind: .toggle(on: .bool(false), off: .bool(true)), defaultValue: .bool(true), restart: .none),
        Tweak(id: "finder.expandsave", title: "Expanded save dialogs", detail: "Open Save dialogs in the expanded view every time.", category: .finder, domain: global, key: "NSNavPanelExpandedStateForSaveMode", kind: .toggle(on: .bool(true), off: .bool(false)), defaultValue: .bool(false), restart: .none),

        // Dock
        Tweak(id: "dock.autohide", title: "Automatically hide the Dock", detail: "Hide the Dock until the pointer reaches the screen edge.", category: .dock, domain: "com.apple.dock", key: "autohide", kind: .toggle(on: .bool(true), off: .bool(false)), defaultValue: .bool(false), restart: .dock),
        Tweak(id: "dock.autohidedelay", title: "Dock reveal delay", detail: "Seconds before a hidden Dock appears. 0 makes it instant.", category: .dock, domain: "com.apple.dock", key: "autohide-delay", kind: .number(range: 0...2, step: 0.1), defaultValue: .double(0.5), restart: .dock),
        Tweak(id: "dock.autohidetime", title: "Dock animation speed", detail: "Duration of the show/hide animation. 0 is instant.", category: .dock, domain: "com.apple.dock", key: "autohide-time-modifier", kind: .number(range: 0...1, step: 0.1), defaultValue: .double(0.5), restart: .dock),
        Tweak(id: "dock.recents", title: "Show recent apps", detail: "The recent applications section at the end of the Dock.", category: .dock, domain: "com.apple.dock", key: "show-recents", kind: .toggle(on: .bool(true), off: .bool(false)), defaultValue: .bool(true), restart: .dock),
        Tweak(id: "dock.staticonly", title: "Only show running apps", detail: "Hide pinned apps; the Dock becomes a task switcher.", category: .dock, domain: "com.apple.dock", key: "static-only", kind: .toggle(on: .bool(true), off: .bool(false)), defaultValue: .bool(false), restart: .dock),
        Tweak(id: "dock.showhidden", title: "Dim hidden apps", detail: "Make icons of hidden (⌘H) apps translucent.", category: .dock, domain: "com.apple.dock", key: "showhidden", kind: .toggle(on: .bool(true), off: .bool(false)), defaultValue: .bool(false), restart: .dock),
        Tweak(id: "dock.scrolltoopen", title: "Scroll on icon to show windows", detail: "Scroll up over a Dock icon to see that app's windows (App Exposé).", category: .dock, domain: "com.apple.dock", key: "scroll-to-open", kind: .toggle(on: .bool(true), off: .bool(false)), defaultValue: .bool(false), restart: .dock),
        Tweak(id: "dock.mineffect", title: "Minimize effect", detail: "Animation used when minimizing windows. \"Suck\" is a hidden one.", category: .dock, domain: "com.apple.dock", key: "mineffect", kind: .choice([(label: "Genie", value: .string("genie")), (label: "Scale", value: .string("scale")), (label: "Suck", value: .string("suck"))]), defaultValue: .string("genie"), restart: .dock),
        Tweak(id: "dock.orientation", title: "Dock position", detail: "Which screen edge the Dock sits on.", category: .dock, domain: "com.apple.dock", key: "orientation", kind: .choice([(label: "Bottom", value: .string("bottom")), (label: "Left", value: .string("left")), (label: "Right", value: .string("right"))]), defaultValue: .string("bottom"), restart: .dock),
        Tweak(id: "dock.tilesize", title: "Icon size", detail: "Dock icon size in points.", category: .dock, domain: "com.apple.dock", key: "tilesize", kind: .number(range: 16...128, step: 4), defaultValue: .int(48), restart: .dock),
        Tweak(id: "dock.mruspaces", title: "Rearrange Spaces by recent use", detail: "Turn off to keep your desktops in a fixed order.", category: .dock, domain: "com.apple.dock", key: "mru-spaces", kind: .toggle(on: .bool(true), off: .bool(false)), defaultValue: .bool(true), restart: .dock),
        Tweak(id: "dock.exposegroup", title: "Group windows by app in Mission Control", detail: "Stack each app's windows together.", category: .dock, domain: "com.apple.dock", key: "expose-group-apps", kind: .toggle(on: .bool(true), off: .bool(false)), defaultValue: .bool(false), restart: .dock),
        Tweak(id: "dock.exposeanim", title: "Mission Control animation speed", detail: "Seconds for the Mission Control animation. 0.1 feels instant.", category: .dock, domain: "com.apple.dock", key: "expose-animation-duration", kind: .number(range: 0...1, step: 0.05), defaultValue: .double(0.25), restart: .dock),
        Tweak(id: "dock.singleapp", title: "Single-app mode", detail: "Clicking a Dock icon hides every other app. Great for focus.", category: .dock, domain: "com.apple.dock", key: "single-app", kind: .toggle(on: .bool(true), off: .bool(false)), defaultValue: .bool(false), restart: .dock),
        Tweak(id: "dock.highlightstack", title: "Highlight hover in stacks", detail: "Highlight the item under the pointer in grid-view stacks.", category: .dock, domain: "com.apple.dock", key: "mouse-over-hilite-stack", kind: .toggle(on: .bool(true), off: .bool(false)), defaultValue: .bool(false), restart: .dock),
        Tweak(id: "dock.spans", title: "Spaces span displays", detail: "Turn off separate Spaces per display (requires logging out).", category: .dock, domain: "com.apple.spaces", key: "spans-displays", kind: .toggle(on: .bool(true), off: .bool(false)), defaultValue: .bool(false), restart: .logout),

        // Screenshots
        Tweak(id: "shot.location", title: "Save screenshots to", detail: "Folder where ⌘⇧3/4 screenshots land. Enter a path such as ~/Pictures/Screenshots.", category: .screenshots, domain: "com.apple.screencapture", key: "location", kind: .choice([(label: "Desktop", value: .string("~/Desktop")), (label: "Downloads", value: .string("~/Downloads")), (label: "Pictures/Screenshots", value: .string("~/Pictures/Screenshots")), (label: "Documents/Screenshots", value: .string("~/Documents/Screenshots"))]), defaultValue: .string("~/Desktop"), restart: .systemUIServer),
        Tweak(id: "shot.type", title: "Screenshot format", detail: "PNG is lossless; JPG and HEIC are much smaller.", category: .screenshots, domain: "com.apple.screencapture", key: "type", kind: .choice([(label: "PNG", value: .string("png")), (label: "JPG", value: .string("jpg")), (label: "HEIC", value: .string("heic")), (label: "PDF", value: .string("pdf")), (label: "TIFF", value: .string("tiff"))]), defaultValue: .string("png"), restart: .systemUIServer),
        Tweak(id: "shot.shadow", title: "Window shadow in screenshots", detail: "Turn off to capture windows without the big drop shadow.", category: .screenshots, domain: "com.apple.screencapture", key: "disable-shadow", kind: .toggle(on: .bool(false), off: .bool(true)), defaultValue: .bool(false), restart: .systemUIServer),
        Tweak(id: "shot.thumbnail", title: "Floating thumbnail", detail: "The preview that hovers in the corner after a screenshot. Off saves files instantly.", category: .screenshots, domain: "com.apple.screencapture", key: "show-thumbnail", kind: .toggle(on: .bool(true), off: .bool(false)), defaultValue: .bool(true), restart: .systemUIServer),
        Tweak(id: "shot.date", title: "Date in file name", detail: "Include the date and time in screenshot file names.", category: .screenshots, domain: "com.apple.screencapture", key: "include-date", kind: .toggle(on: .bool(true), off: .bool(false)), defaultValue: .bool(true), restart: .systemUIServer),
        Tweak(id: "shot.name", title: "File name prefix", detail: "The word before the date in screenshot names.", category: .screenshots, domain: "com.apple.screencapture", key: "name", kind: .choice([(label: "Screenshot", value: .string("Screenshot")), (label: "Screen Shot", value: .string("Screen Shot")), (label: "Capture", value: .string("Capture")), (label: "Shot", value: .string("Shot"))]), defaultValue: .string("Screenshot"), restart: .systemUIServer),

        // Keyboard & text
        Tweak(id: "key.repeat", title: "Key repeat rate", detail: "Lower is faster. System Settings stops at 2; 1 is the hidden fastest setting.", category: .keyboard, domain: global, key: "KeyRepeat", kind: .number(range: 1...120, step: 1), defaultValue: .int(6), restart: .logout),
        Tweak(id: "key.initialrepeat", title: "Delay until repeat", detail: "Lower is shorter. System Settings stops at 15; 10 is the hidden shortest.", category: .keyboard, domain: global, key: "InitialKeyRepeat", kind: .number(range: 10...120, step: 1), defaultValue: .int(25), restart: .logout),
        Tweak(id: "key.pressandhold", title: "Accent menu on long press", detail: "Off makes holding a key repeat it (useful in code editors and games).", category: .keyboard, domain: global, key: "ApplePressAndHoldEnabled", kind: .toggle(on: .bool(true), off: .bool(false)), defaultValue: .bool(true), restart: .logout),
        Tweak(id: "key.autocap", title: "Auto-capitalize", detail: "Capitalize the first letter of sentences everywhere.", category: .keyboard, domain: global, key: "NSAutomaticCapitalizationEnabled", kind: .toggle(on: .bool(true), off: .bool(false)), defaultValue: .bool(true), restart: .none),
        Tweak(id: "key.autocorrect", title: "Auto-correct spelling", detail: "System-wide spelling correction while typing.", category: .keyboard, domain: global, key: "NSAutomaticSpellingCorrectionEnabled", kind: .toggle(on: .bool(true), off: .bool(false)), defaultValue: .bool(true), restart: .none),
        Tweak(id: "key.period", title: "Double-space inserts a period", detail: "Two spaces become \". \".", category: .keyboard, domain: global, key: "NSAutomaticPeriodSubstitutionEnabled", kind: .toggle(on: .bool(true), off: .bool(false)), defaultValue: .bool(true), restart: .none),
        Tweak(id: "key.smartquotes", title: "Smart quotes", detail: "Convert straight quotes to curly ones. Off is better for code.", category: .keyboard, domain: global, key: "NSAutomaticQuoteSubstitutionEnabled", kind: .toggle(on: .bool(true), off: .bool(false)), defaultValue: .bool(true), restart: .none),
        Tweak(id: "key.smartdashes", title: "Smart dashes", detail: "Convert -- to an em dash.", category: .keyboard, domain: global, key: "NSAutomaticDashSubstitutionEnabled", kind: .toggle(on: .bool(true), off: .bool(false)), defaultValue: .bool(true), restart: .none),
        Tweak(id: "key.fullaccess", title: "Full keyboard access", detail: "Tab moves focus between every control in dialogs, not just text fields.", category: .keyboard, domain: global, key: "AppleKeyboardUIMode", kind: .toggle(on: .int(3), off: .int(0)), defaultValue: .int(0), restart: .logout),
        Tweak(id: "key.fnkeys", title: "Use F1–F12 as standard function keys", detail: "Hold Fn for brightness and volume instead.", category: .keyboard, domain: global, key: "com.apple.keyboard.fnState", kind: .toggle(on: .bool(true), off: .bool(false)), defaultValue: .bool(false), restart: .logout),

        // Trackpad & mouse
        Tweak(id: "track.natural", title: "Natural scrolling", detail: "Content follows finger direction. Off makes it scroll like a mouse wheel.", category: .trackpad, domain: global, key: "com.apple.swipescrolldirection", kind: .toggle(on: .bool(true), off: .bool(false)), defaultValue: .bool(true), restart: .logout),
        Tweak(id: "track.tap", title: "Tap to click", detail: "Tap the trackpad instead of pressing it.", category: .trackpad, domain: "com.apple.AppleMultitouchTrackpad", key: "Clicking", kind: .toggle(on: .bool(true), off: .bool(false)), defaultValue: .bool(false), restart: .logout),
        Tweak(id: "track.threefinger", title: "Three-finger drag", detail: "Drag windows and selections with three fingers (hidden in Accessibility settings).", category: .trackpad, domain: "com.apple.AppleMultitouchTrackpad", key: "TrackpadThreeFingerDrag", kind: .toggle(on: .bool(true), off: .bool(false)), defaultValue: .bool(false), restart: .logout),
        Tweak(id: "track.swipenav", title: "Swipe between pages with scroll", detail: "Two-finger horizontal swipe navigates back and forward in browsers.", category: .trackpad, domain: global, key: "AppleEnableSwipeNavigateWithScrolls", kind: .toggle(on: .bool(true), off: .bool(false)), defaultValue: .bool(true), restart: .logout),

        // Appearance & windows
        Tweak(id: "ui.scrollbars", title: "Show scroll bars", detail: "Always show scroll bars instead of only while scrolling.", category: .appearance, domain: global, key: "AppleShowScrollBars", kind: .choice([(label: "Automatic", value: .string("Automatic")), (label: "When scrolling", value: .string("WhenScrolling")), (label: "Always", value: .string("Always"))]), defaultValue: .string("Automatic"), restart: .none),
        Tweak(id: "ui.resize", title: "Window resize animation", detail: "Seconds for windows to animate to a new size. 0.001 feels instant.", category: .appearance, domain: global, key: "NSWindowResizeTime", kind: .number(range: 0.001...0.5, step: 0.05), defaultValue: .double(0.2), restart: .none),
        Tweak(id: "ui.titlebar", title: "Double-click title bar", detail: "What happens when you double-click a window's title bar.", category: .appearance, domain: global, key: "AppleActionOnDoubleClick", kind: .choice([(label: "Zoom", value: .string("Maximize")), (label: "Minimize", value: .string("Minimize")), (label: "Fill", value: .string("Fill")), (label: "Nothing", value: .string("None"))]), defaultValue: .string("Maximize"), restart: .none),
        Tweak(id: "ui.menubarfullscreen", title: "Menu bar in full screen", detail: "Keep the menu bar visible in full-screen apps.", category: .appearance, domain: global, key: "AppleMenuBarVisibleInFullscreen", kind: .toggle(on: .bool(true), off: .bool(false)), defaultValue: .bool(false), restart: .logout),
        Tweak(id: "ui.tinting", title: "Wallpaper tinting in windows", detail: "Off gives flat, neutral window backgrounds.", category: .appearance, domain: global, key: "AppleReduceDesktopTinting", kind: .toggle(on: .bool(false), off: .bool(true)), defaultValue: .bool(false), restart: .none),
        Tweak(id: "ui.fontsmoothing", title: "Font smoothing", detail: "Heavier text rendering on non-Retina displays.", category: .appearance, domain: global, key: "AppleFontSmoothing", kind: .choice([(label: "Off", value: .int(0)), (label: "Light", value: .int(1)), (label: "Medium", value: .int(2)), (label: "Strong", value: .int(3))]), defaultValue: .int(2), restart: .logout),
        Tweak(id: "ui.tooltipdelay", title: "Tooltip delay", detail: "Milliseconds before a tooltip appears when hovering.", category: .appearance, domain: global, key: "NSInitialToolTipDelay", kind: .number(range: 0...5000, step: 100), defaultValue: .int(1000), restart: .none),
        Tweak(id: "ui.sidebariconsize", title: "Sidebar icon size", detail: "Icon size in Finder and Mail sidebars.", category: .appearance, domain: global, key: "NSTableViewDefaultSizeMode", kind: .choice([(label: "Small", value: .int(1)), (label: "Medium", value: .int(2)), (label: "Large", value: .int(3))]), defaultValue: .int(2), restart: .finder),
        Tweak(id: "ui.keepwindows", title: "Reopen windows after quitting", detail: "Restore an app's windows when it is relaunched.", category: .appearance, domain: global, key: "NSQuitAlwaysKeepsWindows", kind: .toggle(on: .bool(true), off: .bool(false)), defaultValue: .bool(true), restart: .none),

        // System
        Tweak(id: "sys.clockseconds", title: "Seconds in the menu bar clock", detail: "Show seconds next to the time.", category: .system, domain: "com.apple.menuextra.clock", key: "ShowSeconds", kind: .toggle(on: .bool(true), off: .bool(false)), defaultValue: .bool(false), restart: .systemUIServer),
        Tweak(id: "sys.clockflash", title: "Flashing clock separators", detail: "Blink the colon in the menu bar clock every second.", category: .system, domain: "com.apple.menuextra.clock", key: "FlashDateSeparators", kind: .toggle(on: .bool(true), off: .bool(false)), defaultValue: .bool(false), restart: .systemUIServer),
        Tweak(id: "sys.crashreporter", title: "Crash report dialogs", detail: "Off hides the \"quit unexpectedly\" dialogs; reports still go to Console.", category: .system, domain: "com.apple.CrashReporter", key: "DialogType", kind: .choice([(label: "Show", value: .string("crashreport")), (label: "Hide", value: .string("none"))]), defaultValue: .string("crashreport"), restart: .none),
        Tweak(id: "sys.tmnewdisks", title: "Offer new disks for Time Machine", detail: "Off stops the \"Do you want to use this disk to back up\" prompt.", category: .system, domain: "com.apple.TimeMachine", key: "DoNotOfferNewDisksForBackup", kind: .toggle(on: .bool(false), off: .bool(true)), defaultValue: .bool(false), restart: .none),
        Tweak(id: "sys.textedit", title: "TextEdit opens in plain text", detail: "New documents start as plain text instead of rich text.", category: .system, domain: "com.apple.TextEdit", key: "RichText", kind: .toggle(on: .bool(false), off: .bool(true)), defaultValue: .bool(true), restart: .none),
        Tweak(id: "sys.helpfloat", title: "Help windows float on top", detail: "Off lets Help Viewer windows go behind other windows.", category: .system, domain: "com.apple.helpviewer", key: "DevMode", kind: .toggle(on: .bool(false), off: .bool(true)), defaultValue: .bool(false), restart: .none),
        Tweak(id: "sys.printquit", title: "Quit printer app when done", detail: "Close the print queue app automatically after printing.", category: .system, domain: "com.apple.print.PrintingPrefs", key: "Quit When Finished", kind: .toggle(on: .bool(true), off: .bool(false)), defaultValue: .bool(false), restart: .none),
        Tweak(id: "sys.photoshotplug", title: "Open Photos when a device connects", detail: "Off stops Photos opening every time you plug in an iPhone or camera.", category: .system, domain: "com.apple.ImageCapture", key: "disableHotPlug", kind: .toggle(on: .bool(false), off: .bool(true)), defaultValue: .bool(false), restart: .none),
        Tweak(id: "sys.spaceswitch", title: "Switch Space to an app's window", detail: "When activating an app, jump to the Space that has its windows.", category: .system, domain: global, key: "AppleSpacesSwitchOnActivate", kind: .toggle(on: .bool(true), off: .bool(false)), defaultValue: .bool(true), restart: .none),
    ]

    static func tweak(id: String) -> Tweak? { all.first { $0.id == id } }
    static func tweaks(in category: Tweak.Category) -> [Tweak] { all.filter { $0.category == category } }
}

/// Reads and writes `defaults` through CFPreferences, which is what the `defaults` tool uses underneath.
enum TweaksService {
    private static func application(_ domain: String) -> CFString {
        if domain == TweakCatalog.global { return kCFPreferencesAnyApplication }
        return domain as CFString
    }

    static func read(domain: String, key: String, currentHost: Bool = false) -> TweakValue? {
        let host = currentHost ? kCFPreferencesCurrentHost : kCFPreferencesAnyHost
        let value = CFPreferencesCopyValue(key as CFString, application(domain), kCFPreferencesCurrentUser, host)
        return TweakValue(any: value)
    }

    static func readBool(domain: String, key: String) -> Bool? {
        guard let value = read(domain: domain, key: key) else { return nil }
        switch value {
        case .bool(let flag): return flag
        case .int(let number): return number != 0
        case .string(let string): return string.lowercased() == "true" || string == "1" || string.lowercased() == "yes"
        case .double(let number): return number != 0
        }
    }

    static func write(domain: String, key: String, value: Any?, currentHost: Bool = false) {
        let host = currentHost ? kCFPreferencesCurrentHost : kCFPreferencesAnyHost
        let application = application(domain)
        var converted: AnyObject?
        if let value {
            if let string = value as? String, string.hasPrefix("~") {
                converted = (string as NSString).expandingTildeInPath as NSString
            } else {
                converted = value as AnyObject
            }
        }
        CFPreferencesSetValue(key as CFString, converted, application, kCFPreferencesCurrentUser, host)
        CFPreferencesSynchronize(application, kCFPreferencesCurrentUser, host)
    }

    static func apply(_ tweak: Tweak, value: TweakValue) {
        // Expand the screenshot folder and create it so screencapture does not silently fall back to the Desktop.
        if case .string(let path) = value, tweak.id == "shot.location" {
            let expanded = (path as NSString).expandingTildeInPath
            try? FileManager.default.createDirectory(atPath: expanded, withIntermediateDirectories: true)
        }
        write(domain: tweak.domain, key: tweak.key, value: value.propertyListValue, currentHost: tweak.currentHost)
        restart(tweak.restart)
    }

    static func reset(_ tweak: Tweak) {
        write(domain: tweak.domain, key: tweak.key, value: nil, currentHost: tweak.currentHost)
        restart(tweak.restart)
    }

    static func current(_ tweak: Tweak) -> TweakValue {
        read(domain: tweak.domain, key: tweak.key, currentHost: tweak.currentHost) ?? tweak.defaultValue
    }

    static func isModified(_ tweak: Tweak) -> Bool {
        read(domain: tweak.domain, key: tweak.key, currentHost: tweak.currentHost) != nil
    }

    static func restart(_ target: Tweak.Restart) {
        switch target {
        case .none, .logout: break
        case .finder: Shell.killAll("Finder")
        case .dock: Shell.killAll("Dock")
        case .systemUIServer: Shell.killAll("SystemUIServer")
        }
    }
}
