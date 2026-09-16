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

For a closed pre-release train, increase `MARKETING_VERSION`; changing `CURRENT_PROJECT_VERSION` only changes the internal build number and does not open a new App Store version.

**Why:** A build showing the session-proxy warning was initially mistaken for an Apple-side outage, but Apple had accepted the upload and rejected it because `MARKETING_VERSION` still matched the previously approved version.

**How to apply:** Before changing credentials, certificates, or provisioning, check for Apple's delivery email and compare `MARKETING_VERSION` with the last approved App Store version.
