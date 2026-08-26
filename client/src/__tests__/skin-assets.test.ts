import { afterEach, describe, expect, it, vi } from "vitest";
import { Capacitor } from "@capacitor/core";
import { getSkinBackgroundUrl, getSkinImageUrl } from "../lib/skins";
import { MIXED_SKIN_ORDER, STARTER_SKIN_ID } from "@shared/skin-config";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("skin asset URLs", () => {
  it("uses the first free skin as the bundled starter asset", () => {
    expect(STARTER_SKIN_ID).toBe("junior-champion");
    expect(MIXED_SKIN_ORDER[0]).toBe(STARTER_SKIN_ID);
  });

  it("uses relative skin URLs on the web", () => {
    vi.spyOn(Capacitor, "isNativePlatform").mockReturnValue(false);

    expect(getSkinImageUrl("junior-champion")).toBe(
      "/skins/avatars/junior-champion.png",
    );
    expect(getSkinBackgroundUrl("junior-champion")).toBe(
      "/skins/backgrounds/junior-champion.png?v=2",
    );
  });

  it("keeps the starter background local but loads other backgrounds from the server on native", () => {
    vi.spyOn(Capacitor, "isNativePlatform").mockReturnValue(true);

    expect(getSkinImageUrl("junior-champion")).toBe(
      "/skins/avatars/junior-champion.png",
    );
    expect(getSkinBackgroundUrl("junior-champion")).toBe(
      "/skins/backgrounds/junior-champion.png?v=2",
    );
    expect(getSkinBackgroundUrl("brave-explorer")).toBe(
      "https://littlechamps.net/skins/backgrounds/brave-explorer.png?v=2",
    );
  });
});