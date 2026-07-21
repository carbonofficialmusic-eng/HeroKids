---
name: iOS IAP Spinner — Paywall was the real source
description: The indefinite spinner Apple kept seeing was in first-open-paywall.tsx, not pricing.tsx. Both files must skip RevenueCat init on iOS.
---

## The Rule
When removing RevenueCat / in-app purchase UI from iOS, check ALL components that call `initRevenueCat` — not just the obvious pricing page.

**Why:** `pricing.tsx` was fixed first (skipping RC init on iOS), but `first-open-paywall.tsx` also called `initRevenueCat` on iOS with a `Loader2` spinner tied to `rcLoading` — and had NO safety timeout. Apple kept seeing the spinner across two builds (50, 51) because the paywall was the real source.

**How to apply:** Search for all `initRevenueCat` call sites before declaring the spinner fixed. Also add an 8-second safety timeout wherever `rcLoading` drives visible UI, even on web.

## Files affected
- `client/src/pages/pricing.tsx` — condition changed to `if (isNativePlatform() || ...)` (skip on iOS)
- `client/src/components/first-open-paywall.tsx` — same condition fix + 8s safety timeout added for web + iOS upgrade button replaced with static "subscribe at herokids.app" text

## iOS strategy (as of Build 52)
- No RevenueCat initialization on iOS anywhere
- No in-app purchase buttons on iOS
- All subscription UI on iOS shows static text: "Abonniere unter herokids.app"
- IAP products deleted from App Store Connect
