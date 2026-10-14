# iOS build and GitHub synchronization

## Scope and safety

- The phone app lives in `artifacts/little-champs`.
- Its Xcode workspace is `artifacts/little-champs/ios/App/App.xcworkspace`.
- Its shared scheme is `App`; the archive configuration is `Release`.
- The bundle ID remains `app.herokids.com`.
- Keep `server.url = https://littlechamps.net` enabled for this online app.
  A native release must not silently switch to the locally bundled UI.
- TV is a separate artifact. Do not copy its output into the iOS app.
- Do not use the projects under `.migration-backup` or the ignored root-level
  generated `ios/` directory as the release source.

No GitHub push, forced history update, signing change, version increase,
App Store submission, database operation or publication is part of this preparation.

## Build locally on macOS

Prerequisites: Xcode, its command-line tools, Node 22, pnpm 10.26.1, CocoaPods.

From the repository root:

```sh
pnpm install --frozen-lockfile
pnpm run ios:prepare
open artifacts/little-champs/ios/App/App.xcworkspace
```

`ios:prepare` builds only the phone web app with its root base path, synchronizes
Capacitor from that app directory, installs Pods through Capacitor, applies the
existing skin-bundle policy and permissions, then checks the generated native
configuration and entry assets. It refuses to run on Linux rather than claiming
to have prepared an actual iOS archive.

To recheck generated resources without rebuilding:

```sh
pnpm run ios:check
```

This requires a completed Mac sync. Missing generated resources are an error,
not permission to reuse older files elsewhere in the repository.

## Xcode Cloud settings after the repository sync

In the existing Xcode Cloud workflow, select the actual intended source branch
and the workspace above. The workspace path changed during the multi-artifact
migration; existing workflow settings must be checked in Xcode/App Store Connect.
This cannot be inferred from the local Git branch.

Use the custom scripts beside the new Xcode project:

```text
artifacts/little-champs/ios/App/ci_scripts/ci_post_clone.sh
artifacts/little-champs/ios/App/ci_scripts/ci_pre_xcodebuild.sh
```

Post-clone pins Node/pnpm, installs the frozen workspace lockfile using the public
npm registry, and calls `ios:prepare`. Pre-build checks the generated resources
again before archiving. Do not use the old `npm ci` script from a legacy branch.
Do not use the root `pnpm build`, which also builds unrelated artifacts.

The workspace lockfile includes the macOS ARM64 and x64 binaries for esbuild,
Rollup and Lightning CSS. Linux-only dependency exclusions must not be reintroduced.

## Before pushing

1. Read the live GitHub `publish` and `main` heads; do not assume locally cached
   remote-tracking branches are current.
2. Compare the intended target with the local history and review the repository
   migration, not just the latest CSS changes. Preserve remote-only work.
3. Review tracked files for accidental generated assets, private configuration,
   backups and large binaries. Existing `.migration-backup` files are tracked;
   excluding or removing them is a separate reviewed cleanup, not automatic here.
4. Confirm which GitHub branch Xcode Cloud actually builds and whether a push to
   it triggers an archive or automatic TestFlight distribution.
5. Push only after approval. Use a normal, non-forced push. If the branch moved,
   stop and reconcile rather than overwriting it.

Replit publishing, GitHub synchronization and native App Store distribution are
separate operations. A current web deployment alone does not update a native
binary or synchronize the iOS repository.

## Verification boundaries

The native configuration/resource validator is covered by portable fixture tests:

```sh
node --test artifacts/little-champs/scripts/ios-build.test.mjs
```

Linux can verify those checks, the web build and shell syntax. Only macOS/Xcode
can verify Pods, signing and a real archive. The temporary settings diagnostics
must still be read in the installed iOS app to diagnose the actual layout issue.

During preparation, the actual `cap copy ios` step and subsequent resource check
were also run successfully on Linux. This verifies the copied phone assets and
generated online configuration, not the Mac-only CocoaPods/archive stages.
