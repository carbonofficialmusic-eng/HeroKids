#!/bin/bash
# Legacy helper for an already completed Capacitor sync.
# Prefer scripts/ios-sync.sh for future syncs so stale generated files are
# removed before syncing and large backgrounds are excluded from the bundle.
#
# Adds the required iOS camera/photo permission strings to Info.plist.
# Without these entries Apple rejects the build and the app crashes when
# a child tries to take a task-proof photo.
#
# Usage:
#   chmod +x scripts/ios-post-sync.sh
#   ./scripts/ios-post-sync.sh

set -e
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR/.."

INFO_PLIST="ios/App/App/Info.plist"

if [ ! -f "$INFO_PLIST" ]; then
  echo "ERROR: $INFO_PLIST not found."
  echo "Run the following first:"
  echo "  pnpm exec cap add ios"
  echo "  pnpm exec cap sync ios"
  exit 1
fi

echo "Patching $INFO_PLIST with required camera permissions..."

if ! grep -q "NSCameraUsageDescription" "$INFO_PLIST"; then
  plutil -insert NSCameraUsageDescription \
    -string "HeroKids needs camera access so kids can take photos as proof of completing tasks." \
    "$INFO_PLIST"
  echo "  + NSCameraUsageDescription added"
else
  echo "  = NSCameraUsageDescription already present"
fi

if ! grep -q "NSPhotoLibraryUsageDescription" "$INFO_PLIST"; then
  plutil -insert NSPhotoLibraryUsageDescription \
    -string "HeroKids needs photo library access so kids can choose a photo as proof of completing tasks." \
    "$INFO_PLIST"
  echo "  + NSPhotoLibraryUsageDescription added"
else
  echo "  = NSPhotoLibraryUsageDescription already present"
fi

echo "Done. Open Xcode and build the app."

echo ""
echo "Removing all skin avatars and backgrounds from the local iOS bundle..."
bash "$SCRIPT_DIR/trim-ios-background-assets.sh"
