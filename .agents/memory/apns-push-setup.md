---
name: APNs Push Notification Setup
description: How iOS push notifications are implemented in HeroKids — APNs JWT auth, device token storage, and trigger points.
---

# APNs Push Notification Setup

**Why:** Parents need to know when a child submits a task. Children should be notified when approved/rejected. Native iOS push via APNs (no third-party service).

**How to apply:** When adding new push notification triggers, follow the same pattern as task_pending in routes.ts — fetch tokens for target members, call sendPushToMembers, wrap in try/catch so push failures never break the API response.

## Architecture

- `server/apns.ts` — JWT-based APNs call using Node's built-in `node:http2`. Never replace this with `https.request`: Apple's provider API requires HTTP/2. Caches JWT for 50 min and uses `api.push.apple.com` (production, including TestFlight).
- `device_push_tokens` table — stores memberId + token + platform, unique constraint on (memberId, token).
- `server/storage.ts` — `upsertDevicePushToken`, `removeDevicePushToken`, `getDevicePushTokensForMember`, `getDevicePushTokensForMembers`.
- `POST /api/device-tokens/register` — called by iOS app on startup to store token.
- `POST /api/device-tokens/unregister` — called on logout.

## Secrets required
- `APNS_KEY_ID` — Apple push key ID
- `APNS_TEAM_ID` — Apple developer team ID
- `APNS_BUNDLE_ID` — must exactly match the native app identifier `app.herokids.com`
- `APNS_PRIVATE_KEY` — full .p8 file contents including BEGIN/END lines

## Trigger points (routes.ts)
- `task_pending` → push to all parents (excl. self)
- `task_approved` → in-app notification only; no child push
- `task_rejected` → push to child who submitted

## Client side
- `client/src/hooks/usePushNotifications.ts` — requests permission, registers with APNs, POSTs token to `/api/device-tokens/register`.
- Called in `Router()` in App.tsx with `usePushNotifications(isAuthenticated)`.
- Uses `@capacitor/push-notifications` (dynamic import — no-ops on web).
- Capacitor v8 requires both APNs registration callbacks in `AppDelegate.swift`; they must post `.capacitorDidRegisterForRemoteNotifications` and `.capacitorDidFailToRegisterForRemoteNotifications` so the JavaScript listeners receive the result.
- Configure PushNotifications `presentationOptions` with badge, sound, banner, and list when notifications must remain visibly testable while the app is in the foreground.

## Native build handoff

**Rule:** The currently distributed native app contains working push support. Server-only APNs fixes should be published through Replit without pushing to the GitHub branch that triggers Xcode Cloud.

**Why:** Device registration and push receipt from the installed TestFlight app are confirmed in production. Additional native builds add delay and do not affect provider-side protocol, signing, delivery rules, or web settings.

**How to apply:** Publish backend changes in Replit, trigger a real task or chat event, and inspect APNs acceptance/rejection logs. Create a new native build only when native push registration code, entitlements, or capabilities change.

## Provider protocol requirement

**Rule:** APNs delivery must use a real HTTP/2 client and log the accepted/attempted count plus Apple's rejection reason without exposing device tokens.

**Why:** Device registration, trigger execution, and token lookup can all succeed while delivery fails if the provider request uses ordinary HTTP/1.1 HTTPS. The Apple `.p8` secret may also be stored as a one-line PEM; it must be reconstructed before OpenSSL can parse it. JWT ES256 signatures must use the 64-byte IEEE-P1363 representation, not OpenSSL's default DER representation.

**How to apply:** Keep APNs requests on `node:http2`, normalize multiline, escaped-newline, one-line PEM, and base64 PKCS#8 key formats, use IEEE-P1363 signing, treat non-200 responses as rejected deliveries, and retain per-type summaries.
