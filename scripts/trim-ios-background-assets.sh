#!/bin/bash
# Remove large skin backgrounds from the locally bundled iOS web assets.
#
# Backgrounds remain in client/public/skins/backgrounds for the web server.
# The iOS app loads them on demand from /skins/backgrounds/{skinId}.png.

set -euo pipefail

IOS_PUBLIC_DIR="${1:-ios/App/App/public}"
BACKGROUND_DIR="$IOS_PUBLIC_DIR/skins/backgrounds"

if [ ! -d "$IOS_PUBLIC_DIR" ]; then
  echo "ERROR: iOS web asset directory not found: $IOS_PUBLIC_DIR"
  exit 1
fi

if [ -d "$BACKGROUND_DIR" ]; then
  BACKGROUND_SIZE="$(du -sh "$BACKGROUND_DIR" | cut -f1)"
  rm -rf "$BACKGROUND_DIR"
  echo "Removed iOS skin backgrounds ($BACKGROUND_SIZE) from $BACKGROUND_DIR"
else
  echo "No bundled iOS skin backgrounds found; nothing to remove."
fi

if [ -d "$IOS_PUBLIC_DIR/skins/avatars" ]; then
  AVATAR_COUNT="$(find "$IOS_PUBLIC_DIR/skins/avatars" -type f | wc -l | tr -d ' ')"
  echo "Keeping $AVATAR_COUNT bundled iOS avatar assets."
else
  echo "ERROR: Bundled iOS avatar directory not found: $IOS_PUBLIC_DIR/skins/avatars"
  exit 1
fi