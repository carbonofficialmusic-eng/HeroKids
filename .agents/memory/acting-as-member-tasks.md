---
name: actingAsMemberId in member-scoped task endpoints
description: Task and appointment endpoints must consistently resolve a parent's acting-as child before filtering data.
---

## The Rule
Every member-scoped task or appointment endpoint must resolve a validated `actingAsMemberId` for non-device sessions before filtering visibility or completion state. The condition must be `req.user.authMethod !== "device"`, NOT `!req.user.authMethod`.

## Why
`!req.user.authMethod` evaluates to `false` for local email/password auth (where `authMethod = "local"`), so the override was silently skipped. Parents switching to child members always saw tasks through the parent's own completion status, causing shared tasks to appear locked for children.

An endpoint that resolves only the account-linked parent can leak appointments assigned to other children into a switched child view, even when the main task endpoint is correct.

## How to Apply
Any task, appointment, calendar, or completion handler that resolves the current member must use the shared acting-as semantics:
```javascript
if (req.session?.actingAsMemberId && req.user.authMethod !== "device") {
  const actingMember = await storage.getFamilyMemberById(req.session.actingAsMemberId);
  if (actingMember && actingMember.familyName === realMember.familyName) {
    member = actingMember;
  }
}
```
