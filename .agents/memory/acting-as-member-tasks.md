---
name: actingAsMemberId Override in GET /api/tasks
description: The GET /api/tasks handler used wrong condition to apply actingAsMemberId, breaking child task view when a parent switches to a child member.
---

## The Rule
In `GET /api/tasks`, the condition to apply the actingAsMemberId override must be `req.user.authMethod !== "device"`, NOT `!req.user.authMethod`.

## Why
`!req.user.authMethod` evaluates to `false` for local email/password auth (where `authMethod = "local"`), so the override was silently skipped. Parents switching to child members always saw tasks through the parent's own completion status, causing shared tasks to appear locked for children.

Other endpoints (complete, approve, etc.) already use `!result.isDeviceSession` or `req.user.authMethod !== "device"` which work correctly.

## How to Apply
Any new handler in `GET /api/tasks` (or similar top-level task endpoints) that resolves the member must use:
```javascript
if (req.session?.actingAsMemberId && req.user.authMethod !== "device") {
  const actingMember = await storage.getFamilyMemberById(req.session.actingAsMemberId);
  if (actingMember && actingMember.familyName === realMember.familyName) {
    member = actingMember;
  }
}
```
