---
name: Ad-hoc TypeScript checks
description: How to run temporary database and integration checks with the project toolchain.
---

Run temporary `tsx` scripts from inside the workspace rather than `/tmp`.

**Why:** Scripts located in `/tmp` resolve as CommonJS and cannot find workspace packages reliably, even when invoked through the workspace's `tsx` binary.

**How to apply:** Create a short dot-prefixed script in the project root, run it with `npx tsx`, and remove it immediately after the check.