import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { runInNewContext } from "node:vm";
import { expect, it, vi } from "vitest";

const html = readFileSync(path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../index.html"), "utf8");
const start = html.indexOf("(function () {");
const watchdogScript = html.slice(start, html.indexOf("</script>", start));

function startWatchdog(href: string, failureDetails = "") {
  let timeout!: () => void;
  let onMutation!: () => void;
  const nodes: Record<string, { textContent?: string; hidden?: boolean; onclick?: () => void } | null> = {
    "lc-bootstrap": {}, root: {},
    "lc-bootstrap-message": { textContent: "", hidden: true },
    "lc-bootstrap-details": { textContent: failureDetails },
    "lc-bootstrap-retry": { hidden: true },
  };
  const replace = vi.fn();
  const replaceState = vi.fn();
  const clearTimeout = vi.fn();
  runInNewContext(watchdogScript, {
    URL,
    window: { location: { href, replace }, history: { state: null, replaceState } },
    document: { getElementById: (id: string) => nodes[id] },
    setTimeout: (fn: () => void) => { timeout = fn; return 1; },
    clearTimeout,
    MutationObserver: class {
      constructor(fn: () => void) { onMutation = fn; }
      observe() {}
      disconnect() {}
    },
  });
  return { nodes, replace, replaceState, clearTimeout, runTimeout: () => timeout(), onMutation: () => onMutation() };
}

it("automatically retries a stalled first start without requiring a button click", () => {
  const boot = startWatchdog("https://example.test/dashboard?view=tasks");
  boot.runTimeout();
  expect(boot.replace).toHaveBeenCalledOnce();
  const retryUrl = new URL(boot.replace.mock.calls[0][0]);
  expect(retryUrl.searchParams.get("lc_boot_retry")).toBe("1");
  expect(retryUrl.searchParams.has("lc_reload")).toBe(true);
  expect(retryUrl.searchParams.get("view")).toBe("tasks");
  expect(boot.nodes["lc-bootstrap-retry"]?.hidden).toBe(true);
});

it("does not create an automatic reload loop if the next attempt also stalls", () => {
  const boot = startWatchdog("https://example.test/dashboard?lc_boot_retry=1&lc_reload=123");
  boot.runTimeout();
  expect(boot.replace).not.toHaveBeenCalled();
  expect(boot.nodes["lc-bootstrap-retry"]?.hidden).toBe(false);
  expect(boot.nodes["lc-bootstrap-message"]?.textContent).toContain("ungewöhnlich lange");
  expect(boot.nodes["lc-bootstrap-message"]?.hidden).toBe(false);
});

it("does not overwrite a real module error with a timeout or automatic reload", () => {
  const boot = startWatchdog("https://example.test/dashboard", "Module import rejected");
  boot.runTimeout();
  expect(boot.replace).not.toHaveBeenCalled();
  expect(boot.nodes["lc-bootstrap-details"]?.textContent).toBe("Module import rejected");
});

it("clears the watchdog and recovery-only URL parameters after React starts", () => {
  const boot = startWatchdog("https://example.test/dashboard?view=tasks&lc_boot_retry=1&lc_reload=123");
  boot.nodes["lc-bootstrap"] = null;
  boot.onMutation();
  expect(boot.clearTimeout).toHaveBeenCalledOnce();
  expect(boot.replaceState).toHaveBeenCalledWith(null, "", "https://example.test/dashboard?view=tasks");
});

it("shows only the pulsing brand logo during normal startup and respects reduced motion", () => {
  expect(html).toContain('class="lc-bootstrap-logo" src="%BASE_URL%images/little-champs-logo.webp"');
  expect(html).toContain('<span id="lc-bootstrap-message" hidden></span>');
  expect(html).not.toContain("Dein Dashboard wird geladen");
  expect(html).toContain("@keyframes lc-bootstrap-pulse");
  expect(html).toMatch(/id="lc-bootstrap"[^>]+background:#000;/);
  expect(html).toContain("@media (prefers-reduced-motion: reduce)");
});
