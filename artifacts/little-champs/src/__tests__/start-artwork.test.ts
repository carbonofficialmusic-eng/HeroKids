// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { getStartArtworkUrl } from "@/lib/start-artwork";

const { native } = vi.hoisted(() => ({ native: vi.fn() }));
vi.mock("@/lib/platform", () => ({ isNativePlatform: native }));
afterEach(() => {
  delete window.__LITTLE_CHAMPS_START_ARTWORK__;
  vi.resetAllMocks();
  vi.resetModules();
});

it("uses the two on-board illustrations without changing random hero downloads", async () => {
  native.mockReturnValue(true);
  window.__LITTLE_CHAMPS_START_ARTWORK__ = {
    parent: "data:image/webp;base64,cGFyZW50",
    child: "data:image/webp;base64,Y2hpbGQ=",
  };
  expect(getStartArtworkUrl("parent", "/online-parent.webp")).toBe(window.__LITTLE_CHAMPS_START_ARTWORK__.parent);
  const media = await import("@/lib/kid-starter-media");
  expect(media.KID_STARTER_BANNER_URL).toBe(window.__LITTLE_CHAMPS_START_ARTWORK__.child);
  expect(media.getKidStarterHeroUrl("t-rex")).toBe("https://littlechamps.net/api/kid-starter-media/v1/t-rex.webp");
  expect(media.KID_STARTER_CARD_BACKGROUND_URL).toContain("https://littlechamps.net/api/");
});

it("keeps older native versions working through the existing online URLs", () => {
  native.mockReturnValue(true);
  expect(getStartArtworkUrl("parent", "/online-parent.webp")).toBe("/online-parent.webp");
  expect(getStartArtworkUrl("child", "/online-child.webp")).toBe("/online-child.webp");
});

it("never switches the regular website to native resources", () => {
  native.mockReturnValue(false);
  window.__LITTLE_CHAMPS_START_ARTWORK__ = { child: "data:image/webp;base64,Y2hpbGQ=" };
  expect(getStartArtworkUrl("child", "/online-child.webp")).toBe("/online-child.webp");
});

it("rejects non-image or unexpected injected resource URLs", () => {
  native.mockReturnValue(true);
  window.__LITTLE_CHAMPS_START_ARTWORK__ = { child: "https://unexpected.example/image.webp" };
  expect(getStartArtworkUrl("child", "/online-child.webp")).toBe("/online-child.webp");
});
