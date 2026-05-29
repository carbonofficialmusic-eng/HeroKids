---
name: Immediate task skipApprovedReset pattern
description: Every getMemberCompletionStatus call for immediate recurrence tasks must pass skipApprovedReset=true, in BOTH child and parent branches of GET /api/tasks.
---

## Rule
All `getMemberCompletionStatus(taskId, memberId, ...)` calls inside `GET /api/tasks` that handle multi-member tasks (sharedMemberIds or assignedMemberIds paths) must pass `skipApprovedReset = task.recurrence === 'immediate'` as the 4th argument.

## Why
For `immediate` recurrence tasks, `getMemberCompletionStatus` normally returns `null` after a member is approved (the "reset" behaviour for the next round). Without `skipApprovedReset=true`, approved members appear as `null` → `hasCompleted: false` → outline badge (not blue) and progress counter shows 0/N instead of K/N.

## How to apply
- Child branch sharedMemberIds path (~line 1710): `const skipReset = task.recurrence === 'immediate'` → pass as arg ✓
- Child branch assignedMemberIds path: same ✓
- **Parent branch sharedMemberIds path (~line 1946): same fix required** ← was missing
- **Parent branch assignedMemberIds path (~line 1993): same fix required** ← was missing
- If any new path is added that calls getMemberCompletionStatus for multi-member tasks, always add this pattern.
