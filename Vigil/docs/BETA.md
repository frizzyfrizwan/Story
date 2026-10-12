# Vigil beta kit

## Who to recruit (5–10 people)

Aim for one of each: an Intel MacBook (2018–2020), an M1 or M2 MacBook Air (fanless), an M3 or M4 MacBook Pro, a Mac mini or Mac Studio
(no battery), and one iMac. One person on macOS 14 Sonoma, the rest on 15/26. A "normal" user who has never opened Activity Monitor is worth
more than three developers.

## What to send them

Subject: Help me test Vigil (10 minutes, you keep the app)

> Hi — I built a Mac app called Vigil that shows what is slowing your Mac down and keeps it healthy. Could you try it for a week?
>
> 1. Download: <release URL>. Open the DMG, drag Vigil to Applications, open it.
>    (Beta builds are not yet notarized; if macOS blocks it, run `xattr -dr com.apple.quarantine /Applications/Vigil.app` in Terminal once.)
> 2. Leave it running with "Launch at login" on.
> 3. On day one and day seven: open Settings → General → "Save report to Desktop" and send me `Vigil-diagnostics.txt` from your Desktop.
> 4. Tell me anything that is wrong, confusing, or that you would pay for. One line each is perfect.
>
> You get a lifetime Pro licence for your trouble. Thanks!

Issue their licence with `swift Tools/make-license.swift issue <private-hex> their@email lifetime`.

## What to check in each report

See `LAUNCH.md` §6. In short: temperatures grouped sensibly, fans present where the Mac has them, battery figures matching
System Information → Power, Wi-Fi matching System Information → Network, no process at more than 1% named Vigil.

## Feedback to collect

- First impression of the Overview: did they understand the health score without explanation?
- Did any alert fire, and was it useful or noise?
- Which Toolbox action did they use more than once?
- Did they open History, and did "what was running" make sense?
- Would they pay US$29 once? If not, what would it take?
