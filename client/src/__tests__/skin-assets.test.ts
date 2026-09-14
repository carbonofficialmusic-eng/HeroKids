import { afterEach, describe, expect, it, vi } from "vitest";
import { Capacitor } from "@capacitor/core";
import {
  cacheRevealedSkinAssets,
  getSkinBackgroundUrl,
  getSkinImageUrl,
} from "../lib/skins";
import { MIXED_SKIN_ORDER, STARTER_SKIN_ID } from "@shared/skin-config";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("skin asset URLs", () => {
  it("uses the first free skin as the bundled starter asset", () => {
    expect(STARTER_SKIN_ID).toBe("junior-champion");
    expect(MIXED_SKIN_ORDER[0]).toBe(STARTER_SKIN_ID);
  });

  it("uses relative skin URLs on the web", () => {
    vi.spyOn(Capacitor, "isNativePlatform").mockReturnValue(false);

    expect(getSkinImageUrl("junior-champion")).toBe(
      "/skins/avatars/junior-champion.png?v=10",
    );
    expect(getSkinBackgroundUrl("junior-champion")).toBe(
      "/skins/backgrounds/junior-champion.png?v=21",
    );
  });

  it("keeps starter assets local but loads other skin assets from the server on native", () => {
    vi.spyOn(Capacitor, "isNativePlatform").mockReturnValue(true);

    expect(getSkinImageUrl("junior-champion")).toBe(
      "/skins/avatars/junior-champion.png?v=10",
    );
    expect(getSkinImageUrl("brave-explorer")).toBe(
      "https://littlechamps.net/skins/avatars/brave-explorer.png?v=10",
    );
    expect(getSkinBackgroundUrl("junior-champion")).toBe(
      "/skins/backgrounds/junior-champion.png?v=21",
    );
    expect(getSkinBackgroundUrl("brave-explorer")).toBe(
      "https://littlechamps.net/skins/backgrounds/brave-explorer.png?v=21",
    );
  });

  it("downloads revealed native skin assets one pair at a time", async () => {
    vi.spyOn(Capacitor, "isNativePlatform").mockReturnValue(true);
    const requestedUrls: string[] = [];

    class MockImage {
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;

      set src(url: string) {
        requestedUrls.push(url);
        queueMicrotask(() => this.onload?.());
      }
    }

    vi.stubGlobal("Image", MockImage);

    await Promise.all([
      cacheRevealedSkinAssets("brave-explorer"),
      cacheRevealedSkinAssets("star-cadet"),
    ]);

    expect(requestedUrls).toEqual([
      "https://littlechamps.net/skins/avatars/brave-explorer.png?v=10",
      "https://littlechamps.net/skins/backgrounds/brave-explorer.png?v=21",
      "https://littlechamps.net/skins/avatars/star-cadet.png?v=10",
      "https://littlechamps.net/skins/backgrounds/star-cadet.png?v=21",
    ]);
  });
});