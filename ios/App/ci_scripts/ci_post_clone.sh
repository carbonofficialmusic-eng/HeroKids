#!/bin/sh

set -e

echo "=== HeroKids Xcode Cloud Post-Clone ==="

# Install Node.js - skip Homebrew auto-update to keep it fast
export HOMEBREW_NO_AUTO_UPDATE=1
brew install node

node --version
npm --version

# Navigate to repo root (ci_scripts is in ios/App/ci_scripts)
cd "$CI_PRIMARY_REPOSITORY_PATH"

echo "Installing npm dependencies..."
npm ci

echo "Building web assets..."
npm run build

echo "Syncing Capacitor..."
npx cap sync ios

echo "Installing CocoaPods dependencies..."
cd ios/App
pod install

echo "=== Post-clone complete ==="
