# Launching Vigil

Vigil is distributed **directly** (Developer ID + notarization), not through the Mac App Store. The App Store
requires the app sandbox, and sandboxing blocks the features people buy Vigil for: SMC temperatures and fans,
reading every process, cleaning other apps' caches, toggling launch agents, writing other apps' `defaults`,
and the administrator tools. iStat Menus, CleanMyMac, TG Pro and AlDente ship the same way.

## 1. Apple Developer setup (once, ~30 min)

1. Join the Apple Developer Program (developer.apple.com, US$99/year).
2. Certificates: Xcode → Settings → Accounts → your team → *Manage Certificates* → **+** → **Developer ID Application**.
3. Export it: Keychain Access → My Certificates → right-click the "Developer ID Application: …" cert → Export → `.p12` with a password.
4. App-specific password for notarization: appleid.apple.com → Sign-In and Security → App-Specific Passwords → generate one named "Vigil notarytool".
5. Team ID: developer.apple.com → Membership details.

Add these as GitHub repository secrets (Settings → Secrets and variables → Actions):

| Secret | Value |
|---|---|
| `DEVELOPER_ID_CERT_P12_BASE64` | `base64 -i cert.p12 \| pbcopy` |
| `DEVELOPER_ID_CERT_PASSWORD` | the export password |
| `APPLE_TEAM_ID` | e.g. `ABCDE12345` |
| `NOTARY_APPLE_ID` | your Apple ID email |
| `NOTARY_APP_PASSWORD` | the app-specific password |

## 2. Licence keys (done)

The production key pair was generated on 2026-10-12. The **public** half is embedded in `LicenseVerifier.productionPublicKeyHex`
(`Vigil/Services/LicenseManager.swift`). The **private** half was handed to the owner once, out of band; store it in a password manager and
in the fulfilment worker's secrets (`Tools/fulfilment/README.md`). Never commit it. If it is ever lost or leaked, run
`swift Tools/make-license.swift keygen`, replace the public key, ship an update, and re-issue keys to existing customers.

## 3. Cut a release

```
git tag vigil-v1.0.0 && git push origin vigil-v1.0.0
```

`.github/workflows/macos-release.yml` archives, signs with Developer ID, notarizes, staples, builds `Vigil-1.0.0.dmg`
and attaches it to a GitHub release. Bump `MARKETING_VERSION` in the Xcode target before tagging.
Verify on a clean Mac: download the DMG from the release page, open it, drag to Applications, launch. No Gatekeeper warning
means notarization worked (`spctl -a -vv /Applications/Vigil.app` prints `source=Notarized Developer ID`).

## 4. Selling (direct, no App Store)

Recommended: **Lemon Squeezy** (handles VAT/sales tax as merchant of record, ~5% + 50¢) or **Paddle**.

1. Create a Lemon Squeezy store and a product "Vigil Pro" with variants named **Lifetime** (US$29), **Yearly** (US$12/year) and
   **Family Lifetime** (US$49, 3 Macs). The variant name is what the fulfilment code keys off.
2. Deploy `Tools/fulfilment/` (a Cloudflare Worker, free tier) following its README; it signs a licence for every order and attaches it to the receipt.
3. Put the checkout URL in `LicenseSettings` (`Buy Vigil Pro…` currently opens `https://vigil.lemonsqueezy.com`) and in `site/index.html`.
4. Refund policy: 14 days, no questions. The trial already lets people try everything, so refunds stay rare.

The landing page lives in `site/` and deploys to GitHub Pages from `.github/workflows/pages.yml` once repo Settings → Pages → Source is set to
"GitHub Actions". Point a custom domain at it later from the same settings page.

Later channel: **Setapp** (revenue share, large audience of Mac-utility buyers) once there are a few reviews.

## 5. Updates and crash reports (before 1.1)

- Add **Sparkle 2** (Swift Package `https://github.com/sparkle-project/Sparkle`) for in-app updates; host `appcast.xml` on GitHub Pages;
  the release workflow can append each DMG to it with `generate_appcast`.
- Crash reports: Sentry's macOS SDK, or simply ask users to attach `~/Library/Logs/DiagnosticReports/Vigil-*.ips` from the Diagnostics button.

## 5a. Beta testers

`docs/BETA.md` has who to recruit, the email to send, and what to check in each diagnostics report. Beta tags (`vigil-v1.0.0-beta.N`)
produce a pre-release with an unsigned DMG until the signing secrets exist.

