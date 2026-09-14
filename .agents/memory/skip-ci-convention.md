---
name: Skip CI Convention
description: How to commit with [skip ci] to avoid unnecessary Xcode Cloud builds for web-only changes
---

# Skip CI Convention

The user wants to avoid unnecessary Xcode Cloud builds. Every push can trigger a build. Xcode Cloud has already started a build despite `[skip ci]`, so the marker must not be treated as a reliable control.

## The Rule
- **Web/server-only change** → append `[skip ci]` to the commit message
- **iOS files changed** (`ios/` or `capacitor.config.ts`) → commit normally (no `[skip ci]`)
- **Operational guarantee:** `[skip ci]` documents intent but does not reliably suppress Xcode Cloud. Use Xcode Cloud workflow start conditions/file filters, temporarily disable the workflow, or cancel an unwanted build.

## How to apply in practice
`gitPush()` auto-commits and doesn't allow custom messages. Instead:

```bash
# 1. Stage changes
git add .

# 2. Check if any iOS files are staged
git diff --cached --name-only | grep -E '^ios/|^capacitor\.config'

# 3a. If no output (no iOS files) → commit with [skip ci]
git commit -m "fix: describe the change [skip ci]"

# 3b. If iOS files are listed → commit normally
git commit -m "fix: describe the change"

# 4. Push using gitPush() in CodeExecution (handles GitHub auth)
await gitPush({ branch: "main", provider: "github" });
```

**Why:** `gitPush` manages GitHub OAuth; manual `git push` doesn't have those credentials. Xcode Cloud behavior is controlled by its own workflow configuration and may ignore conventional commit markers.

## iOS files that require a real build
- Anything under `ios/`
- `capacitor.config.ts`
- `package.json` (if Capacitor plugin versions change)
