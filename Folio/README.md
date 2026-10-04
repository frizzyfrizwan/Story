# Folio

**The PDF editor that gets out of your way.**

Folio is a native iOS 17+ app (SwiftUI + PDFKit + Vision + StoreKit 2) for people who need to *fix* a PDF, not study a toolbar. Open a document and you see the page and one small dock. Every tool appears only when you ask for it.

## What makes it different

| | Folio | Typical PDF apps |
|---|---|---|
| **Tap to retype** | Tap any line of text and type over it. Folio measures the line, picks a matching size and paints a clean patch. | Separate "text box" tool, manual sizing |
| **Smart Redact** | Finds emails, phone numbers, links, addresses, card numbers and ID numbers (plus any word you add), then **rasterises the page** so hidden data is gone for good and **re-OCRs** it so the rest stays searchable. | Black boxes drawn on top; text still copyable |
| **Signatures that travel** | Draw or type once. Drag, pinch, place. The signature is burned into the page so every viewer shows it. | Stamp annotations that other apps hide |
| **Scan to searchable PDF** | VisionKit capture + on-device OCR writes an invisible text layer (PDF text render mode 3). | Cloud OCR or none |
| **Safe edits** | The original file is kept on first edit. Undo everything. "Restore original" is always one tap away. | Destructive saves |
| **Nothing leaves the device** | No account, no servers, no analytics. | — |

### Modes

- **Read** – scroll, pinch, long-press to select text. Links work. Tap the magnifier to find text anywhere in the document; matches are highlighted and you can step through them.
- **Mark** – pen, highlighter, eraser. One finger draws, two fingers scroll (or Pencil-only in Settings).
- **Text** – tap a line to retype it, tap empty space to add text.
- **Sign** – pick a saved signature, drop it on the page.
- **Pages** – a board of thumbnails: drag to reorder, long-press for rotate / duplicate / share / delete, multi-select for bulk actions, add pages from the camera, Photos, another PDF, or a blank sheet.

### Free vs Pro

Everything above is free. **Folio Pro** (yearly with a free trial, or lifetime) adds:

- Scan → searchable PDF (OCR on capture)
- Recognize text on any image-only PDF
- Smart Redact
- Signature vault (free users keep one signature)

## Project layout

```
Folio/
├── Folio.xcodeproj           # Xcode 16 project (file-system-synchronised groups)
├── Config/Folio.storekit     # Local StoreKit configuration (attached to the scheme)
├── Folio/
│   ├── App/                  # FolioApp, RootView, Router, AppSettings
│   ├── Models/               # DocumentRecord, editor types, OCR line, redaction candidate…
│   ├── Services/             # PDFService, OCRService, RedactionFinder, LibraryStore,
│   │                         # SignatureStore, StoreService, ScanPipeline, UIKit wrappers
│   ├── Views/
│   │   ├── Library/          # Home grid, document card, scan review
│   │   ├── Editor/           # EditorViewModel, PDFKitView (+ink gestures), dock, sheets
│   │   ├── Paywall/
│   │   └── Settings/         # Settings, Welcome
│   ├── Utilities/            # Theme, haptics, extensions
│   ├── Assets.xcassets
│   └── Info.plist
└── FolioTests/               # XCTest: PDF building, OCR layer, redaction finder
```

### Architecture notes

- **State**: `@Observable` classes injected through the SwiftUI environment (`LibraryStore`, `StoreService`, `SignatureStore`, `Router`, `AppSettings`). One `EditorViewModel` per open document.
- **Undo**: the editor keeps its own stack of `EditAction`s. Annotation edits are cheap (add/remove); page-level edits (signature flatten, OCR, redaction, reorder) swap `PDFPage` objects and carry user annotations across so they stay editable.
- **Persistence**: documents live in `Documents/Folio/Files/<uuid>.pdf`, pristine originals in `Originals/`, thumbnails in `Thumbnails/`, and `library.json` is the index. Saves are debounced (1 s) and written atomically via a temp file + `replaceItemAt`.
- **Rendering tricks**:
  - `PDFService.flatten(page:)` redraws a page into a `UIGraphicsPDFRenderer` so vector content stays vector while annotations are burned in.
  - `ImageStampAnnotation` draws a bitmap through PDFKit's annotation pipeline, so page rotation is handled for free, then the page is flattened.
  - `OCRService.drawInvisibleText` lays Core Text glyphs over recognised boxes with text drawing mode `.invisible` and a horizontal text-matrix scale so selection highlights line up with the printed words.
- **Ink**: a custom `StrokeGestureRecognizer` begins on the first touch, previews with a `CAShapeLayer`, and converts to a PDFKit ink annotation on release. PDFView's scroll view is switched to two-finger panning while drawing with a finger.

## Running it

1. Open `Folio/Folio.xcodeproj` in **Xcode 16** or newer.
2. Select the `Folio` target → *Signing & Capabilities* → pick your team (bundle id `com.faisalrizwan.folio`, change as needed).
3. Run on an iOS 17+ device. The simulator works for everything except the camera scanner (use *From Photos* or *Import PDF* there).
4. The shared `Folio` scheme references `Config/Folio.storekit`, so purchases work locally. If Xcode doesn't pick it up, set it under *Edit Scheme → Run → Options → StoreKit Configuration*.
5. Debug builds have a *Settings → Debug → Unlock Pro* toggle for exercising Pro features without a purchase.

Run the tests with ⌘U (the `FolioTests` target covers PDF assembly, the OCR text layer and the redaction finder).

## TestFlight from GitHub

`.github/workflows/testflight.yml` archives the app with Xcode's cloud signing and uploads it to TestFlight. It runs on every push to `master` that touches `Folio/`, or on demand from the Actions tab, and skips itself with a warning until these repository secrets exist:

| Secret | Where to get it |
|---|---|
| `APPLE_TEAM_ID` | developer.apple.com → Membership details → Team ID |
| `ASC_KEY_ID`, `ASC_ISSUER_ID`, `ASC_API_KEY_P8` | App Store Connect → Users and Access → Integrations → App Store Connect API → generate a key with the **App Manager** role; paste the `.p8` file's full contents as the third secret |

Also create the app record once in App Store Connect (My Apps → + → iOS, bundle id `com.faisalrizwan.folio`). Each successful run shows up in TestFlight within a few minutes; add yourself as an internal tester to install it from the TestFlight app on your iPhone.

## Shipping checklist

- Create the two in-app purchases in App Store Connect with the ids in `StoreService.ProductID` (`app.folio.pro.yearly` as an auto-renewing subscription with an introductory free trial, `app.folio.pro.lifetime` as a non-consumable).
- Add an app icon to `Assets.xcassets/AppIcon.appiconset` (the catalog already declares the 1024 pt slots).
- Review the privacy strings in `Info.plist` and fill in the App Privacy questionnaire as "data not collected".

## Demo mode and screenshots

Launching with `-demo` seeds a two-page "Welcome to Folio" document and skips the welcome sheet; `-demo-open` also opens it in the editor. CI uses this to capture `screenshots/01-library.png` and `screenshots/02-editor.png` from the simulator on every run (download them from the workflow's artifacts). Handy for App Store captures too:

```
xcrun simctl launch booted com.faisalrizwan.folio -demo-open
```

## Known limitations

- Password-protected PDFs are unlocked at import (you're asked for the password) and stored without encryption; Folio doesn't re-apply passwords on export.
- "Tap to retype" paints over the original glyphs rather than rewriting the content stream, so the old text is still present in the file (Smart Redact is the tool for removing text for good).
- Form-field filling relies on PDFKit's built-in widget handling; there is no dedicated form UI.