## 6. Hardware validation checklist

Run on each machine, then Settings → General → *Save report to Desktop* (or `open -a Vigil --args -diagnostics`) and compare:

| Machine | Check |
|---|---|
| Apple Silicon laptop (M1/M2/M3/M4) | Temperatures grouped sensibly (CPU `Tp*/Te*/Tf*`, GPU `Tg*`), fans present with min/max, battery health within 1% of System Information, power draw plausible (5–60 W) |
| Intel MacBook | `TC0P`/`TC0D` CPU, `TG0P` GPU, fans via `fpe2`, battery `Amperage` sign correct while charging/discharging |
| Mac mini / Studio | No battery page clutter, fans present, SMC available |
| Any Mac on Wi-Fi | SSID appears after Location permission; RSSI/channel/band correct |
| Any Mac with Magic Mouse/Keyboard | Peripheral batteries listed |

Paste the report into an issue (or to Claude) when a value looks wrong; the sensor name → group mapping lives in `SMCProbe.group(for:)`.

What to compare the report against:

- **Battery**: System Information → Power (cycle count, condition, maximum capacity) and `pmset -g batt` (percent, time remaining).
  Vigil derives *Condition* itself: the power-source API says "Good" for any battery that is not failing, while System
  Information says "Service Recommended" below 80% maximum capacity, so Vigil applies the same 80% rule. The percentage itself is
  macOS's own "Maximum Capacity Percent", which powerd only hands to `pmset -g ps -xml` (the public IOPS snapshot omits it for
  unentitled apps); Vigil runs that once a minute. The live gauge values (`AppleRawMaxCapacity`, `NominalChargeCapacity`) swing
  2–3% with load and are the fallback only; they feed the mAh figures.
- **Cores**: `sysctl -a | grep perflevel` (`perflevel0` is Performance on Apple Silicon).
- **Wi-Fi**: System Information → Network → Wi-Fi (channel, width, PHY mode, security, signal/noise, transmit rate).
- **SMC**: the `SMC raw keys` section lists every `T*`/`F*`/`P*` key with its type and decoded value. The parameter struct
  must be exactly 80 bytes (the report prints it); any other size makes `AppleSMC` return `kIOReturnBadArgument` and the
  Temperatures page shows "No temperature sensors found" even though the SMC opened.

### Validated machines

| Machine | macOS | Result |
|---|---|---|
| MacBook Pro 16" 2021, M1 Max (MacBookPro18,2), 10 cores (8P+2E), 64 GB | 26.6.2 (25G83) | 2124 SMC keys, ~215 readable temperatures. CPU `Tp00–Tp0c` (30 sensors, hottest 78 °C under a build), `TC1x–TC5x`/`TCMz`; GPU `Tg04–Tg0T` (8); memory `Tm0x` (12); NAND `TH0a/TH0b/TH0x` 31 °C; battery `TB0T–TB2T` 32.6 °C (registry 30.6 °C); wireless `TW0P`; palm rest `Ts0P/Ts1P` 28–31 °C; airflow `TaLP/TaRF`. Two fans (`FNum`=2, `F0Ac`/`F1Ac` ~1500 rpm, max 5348/5776). `PSTR` 30–38 W on battery; no `PCPC`/`PGPC`, so CPU/GPU watts stay hidden. Battery 759 cycles of 1000, macOS maximum capacity 78% → Service Recommended, matching System Information (live raw max swung 6526–6760 mAh = 75–78% and nominal 6770–6953 mAh = 78–80% during the session, so neither is usable as the headline figure). Wi-Fi channel 48, 5 GHz, 80 MHz, 802.11ax, WPA2, −43/−90 dBm, 1200 Mbps. |

## 7. Website and store page copy (starter)

- Headline: **Your Mac, explained.**
- Sub: Live monitoring, a health score that tells you what to do, and a history that remembers what slowed you down.
- Three screenshots: Overview, Activity with a process explained, History with a selected moment.
- Price block: Free forever · Pro US$29 lifetime or US$12/year · 14-day trial · no account, nothing leaves your Mac.

## 8. App Store edition (optional, later)

A sandboxed "Vigil Lite" is possible with monitoring, explanations, health score and history only (sensor access needs
the `com.apple.security.temporary-exception.iokit-user-client-class` entitlement for `AppleSMCClient`, which Apple grants case by case).
It would be a separate target with its own bundle id and in-app purchase; cleanup, tweaks, startup control and admin tools cannot ship there.
