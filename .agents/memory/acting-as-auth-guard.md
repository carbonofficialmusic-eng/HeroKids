---
name: Acting-As Member Auth Guard
description: The actingAsMemberId session check in /api/tasks must use !== "device", not !authMethod — using !authMethod silently breaks parent-switches-to-child for all browser/dev-token sessions.
---

## Rule
In `server/routes.ts`, the guard for applying `actingAsMemberId` must be:

```javascript
if (req.session?.actingAsMemberId && req.user.authMethod !== "device") {
```

**Not:**
```javascript
if (req.session?.actingAsMemberId && !req.user.authMethod) {
```

## Why
`req.user.authMethod` is set (truthy) for dev-token sessions (Replit preview) and potentially other auth methods. Using `!authMethod` blocks ALL of those from ever applying the acting-as-member override, so parents who switch to a child profile are silently served their own (parent) task list — the child dashboard appears to work but shows the wrong data.

The intent of the guard is only to block **device-linked sessions** (where `authMethod === "device"`), not all non-standard auth methods.

## How to Apply
Any time you add a new route or endpoint that reads `req.session.actingAsMemberId`, use `req.user.authMethod !== "device"` as the guard condition. Never use `!req.user.authMethod`.
