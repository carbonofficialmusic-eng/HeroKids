import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const appDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/** Validate generated resources, not just the TypeScript source configuration. */
export function validateIosBuild(directory) {
  const webDir = path.join(directory, "dist/public");
  const nativeDir = path.join(directory, "ios/App/App");
  const bundledDir = path.join(nativeDir, "public");
  const readJson = (file) => JSON.parse(fs.readFileSync(file, "utf8"));
  const config = readJson(path.join(nativeDir, "capacitor.config.json"));
  assert.equal(config.appId, "app.herokids.com", "Unexpected native app identity");
  assert.equal(config.appName, "Little Champs", "TV or another app must not be bundled");
  assert.equal(config.server?.url, "https://littlechamps.net", "Native startup must load the live phone app");
  assert.ok(config.server.allowNavigation?.includes("littlechamps.net"), "Live host must be allowed");
  assert.equal(config.webDir, "dist/public", "Native webDir must point to the phone app build");

  const index = fs.readFileSync(path.join(webDir, "index.html"), "utf8");
  assert.equal(fs.readFileSync(path.join(bundledDir, "index.html"), "utf8"), index, "Bundled HTML is stale or from another artifact");
  assert.ok(!/\/tv\/assets\//.test(index), "TV assets found in phone entry point");
  const build = readJson(path.join(webDir, "build-info.json"));
  const bundledBuild = readJson(path.join(bundledDir, "build-info.json"));
  assert.equal(bundledBuild.id, build.id, "Bundled build identifier is stale");
  assert.ok(typeof build.id === "string" && Number.isFinite(Date.parse(build.id)), "Missing web build identifier");

  const assets = new Set(
    [...index.matchAll(/(?:src|href)=["']\/(assets\/[^"'?#]+\.(?:js|css))["']/g)]
      .map(([, asset]) => asset),
  );
  assert.ok([...assets].some(asset => asset.endsWith(".js")), "Missing phone JavaScript entry point");

  // The bootstrap imports main dynamically, so Vite loads its CSS through JS
  // rather than an HTML link. Follow the build manifest instead of requiring
  // a static stylesheet link or guessing hashed chunk names from minified JS.
  const manifestFile = path.join(webDir, ".vite/manifest.json");
  if (fs.existsSync(manifestFile)) {
    const manifest = readJson(manifestFile);
    const roots = Object.keys(manifest)
      .filter(key => manifest[key].isEntry && assets.has(manifest[key].file));
    assert.ok(roots.length > 0, "Build manifest does not match the phone entry point");
    const visited = new Set();
    function collect(key) {
      if (visited.has(key)) return;
      visited.add(key);
      assert.ok(Object.hasOwn(manifest, key), `Missing build manifest dependency: ${key}`);
      const chunk = manifest[key];
      assets.add(chunk.file);
      for (const css of chunk.css ?? []) assets.add(css);
      for (const dependency of [...(chunk.imports ?? []), ...(chunk.dynamicImports ?? [])]) {
        collect(dependency);
      }
    }
    for (const root of roots) collect(root);
  }

  assert.ok([...assets].some(asset => typeof asset === "string" && asset.endsWith(".css")), "Missing phone stylesheet");
  for (const relative of assets) {
    assert.ok(typeof relative === "string" && /^assets\/[^?#]+\.(js|css)$/.test(relative) &&
      !relative.includes("\\") && !relative.split("/").some(part => part === ".." || part === "."),
    "Invalid entry asset path");
    assert.deepEqual(
      fs.readFileSync(path.join(bundledDir, relative)),
      fs.readFileSync(path.join(webDir, relative)),
      `Bundled entry asset is stale: ${relative}`,
    );
  }
  for (const image of ["welcome-start.webp", "welcome-kid-start.webp"]) {
    const relative = path.join("images", image);
    assert.deepEqual(
      fs.readFileSync(path.join(bundledDir, relative)),
      fs.readFileSync(path.join(webDir, relative)),
      `Bundled start illustration is stale: ${image}`,
    );
  }
  const skinsDir = path.join(bundledDir, "skins");
  if (fs.existsSync(skinsDir)) {
    const skinImages = fs.readdirSync(skinsDir, { recursive: true })
      .filter(name => /\.(png|jpe?g|webp|gif)$/i.test(name));
    assert.deepEqual(skinImages, [], "Game skins and their backgrounds must remain online-only");
  }
  return { appId: config.appId, serverUrl: config.server.url, webBuild: build.id };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const result = validateIosBuild(appDir);
    console.log(`iOS resources verified: ${result.appId}; ${result.serverUrl}; web build ${result.webBuild}`);
  } catch (error) {
    console.error(`iOS resources are NOT ready: ${error.message}`);
    console.error("On macOS, run pnpm run ios:prepare from the workspace root.");
    process.exit(1);
  }
}
