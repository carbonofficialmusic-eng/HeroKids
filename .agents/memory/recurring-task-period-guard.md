---
name: Period-blind hasActiveMemberCompletion bug
description: hasActiveMemberCompletion must be period-aware for recurring tasks or old completions block new-period submissions
---

## The Rule
`hasActiveMemberCompletion` in `storage.ts` must apply the same period-boundary logic as `getMemberCompletionStatus` and `getTaskCompletionStatusForFamily`.

## Why
For recurrenceDays / weekly / monthly / yearly tasks, `nextAvailableDate` marks the start of the new period. If `nextAvailableDate <= now`, a new period has started and completions from BEFORE that date must be ignored. Without this, a user's completion from a previous cycle still blocks them in the DB transaction even though the UI (correctly) shows the task as available again.

Symptoms: user sees yellow "+10" button (UI correctly identifies new period), clicks it, gets 422 "already completed" from the write guard.

## How to Apply
In `hasActiveMemberCompletion`:
1. Select `recurrenceDays` and `nextAvailableDate` from the task row (already done after the fix).
2. After handling immediate / daily / weekdays: check `isRecurring = recurrence !== 'none' || recurrenceDays != null`.
3. If `isRecurring && nextAvailableDate && new Date(nextAvailableDate) <= now` → add `gte(taskCompletions.completedAt, nextDate)` filter so only in-period completions count.
4. Otherwise fall through to the period-blind "any active completion" query (correct for tasks whose nextAvailableDate is still in the future).
