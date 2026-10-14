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

  const assets = [...index.matchAll(/(?:src|href)=["'](\/assets\/[^"'?#]+\.(?:js|css))["']/g)];
  assert.ok(assets.some(([, asset]) => asset.endsWith(".js")), "Missing phone JavaScript entry point");
  assert.ok(assets.some(([, asset]) => asset.endsWith(".css")), "Missing phone stylesheet");
  for (const [, asset] of assets) {
    const relative = asset.slice(1);
    assert.ok(!relative.split("/").includes(".."), "Invalid entry asset path");
    assert.deepEqual(
      fs.readFileSync(path.join(bundledDir, relative)),
      fs.readFileSync(path.join(webDir, relative)),
      `Bundled entry asset is stale: ${relative}`,
    );
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
