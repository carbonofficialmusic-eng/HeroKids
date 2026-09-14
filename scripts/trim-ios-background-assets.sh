#!/bin/bash
# Keep only the free starter avatar and background in the locally bundled iOS
# web assets.
#
# All assets remain in client/public/skins for the web server. The iOS app loads
# non-starter assets from littlechamps.net only after a skin card is revealed.

set -euo pipefail

IOS_PUBLIC_DIR="${1:-ios/App/App/public}"
BACKGROUND_DIR="$IOS_PUBLIC_DIR/skins/backgrounds"
AVATAR_DIR="$IOS_PUBLIC_DIR/skins/avatars"
SCRIPT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
STARTER_SKIN_ID="junior-champion"
STARTER_BACKGROUND="$PROJECT_ROOT/client/public/skins/backgrounds/$STARTER_SKIN_ID.png"
STARTER_AVATAR="$PROJECT_ROOT/client/public/skins/avatars/$STARTER_SKIN_ID.png"

if [ ! -d "$IOS_PUBLIC_DIR" ]; then
  echo "ERROR: iOS web asset directory not found: $IOS_PUBLIC_DIR"
  exit 1
fi

if [ ! -f "$STARTER_BACKGROUND" ]; then
  echo "ERROR: Starter background not found: $STARTER_BACKGROUND"
  exit 1
fi
if [ ! -f "$STARTER_AVATAR" ]; then
  echo "ERROR: Starter avatar not found: $STARTER_AVATAR"
  exit 1
fi

BACKGROUND_SIZE="0"
if [ -d "$BACKGROUND_DIR" ]; then
  BACKGROUND_SIZE="$(du -sh "$BACKGROUND_DIR" | cut -f1)"
fi
rm -rf "$BACKGROUND_DIR"
mkdir -p "$BACKGROUND_DIR"
cp "$STARTER_BACKGROUND" "$BACKGROUND_DIR/$STARTER_SKIN_ID.png"
echo "Replaced bundled iOS skin backgrounds ($BACKGROUND_SIZE) with starter background."

BACKGROUND_COUNT="$(find "$BACKGROUND_DIR" -type f | wc -l | tr -d ' ')"
if [ "$BACKGROUND_COUNT" -ne 1 ] || [ ! -f "$BACKGROUND_DIR/$STARTER_SKIN_ID.png" ]; then
  echo "ERROR: Expected exactly one bundled background: $STARTER_SKIN_ID.png"
  exit 1
fi
echo "Keeping bundled iOS background: $STARTER_SKIN_ID.png"

AVATAR_SIZE="0"
if [ -d "$AVATAR_DIR" ]; then
  AVATAR_SIZE="$(du -sh "$AVATAR_DIR" | cut -f1)"
fi
rm -rf "$AVATAR_DIR"
mkdir -p "$AVATAR_DIR"
cp "$STARTER_AVATAR" "$AVATAR_DIR/$STARTER_SKIN_ID.png"
echo "Replaced bundled iOS skin avatars ($AVATAR_SIZE) with starter avatar."

AVATAR_COUNT="$(find "$AVATAR_DIR" -type f | wc -l | tr -d ' ')"
if [ "$AVATAR_COUNT" -ne 1 ] || [ ! -f "$AVATAR_DIR/$STARTER_SKIN_ID.png" ]; then
  echo "ERROR: Expected exactly one bundled avatar: $STARTER_SKIN_ID.png"
  exit 1
fi
echo "Keeping bundled iOS avatar: $STARTER_SKIN_ID.png"