# Prepared GitHub synchronization review

Read-only review on 2026-10-14 for `carbonofficialmusic-eng/HeroKids`.
No push or remote branch update was performed.

## Live source branches checked

| Branch | Last remote commit date | Role to confirm |
| --- | --- | --- |
| `publish` | 2026-09-19 | User-confirmed source branch for the iOS Xcode Cloud workflow |
| `main` | 2026-08-08 | Older source; not the user-confirmed iOS workflow branch |

The live `publish` head matched the locally cached remote-tracking reference.
At review time the local branch was 251 commits ahead and zero commits behind
that remote head. This does not authorize a push and must be rechecked immediately
before any actual push.

## Scope of the pending change

The committed comparison with remote `publish` spans about 3,000 paths, including
the multi-artifact migration. It is much larger than an isolated layout patch.
The local tree also tracks 1,636 files under `.migration-backup`.

No tracked files above 50 MiB or credential-like `.env`, `.p8`, `.p12`, or
`.mobileprovision` filenames were found by the initial filename/size checks.
This is **not** a content-based secret scan or a complete security audit.

The working-tree iOS preparation changes must also be reviewed and committed
before a later sync; they were not part of the 251-commit count.

## Required decisions before the actual push

- The user confirmed `publish` as the Xcode Cloud source branch; recheck live remote state before syncing.
- Confirm whether a push triggers an archive or automatic TestFlight delivery.
- Review the migration and tracked backups; do not silently delete them here.
- Select the new workspace path in Xcode Cloud as described in
  [the build guide](ios-build-and-github-sync.md).
- Use a normal, non-forced push only after approval and a fresh remote-head check.

The App Store version/build numbers and distribution settings were intentionally
not changed. A real signed archive remains a separate macOS/Xcode verification.

## Approved release selection

The user authorized synchronizing `publish` and excluding backups, generated
native output, test archives and unused uploads. Local files must remain intact.

The selected release therefore retains application sources, shared packages,
the canonical native Xcode project, build configuration, tests, public runtime
assets and the uploaded images actually imported by the applications. It omits
`.migration-backup`, the obsolete generated root `ios` tree, archive downloads
and unused files under `attached_assets`.

The direct Git HTTPS credential is unavailable in this environment. Synchronize
through the existing GitHub connection as a new release snapshot commit whose
parent is the checked live `publish` head, and update the ref with `force: false`.
This preserves GitHub history, but does not replay every local checkpoint commit.
Do not reset the local branch or delete local excluded files to make histories
look identical. Verify the resulting remote tree against the selected export.
