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
    assert.deepEqual(fs.readdirSync(bundled), ["junior-champion.png"]);
    assert.deepEqual(
      fs.readFileSync(path.join(bundled, "junior-champion.png")),
      fs.readFileSync(path.join(app, "public/skins", category, "junior-champion.png")),
    );
  }
});
