#!/bin/sh

set -e

echo "=== HeroKids Xcode Cloud Post-Clone ==="

# Capacitor 8 requires Node.js 22 or newer. Pin Xcode Cloud to Node 22 so a
# preinstalled older/newer Homebrew default cannot change the build behavior.
export HOMEBREW_NO_AUTO_UPDATE=1
if ! brew list node@22 > /dev/null 2>&1; then
  echo "Installing Node 22 via Homebrew..."
  brew install node@22
fi
export PATH="$(brew --prefix node@22)/bin:$PATH"

node --version
npm --version

case "$(node --version)" in
  v22.*) ;;
  *)
    echo "ERROR: Capacitor 8 requires Node 22 in this Xcode Cloud workflow."
    exit 1
    ;;
esac

# Navigate to repo root
cd "$CI_PRIMARY_REPOSITORY_PATH"
echo "Working directory: $(pwd)"

# Replace Replit's internal package firewall with public npm registry
# package-lock.json resolved URLs point to package-firewall.replit.local
echo "Patching package-lock.json registry URLs..."
sed -i '' 's|https://package-firewall.replit.local/npm/|https://registry.npmjs.org/|g' package-lock.json
sed -i '' 's|http://package-firewall.replit.local/npm/|https://registry.npmjs.org/|g' package-lock.json
sed -i '' 's|https://package-firewall.replit.internal/npm/|https://registry.npmjs.org/|g' package-lock.json
sed -i '' 's|http://package-firewall.replit.internal/npm/|https://registry.npmjs.org/|g' package-lock.json

echo "Installing npm dependencies..."
npm ci

echo "Building web assets..."
npm run build

echo "Syncing Capacitor..."
bash ./scripts/ios-sync.sh

# Restore app icon and splash screen after cap sync (which overwrites them with defaults)
echo "Restoring app icon and splash screen..."
git checkout -- ios/App/App/Assets.xcassets/AppIcon.appiconset/
git checkout -- ios/App/App/Assets.xcassets/Splash.imageset/

echo "Installing CocoaPods dependencies..."
cd ios/App

# Add the GitHub-based trunk repo explicitly (avoids CDN SSL issues in Xcode Cloud)
pod repo add trunk https://github.com/CocoaPods/Specs.git 2>/dev/null || pod repo update trunk 2>/dev/null || true

# Retry pod install up to 3 times in case of transient network issues
for attempt in 1 2 3; do
  echo "pod install attempt $attempt..."
  if pod install --repo-update; then
    echo "pod install succeeded on attempt $attempt"
    break
  fi
  if [ "$attempt" -eq 3 ]; then
    echo "pod install failed after 3 attempts"
    exit 1
  fi
  echo "Retrying in 10 seconds..."
  sleep 10
done

echo "=== Post-clone complete ==="
