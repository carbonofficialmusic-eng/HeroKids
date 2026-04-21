import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  oxc: false,
  esbuild: {
    jsx: "automatic",
  },
  test: {
    environment: "node",
    include: ["client/src/__tests__/**/*.test.ts"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "client/src"),
      "@shared": path.resolve(__dirname, "shared"),
      "@assets": path.resolve(__dirname, "attached_assets"),
    },
  },
});
