#!/bin/bash
# Keep the web catalog on the server, never in the native application bundle.
# Icons and the independent local outage screen are deliberately untouched.
set -euo pipefail
SCRIPT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
IOS_PUBLIC_DIR="${1:-$PROJECT_ROOT/ios/App/App/public}"
if [ ! -d "$IOS_PUBLIC_DIR" ]; then
  echo "ERROR: iOS web asset directory not found: $IOS_PUBLIC_DIR"
  exit 1
fi
for category in avatars backgrounds; do
  directory="$IOS_PUBLIC_DIR/skins/$category"
  rm -rf "$directory"
  mkdir -p "$directory"
  test "$(find "$directory" -type f | wc -l | tr -d ' ')" -eq 0
done
echo "Removed all bundled skin avatars and backgrounds; skin media loads online."
