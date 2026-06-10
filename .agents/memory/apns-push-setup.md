---
name: APNs Push Notification Setup
description: How iOS push notifications are implemented in HeroKids — APNs JWT auth, device token storage, and trigger points.
---

# APNs Push Notification Setup

**Why:** Parents need to know when a child submits a task. Children should be notified when approved/rejected. Native iOS push via APNs (no third-party service).

**How to apply:** When adding new push notification triggers, follow the same pattern as task_pending in routes.ts — fetch tokens for target members, call sendPushToMembers, wrap in try/catch so push failures never break the API response.

## Architecture

- `server/apns.ts` — JWT-based APNs HTTP/2 call using Node's built-in `https`. Caches JWT for 50 min (APNs tokens expire after 1 hour). Uses `api.push.apple.com` (production — covers TestFlight too).
- `device_push_tokens` table — stores memberId + token + platform, unique constraint on (memberId, token).
- `server/storage.ts` — `upsertDevicePushToken`, `removeDevicePushToken`, `getDevicePushTokensForMember`, `getDevicePushTokensForMembers`.
- `POST /api/device-tokens/register` — called by iOS app on startup to store token.
- `POST /api/device-tokens/unregister` — called on logout.

## Secrets required
- `APNS_KEY_ID` — 10-char key ID (DQT69WC98R)
- `APNS_TEAM_ID` — 10-char team ID (L834576FM4)
- `APNS_BUNDLE_ID` — com.herokids.app
- `APNS_PRIVATE_KEY` — full .p8 file contents including BEGIN/END lines

## Trigger points (routes.ts)
- `task_pending` → push to all parents (excl. self)
- `task_approved` → push to child who submitted
- `task_rejected` → push to child who submitted

## Client side
- `client/src/hooks/usePushNotifications.ts` — requests permission, registers with APNs, POSTs token to `/api/device-tokens/register`.
- Called in `Router()` in App.tsx with `usePushNotifications(isAuthenticated)`.
- Uses `@capacitor/push-notifications` (dynamic import — no-ops on web).
