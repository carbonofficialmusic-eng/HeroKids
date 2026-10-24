import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { runInNewContext } from "node:vm";
import { expect, it, vi } from "vitest";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const refreshScript = readFileSync(path.join(root, "public/preview-refresh.js"), "utf8");

function installRefresh({ visible = true, version = "first", hasMeta = true, unavailable = false } = {}) {
  let check!: () => void;
  const reload = vi.fn();
  const fetch = vi.fn(() => unavailable
    ? Promise.reject(new Error("Offline"))
    : Promise.resolve({ ok: true, json: () => Promise.resolve({ id: version }) }));
  runInNewContext(refreshScript, {
    document: {
      visibilityState: visible ? "visible" : "hidden",
      querySelector: () => hasMeta ? { content: "first", getAttribute: () => "/preview-build.json" } : null,
      addEventListener: vi.fn(),
    },
    window: { location: { reload } },
    fetch,
    setInterval: (fn: () => void) => { check = fn; },
  });
  return { reload, fetch, check: () => check?.() };
}

it("does not turn the production app into a development refresh poller", () => {
  const refresh = installRefresh({ hasMeta: false });
  refresh.check();
  expect(refresh.fetch).not.toHaveBeenCalled();
});

it("does not reload an unchanged build or a hidden app", async () => {
  const same = installRefresh();
  same.check();
  await vi.waitFor(() => expect(same.fetch).toHaveBeenCalledOnce());
  expect(same.reload).not.toHaveBeenCalled();
  const hidden = installRefresh({ visible: false, version: "second" });
  hidden.check();
  expect(hidden.fetch).not.toHaveBeenCalled();
});

it("refreshes the browser only when a completed development build changes", async () => {
  const refresh = installRefresh({ version: "second" });
  refresh.check();
  await vi.waitFor(() => expect(refresh.reload).toHaveBeenCalledOnce());
  expect(refresh.fetch).toHaveBeenCalledWith("/preview-build.json", { cache: "no-store" });
});

it("keeps the current app open during a temporarily unavailable build check", async () => {
  const refresh = installRefresh({ unavailable: true });
  refresh.check();
  await vi.waitFor(() => expect(refresh.fetch).toHaveBeenCalledOnce());
  expect(refresh.reload).not.toHaveBeenCalled();
});

it("includes the parent dashboard and initial redirect in the app entry rather than a lazy-route promise", () => {
  const app = readFileSync(path.join(root, "src/App.tsx"), "utf8");
  expect(app).toContain('import Dashboard from "@/pages/dashboard"');
  expect(app).toContain('import AutoRedirect from "@/pages/auto-redirect"');
  expect(app).not.toContain('const Dashboard = lazy(');
  expect(app).not.toContain('const AutoRedirect = lazy(');
});

it("preserves development-only auth behavior without changing production builds", () => {
  const config = readFileSync(path.join(root, "vite.config.ts"), "utf8");
  expect(config).toContain("mode === 'preview-development'");
  expect(config).toMatch(/bundledDevelopment\s*\?\s*\{\s*'import\.meta\.env\.DEV':\s*'true',\s*'import\.meta\.env\.PROD':\s*'false'/);
});
