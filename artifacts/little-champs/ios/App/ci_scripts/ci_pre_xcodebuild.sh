#!/bin/sh

set -eu

echo "=== HeroKids Xcode Cloud Pre-Build ==="
: "${CI_PRIMARY_REPOSITORY_PATH:?Xcode Cloud repository path is missing}"
cd "$CI_PRIMARY_REPOSITORY_PATH"
export PATH="$(brew --prefix node@22)/bin:$PATH"
# Stop before archiving if preparation was skipped or used stale resources.
pnpm run ios:check
echo "=== Pre-build complete ==="
