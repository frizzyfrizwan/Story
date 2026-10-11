# Vigil — Product Research

**Status:** v1 planning · **Audience:** engineering · **Author:** PM · **Date:** 2026-10-11

Vigil is a paid, native macOS menu-bar + dashboard app: "Activity Monitor made human." It monitors the Mac live, keeps a persistent history of what used CPU/RAM/disk/network over time, scores the Mac's health with concrete longevity actions, cleans storage, exposes hidden macOS tweaks, and ships a toolbox of small utilities. Claims below are sourced inline; anything marked *(inference)* is our own judgment.

---

## 1. Who uses a Mac system monitor

| Persona | Job to be done (one line) |
|---|---|
| **The developer with a screaming fan** (M-series MacBook Pro, Xcode/Docker/Node) | "Tell me *which* process is cooking my laptop right now, and whether I can quit it without breaking my build." |
| **The MacBook Air owner with "Your disk is almost full"** (256 GB, non-technical) | "Free up space safely, show me what you will delete before you delete it, and don't make me learn what a cache is." |
| **The parent who wants the family Mac to last 7 years** | "Give me a number that says the machine is healthy and a short list of things to do to keep it that way." |
| **The creative pro exporting video/audio** | "Am I thermally throttling during this export, is it the GPU or CPU, and is it worth plugging in or moving to the desk?" |

*(Personas are inferences from the competitor positioning cited in §3; no primary user research yet.)*

## 2. Jobs to be done, ranked

Ranked by estimated frequency × pain *(inference)*. "AM" = Apple's Activity Monitor.

| # | Question | How Activity Monitor answers it today | Vigil answer |
|---|---|---|---|
| 1 | Why is my Mac slow *right now*? | Sort by %CPU / Memory; raw process names; no explanation. | Popover lists top offenders in plain English with a "safe to quit" verdict. |
| 2 | What is eating my storage? | Doesn't. Disk tab shows I/O, not space. | Storage view groups space by category with a preview-then-clean flow. |
| 3 | What was using RAM an hour ago when things froze? | Doesn't; per-process data is live only ([Vitals listing](https://mac.softpedia.com/get/System-Utilities/Vitals.shtml), [Apple guide](https://support.apple.com/en-gb/guide/activity-monitor/actmntr43452/mac)). | Scrub a timeline; per-process samples persisted in SQLite. |
| 4 | Is my battery dying? | Doesn't (Energy tab shows impact, not health). | Cycle count, max capacity, trend line, and a replacement estimate. |
| 5 | What starts at login? | Doesn't; lives in System Settings > Login Items. | Startup items list with explanations and one-click disable. |
| 6 | Is my Mac too hot? | Doesn't. | Temperature + fan readout with "normal / warm / throttling" label. |
| 7 | Is it throttling during my export? | Doesn't. | Live thermal-pressure state, per-core P/E load and temperature on the timeline (CPU frequency is not exposed by public APIs on Apple Silicon). |
| 8 | Which app is using my network / Wi-Fi? | Network tab, bytes only. | Per-interface up/down, Wi-Fi band, signal, link rate, and a history chart (per-process network needs private APIs; v1.1 candidate). |
| 9 | Why is my fan running when I'm doing nothing? | Sort by CPU; background daemons unexplained. | Explains `mds_stores`, `photoanalysisd`, `kernel_task`, etc. and what to do. |
| 10 | Is this process safe to quit? | Doesn't; "Force Quit" with no guidance. | Every process has a verdict: Safe / Ask first / Don't. |
| 11 | How much memory pressure am I under, and does it matter? | Memory Pressure graph, no advice. | Pressure explained with a "you need more RAM / you don't" verdict. |
| 12 | Is my SSD wearing out? | Doesn't. | S.M.A.R.T. verdict from `diskutil` plus free-space headroom guidance (TBW/wear trend needs an NVMe helper; v1.1 candidate). |
| 13 | Are my backups / FileVault / firewall in good shape? | Doesn't. | Health score items with one-click fixes or deep links. |
| 14 | What's the battery of my AirPods / mouse / keyboard? | Doesn't. | Bluetooth input-device batteries (Magic Mouse/Keyboard/Trackpad) in Battery & Power; AirPods are a v1.1 candidate. |
| 15 | What is my public / local IP? | Doesn't. | Toolbox card; public lookup opt-in. |

## 3. Competitive teardown

