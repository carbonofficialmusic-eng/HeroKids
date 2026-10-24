// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { QueryClientProvider } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { FamilyMember } from "@shared/schema";
import { useStartSkin } from "../hooks/useStartSkin";
import { queryClient } from "../lib/queryClient";

const { translate } = vi.hoisted(() => ({
  translate: (key: string, options?: { defaultValue?: string }) => options?.defaultValue || key,
}));
vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: translate }) }));

afterEach(() => { cleanup(); queryClient.clear(); vi.unstubAllGlobals(); });
const profile = (overrides: Partial<FamilyMember> = {}) => ({
  id: "new-parent", role: "parent", startSkinOptions: ["t-rex", "art-master", "junior-champion"],
  startCompletedAt: null, firstTaskCreatedAt: null, freeStarterSkinId: null,
  ...overrides,
}) as FamilyMember;
const wrapper = ({ children }: { children: React.ReactNode }) =>
  <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;

describe("start state through profile loading and switching", () => {
  it("keeps hook order stable when no profile loads, then a parent, then another profile", () => {
    const { result, rerender } = renderHook(({ member }: { member?: FamilyMember }) => useStartSkin(member), {
      wrapper, initialProps: { member: undefined } as { member?: FamilyMember },
    });
    expect(result.current.visible).toBe(false);
    rerender({ member: profile() });
    expect(result.current.visible).toBe(true);
    expect(result.current.taskCreated).toBe(false);
    rerender({ member: profile({ firstTaskCreatedAt: new Date() }) });
    expect(result.current.taskCreated).toBe(true);
    rerender({ member: profile({ id: "existing", startSkinOptions: null }) });
    expect(result.current.visible).toBe(false);
    expect(result.current.options).toEqual([]);
  });

  it("does not block children or impose a first-task requirement on their dashboard", () => {
    const { result } = renderHook(() => useStartSkin(profile({ role: "child" })), { wrapper });
    expect(result.current.pending).toBe(true);
    expect(result.current.visible).toBe(false);
  });

  it.each(["parent", "child"] as const)("shows a credited starter star immediately for a %s", async role => {
    const member = profile({ role, firstTaskCreatedAt: new Date(), starsFound: 0 });
    const updated = { ...member, startCompletedAt: new Date(), freeStarterSkinId: "t-rex", activeSkinId: "t-rex", starsFound: 1 };
    queryClient.setQueryData(["/api/family-members/current"], member);
    class LoadedImage {
      onload: (() => void) | null = null;
      set src(_url: string) { queueMicrotask(() => this.onload?.()); }
    }
    vi.stubGlobal("Image", LoadedImage);
    vi.stubGlobal("requestAnimationFrame", (callback: () => void) => window.setTimeout(callback, 0));
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify(updated), {
      status: 200, headers: { "Content-Type": "application/json" },
    })));
    const { result } = renderHook(() => useStartSkin(member), { wrapper });
    act(() => result.current.choose("t-rex"));
    await waitFor(() => {
      expect(queryClient.getQueryData<FamilyMember>(["/api/family-members/current"])?.starsFound).toBe(1);
      expect(result.current.selecting).toBe(false);
    }, { timeout: 2500 });
  });

  it("waits for a loaded background before the tour, without re-enrolling a completed member", async () => {
    let loaded: (() => void) | null = null;
    class FakeImage {
      onload: (() => void) | null = null;
      set src(_url: string) { loaded = () => this.onload?.(); }
    }
    vi.stubGlobal("Image", FakeImage);
    const { result } = renderHook(() => useStartSkin(profile({
      startCompletedAt: new Date(), freeStarterSkinId: "art-master",
    })), { wrapper });
    expect(result.current.visible).toBe(false);
    expect(result.current.tourReady).toBe(false);
    await act(async () => { loaded?.(); });
    await waitFor(() => expect(result.current.tourReady).toBe(true));
  });
});
