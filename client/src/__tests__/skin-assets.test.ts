import { afterEach, describe, expect, it, vi } from "vitest";
import { Capacitor } from "@capacitor/core";
import { getSkinBackgroundUrl, getSkinImageUrl } from "../lib/skins";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("skin asset URLs", () => {
  it("uses relative skin URLs on the web", () => {
    vi.spyOn(Capacitor, "isNativePlatform").mockReturnValue(false);

    expect(getSkinImageUrl("junior-champion")).toBe(
      "/skins/avatars/junior-champion.png",
    );
    expect(getSkinBackgroundUrl("junior-champion")).toBe(
      "/skins/backgrounds/junior-champion.png?v=2",
    );
  });

  it("keeps avatars local but loads backgrounds from the server on native", () => {
    vi.spyOn(Capacitor, "isNativePlatform").mockReturnValue(true);

    expect(getSkinImageUrl("junior-champion")).toBe(
      "/skins/avatars/junior-champion.png",
    );
    expect(getSkinBackgroundUrl("junior-champion")).toBe(
      "https://littlechamps.net/skins/backgrounds/junior-champion.png?v=2",
    );
  });
});