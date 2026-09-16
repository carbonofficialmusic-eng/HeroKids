---
name: Collective team-task approval
description: Approval timing, card state, and point payout for team-mode tasks.
---

For a team task requiring parental approval, each participant submits separately and their card shows only “submitted.” No parent approval request is created until every assigned participant has submitted. The final submission creates exactly one collective approval request.

Approving that request approves every participant’s pending completion and awards the task’s full point value to every assigned participant. Rejecting it rejects the collective submission so no hidden approvals remain.

For a team task without parental approval, individual contributions must still remain unpaid until every assigned participant has submitted. The final contribution atomically approves all current team completions and awards the full task value to every participant together.

**Why:** Team mode represents one shared result. Separate decisions or immediate per-person payouts could complete and pay only part of the team before the shared work was complete.

**How to apply:** Keep per-member completion rows for progress, attribution, history, and points, but defer every team payout until the complete target member set has submitted. With approval, expose one collective approval item; without approval, release every team payout atomically after the final contribution. Do not apply this rule to individual assignment mode.