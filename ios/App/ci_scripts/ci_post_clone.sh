#!/bin/sh

set -e

echo "=== HeroKids Xcode Cloud Post-Clone ==="

# Node.js is pre-installed on Xcode Cloud - no brew install needed
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
pod install --repo-update

echo "=== Post-clone complete ==="
