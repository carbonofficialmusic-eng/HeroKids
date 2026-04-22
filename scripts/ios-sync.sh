#!/bin/bash
# Single command to sync the iOS build and apply required permissions.
#
# Use this INSTEAD of `npx cap sync ios` to ensure camera permissions are
# always present in Info.plist after each sync.
#
# Usage (run from the project root on your Mac):
#   chmod +x scripts/ios-sync.sh
#   ./scripts/ios-sync.sh
#
# First-time setup (if ios/ folder does not exist yet):
#   npx cap add ios
#   ./scripts/ios-sync.sh

set -e

echo "==> Syncing Capacitor iOS..."
npx cap sync ios

INFO_PLIST="ios/App/App/Info.plist"

if [ ! -f "$INFO_PLIST" ]; then
  echo ""
  echo "ERROR: $INFO_PLIST not found after sync."
  echo "Run 'npx cap add ios' first, then re-run this script."
  exit 1
fi

echo ""
echo "==> Applying required iOS camera permissions to $INFO_PLIST..."

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

echo ""
echo "==> Done. Open Xcode and build the app:"
echo "    npx cap open ios"
