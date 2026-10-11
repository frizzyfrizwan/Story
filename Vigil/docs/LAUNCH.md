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

## 2. Licence keys (once)

```
swift Tools/make-license.swift keygen
```

Paste the **public** hex into `LicenseVerifier.productionPublicKeyHex` (`Vigil/Services/LicenseManager.swift`) and commit.
Store the **private** hex only in your payment provider's secrets. Never commit it.

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

1. Create a product "Vigil Pro" with two variants: Lifetime (US$29) and Yearly (US$12/year). Optional: Family (3 Macs) US$49.
2. Fulfilment: on the `order_created` webhook, run `swift Tools/make-license.swift issue <private-hex> <email> lifetime|yearly`
   (a tiny serverless function or a script on a Mac mini) and email the key. Yearly keys embed an expiry a year out; renewals issue a new key.
3. Put the checkout URL in `LicenseSettings` (`Buy Vigil Pro…` currently opens `https://vigil.app/buy`).
4. Refund policy: 14 days, no questions. The trial already lets people try everything, so refunds stay rare.

Later channel: **Setapp** (revenue share, large audience of Mac-utility buyers) once there are a few reviews.

## 5. Updates and crash reports (before 1.1)

- Add **Sparkle 2** (Swift Package `https://github.com/sparkle-project/Sparkle`) for in-app updates; host `appcast.xml` on GitHub Pages;
  the release workflow can append each DMG to it with `generate_appcast`.
- Crash reports: Sentry's macOS SDK, or simply ask users to attach `~/Library/Logs/DiagnosticReports/Vigil-*.ips` from the Diagnostics button.

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

## 7. Website and store page copy (starter)

- Headline: **Your Mac, explained.**
- Sub: Live monitoring, a health score that tells you what to do, and a history that remembers what slowed you down.
- Three screenshots: Overview, Activity with a process explained, History with a selected moment.
- Price block: Free forever · Pro US$29 lifetime or US$12/year · 14-day trial · no account, nothing leaves your Mac.

## 8. App Store edition (optional, later)

A sandboxed "Vigil Lite" is possible with monitoring, explanations, health score and history only (sensor access needs
the `com.apple.security.temporary-exception.iokit-user-client-class` entitlement for `AppleSMCClient`, which Apple grants case by case).
It would be a separate target with its own bundle id and in-app purchase; cleanup, tweaks, startup control and admin tools cannot ship there.
