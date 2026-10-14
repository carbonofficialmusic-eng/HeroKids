import { afterEach, test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { checkRelease, checkPush } from "./check-release.mjs";

const directories = [];
afterEach(() => {
  for (const directory of directories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

function repository() {
  const cwd = mkdtempSync(join(tmpdir(), "little-champs-git-test-"));
  directories.push(cwd);
  const git = (...args) => execFileSync("git", args, {
    cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"],
  }).trim();
  git("init", "-q");
  git("config", "user.name", "Release Test");
  git("config", "user.email", "release-test@example.invalid");
  const put = (path, contents = "fixture") => {
    mkdirSync(dirname(join(cwd, path)), { recursive: true });
    writeFileSync(join(cwd, path), contents);
  };
  const commit = () => {
    git("add", "-A");
    git("commit", "-qm", "Fixture");
    return git("rev-parse", "HEAD");
  };
  put("package.json", "{}");
  const base = commit();
  return { cwd, git, put, commit, base };
}

test("clean source-only release passes", () => {
  const r = repository();
  assert.deepEqual(checkRelease("HEAD", r.cwd), []);
});

test("workspace-package invocation still checks the entire repository", () => {
  const r = repository();
  r.put("scripts/src/check.mjs");
  r.put(".migration-backup/old.txt");
  r.commit();
  assert.match(checkRelease("HEAD", join(r.cwd, "scripts")).join("\n"), /Local-only\/generated/);
});

test("generated native files, migration backups and test packages are rejected", () => {
  const r = repository();
  for (const path of [
    ".migration-backup/old-app.ts",
    "ios/App/App/public/index.html",
    "artifacts/little-champs/ios/App/App/public/index.html",
    "artifacts/little-champs/ios/App/App/capacitor.config.json",
    "artifacts/little-champs/ios/App/Pods/Podfile.lock",
    "generated-artifacts/report.txt",
    "test.ipk",
  ]) r.put(path);
  r.commit();
  assert.equal(checkRelease("HEAD", r.cwd).length, 7);
});

test("an imported asset must be in the commit, not just on disk", () => {
  const r = repository();
  r.put("artifacts/app/src/App.tsx", 'import logo from "@assets/logo.png";');
  r.commit();
  r.put("attached_assets/logo.png");
  assert.match(checkRelease("HEAD", r.cwd).join("\n"), /Missing imported asset/);
  r.commit();
  assert.deepEqual(checkRelease("HEAD", r.cwd), []);
});

test("unused uploads are rejected but an imported asset with query parameters is allowed", () => {
  const r = repository();
  r.put("artifacts/app/src/App.tsx", 'import logo from "@assets/logo.svg?url";');
  r.put("attached_assets/logo.svg");
  r.put("attached_assets/screenshot.png");
  r.commit();
  assert.deepEqual(checkRelease("HEAD", r.cwd), [
    "Unused upload in release: attached_assets/screenshot.png",
  ]);
});

test("ordinary publish update passes and backup branch upload is blocked", () => {
  const r = repository();
  r.put("feature.txt");
  const tip = r.commit();
  assert.deepEqual(checkPush(`refs/heads/publish ${tip} refs/heads/publish ${r.base}\n`, r.cwd), []);
  assert.match(checkPush(`refs/heads/backup/saved ${tip} refs/heads/backup/saved ${"0".repeat(40)}\n`, r.cwd).join("\n"), /Backup branches stay local/);
});

test("non-fast-forward update and publish deletion are blocked", () => {
  const r = repository();
  r.put("feature.txt");
  const tip = r.commit();
  assert.match(checkPush(`refs/heads/publish ${r.base} refs/heads/publish ${tip}\n`, r.cwd).join("\n"), /do not force-push/);
  assert.match(checkPush(`(delete) ${"0".repeat(40)} refs/heads/publish ${tip}\n`, r.cwd).join("\n"), /Deleting publish is blocked/);
});

test("files removed at the tip are still detected in outgoing history", () => {
  const r = repository();
  r.put(".migration-backup/unwanted.txt");
  r.commit();
  r.git("rm", "-qr", ".migration-backup");
  const tip = r.commit();
  assert.deepEqual(checkRelease(tip, r.cwd), []);
  assert.match(checkPush(`refs/heads/publish ${tip} refs/heads/publish ${r.base}\n`, r.cwd).join("\n"), /Local-only\/generated file/);
});

test("malformed input and recreation of publish fail explicitly", () => {
  const r = repository();
  assert.match(checkPush("bad input\n", r.cwd).join("\n"), /Invalid pre-push/);
  assert.match(checkPush(`refs/heads/publish ${r.base} refs/heads/publish ${"0".repeat(40)}\n`, r.cwd).join("\n"), /Creating publish is blocked/);
});
