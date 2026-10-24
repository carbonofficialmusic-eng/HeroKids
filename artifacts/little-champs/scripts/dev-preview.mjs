import path from "node:path";
import { fileURLToPath } from "node:url";
import { copyFile } from "node:fs/promises";
import { build, preview } from "vite";

// Serve a bundled development app, not thousands of source-module requests.
// Keep DEV auth/header behavior while leaving the production build unchanged.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outDir = path.join(root, "dist/development");
const configFile = path.join(root, "vite.config.ts");
const mode = "preview-development";
let server;
let failed = false;
let stopping = false;

const watcher = await build({
  configFile,
  mode,
  build: {
    outDir,
    // Retain previous hashed chunks while an open browser receives an update.
    emptyOutDir: false,
    watch: { buildDelay: 300 },
  },
});

watcher.on("event", async (event) => {
  if (event.code === "START") failed = false;
  if (event.code === "ERROR") {
    failed = true;
    console.error("[preview] Build failed:", event.error);
    if (!server) await shutdown(1);
  }
  if (event.code !== "END" || failed || stopping) return;
  try {
    // Publish the new refresh token only after every output has been written.
    await copyFile(
      path.join(outDir, "preview-build-pending.json"),
      path.join(outDir, "preview-build.json"),
    );
    if (!server) {
      server = await preview({ configFile, mode, build: { outDir } });
      console.log("[preview] Bundled development app ready; watching for changes.");
      server.printUrls();
    } else {
      console.log("[preview] Updated build ready.");
    }
  } catch (error) {
    console.error("[preview] Could not serve the development build:", error);
    if (!server) await shutdown(1);
  }
});

async function shutdown(code) {
  if (stopping) return;
  stopping = true;
  await watcher.close();
  if (server) await new Promise((resolve) => server.httpServer.close(resolve));
  process.exit(code);
}
process.once("SIGTERM", () => void shutdown(0));
process.once("SIGINT", () => void shutdown(0));
