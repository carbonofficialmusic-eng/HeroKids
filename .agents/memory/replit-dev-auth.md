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
- `devTokenStore`: `Map<string, any>` holds `{ claims: { sub: userId }, authMethod: 'local' }`
- `createDevToken(user)` / `getDevTokenUser(token)` / `deleteDevToken(token)` helpers
- Login handler: when `isDev`, generates token, returns as `devToken` in response body
- `isAuthenticated` middleware: before the Bearer/device-token checks, reads `X-Dev-Token` header, looks up user in `devTokenStore`, sets `req.user`
- Logout handler: deletes token from store when `X-Dev-Token` header present

**Client:**
- `client/src/lib/queryClient.ts`: `getDevHeaders()` reads `__hk_dev_token` from localStorage, returns `{ "X-Dev-Token": token }` in DEV mode; added to both `apiRequest` and `getQueryFn` fetches
- `storeDevToken(token)` / `clearDevToken()` exported from queryClient
- `client/src/pages/landing.tsx` `onLogin`: if `result.devToken` exists, calls `storeDevToken()`
- `client/src/components/profile-menu.tsx` `handleLogout`: calls `clearDevToken()` before POST /api/auth/logout

**How to apply:** This is purely additive dev-only code. Production is not affected — `isDev` guards all token logic server-side, and `import.meta.env.DEV` guards client-side.
