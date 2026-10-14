#!/usr/bin/env bash
set -euo pipefail

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ROOT_DIR="$(cd "$APP_DIR/../.." && pwd)"
API_ORIGIN="${VITE_TV_API_ORIGIN:-}"
RELEASE="${TV_RELEASE:-0}"
LOCAL_PACKAGER="$APP_DIR/node_modules/.bin/ares-package"

if [[ ! "$API_ORIGIN" =~ ^https://[a-zA-Z0-9.-]+(:[0-9]+)?$ ]]; then
  echo "Set VITE_TV_API_ORIGIN to a reachable HTTPS origin of Little Champs (without a path)." >&2
  exit 1
fi

if [[ "$RELEASE" == 1 ]]; then
  if [[ "$API_ORIGIN" == *".replit.dev"* || "$API_ORIGIN" == *"localhost"* || "$API_ORIGIN" == *"127.0.0.1"* ]]; then
    echo "Release packages must use the verified production HTTPS origin, not a development server." >&2
    exit 1
  fi
  if [[ ! -x "$LOCAL_PACKAGER" ]] && ! command -v ares-package >/dev/null 2>&1; then
    echo "Release packages require the official @webos-tools/cli packager; the development fallback is not allowed." >&2
    exit 1
  fi
fi

cd "$ROOT_DIR"
PORT=18658 BASE_PATH=./ TV_PACKAGE=webos VITE_TV_PACKAGED=1 VITE_TV_API_ORIGIN="$API_ORIGIN" \
  pnpm --filter @workspace/little-champs-tv run build

STAGE="$APP_DIR/dist/webos-stage"
rm -rf "$STAGE"
mkdir -p "$STAGE"
cp -R "$APP_DIR/dist/public/." "$STAGE/"
cp "$APP_DIR/webos/appinfo.json" "$STAGE/appinfo.json"
cp "$APP_DIR/webos/bootstrap.js" "$STAGE/bootstrap.js"

# Vite copies TV-only public/skin-previews into the package. Resolve these
# through BASE_URL (./ here), separately from the unchanged full-size media.
test -f "$STAGE/skin-previews/manifest.json" || { echo "TV skin previews are missing from the build." >&2; exit 1; }

# webOS 5 must be able to show skin artwork even if cross-origin image loading
# from a file:// widget fails. Keep the originals in the main web app; bundle
# compact local WebP copies of the same avatars and backgrounds for TV.
if ! command -v magick >/dev/null 2>&1; then
  echo "ImageMagick is required to prepare the TV skin artwork." >&2
  exit 1
fi
SKINS="$ROOT_DIR/artifacts/little-champs/public/skins"
for kind in avatars backgrounds; do
  mkdir -p "$STAGE/media/skins/$kind"
  for source in "$SKINS/$kind/"*.png; do
    target="$STAGE/media/skins/$kind/$(basename "${source%.png}").webp"
    if [[ "$kind" == avatars ]]; then
      magick "$source" -resize 512x512 -strip -quality 84 "$target"
    else
      magick "$source" -strip -quality 84 "$target"
    fi
  done
done

# The webOS 5 packaged app opens from file://. Module script tags fail to
# load there; the Vite config bundles the JS as a single classic IIFE instead.
node - "$STAGE/index.html" <<'NODE'
const fs = require('node:fs');
const file = process.argv[2];
const html = fs.readFileSync(file, 'utf8');
const scripts = html.match(/<script\b[^>]*type="module"[^>]*><\/script>/g) || [];
if (scripts.length !== 1) throw new Error(`Expected one bundled script, found ${scripts.length}`);
const output = html.replace(scripts[0], '<script src="./bootstrap.js"></script>\n    ' + scripts[0].replace('type="module"', 'defer').replace(' crossorigin', ''));
fs.writeFileSync(file, output);
NODE

ICON="$APP_DIR/public/brand/littlechamps_logo.png"
if command -v sips >/dev/null 2>&1; then
  sips -s format png -z 80 80 "$ICON" --out "$STAGE/icon.png" >/dev/null
  sips -s format png -z 130 130 "$ICON" --out "$STAGE/largeicon.png" >/dev/null
elif command -v magick >/dev/null 2>&1; then
  magick "$ICON" -resize 80x80 "$STAGE/icon.png"
  magick "$ICON" -resize 130x130 "$STAGE/largeicon.png"
else
  echo "ImageMagick (or macOS sips) is required to create the webOS launcher icons." >&2
  exit 1
fi

if [[ -x "$LOCAL_PACKAGER" ]]; then
  "$LOCAL_PACKAGER" --check "$STAGE"
  "$LOCAL_PACKAGER" -o "$APP_DIR/dist" "$STAGE"
  echo "webOS .ipk created in $APP_DIR/dist using the official LG CLI"
  exit 0
elif command -v ares-package >/dev/null 2>&1; then
  ares-package --check "$STAGE"
  ares-package -o "$APP_DIR/dist" "$STAGE"
  echo "webOS .ipk created in $APP_DIR/dist"
  exit 0
fi

# LG's developer-mode installer requires the CLI-style ar headers: GNU ar adds
# a trailing slash to member names and uses a different mode field, which
# yields "ipk verified failed" even though dpkg-deb accepts the file.
APP_ID="$(node -p "require('$STAGE/appinfo.json').id")"
VERSION="$(node -p "require('$STAGE/appinfo.json').version")"
PACKAGE_DIR="$(mktemp -d)"
trap 'rm -rf "$PACKAGE_DIR"' EXIT
mkdir -p "$PACKAGE_DIR/data/usr/palm/applications/$APP_ID" "$PACKAGE_DIR/data/usr/palm/packages/$APP_ID" "$PACKAGE_DIR/control"
cp -R "$STAGE/." "$PACKAGE_DIR/data/usr/palm/applications/$APP_ID/"
node - "$STAGE/appinfo.json" "$PACKAGE_DIR/data/usr/palm/packages/$APP_ID/packageinfo.json" <<'NODE'
const fs = require('node:fs');
const app = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
fs.writeFileSync(process.argv[3], JSON.stringify({id:app.id,version:app.version,app:app.id},null,2) + '\n');
NODE
INSTALLED_SIZE="$(du -sb "$PACKAGE_DIR/data/usr/palm/applications/$APP_ID" | cut -f1)"
cat > "$PACKAGE_DIR/control/control" <<EOF
Package: $APP_ID
Version: $VERSION
Section: misc
Priority: optional
Architecture: all
Installed-Size: $INSTALLED_SIZE
Maintainer: N/A <nobody@example.com>
Description: This is a webOS application.
webOS-Package-Format-Version: 2
webOS-Packager-Version: x.y.x
EOF
printf '2.0\n' > "$PACKAGE_DIR/debian-binary"
tar -czf "$PACKAGE_DIR/control.tar.gz" -C "$PACKAGE_DIR/control" control
tar -czf "$PACKAGE_DIR/data.tar.gz" -C "$PACKAGE_DIR/data" usr
node - "$PACKAGE_DIR" "$APP_DIR/dist/${APP_ID}_${VERSION}_all.ipk" <<'NODE'
const fs = require('node:fs');
const path = require('node:path');
const [source, destination] = process.argv.slice(2);
const pad = (value, length) => Buffer.from((String(value) + ' '.repeat(length)).slice(0, length), 'ascii');
const chunks = [Buffer.from('!<arch>\n')];
for (const name of ['debian-binary', 'control.tar.gz', 'data.tar.gz']) {
  const content = fs.readFileSync(path.join(source, name));
  chunks.push(Buffer.concat([
    pad(name, 16), pad(Math.floor(Date.now() / 1000), 12),
    Buffer.from('0     0     100644  '), pad(content.length, 10), Buffer.from('`\n'),
  ]), content);
  if (content.length % 2) chunks.push(Buffer.from('\n'));
}
fs.writeFileSync(destination, Buffer.concat(chunks));
NODE
echo "webOS .ipk created in $APP_DIR/dist"