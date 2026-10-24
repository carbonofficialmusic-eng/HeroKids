// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { installPhoneLandscapeLayout } from "@/lib/phone-landscape";

vi.mock("../main", () => { throw new Error("App dependency failed to initialize"); });
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  document.body.innerHTML = "";
  document.documentElement.classList.remove("lc-phone-landscape");
});

it("reports a failed app module on the HTML recovery screen", async () => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  document.body.innerHTML = '<span id="lc-bootstrap-message"></span><span id="lc-bootstrap-details" hidden></span><button id="lc-bootstrap-retry" hidden></button>';
  await import("../bootstrap");
  await vi.dynamicImportSettled();
  expect(document.getElementById("lc-bootstrap-message")?.textContent).toContain("nicht gestartet");
  // Vitest wraps a rejecting mock factory; browsers report the original import error.
  expect(document.getElementById("lc-bootstrap-details")?.textContent).toBeTruthy();
  expect(document.getElementById("lc-bootstrap-retry")?.hidden).toBe(false);
});

it("does not abort startup when an embedded browser exposes orientation without event methods", () => {
  vi.stubGlobal("screen", { width: 393, height: 852, orientation: { angle: 0 } });
  const remove = installPhoneLandscapeLayout(false);
  expect(typeof remove).toBe("function");
  expect(() => remove()).not.toThrow();
});

it("uses browser language when an embedded browser denies local storage", async () => {
  vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw new DOMException("Storage unavailable", "SecurityError"); });
  const { default: i18n } = await import("../i18n");
  expect(i18n.isInitialized).toBe(true);
  expect(i18n.language).toBeTruthy();
});
