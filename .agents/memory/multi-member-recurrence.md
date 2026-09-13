---
name: Multi-member recurrence boundaries
description: Non-obvious period rules for individual and team multi-member tasks.
---

Individual multi-member tasks must derive recurrence availability from each member's own latest completion. Never delay one assignee's next weekly, monthly, yearly, custom, or immediate occurrence until other assignees finish. Parent cards must also display that per-member boundary instead of relying on the task's global next-available date. Family-wide recurring tasks may derive a missing display boundary from their latest approved completion.

Team tasks use one shared period. When checking whether everyone contributed, include only completions from the current shared period. After a current-round rejection, the member's latest rejected status must supersede older approvals so a retry is allowed.

All multi-member tasks that predate the explicit individual/team choice belong to individual mode, regardless of their legacy shared-task flag. Convert that legacy representation exactly once; only a deliberate team selection made afterward may create a team task.

**Why:** A single global boundary for individual assignments can block active members indefinitely. Unscoped team completion queries can reuse old approvals, prematurely finish a new round, or block a rejected member's retry. Before team mode existed, the shared-task flag represented ordinary multi-assignment, so treating it as explicit teamwork changes existing families' behavior.

**How to apply:** Any completion, duplicate-prevention, status, reset, or migration change for multi-member tasks must preserve legacy tasks as individual, per-member boundaries in individual mode, and current-period filtering plus latest-status precedence in team mode.