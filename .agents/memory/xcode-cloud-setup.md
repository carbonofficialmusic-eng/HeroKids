---
name: Xcode Cloud Setup Lessons
description: What's required for Xcode Cloud to successfully build, sign, and export a Capacitor/CocoaPods iOS app
---

## Required files in the repo

- `ios/App/App.xcworkspace/contents.xcworkspacedata` — MUST exist and reference both `App.xcodeproj` and `Pods/Pods.xcodeproj`. Without it xcodebuild says "platforms is empty" and fails.
- `ios/App/App.xcworkspace/xcshareddata/xcschemes/App.xcscheme` — scheme must be in the xcworkspace (not just xcodeproj) for Xcode Cloud to find it.
- `ios/App/ci_scripts/ci_post_clone.sh` — runs BEFORE resolvePackageDependencies. Must install Node, build web assets, cap sync, and pod install HERE (not in ci_pre_xcodebuild.sh which is too late).

## ci_post_clone.sh critical points

- Pin Node 22 with Homebrew (`node@22`) and prepend its bin directory to PATH; Capacitor 8 requires Node 22 and Xcode Cloud's preinstalled/default Node may differ.
- Patch both `package-firewall.replit.local` and `package-firewall.replit.internal` lockfile URLs before npm ci — neither Replit registry exists outside Replit.
- Run `pod install` (not `pod install --repo-update`) at end

## project.pbxproj required settings

- `DEVELOPMENT_TEAM = L834576FM4` — must be in BOTH Debug and Release target build configs or export fails with exit code 70
- `PRODUCT_BUNDLE_IDENTIFIER = app.herokids.com` — must match the App ID registered in the developer portal and the provisioning profile
- `IPHONEOS_DEPLOYMENT_TARGET = 15.0` — Capacitor requires 15.0 minimum

## Apple Developer Portal requirements

