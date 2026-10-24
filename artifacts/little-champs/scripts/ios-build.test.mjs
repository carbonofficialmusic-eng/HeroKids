import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import { validateIosBuild } from "./check-ios-build.mjs";

function fixture(t) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "little-champs-ios-"));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const write = (file, value) => {
    const destination = path.join(directory, file);
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.writeFileSync(destination, value);
  };
  const config = {
    appId: "app.herokids.com", appName: "Little Champs", webDir: "dist/public",
    server: { url: "https://littlechamps.net", allowNavigation: ["littlechamps.net"] },
  };
  write("ios/App/App/capacitor.config.json", JSON.stringify(config));
  for (const base of ["dist/public", "ios/App/App/public"]) {
    write(`${base}/index.html`, '<script src="/assets/phone.js"></script><link href="/assets/phone.css">');
    write(`${base}/assets/phone.js`, "phone-only");
    write(`${base}/assets/phone.css`, "html{color:blue}");
    write(`${base}/images/welcome-start.webp`, "parent illustration");
    write(`${base}/images/welcome-kid-start.webp`, "child illustration");
    write(`${base}/build-info.json`, JSON.stringify({ id: "2026-10-14T20:00:00.000Z" }));
  }
  return { directory, write, config };
}

test("accepts freshly synchronized phone assets and the live startup URL", (t) => {
  const { directory } = fixture(t);
  assert.deepEqual(validateIosBuild(directory), {
    appId: "app.herokids.com",
    serverUrl: "https://littlechamps.net",
    webBuild: "2026-10-14T20:00:00.000Z",
  });
});

function dynamicFixture(t) {
  const result = fixture(t);
  for (const base of ["dist/public", "ios/App/App/public"]) {
    result.write(`${base}/index.html`, '<script type="module" src="/assets/phone.js"></script>');
    result.write(`${base}/assets/main.js`, "dynamically loaded main");
  }
  const manifest = {
    "index.html": { file: "assets/phone.js", isEntry: true, dynamicImports: ["src/main.tsx"] },
    "src/main.tsx": { file: "assets/main.js", css: ["assets/phone.css"], imports: ["index.html"] },
  };
  result.write("dist/public/.vite/manifest.json", JSON.stringify(manifest));
  return { ...result, manifest };
}

test("accepts CSS loaded by the dynamic bootstrap and handles shared cycles", (t) => {
  const { directory } = dynamicFixture(t);
  assert.equal(validateIosBuild(directory).appId, "app.herokids.com");
});

test("rejects stale dynamically loaded CSS", (t) => {
  const { directory, write } = dynamicFixture(t);
  write("ios/App/App/public/assets/phone.css", "stale dynamic CSS");
  assert.throws(() => validateIosBuild(directory), /Bundled entry asset is stale/);
});

test("rejects a missing dynamically loaded stylesheet", (t) => {
  const { directory } = dynamicFixture(t);
  fs.rmSync(path.join(directory, "ios/App/App/public/assets/phone.css"));
  assert.throws(() => validateIosBuild(directory), /ENOENT/);
});

test("rejects a stale dynamically loaded JavaScript chunk", (t) => {
  const { directory, write } = dynamicFixture(t);
  write("ios/App/App/public/assets/main.js", "stale dynamic JavaScript");
  assert.throws(() => validateIosBuild(directory), /Bundled entry asset is stale/);
});

test("rejects a manifest from another entry point", (t) => {
  const { directory, manifest, write } = dynamicFixture(t);
  manifest["index.html"].file = "assets/unrelated.js";
  write("dist/public/.vite/manifest.json", JSON.stringify(manifest));
  assert.throws(() => validateIosBuild(directory), /manifest does not match/);
});

test("rejects unresolved manifest dependencies", (t) => {
  const { directory, manifest, write } = dynamicFixture(t);
  manifest["src/main.tsx"].dynamicImports = ["missing.tsx"];
  write("dist/public/.vite/manifest.json", JSON.stringify(manifest));
  assert.throws(() => validateIosBuild(directory), /Missing build manifest dependency/);
});

test("rejects unsafe paths in a dynamically loaded chunk", (t) => {
  const { directory, manifest, write } = dynamicFixture(t);
  manifest["src/main.tsx"].file = "assets/../../outside.js";
  write("dist/public/.vite/manifest.json", JSON.stringify(manifest));
  assert.throws(() => validateIosBuild(directory), /Invalid entry asset path/);
});

test("unrelated CSS files do not satisfy the stylesheet requirement", (t) => {
  const { directory, manifest, write } = dynamicFixture(t);
  delete manifest["src/main.tsx"].css;
  manifest["unused.tsx"] = { file: "assets/unused.js", css: ["assets/phone.css"] };
  write("dist/public/.vite/manifest.json", JSON.stringify(manifest));
  assert.throws(() => validateIosBuild(directory), /Missing phone stylesheet/);
});

