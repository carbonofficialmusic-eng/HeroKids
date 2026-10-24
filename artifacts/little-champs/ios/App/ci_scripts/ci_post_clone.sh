#!/bin/sh
set -eu

echo "=== Little Champs: monorepo iOS preparation ==="
: "${CI_PRIMARY_REPOSITORY_PATH:?Xcode Cloud repository path is missing}"
cd "$CI_PRIMARY_REPOSITORY_PATH"

if [ ! -f pnpm-lock.yaml ] || [ ! -f artifacts/little-champs/capacitor.config.ts ]; then
  echo "ERROR: This workflow requires the current multi-artifact repository, not the legacy branch."
  exit 1
fi

export HOMEBREW_NO_AUTO_UPDATE=1
if ! brew list node@22 > /dev/null 2>&1; then
  brew install node@22
fi
export PATH="$(brew --prefix node@22)/bin:$PATH"
case "$(node --version)" in
  v22.*) ;;
  *) echo "ERROR: Node 22 is required for Capacitor 8."; exit 1 ;;
esac

# Use the exact pnpm release declared by the repository; do not use npm ci.
PNPM_VERSION="$(node -p "require('./package.json').packageManager.split('@')[1]")"
if ! command -v pnpm > /dev/null 2>&1 || [ "$(pnpm --version)" != "$PNPM_VERSION" ]; then
  npm install --global "pnpm@$PNPM_VERSION" --registry=https://registry.npmjs.org/
fi
node --version
pnpm --version

command -v pod > /dev/null 2>&1 || { echo "ERROR: CocoaPods is not installed."; exit 1; }
pnpm install --frozen-lockfile --registry=https://registry.npmjs.org/

# Builds only the phone artifact, syncs its own iOS project, runs CocoaPods
# through Capacitor, trims skin assets and verifies the generated configuration.
pnpm run ios:prepare
echo "=== Phone iOS preparation complete; no TV/API build or database changes ==="
