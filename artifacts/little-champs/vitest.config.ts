import path from "node:path";
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

const appRoot = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  root: appRoot,
  plugins: [react()],
  resolve: {
    alias: [
      { find: "@", replacement: path.resolve(appRoot, "src") },
      {
        find: "@shared",
        replacement: path.resolve(appRoot, "../../lib/legacy-shared/src"),
      },
      {
        find: "@assets",
        replacement: path.resolve(appRoot, "../../attached_assets"),
      },
      {
        find: /^react$/,
        replacement: path.resolve(appRoot, "node_modules/react/index.js"),
      },
      {
        find: /^react-dom$/,
        replacement: path.resolve(appRoot, "node_modules/react-dom/index.js"),
      },
      {
        find: /^react-dom\/client$/,
        replacement: path.resolve(
          appRoot,
          "node_modules/react-dom/client.js",
        ),
      },
    ],
    dedupe: ["react", "react-dom"],
  },
  test: {
    include: [
      "src/__tests__/**/*.{test,spec}.{ts,tsx}",
      "../api-server/src/**/*.{test,spec}.ts",
      "../little-champs-tv/src/**/*.test.{ts,tsx}",
    ],
    exclude: [
      "**/node_modules/**",
      "**/.cache/**",
      "**/dist/**",
      "**/.migration-backup/**",
    ],
    environment: "node",
  },
});