- An Apple Distribution certificate must exist (the "Distribution Managed (Xcode Cloud)" ones are internal to Xcode Cloud and can't be used for manual provisioning profiles)
- An App Store Connect provisioning profile for `app.herokids.com` must exist in the portal
- Create profile: developer.apple.com → Profiles → + → App Store Connect → select app ID → select certificate → generate

## Info.plist

- Add `<key>ITSAppUsesNonExemptEncryption</key><false/>` to skip the Export Compliance question for every future build (app only uses Apple's built-in HTTPS)

**Why:** Without each of these pieces, Xcode Cloud fails at different stages — scheme not found, platforms empty, npm registry unreachable, pod install not run, code signing exit 70.

For Push Notifications, keep all three native declarations aligned: the production `aps-environment` entitlement, `CODE_SIGN_ENTITLEMENTS` in Debug and Release, and `com.apple.Push` enabled under the target's `SystemCapabilities`.

## Distinguish export warnings from delivery rejection

If Xcode Cloud produces an App Store IPA and Apple sends an ITMS delivery email, the binary reached App Store Connect even when distribution logs also contain a `Session Proxy Provider` authentication warning. Treat Apple's ITMS message as the actionable failure.

A `Session Proxy Provider` message inside a file named `critical.log` is not sufficient evidence that export failed when the export command ends with `EXPORT SUCCEEDED`. Archive log ZIPs can include successful compilation and exports without the subsequent failed upload or TestFlight post-action.

For a closed pre-release train, increase `MARKETING_VERSION`; changing `CURRENT_PROJECT_VERSION` only changes the internal build number and does not open a new App Store version.

**Why:** A build showing the session-proxy warning was initially mistaken for an Apple-side outage, but Apple had accepted the upload and rejected it because `MARKETING_VERSION` still matched the previously approved version. The user explicitly reported that this versioning failure has recurred in this project.

**How to apply:** When a delivery failure recurs, compare `MARKETING_VERSION` with the approved App Store version early, particularly when the user mentions the known versioning issue. Then check terminal statuses and obtain the failed post-action log or Apple's delivery email as needed to confirm the exact rejection. Do not change credentials or provisioning based on the session-proxy warning alone, and do not infer successful overall delivery from a successful archive or export.

## Replit workspace versus the iOS release repository

The user confirmed that the iOS Xcode Cloud workflow builds the GitHub branch `publish`, not `main`, and that synchronizing that branch automatically starts a Cloud build.

**Why:** Repository branches held different source snapshots, so assuming `main` was the release source would update the wrong build input.

**How to apply:** Use `publish` as the confirmed iOS synchronization target unless the user changes the workflow. Still obtain approval for a push and warn about automatic builds; automatic TestFlight distribution remains a separate setting, not an established fact.

Moving the native workspace in Git does not update the workspace path stored in the existing Xcode Cloud workflow.

**Why:** After the approved multi-artifact synchronization, Cloud still passed the legacy root workspace path to `xcodebuild` and failed with exit 66, even though the new workspace was present on the correct remote branch.

**How to apply:** Update the workflow's project/workspace selection to the canonical phone artifact before retrying. Do not change the source branch, republish the website or reintroduce obsolete generated native output to address a Cloud workspace-selection error. If the UI does not expose this setting clearly, inspect the actual workflow editor rather than inventing a menu location.

Inspect the GitHub branch used for iOS separately from the current Replit workspace before diagnosing a native build or changing its CI.

**Why:** The Replit workspace was migrated to multiple artifacts, while the connected iOS release repository still had the legacy single-app structure. Its `main` and `publish` branches were different source snapshots. A root-based npm build can therefore be correct for that repository even though the same script is incompatible with the current pnpm workspace.

**How to apply:** Do not blindly push the workspace structure or rewrite Xcode CI to repair a web-only display issue. Check the relevant branch's Capacitor configuration and build scripts first. An enabled remote `server.url` means bundled web assets are not the normal startup surface; old bundled assets alone do not establish why a live layout is old. Checked-in configuration, locally generated configuration, and the actual shipped IPA remain distinct evidence.

When Safari and the installed app differ, compare them on the same device before recommending another deployment or assuming a native cache problem.

**Why:** The user confirmed that the current diagnostic UI and matching loaded/server build identifiers appeared in Safari on the same iPhone while the installed App Store app lacked that UI. A successful web publication does not establish the installed binary's loading configuration.

**How to apply:** Treat browser diagnostics as evidence about that browser only. Inspect the shipped native configuration or obtain diagnostics from a verified native build before choosing between local assets, another origin and native caching as the cause.

The user subsequently confirmed on the installed native app that it loads the online address `https://littlechamps.net`, reports identical loaded/server web identifiers, and displays the updated layouts.

**Why:** This is direct device evidence that the migrated iOS release pipeline produces an app loading the current remote UI. It does not establish why the earlier installed binary showed a different UI.

**How to apply:** Use the confirmed remote-loading behavior as the baseline for future web-only updates; do not assume every layout change requires a new native release. Native configuration, plugin or bundled-resource changes still require a native build. If divergence returns, compare diagnostics from the affected installed app rather than extrapolating from Safari or rebuilding without evidence.

## Cross-platform workspace dependencies

Keep the macOS optional native binaries for the web build tools available in the workspace lockfile, even when development runs on Linux.

**Why:** The multi-artifact template excluded Darwin dependencies repository-wide. Xcode Cloud must build the phone web app on macOS, so Linux-only success cannot establish that its dependency installation will work there.

**How to apply:** Review platform-removal overrides whenever changing pnpm configuration or regenerating the lockfile. Keep both Apple Silicon and Intel Mac builds possible. A portable Capacitor copy/resource check is useful, but must never be reported as a successful CocoaPods installation, signed Xcode archive or App Store delivery.

## Yellow custom-script warnings

A yellow Xcode Cloud custom-script step can still have completed successfully. Read its terminal status and warning text before recommending another build.

**Why:** Actual Cloud logs showed successful native resource preparation followed by a warning that a non-executable post-clone script had been run using `/bin/zsh`. Homebrew also warned about its support for the macOS image while continuing installation successfully.

**How to apply:** Track executable permissions for custom CI scripts on subsequent maintenance. Do not rebuild a completed archive solely to remove these warnings, and do not treat successful preparation as proof of successful signing or TestFlight delivery.

## Resource checks against actual production output

Before sending native packaging changes to Xcode Cloud, exercise portable resource validation against a real production web build, not only hand-written test fixtures.

**Why:** A valid dynamic bootstrap loaded the main stylesheet through JavaScript. Simplified fixtures linked CSS directly in HTML, hiding an incorrect validation assumption that stopped the Cloud build after synchronization had already succeeded.

**How to apply:** Include the production dependency graph when validating copied resources. Keep missing/stale-file checks strict, but do not assume the HTML alone lists every required stylesheet. A passing portable check still does not establish a successful macOS archive or signing.
