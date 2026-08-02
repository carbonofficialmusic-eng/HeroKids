---
name: iOS IAP Downgrade & Cancel Flow
description: Fixes required to make Apple subscription downgrades (FamilyPro→Family) and cancellations reflect immediately in the app.
---

# iOS IAP Downgrade & Cancellation Flow

## Key Rules

**Why:** Apple's subscription system differs from Stripe in several important ways that caused every downgrade/cancel to silently fail until all of these were fixed.

### 1 — RC REST API lags after a fresh StoreKit purchase
After `purchaseRCStoreProduct()` confirms a purchase, the RC REST API (`/v1/subscribers/...`) may not yet reflect the new entitlement. The server must retry up to 3× with ~2 s gaps before giving up.
**Where:** `server/routes.ts` → `/api/revenuecat-sync` — `fetchRCSubscriber` retry loop.

### 2 — Apple scheduled downgrade: entitlement is never immediately active
When downgrading FamilyPro → Family, Apple does NOT activate the `family` entitlement immediately — it schedules the switch for the next billing period. RC will never show `family` as active right after purchase. Instead, accept the claim when FamilyPro subscription has `unsubscribe_detected_at` set (Fallback B).
**Where:** `server/routes.ts` → `/api/revenuecat-sync` — Fallback B block.

### 3 — Client cancel-sync must always call the server
The client was gated on `if (!tier)` (no active entitlement at all), which meant it never ran when FamilyPro was cancelled-but-not-expired (entitlement still active, `unsubscribe_detected_at` set). Remove the client gate — let the server decide via the RC REST API check.
**Where:** `client/src/pages/pricing.tsx` and `client/src/App.tsx` cancel-sync useEffects.

### 4 — RC webhook: handle CANCELLATION and PRODUCT_CHANGE
- `CANCELLATION` → immediately set DB to free/canceled (same as EXPIRATION).
- `PRODUCT_CHANGE` → fires when Apple's scheduled downgrade actually takes effect; update DB to new tier.
Both were missing and caused DB to stay on old tier.
**Where:** `server/routes.ts` → `/api/revenuecat-webhook` switch statement.

### 5 — `window.open("itms-apps://...", "_system")` hangs WKWebView
Cordova convention `_system` does not work in Capacitor. WKWebView tries to navigate to the URL and shows a blank "Laden..." screen. Use `CapApp.openUrl({ url })` from `@capacitor/app` instead.
**Where:** `client/src/pages/pricing.tsx` — cancel subscription button onClick.

### 6 — iOS/Web branch split in pricing.tsx
The pricing page has a `isNativePlatform() ? (iOS branch) : (Web branch)` ternary. Any iOS-specific UI (cancel button, RC purchase buttons) must be placed inside the iOS branch. Easy to accidentally insert code into the wrong branch.

## How to apply
- Any new IAP server endpoint that verifies an entitlement must include the retry loop and both fallbacks (subscription record + FamilyPro-cancelled).
- Any new link/button that opens a system URL on iOS must use `CapApp.openUrl()`.
- When adding UI to the pricing page, always confirm which ternary branch you are editing.
