---
name: RevenueCat downgrade verification
description: Protect paid access from stale RevenueCat expiration and billing-issue events.
---

# RevenueCat downgrade verification

Never downgrade a family solely because an `EXPIRATION` or `BILLING_ISSUE`
webhook arrived. First read the current RevenueCat subscriber state and remove
access only when neither paid entitlement is currently active. If RevenueCat
cannot be reached, preserve the current tier and let the webhook retry.

**Why:** RevenueCat can deliver an expiry event for an older subscription after
a later purchase has already become active. Trusting the old event directly
turns a genuinely paid family into Free.

**How to apply:** Any new code path that removes a RevenueCat-backed paid tier
must verify the current entitlement first. Keep the app-start reconciliation so
a false `free/canceled` row repairs itself as soon as RevenueCat reports an
active entitlement.