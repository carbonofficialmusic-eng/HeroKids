---
name: Skip CI Convention
description: How to commit with [skip ci] to avoid unnecessary Xcode Cloud builds for web-only changes
---

# Skip CI Convention

The user wants to avoid unnecessary Xcode Cloud builds. Every push to `main` triggers a build — but native builds are only needed when `ios/` or `capacitor.config.ts` actually changed.

## The Rule
- **Web/server-only change** → append `[skip ci]` to the commit message
- **iOS files changed** (`ios/` or `capacitor.config.ts`) → commit normally (no `[skip ci]`)

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

**Why:** `gitPush` manages GitHub OAuth; manual `git push` doesn't have those credentials. So always use `gitPush` for the push step — just make sure the commit is already made via ShellExec first.

## iOS files that require a real build
- Anything under `ios/`
- `capacitor.config.ts`
- `package.json` (if Capacitor plugin versions change)
