#!/bin/bash
# Run this on your Mac AFTER running: npx cap add ios && npx cap sync ios
#
# Adds the required iOS camera/photo permission strings to Info.plist.
# Without these entries Apple rejects the build and the app crashes when
# a child tries to take a task-proof photo.
#
# Usage:
#   chmod +x scripts/ios-post-sync.sh
#   ./scripts/ios-post-sync.sh

set -e

INFO_PLIST="ios/App/App/Info.plist"

if [ ! -f "$INFO_PLIST" ]; then
  echo "ERROR: $INFO_PLIST not found."
  echo "Run the following first:"
  echo "  npx cap add ios"
  echo "  npx cap sync ios"
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
