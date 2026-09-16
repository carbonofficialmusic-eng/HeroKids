---
name: Shared-task approval display
description: Keep individual approval state separate from overall shared-task completion.
---

## Rule

For an individual-mode task assigned to multiple members, render each child’s card from that child’s own completion status. An approved child must see the green approved state even when another assigned member is still pending. Team-mode tasks instead follow collective approval.

**Why:** The server had correctly saved approvals, but the UI grouped “approved while others remain” together with “my completion is still pending.” This made successful approvals appear lost.

**How to apply:** Apply this only to individual assignment mode. Team mode keeps each contribution as submitted until everyone has contributed, then one parent decision approves or rejects the whole group.