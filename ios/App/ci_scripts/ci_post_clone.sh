#!/bin/sh

set -e

echo "=== HeroKids Xcode Cloud Post-Clone ==="

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

# Navigate to repo root
cd "$CI_PRIMARY_REPOSITORY_PATH"
echo "Working directory: $(pwd)"

# Replace Replit's internal package firewall with public npm registry
# package-lock.json resolved URLs point to package-firewall.replit.local
echo "Patching package-lock.json registry URLs..."
sed -i '' 's|https://package-firewall.replit.local/npm/|https://registry.npmjs.org/|g' package-lock.json
sed -i '' 's|http://package-firewall.replit.local/npm/|https://registry.npmjs.org/|g' package-lock.json

echo "Installing npm dependencies..."
npm ci

echo "Building web assets..."
npm run build

echo "Syncing Capacitor..."
npx cap sync ios

# Restore app icon and splash screen after cap sync (which overwrites them with defaults)
echo "Restoring app icon and splash screen..."
git checkout -- ios/App/App/Assets.xcassets/AppIcon.appiconset/
git checkout -- ios/App/App/Assets.xcassets/Splash.imageset/

echo "Installing CocoaPods dependencies..."
cd ios/App
pod install

echo "=== Post-clone complete ==="
