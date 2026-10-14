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

For administrator-granted promotional entitlements, end the promotion in
RevenueCat before setting the family to Free. Verify again after revocation:
a paid store subscription may still be active underneath the promotion.

**Why:** A database-only Free reset is overwritten by the still-active
promotional entitlement, and blindly revoking a promo must not remove access
funded by a separate purchase.

**How to apply:** Confirm the active grant is promotional, revoke it via the
RevenueCat promotion-revocation API, then read subscriber state again. Only
write Free after RC confirms neither promotional nor paid access remains.

A successful HTTP response is not sufficient verification. Missing or malformed
subscriber/entitlement/subscription data must remain an unknown state, never an
empty confirmed entitlement set. Invalid unrelated metadata must not erase valid
future-expiry evidence.

**Why:** Normalizing malformed provider data to empty maps can revoke legitimate
paid access during cancellation sync, webhook handling, or promotion removal.

**How to apply:** Validate provider snapshots before destructive decisions,
including the reread after promotional revocation. Preserve access and return a
retryable failure if verification is inconclusive. Client-side purchase flags
alone are not server-verifiable proof of a paid subscription.