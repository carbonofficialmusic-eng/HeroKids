# Threat Model

## Project Overview

HeroKids is a public production family-task app with a React/Vite frontend, an Express/TypeScript backend, PostgreSQL storage, WebSocket realtime updates, object storage for uploads, and email-based account flows. Primary users are parents and children inside a family, plus a separate high-privilege admin surface.

Production assumptions for this scan:
- `NODE_ENV` is `production`.
- The mockup sandbox is not deployed to production.
- Replit terminates TLS for deployed traffic.
- The deployed app is publicly reachable at `https://herokids.app`.

## Assets

- **Family account access** — parent accounts, child/device sessions, mobile JWTs, and admin credentials. Compromise lets an attacker act as a family member or administrator.
- **Private family data** — emails, names, avatars, family names, chat messages, tasks, rewards, goals, notifications, analytics, and device-link state. This is sensitive household data, especially because children are involved.
- **Authorization state** — role assignments, acting-as-member state, join codes, device-link codes, and subscription-tier entitlements. Broken enforcement here can let an attacker gain parent or admin powers.
- **Uploaded media** — avatars and task-proof photos stored in object storage. These uploads can reveal household activity and identity details.
- **Operational secrets** — session secret, JWT secret, admin password, database credentials, email-provider credentials, APNs credentials, and payment/webhook secrets.

## Trust Boundaries

- **Browser/mobile client to Express API** — all client input is untrusted and must be authenticated, authorized, and validated on the server.
- **Public to authenticated surface** — registration, login, password reset, verification, websocket connection setup, and any public payment callbacks sit on the outer edge of the app.
- **Authenticated member to parent/admin surface** — parents have family-management powers; admins have global powers across families. The server must never trust client-declared role or family context.
- **Server to PostgreSQL** — the API server has broad access to account, family, and task data; injection or broken scoping here would expose the whole dataset.
- **Server to object storage** — uploaded objects cross from untrusted client content into storage and later back to users through `/objects/...`.
- **Server to external services** — email delivery, APNs, payment providers, and any hosted integrations must be called with trusted configuration and verified inputs.
- **Dev-only to production boundary** — preview/dev helpers, tests, backup files, and mockup-sandbox artifacts are out of scope unless production reachability is proven.

## Scan Anchors

- Production entry points: `server/index.ts`, `server/routes.ts`, `server/replitAuth.ts`, `server/mobileAuth.ts`.
- High-risk code areas: `server/routes.ts` (large mixed route surface), admin routes in `server/routes.ts` plus `server/admin*Routes.ts`, object storage in `server/objectStorage.ts`, realtime delivery in `server/websocket.ts` and `client/src/hooks/useWebSocket.ts`.
- Public/authenticated/admin boundaries: public auth routes in `server/replitAuth.ts`; family/member/task/reward routes in `server/routes.ts`; admin routes under `/api/admin/*`.
- Usually ignore unless production reachability is shown: `artifacts/mockup-sandbox/`, tests, `*.bak`, and local preview-only flows.

## Threat Categories

### Spoofing

HeroKids supports several session types: browser sessions, device-linked sessions, and mobile JWTs. The app must prove who a caller is before letting them act as a family member, join a realtime family channel, refresh mobile auth, or access the admin surface. Family identity, role, and room subscription state must come from trusted server-side data, not from client-supplied values.

Required guarantees:
- Protected API routes MUST require a valid session or token.
- Realtime subscriptions MUST bind to the authenticated family, not a client-declared family name.
- Admin access MUST use a strong authentication mechanism resistant to online guessing.

### Tampering

Parents and children send task, reward, family-goal, chat, upload, and settings data from untrusted clients. The server must enforce family scoping, role checks, and business rules itself. Invitation and linking flows are especially sensitive because they change who belongs to a family and what privileges they get.

Required guarantees:
- The server MUST derive family membership and effective role from trusted records.
- Invitation/join flows MUST not let the client grant itself extra privileges.
- Upload finalization MUST only attach objects that belong to the authenticated user or member.

### Information Disclosure

The app handles private household data, including children’s activity, chat content, reward history, family goals, and account emails. Realtime delivery, admin APIs, object access, and logs are the main places where data could leak.

Required guarantees:
- Family data MUST only be returned or broadcast to the correct family.
- Admin-only datasets MUST never be reachable from regular member flows.
- Sensitive secrets and credentials MUST not appear in client responses or logs.

### Denial of Service

Public entry points like login, registration, password reset, join flows, websocket setup, and admin login can be abused for brute force, spam, or resource exhaustion. The highest-risk routes are those tied to account takeover or privileged access.

Required guarantees:
- High-value public endpoints MUST have effective rate limiting or equivalent abuse controls.
- Reusable invitation and admin-auth flows MUST resist repeated online guessing.
- Resource-heavy actions should not be triggerable at unbounded volume by unauthenticated or low-trust callers.

### Elevation of Privilege

The biggest risks in this app are cross-family access and role escalation: a user should never become a parent, admin, or another family’s subscriber just by changing a request field or naming a different family. Acting-as-member flows, join flows, admin authentication, and websocket subscriptions are key checks here.

Required guarantees:
- A user MUST only act within their own family unless a tightly scoped server-side admin path allows otherwise.
- Role changes MUST be granted only by trusted server-side policy, never by client choice alone.
- Global admin powers MUST not depend on a weak, reusable secret with no online attack protections.
