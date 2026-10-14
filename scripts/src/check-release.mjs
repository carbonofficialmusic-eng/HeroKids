import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ZERO = "0".repeat(40);
const forbidden = [
  /^\.migration-backup\//,
  /^ios\//,
  /^generated-artifacts\//,
  /^\.(?:local|cache)\//,
  /(?:^|\/)(?:node_modules|dist|Pods|DerivedData)\//,
  /(?:^|\/)ios\/App\/App\/(?:public\/|capacitor\.config\.json$|config\.xml$)/,
  /(?:^|\/)ios\/capacitor-cordova-ios-plugins\//,
  /\.ipk$/i,
];

function git(cwd, args) {
  return execFileSync("git", args, {
    cwd,
    encoding: "utf8",
    maxBuffer: 16 * 1024 * 1024,
    stdio: ["ignore", "pipe", "pipe"],
  });
}

export function checkRelease(ref = "HEAD", cwd = process.cwd()) {
  cwd = git(cwd, ["rev-parse", "--show-toplevel"]).trim();
  const files = git(cwd, ["ls-tree", "-r", "-z", "--name-only", ref])
    .split("\0")
    .filter(Boolean);
  const tracked = new Set(files);
  const errors = files
    .filter((path) => forbidden.some((pattern) => pattern.test(path)))
    .map((path) => `Local-only/generated file in release: ${path}`);

  let source = "";
  try {
    source = git(cwd, [
      "grep", "-I", "-h", "-e", "@assets/", ref, "--",
      ":(glob)artifacts/**/src/**", ":(glob)lib/**/src/**",
    ]);
  } catch (error) {
    if (error.status !== 1) throw error;
  }
  const requiredAssets = new Set(
    [...source.matchAll(/["']@assets\/([^"'?#]+)(?:[?#][^"']*)?["']/g)]
      .map((match) => `attached_assets/${match[1]}`),
  );
  for (const path of requiredAssets) {
    if (!tracked.has(path)) {
      errors.push(`Missing imported asset: ${path}. Commit it with git add -f.`);
    }
  }
  for (const path of files) {
    if (path.startsWith("attached_assets/") && !requiredAssets.has(path)) {
      errors.push(`Unused upload in release: ${path}`);
    }
  }
  return errors;
}

export function checkPush(input, cwd = process.cwd()) {
  const errors = [];
  for (const line of input.trim().split("\n").filter(Boolean)) {
    const [localRef, localSha, remoteRef, remoteSha] = line.trim().split(/\s+/);
    if (!localRef || !/^[0-9a-f]{40}$/.test(localSha ?? "") ||
        !remoteRef || !/^[0-9a-f]{40}$/.test(remoteSha ?? "")) {
      errors.push("Invalid pre-push input; stopped rather than skipping checks.");
      continue;
    }
    if (remoteRef.startsWith("refs/heads/backup/")) {
      errors.push("Backup branches stay local. Do not use git push --all.");
      continue;
    }
    if (remoteRef !== "refs/heads/publish") continue;
    if (localSha === ZERO) {
      errors.push("Deleting publish is blocked.");
      continue;
    }
    if (remoteSha === ZERO) {
      errors.push("Creating publish is blocked; fetch the existing branch first.");
      continue;
    }
    try {
      git(cwd, ["merge-base", "--is-ancestor", remoteSha, localSha]);
    } catch {
      errors.push("publish must extend GitHub's current history. Fetch first; do not force-push.");
      continue;
    }
    // Check every outgoing commit: files deleted again at the tip would still
    // be uploaded as part of the intermediate history.
    const commits = git(cwd, ["rev-list", `${remoteSha}..${localSha}`])
      .trim().split("\n").filter(Boolean);
    for (const commit of commits.length ? commits : [localSha]) {
      const problems = checkRelease(commit, cwd);
      if (problems.length) {
        errors.push(`${commit.slice(0, 8)}:\n${problems.slice(0, 12).join("\n")}`);
        break;
      }
    }
  }
  return errors;
}

function main() {
  const [option] = process.argv.slice(2);
  const errors = option === "--pre-push"
    ? checkPush(readFileSync(0, "utf8"))
    : checkRelease(option || "HEAD");
  if (errors.length) {
    console.error(`Release check failed:\n${errors.slice(0, 15).join("\n")}`);
    process.exitCode = 1;
  } else {
    console.log("Release check passed: source/assets complete, local-only files excluded.");
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
