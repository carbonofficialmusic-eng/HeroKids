import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { refreshStaleWebBuild, installWebBuildResumeCheck } from "../lib/web-build-refresh";

const oldBuild = "2026-10-14T20:17:02.824Z";
const newBuild = "2026-10-23T10:27:48.171Z";
let replace: ReturnType<typeof vi.fn>;
let fetchMock: ReturnType<typeof vi.fn>;
let documentMock: EventTarget & { visibilityState: string; querySelector: ReturnType<typeof vi.fn> };
let cleanup: (() => void) | undefined;

beforeEach(() => {
  const values = new Map<string, string>();
  replace = vi.fn();
  fetchMock = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ id: newBuild }),
  });
  documentMock = Object.assign(new EventTarget(), {
    visibilityState: "visible",
    querySelector: vi.fn().mockReturnValue(null),
  });
  vi.stubGlobal("fetch", fetchMock);
  vi.stubGlobal("document", documentMock);
  vi.stubGlobal("window", {
    location: { href: "https://littlechamps.net/settings?section=help#diagnosis", replace },
    history: { state: null, replaceState: vi.fn() },
  });
  vi.stubGlobal("sessionStorage", {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
  });
});
afterEach(() => {
  cleanup?.();
  cleanup = undefined;
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("published web build refresh", () => {
  it("loads a changed build at a cache-busting URL, preserving the route and existing parameters", async () => {
    expect(await refreshStaleWebBuild(oldBuild)).toBe(true);
    const target = new URL(replace.mock.calls[0][0]);
    expect(target.pathname).toBe("/settings");
    expect(target.searchParams.get("section")).toBe("help");
    expect(target.searchParams.get("_lc_web")).toBe(newBuild);
    expect(target.hash).toBe("#diagnosis");
    expect(fetchMock.mock.calls[0][1].cache).toBe("no-store");
  });
  it("does not reload an up-to-date build", async () => {
    expect(await refreshStaleWebBuild(newBuild)).toBe(false);
    expect(replace).not.toHaveBeenCalled();
  });
  it("never retries the same failed refresh in a loop", async () => {
    await refreshStaleWebBuild(oldBuild);
    expect(await refreshStaleWebBuild(oldBuild)).toBe(false);
    expect(replace).toHaveBeenCalledTimes(1);
  });
  it("guards against loops even without session storage", async () => {
    vi.stubGlobal("sessionStorage", {
      getItem: () => { throw new Error("Storage blocked"); },
    });
    window.location.href = `https://littlechamps.net/?_lc_web=${encodeURIComponent(newBuild)}`;
    expect(await refreshStaleWebBuild(oldBuild)).toBe(false);
    expect(replace).not.toHaveBeenCalled();
  });
  it("does not block the app when offline, during an outage, or on invalid build info", async () => {
    fetchMock.mockRejectedValueOnce(new Error("Offline"));
    expect(await refreshStaleWebBuild(oldBuild)).toBe(false);
    fetchMock.mockResolvedValueOnce({ ok: false });
    expect(await refreshStaleWebBuild(oldBuild)).toBe(false);
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ id: "not a build" }) });
    expect(await refreshStaleWebBuild(oldBuild)).toBe(false);
    expect(replace).not.toHaveBeenCalled();
  });
  it("removes only the refresh marker once the current build has loaded", async () => {
    window.location.href = "https://littlechamps.net/?keep=yes&_lc_web=old#top";
    await refreshStaleWebBuild(newBuild);
    const target = new URL(vi.mocked(window.history.replaceState).mock.calls[0][2]!.toString());
    expect(target.searchParams.has("_lc_web")).toBe(false);
    expect(target.searchParams.get("keep")).toBe("yes");
    expect(target.hash).toBe("#top");
  });
});

function resumeAfter(milliseconds: number) {
  let now = 100_000;
  vi.spyOn(Date, "now").mockImplementation(() => now);
  documentMock.visibilityState = "hidden";
  documentMock.dispatchEvent(new Event("visibilitychange"));
  now += milliseconds;
  documentMock.visibilityState = "visible";
  documentMock.dispatchEvent(new Event("visibilitychange"));
}

describe("safe resume checks", () => {
  it("checks for a published update after returning from the background", async () => {
    cleanup = installWebBuildResumeCheck(oldBuild);
    resumeAfter(60_000);
    await vi.waitFor(() => expect(replace).toHaveBeenCalledTimes(1));
  });
  it("does not reload during a camera/picker return", () => {
    cleanup = installWebBuildResumeCheck(oldBuild);
    resumeAfter(5_000);
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("protects drafts and open dialogs from automatic reloads", () => {
    cleanup = installWebBuildResumeCheck(oldBuild);
    documentMock.dispatchEvent(new Event("input"));
    resumeAfter(60_000);
    expect(fetchMock).not.toHaveBeenCalled();
    documentMock.dispatchEvent(new Event("reset"));
    documentMock.querySelector.mockReturnValue({});
    resumeAfter(60_000);
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("rechecks draft safety after the version request finishes", async () => {
    let finish!: (response: unknown) => void;
    fetchMock.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
    cleanup = installWebBuildResumeCheck(oldBuild);
    resumeAfter(60_000);
    documentMock.dispatchEvent(new Event("input"));
    finish({ ok: true, json: async () => ({ id: newBuild }) });
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(replace).not.toHaveBeenCalled();
  });
});
