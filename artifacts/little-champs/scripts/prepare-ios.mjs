import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { validateIosBuild } from "./check-ios-build.mjs";

const appDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

if (process.platform !== "darwin") {
  console.error("iOS preparation requires macOS with Xcode and CocoaPods. No files were synchronized.");
  process.exit(1);
}

function run(command, args, env = process.env) {
  const result = spawnSync(command, args, { cwd: appDir, stdio: "inherit", env });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(" ")} failed (${result.status ?? result.signal})`);
  }
}

try {
  console.log("Building ONLY @workspace/little-champs (no TV or API build).");
  run("pnpm", ["run", "build"], { ...process.env, PORT: "20042", BASE_PATH: "/" });
  run("bash", [path.join(appDir, "scripts/ios-sync.sh")]);
  const result = validateIosBuild(appDir);
  console.log(`iOS prepared: ${result.appId}; online UI ${result.serverUrl}; web build ${result.webBuild}.`);
} catch (error) {
  console.error(error.message);
  process.exit(1);
}
