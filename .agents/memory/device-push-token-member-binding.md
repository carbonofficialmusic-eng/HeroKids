---
name: Device push token must be bound to one member at a time
description: Why the same physical device received multiple copies of one family-wide push notification.
---

**Rule:** `device_push_tokens` uniqueness is only `(memberId, token)`. If a device is used to log into several family member profiles over time (parent testing as different children, shared family iPad, etc.), the same APNs token can end up stored under multiple member rows. Any push sent to "all family members" (e.g. pinboard posts) then delivers once per member row that shares that token — the user sees N duplicate notifications on one phone.

**Why:** Token registration (`upsertDevicePushToken`) only upserted for the current member and never removed the token from other members. A full-page reload on member switch (before the client-side-navigation fix) re-ran the push registration effect each time, re-associating the device's token with whichever member was active at that moment, without cleaning up the old association.

**How to apply:** `upsertDevicePushToken` must delete the token from every other member before inserting/updating it for the current member — a physical device can only be "logged in" as one member at a time. Also dedup by token (not just by row) when fetching tokens for a set of recipient member IDs, as defense in depth. For already-affected production data, run a one-time idempotent cleanup (keep the most recently updated row per token, drop the rest) at server startup rather than a manual prod migration.
