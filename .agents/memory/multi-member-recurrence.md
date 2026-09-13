---
name: Multi-member recurrence boundaries
description: Non-obvious period rules for individual and team multi-member tasks.
---

Individual multi-member tasks must derive recurrence availability from each member's own latest completion. Never delay one assignee's next weekly, monthly, yearly, custom, or immediate occurrence until other assignees finish.

Team tasks use one shared period. When checking whether everyone contributed, include only completions from the current shared period. After a current-round rejection, the member's latest rejected status must supersede older approvals so a retry is allowed.

**Why:** A single global boundary for individual assignments can block active members indefinitely. Unscoped team completion queries can reuse old approvals, prematurely finish a new round, or block a rejected member's retry.

**How to apply:** Any completion, duplicate-prevention, status, or reset change for recurring multi-member tasks must preserve per-member boundaries in individual mode and current-period filtering plus latest-status precedence in team mode.