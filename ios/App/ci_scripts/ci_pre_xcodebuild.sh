#!/bin/sh

set -e

echo "=== HeroKids Xcode Cloud Pre-Build ==="

# Install Node.js via Homebrew (Xcode Cloud has Homebrew)
brew install node || true

# Navigate to repo root (ci_scripts is in ios/App/ci_scripts)
cd "$CI_PRIMARY_REPOSITORY_PATH"

echo "Installing npm dependencies..."
npm ci

echo "Building web assets..."
npm run build

echo "Syncing Capacitor..."
npx cap sync ios

echo "=== Pre-build complete ==="