| Product | Price / model | Monitoring depth | History / persistence | Cleanup | Tweaks / utilities | Battery health | Thermals / fans | Menu-bar footprint | Most-cited complaint |
|---|---|---|---|---|---|---|---|---|---|
| **iStat Menus 7** | One-time ~$11.99 single / $14.99 family; weather is a separate subscription; also on Setapp ([TidBITS](https://tidbits.com/watchlist/istat-menus-7-0-2), [App Store](https://apps.apple.com/AR/app/id6499559693)) | Deepest: CPU, GPU, memory, disk, network, sensors, battery | Short rolling graphs in dropdowns; no long-term per-process timeline *(inference)* | None | None beyond menu-bar config | Yes | Yes, read + limited fan control | Many icons; heavy if all enabled | Paid major upgrades and historical price grumbling ([MacRumors forum](https://forums.macrumors.com/threads/great-istat-menu-alternative.908714/), [Bjango upgrade FAQ](https://bjango.com/help/istatmenus7/update/)) |
| **Stats** (exelban) | Free, MIT, open source ([GitHub](https://github.com/exelban/stats)) | Broad: CPU, GPU, RAM, disk, net, sensors, battery, Bluetooth | Short in-popover graphs only | None | None | Basic | Yes; fan control "not maintained" ([FAQ](https://mac-stats.com/faq)) | Configurable | CPU/energy cost: Sensors and Bluetooth modules "could reduce CPU usage by up to 50%" if disabled; widget comms disabled over `chronod` load ([FAQ](https://mac-stats.com/faq)) |
| **OneMenu** | Freemium ([Softpedia](https://mac.softpedia.com/get/Utilities/OneMenu.shtml)) | Light: CPU, memory, disk ([MacStories](https://www.macstories.net/club/onemenu/)) | None | None | Window snapping + switcher, clipboard history, brightness, keyboard-cleaning lock ([MacStories](https://www.macstories.net/club/onemenu/), [Medium review](https://medium.com/p/1c22861a6403)) | No | No | Single icon | Breadth over depth; monitoring is shallow *(inference)* |
| **CleanMyMac** | $39.95/yr or $89.95 one-time for X; CleanMyMac 5 one-time ~ $120 incl. bundled malware scanner; on Setapp ([TidBITS](https://tidbits.com/watchlist/cleanmymac-5-0/), [TidBITS thread](https://tidbits.com/?p=46745)) | Light menu-bar monitor | None | Deep, polished | Uninstaller, malware, privacy, optimization | Basic | No | Single icon | Price and the move to annual subscription ([TidBITS](https://tidbits.com/?p=46745), [GetApp](https://www.getapp.com/sales-software/a/cleanmymac-x/)) |
| **Sensei** | $29/yr, 14-day trial ([Nektony comparison](https://nektony.com/reviews/sensei-maccleanerpro-reviews)) | Dashboard: CPU, GPU, SSD, battery | Limited | Yes | SSD optimization, fan control | Yes, detailed | Yes, read + fan control | Single icon | "Too feature-rich for casual users"; notarization not stated on site ([Nektony](https://nektony.com/reviews/sensei-maccleanerpro-reviews)) |
| **TG Pro** | One-time, ~€10 at the time of one review; notarized ([TheSweetBits](https://thesweetbits.com/tools/tg-pro-review/), [Macitynet](https://www.macitynet.it/?p=1109283)) | Temperatures and fans only | Logging of temps | None | Fan rules, auto-boost | No | Best-in-class, incl. new M5 models ([release notes](https://www.tunabellysoftware.com/tgpro/releasenotes/)) | One icon | Narrow scope; price feels high for one job *(inference)* |
| **AlDente** | Free / Pro ~$8.49 per a competitor's chart; also on Setapp ([Chargie comparison](https://chargie.org/chargie-vs-aldente/)) | Battery only | Charge history | None | Charge limit, sailing, heat protection | Yes, the point of the app | Battery temp only | One icon | Limit stops holding after macOS updates ([GitHub issue #768](https://github.com/AppHouseKitchen/AlDente-Charge-Limiter/issues/768), [MacRumors thread](https://forums.macrumors.com/threads/battery-charging-limited-to-88-how-to-fix.2420374/)) |
| **Activity Monitor** | Free, built in | Deep but raw: CPU, memory, energy, disk, network, GPU history | Overall CPU history window only; "apps in last 8 hours" filter, no usage data ([Apple guide](https://support.apple.com/en-gb/guide/activity-monitor/actmntr43452/mac)) | None | None | None | None | No menu bar presence (dock icon graphs only) | Nothing is explained; no per-process history ([Vitals listing](https://mac.softpedia.com/get/System-Utilities/Vitals.shtml)) |

**OneMenu, explicitly.** OneMenu bundles four things: window management (snapping, layouts, a Command-Tab alternative), system monitoring (CPU, memory, disk), clipboard history, and a keyboard-cleaning lock ([MacStories](https://www.macstories.net/club/onemenu/), [Medium](https://medium.com/p/1c22861a6403)). Vigil **adopts** system monitoring (done far deeper) and the keyboard-cleaning lock (it fits the "care for the machine" story). Vigil **deliberately does not** do window management or clipboard history in v1: both are crowded categories (Rectangle, Raycast, Maccy, Paste), neither has anything to do with the health of the Mac, and both would dilute the pitch.

**Where the gap is** *(inference from the table)*: nobody combines deep monitoring, persisted per-process history, and plain-English explanation. Monitors (iStat, Stats) show numbers without meaning or memory; cleaners (CleanMyMac, Sensei) explain but barely monitor; single-purpose tools (TG Pro, AlDente) are excellent at one thing. Pricing complaints cluster on subscriptions (CleanMyMac) and paid major upgrades (iStat), which argues for a transparent lifetime-or-yearly choice.

## 4. What makes Vigil different

**(a) History that answers "what happened at 3pm".** Every competitor shows a rolling 60-second to few-minute window; Activity Monitor's only history is aggregate CPU. Vigil samples system metrics every 10 s and the top 12 processes (CPU %, physical footprint) every minute while awake, and persists them to a local SQLite database: 14 days of per-process snapshots and a configurable 7 days to 1 year of system-level data (90 days by default). The History tab is a scrubbable timeline: drag to 15:02, see that `photoanalysisd` and a Chrome tab were pegging 6 cores while the fan spun up. This is the single feature users cannot get anywhere else today and is the core Pro justification.

**(b) A health score tied to concrete longevity actions.** The score is not a vanity number: it is a weighted checklist, each line a measurable condition with an action. Battery: cycles and max capacity, plus a habit nudge toward 20–80% and Apple's Optimized Charging. Storage: keep 15% free (APFS and swap suffer below that). Thermals: hours per week spent in heavy thermal pressure. Restart cadence: uptime over 30 days flagged. Backups: last Time Machine completion. Security: FileVault on, Firewall on, software updates current. Each item has a "Fix" that either does it or deep-links to the exact System Settings pane. The parent persona can read it; the developer can argue with it.

**(c) Every process explained in plain English with a safe-to-quit verdict.** Vigil ships a curated dictionary of several hundred macOS daemons and popular apps (`kernel_task`, `WindowServer`, `mds_stores`, `bird`, `cloudd`, `coreaudiod`, Spotlight, Photos analysis, Xcode's build services, Docker's VM, Electron helpers). Each has a one-sentence "what it is", "why it is busy now" heuristics, and a verdict: Safe to quit / Ask first / Don't. Unknown processes get a generic verdict derived from signing identity, parent process, and whether it is a user app. This turns the raw list into advice.

**(d) Cleanup that shows exactly what it will delete and uses the Trash for user files.** Every cleanup category expands to the actual paths and sizes before any button is enabled. Anything under the user's home that they could plausibly want (Downloads, Mail attachments, iOS backups) goes to Trash, never `unlink`. Caches, DerivedData and package-manager caches are removed directly but are regenerable by definition. A post-clean receipt lists what was removed and how much was reclaimed. This is a direct reaction to the trust problem cleaners have.

**(e) Hidden macOS tweaks with one-click revert.** A curated set of `defaults` and `pmset`-style switches (show hidden files, faster Dock autohide, disable press-and-hold, screenshot location/format, disable window animations, key repeat rate, hide desktop icons). Vigil records the prior value before changing anything, shows the exact command it will run, and offers "Revert" per tweak and "Revert all". No tweak requires SIP changes or kernel extensions.

## 5. Feature list for v1

Legend: **Free** ships in the trial-expired tier; **Pro** requires a licence. This matches the gating implemented in `LicenseManager` and the views.

**Monitor** — all Free
- CPU with P-core / E-core breakdown, per-core bars, per-process list, load average and uptime
- Memory: used/app/wired/compressed/cached, swap, memory pressure with explanation
- Disk: space and purgeable per volume, read/write I/O, S.M.A.R.T. verdict
- Network: per-interface up/down, IPs, router and DNS, Wi-Fi SSID/band/RSSI/link rate/security; public IP opt-in
- GPU utilization
- Battery and power: charge, cycles, max/design capacity, condition, wattage in/out, adapter, time remaining, temperature, manufacture date
- Temperatures and fans via SMC (read-only) with thermal-pressure state and system/CPU/GPU power where exposed
- Bluetooth input-device batteries (Magic keyboard/mouse/trackpad)

**History** — last 24 hours Free; longer ranges Pro
- System metrics every 10 s, top-12 process snapshots every minute, persisted in SQLite (per-process 14 days; system-level 7 days–1 year, default 90)
- Scrubbable charts for every range; "running at that moment" panel; heaviest-over-period ranking; event timeline (app launches/quits, sleep/wake, thermal and memory-pressure changes, disk mounts, clean-ups, tweaks, toolbox actions)

**Health** — Free
- Score with explainable penalties across storage, memory, performance, battery, thermals, security, maintenance and backups; each finding carries an action (open a section, open the right System Settings pane)
- Longevity habits: battery 20–80 %, 15 % free disk, heat, restart cadence, backups, updates, startup pruning

**Storage & Cleanup** — scan and preview Free; cleaning Pro
- 30+ categories: user caches; logs; temporary files; Trash; Time Machine local snapshots; Mail downloads; Safari/Chrome/Firefox caches; old downloads; installers; Xcode DerivedData, archives, device support, simulator caches, unavailable simulators; Homebrew, npm/yarn/pnpm, pip/conda, CocoaPods/Carthage, Gradle/Maven, Cargo/Go caches; Docker; iPhone/iPad backups and update installers; Spotify, Slack, Teams, Adobe, Zoom, Discord, VS Code, JetBrains caches
- Home-folder size breakdown and large-file finder (> 250 MB)

**Startup items** — list Free; enable/disable and login-item removal Pro
- Login items (via System Events), user and global launch agents, launch daemons (read-only), vendor and status per item

**Toolbox** — Free unless noted
- Keep awake (with timer); keyboard-cleaning lock (global with Accessibility); screen-cleaning mode; empty Trash; flush DNS; renew DHCP; relaunch Finder/Dock/menu bar; hide desktop icons; show hidden files; toggle Dark Mode; show ~/Library; lock screen; sleep display; sleep Mac; eject all; clear clipboard; reset Launchpad; reset Bluetooth; reset audio
- Pro (administrator tools): free up memory (purge), remove local snapshots, rebuild Spotlight, fix "Open With", clear font caches, run maintenance scripts

**Tweaks** — Pro
- 70+ curated `defaults` switches across Finder, Dock & Mission Control, screenshots, keyboard & text, trackpad, appearance & windows, system; live current value, "changed" marker, one-click reset to the macOS default

**Menu bar** — Free
- Icon, CPU %, memory pressure, temperature, network speed, battery, or a live CPU graph; popover with health ring, six live tiles with sparklines, top processes, battery line, quick actions

**Alerts** — Free
- Disk almost full, memory pressure critical, runaway process, CPU and battery over temperature, thermal throttling; thresholds in Settings; 30-minute cooldown per alert

**Settings & licensing**
- 14-day Pro trial (start date stored in defaults and a hidden file), then the Free tier
- Offline licence key (Ed25519-signed, no activation server); seats recorded in the key
- Lifetime or yearly *(pricing TBD; see §3 complaints)*

## 6. Design principles

1. **Glanceable first.** The popover answers "is anything wrong?" in under a second; details are one click deeper.
2. **Explain every number.** No metric ships without a tooltip saying what it is and when to care.
3. **Never destructive without a preview.** Every clean, tweak, or quit shows exactly what will happen; user files go to Trash.
4. **Respect the battery.** Sampling cost budget: under 1% CPU on average, adaptive sampling on battery, heavy readers (SMC, Bluetooth) throttled. Stats' own FAQ shows how easily sensors double a monitor's cost ([mac-stats.com](https://mac-stats.com/faq)).
5. **Native look.** SwiftUI, Swift Charts, system materials, SF Symbols, full Dark Mode and accessibility support.
6. **Privacy.** Nothing leaves the Mac. No analytics by default. Public IP lookup is opt-in and clearly labeled as a network request.

## 7. Permissions the app needs and why

| Permission | Why | When asked |
|---|---|---|
| **Full Disk Access** | Size and clean Mail downloads, Safari caches, Trash across volumes, iOS backups, Time Machine snapshots | First storage scan |
| **Accessibility** | Global keyboard event tap for the keyboard-cleaning lock and screen-cleaning mode | First use of those tools |
| **Notifications** | Alerts | First alert enabled |
| **Location** | macOS 14+ requires Location authorization to read the current Wi-Fi SSID via CoreWLAN; Apple DTS confirmed this is intentional ([Apple Developer Forums](https://developer.apple.com/forums/thread/732431), [Sequoia follow-up](https://developer.apple.com/forums/thread/769950)) | When the user opts into showing network name |
| **Automation (System Events)** | Toggle login items and dark mode via AppleScript | First use |
| **Administrator password** | A handful of privileged actions: `purge`, flush DNS (`dscacheutil`/`killall -HUP mDNSResponder`), Spotlight rebuild (`mdutil`), deleting local Time Machine snapshots (`tmutil`) | Per action, via `AuthorizationExecuteWithPrivileges` replacement (`SMAppService` helper is a non-goal; use `osascript ... with administrator privileges` for v1) |

**Not sandboxed, distributed outside the Mac App Store.** The sandbox prohibits most of what Vigil exists to do: reading other processes' details beyond basic stats, SMC/IOKit sensor access, `defaults` writes to other domains, Full Disk Access-dependent cleanup, and running privileged commands. iStat Menus, TG Pro, CleanMyMac and Stats all ship their full versions outside the App Store for the same reason. Vigil is signed with Developer ID, notarized, and uses Sparkle for updates; reviewers note notarization as a trust signal for this category ([TheSweetBits on TG Pro](https://thesweetbits.com/tools/tg-pro-review/)). A reduced App Store build is a possible later experiment, not v1.

## 8. Explicit non-goals for v1

- **Window management** — crowded, unrelated to machine health.
- **Clipboard manager** — same; also a privacy liability.
- **Antivirus / malware scanning** — users resent paying for it bundled ([TidBITS](https://tidbits.com/watchlist/cleanmymac-5-0/)); XProtect exists.
- **Duplicate finder** — slow, error-prone, separate product.
- **App uninstaller** — deferred to v1.x; needs a leftovers database.
- **Fan control (SMC write)** — TG Pro owns it; writes carry hardware risk and Stats marks its own as unmaintained.
- **Battery charge limiting** — needs a privileged helper and breaks across macOS updates ([AlDente issue](https://github.com/AppHouseKitchen/AlDente-Charge-Limiter/issues/768)); recommend AlDente instead.
- **Cloud sync** — violates the privacy principle; history stays local.

## 9. Success metrics

1. **Daily popover opens per active user**: target median ≥ 3/day at day 30 (signals the glanceable habit formed).
2. **Trial → paid conversion**: ≥ 8% of trial installs within 30 days of trial end.
3. **Median sampling CPU cost**: ≤ 0.7% average over a 24-hour session, measured by the app itself and visible in Settings.
4. **Cleanup GB reclaimed per user**: median ≥ 5 GB in the first scan; track repeat cleans.
5. **Health score improvement after 30 days**: median +10 points among users who opened Health at least twice.

*(Metrics are collected locally and shown to the user; aggregate reporting is opt-in, per §6.)*

## 10. Sources

- https://tidbits.com/watchlist/istat-menus-7-0-2
- https://apps.apple.com/AR/app/id6499559693
- https://bjango.com/help/istatmenus7/update/
- https://forums.macrumors.com/threads/great-istat-menu-alternative.908714/
- https://github.com/exelban/stats
- https://mac-stats.com/faq
- https://www.macstories.net/club/onemenu/
- https://mac.softpedia.com/get/Utilities/OneMenu.shtml
- https://medium.com/p/1c22861a6403
- https://tidbits.com/?p=46745
- https://tidbits.com/watchlist/cleanmymac-5-0/
- https://www.getapp.com/sales-software/a/cleanmymac-x/
- https://nektony.com/reviews/sensei-maccleanerpro-reviews
- https://thesweetbits.com/tools/tg-pro-review/
- https://www.macitynet.it/?p=1109283
- https://www.tunabellysoftware.com/tgpro/releasenotes/
- https://chargie.org/chargie-vs-aldente/
- https://github.com/AppHouseKitchen/AlDente-Charge-Limiter/issues/768
- https://forums.macrumors.com/threads/battery-charging-limited-to-88-how-to-fix.2420374/
- https://support.apple.com/en-gb/guide/activity-monitor/actmntr43452/mac
- https://mac.softpedia.com/get/System-Utilities/Vitals.shtml
- https://developer.apple.com/forums/thread/732431
- https://developer.apple.com/forums/thread/769950
