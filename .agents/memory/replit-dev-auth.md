---
name: Replit Dev Auth Fix
description: Why cookies fail in Replit's embedded preview iframe and how the dev token workaround solves it
---

## The Problem
Chrome blocks cookies in cross-site iframe contexts. The Replit workspace embeds the preview in an iframe on `replit.com`, while the app runs on `*.replit.dev`. Even with `SameSite=None; Secure`, Chrome's third-party cookie restrictions prevented `Cookie` header from being sent on subsequent requests after login — `req.headers.cookie` was always `undefined`.

**Why:** `SameSite=None` alone is not enough when Chrome's Privacy Sandbox / third-party cookie deprecation is active in embedded iframe contexts.

## The Fix (server/replitAuth.ts + client)

**Server (dev only):**
- `isDev` exported constant: `process.env.NODE_ENV !== "production"`
- `devTokenStore` keeps active entries in memory, but persists only hashed token keys, user IDs, acting-member IDs, and expirations to a private `/tmp` file so backend hot reloads do not invalidate the preview login.
- `createDevToken(user)` / `getDevTokenUser(token)` / `deleteDevToken(token)` helpers
- Login handler: when `isDev`, generates token, returns as `devToken` in response body
- `isAuthenticated` middleware: before the Bearer/device-token checks, reads `X-Dev-Token` header, looks up user in `devTokenStore`, sets `req.user`
- Logout handler: deletes token from store when `X-Dev-Token` header present

**Client:**
- `client/src/lib/queryClient.ts`: `getDevHeaders()` reads `__hk_dev_token` from localStorage, returns `{ "X-Dev-Token": token }` in DEV mode; added to both `apiRequest` and `getQueryFn` fetches
- `storeDevToken(token)` / `clearDevToken()` exported from queryClient
- `client/src/pages/landing.tsx` `onLogin`: if `result.devToken` exists, calls `storeDevToken()`
- `client/src/components/profile-menu.tsx` `handleLogout`: calls `clearDevToken()` before POST /api/auth/logout

## Development session durability

Development cookie sessions must survive API workflow restarts in a session table isolated from production sessions. Keep the dev-token fallback for embedded previews where cookies are blocked; persistent cookies alone do not replace it.

**Why:** In the iOS Replit preview, an API restart discarded the in-memory development cookie session. The interface could still show a cached family member while every protected request, including member switching, returned `Unauthorized` before PIN validation.

**How to apply:** When changing development authentication, preserve restart-safe, isolated session storage and have the frontend recheck the actual auth endpoint on a generic 401 rather than treating a cached user as proof of a live session. Do not log out for an incorrect PIN.

When bundling `connect-pg-simple` for an isolated development session table, include its table template alongside the bundle and give the development table its own primary-key and expiry-index names.

**Why:** The bundled library resolves the template relative to the built output, not its package directory. Its stock index name also conflicts with the existing session table because PostgreSQL index names are schema-wide; this made authenticated requests fail intermittently with 500 responses.

**How to apply:** Keep the development session template and its constraint/index names isolated whenever changing the backend build or session-store configuration. Confirm an authenticated request still works after restarting the built server.

**How to apply:** This is purely additive dev-only code. Production is not affected — `isDev` guards all token logic server-side, and `import.meta.env.DEV` guards client-side. Any future development-token state required across requests must survive backend hot reloads; never persist raw token values.