test("rejects a silently switched local/offline startup", (t) => {
  const { directory, config, write } = fixture(t);
  delete config.server.url;
  write("ios/App/App/capacitor.config.json", JSON.stringify(config));
  assert.throws(() => validateIosBuild(directory), /Native startup/);
});

test("rejects a TV or unrelated app identity", (t) => {
  const { directory, config, write } = fixture(t);
  config.appName = "Little Champs TV";
  write("ios/App/App/capacitor.config.json", JSON.stringify(config));
  assert.throws(() => validateIosBuild(directory), /TV or another app/);
});

test("rejects stale bundled HTML", (t) => {
  const { directory, write } = fixture(t);
  write("ios/App/App/public/index.html", "old entry");
  assert.throws(() => validateIosBuild(directory), /Bundled HTML is stale/);
});

test("rejects a stale native web build identifier", (t) => {
  const { directory, write } = fixture(t);
  write("ios/App/App/public/build-info.json", JSON.stringify({ id: "2026-09-01T00:00:00.000Z" }));
  assert.throws(() => validateIosBuild(directory), /identifier is stale/);
});

test("rejects a stale entry asset even if its filename has not changed", (t) => {
  const { directory, write } = fixture(t);
  write("ios/App/App/public/assets/phone.css", "old CSS");
  assert.throws(() => validateIosBuild(directory), /Bundled entry asset is stale/);
});

test("rejects a missing Capacitor sync result", (t) => {
  const { directory } = fixture(t);
  fs.rmSync(path.join(directory, "ios/App/App/capacitor.config.json"));
  assert.throws(() => validateIosBuild(directory), /ENOENT/);
});

test("rejects a missing or stale bundled start illustration", (t) => {
  const { directory, write } = fixture(t);
  write("ios/App/App/public/images/welcome-kid-start.webp", "outdated child image");
  assert.throws(() => validateIosBuild(directory), /Bundled start illustration is stale/);
  fs.rmSync(path.join(directory, "ios/App/App/public/images/welcome-kid-start.webp"));
  assert.throws(() => validateIosBuild(directory), /ENOENT/);
});

test("rejects a fixed starter skin left in the native bundle", (t) => {
  const { directory, write } = fixture(t);
  write("ios/App/App/public/skins/avatars/junior-champion.png", "unwanted starter");
  assert.throws(() => validateIosBuild(directory), /must remain online-only/);
});

test("native artwork is installed before creating the WebView and restricted to the live main frame", () => {
  const app = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  const swift = fs.readFileSync(path.join(app, "ios/App/App/ViewController.swift"), "utf8");
  const install = swift.indexOf("installBundledStartArtwork(in: configuration)");
  assert.ok(install >= 0 && install < swift.indexOf("let webView = FreshStartWebView"));
  assert.ok(swift.includes('subdirectory: "public/images"'));
  assert.ok(swift.includes('location.hostname !== "littlechamps.net"'));
  assert.ok(swift.includes("injectionTime: .atDocumentStart, forMainFrameOnly: true"));
  assert.ok(swift.includes("__LITTLE_CHAMPS_START_ARTWORK__"));
});

test("rejects a TV entry point even when both copied HTML files match", (t) => {
  const { directory, write } = fixture(t);
  for (const base of ["dist/public", "ios/App/App/public"]) {
    write(`${base}/index.html`, '<script src="/tv/assets/tv.js"></script>');
  }
  assert.throws(() => validateIosBuild(directory), /TV assets/);
});

test("macOS build dependencies are not disabled in workspace overrides", () => {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
  const workspace = fs.readFileSync(path.join(root, "pnpm-workspace.yaml"), "utf8");
  const lock = fs.readFileSync(path.join(root, "pnpm-lock.yaml"), "utf8");
  for (const dependency of ["esbuild", "lightningcss", "rollup"]) {
    assert.ok(!workspace.split("\n").some((line) => line.includes(`${dependency}>`) && line.includes("darwin-") && line.includes("'-'")));
  }
  for (const platform of ["arm64", "x64"]) {
    assert.ok(lock.includes(`@esbuild/darwin-${platform}@`));
    assert.ok(lock.includes(`lightningcss-darwin-${platform}@`));
    assert.ok(lock.includes(`@rollup/rollup-darwin-${platform}@`));
  }
});

test("skin trimming uses current artifact paths from any working directory", (t) => {
  const { directory, write } = fixture(t);
  const app = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  for (const category of ["avatars", "backgrounds"]) {
    write(`ios/App/App/public/skins/${category}/old-skin.png`, "old bundled asset");
  }
  execFileSync("bash", [
    path.join(app, "scripts/trim-ios-background-assets.sh"),
    path.join(directory, "ios/App/App/public"),
  ], { cwd: os.tmpdir() });
  for (const category of ["avatars", "backgrounds"]) {
    const bundled = path.join(directory, "ios/App/App/public/skins", category);
    assert.deepEqual(fs.readdirSync(bundled), []);
    assert.ok(fs.existsSync(path.join(app, "public/skins", category, "junior-champion.png")),
      "The server must still provide the historic starter");
  }
});
