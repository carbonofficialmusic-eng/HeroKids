#!/bin/bash
# Single command to sync the iOS build and apply required permissions.
#
# Use this INSTEAD of `npx cap sync ios` to ensure camera permissions are
# always present in Info.plist after each sync.
#
# From the workspace root on a Mac: pnpm run ios:prepare
# This helper always resolves paths relative to the phone app, not the caller.

set -e
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
APP_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$APP_DIR"

if [ ! -f capacitor.config.ts ] || [ ! -f ios/App/App.xcodeproj/project.pbxproj ] || [ ! -f dist/public/index.html ]; then
  echo "ERROR: Phone app configuration, iOS project or web build is missing."
  echo "Run pnpm run ios:prepare from the workspace root."
  exit 1
fi

echo "==> Syncing Capacitor iOS..."
# Capacitor does not remove files that disappeared from the previous web build.
# Clear the generated folder first so old bundled backgrounds cannot survive.
rm -rf ios/App/App/public
pnpm exec cap sync ios

echo ""
echo "==> Keeping only the starter skin avatar and background in the local iOS bundle..."
bash "$SCRIPT_DIR/trim-ios-background-assets.sh"

INFO_PLIST="ios/App/App/Info.plist"

if [ ! -f "$INFO_PLIST" ]; then
  echo ""
  echo "ERROR: $INFO_PLIST not found after sync."
  echo "Run 'pnpm exec cap add ios' from $APP_DIR first, then re-run this script."
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
echo "    cd \"$APP_DIR\" && pnpm exec cap open ios"
