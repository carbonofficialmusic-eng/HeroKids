---
name: Period-blind hasActiveMemberCompletion bug
description: hasActiveMemberCompletion must be period-aware for recurring tasks or old completions block new-period submissions
---

## The Rule
`hasActiveMemberCompletion` in `storage.ts` must apply the same period-boundary logic as `getMemberCompletionStatus` and `getTaskCompletionStatusForFamily`.

Never classify `recurrence === "none"` by itself as a one-time task. A positive `recurrenceDays` value means it is a custom-interval recurring task. Completed custom-interval tasks must become active again after `nextAvailableDate`, and child-task filters must not hide them as completed one-time tasks.

When an edit changes a task's schedule, daily target, assignment mode, or selected members, treat the edited configuration as active. Schedule changes must also discard the old schedule lock so the new recurrence is not filtered using stale availability data. Title/description-only edits preserve lifecycle state.

## Why
For recurrenceDays / weekly / monthly / yearly tasks, `nextAvailableDate` marks the start of the new period. If `nextAvailableDate <= now`, a new period has started and completions from BEFORE that date must be ignored. Without this, a user's completion from a previous cycle still blocks them in the DB transaction even though the UI (correctly) shows the task as available again.

Symptoms: user sees yellow "+10" button (UI correctly identifies new period), clicks it, gets 422 "already completed" from the write guard.

Another symptom is that a task remains visible to parents but disappears completely from assigned children's dashboards after its first period.

Structural edits previously saved the new settings while retaining an old completed status or `nextAvailableDate`, producing correct-looking parent data but stale child visibility.

## How to Apply
In `hasActiveMemberCompletion`:
1. Select `recurrenceDays` and `nextAvailableDate` from the task row (already done after the fix).
2. After handling immediate / daily / weekdays: check `isRecurring = recurrence !== 'none' || recurrenceDays != null`.
3. If `isRecurring && nextAvailableDate && new Date(nextAvailableDate) <= now` → add `gte(taskCompletions.completedAt, nextDate)` filter so only in-period completions count.
4. Otherwise fall through to the period-blind "any active completion" query (correct for tasks whose nextAvailableDate is still in the future).
