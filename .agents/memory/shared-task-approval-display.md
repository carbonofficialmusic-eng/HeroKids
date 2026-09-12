---
name: Shared-task approval display
description: Keep individual approval state separate from overall shared-task completion.
---

## Rule

For a task assigned to multiple members, render each child’s card from that child’s own completion status. An approved child must see the green approved state even when another assigned member is still pending.

**Why:** The server had correctly saved approvals, but the UI grouped “approved while others remain” together with “my completion is still pending.” This made successful approvals appear lost.

**How to apply:** Use the all-members-approved calculation only for overall group completion and reset behavior. Do not use it to replace an individual member’s approved state with a pending/submitted presentation.