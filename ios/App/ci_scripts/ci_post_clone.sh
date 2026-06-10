#!/bin/sh

set -e

echo "=== HeroKids Xcode Cloud Post-Clone ==="
echo "PATH: $PATH"

# Install Node.js if not already available
export HOMEBREW_NO_AUTO_UPDATE=1
if ! command -v node > /dev/null 2>&1; then
  echo "Node not found, installing via brew..."
  brew install node
else
  echo "Node already available: $(node --version)"
fi

node --version
npm --version

# Navigate to repo root (ci_scripts is in ios/App/ci_scripts)
cd "$CI_PRIMARY_REPOSITORY_PATH"
echo "Working directory: $(pwd)"

echo "Installing npm dependencies..."
npm ci --prefer-offline || npm ci

echo "Building web assets..."
npm run build

echo "Syncing Capacitor..."
npx cap sync ios

echo "Installing CocoaPods dependencies..."
cd ios/App
export HOMEBREW_NO_AUTO_UPDATE=1
pod install

echo "=== Post-clone complete ==="
