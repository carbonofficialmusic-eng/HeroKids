// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { getChildStartArtworkUrl, getParentStartArtworkUrl, getStartArtworkUrl } from "@/lib/start-artwork";

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
  expect(media.getKidStarterBannerUrl("de")).toBe(window.__LITTLE_CHAMPS_START_ARTWORK__.child);
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

it.each(["de", "en", "es", "fr", "ja", "ko", "pt", "sv", "zh"])(
  "uses the matching %s welcome image on the website",
  language => {
    native.mockReturnValue(false);
    const file = language === "de" ? "welcome-start.webp" : `welcome-start-${language}.webp`;
    expect(getParentStartArtworkUrl(language)).toBe(`/images/${file}`);
  },
);

it.each(["en", "es", "fr", "ja", "ko", "pt", "sv", "zh"])(
  "uses the bundled %s image in new native builds",
  language => {
    native.mockReturnValue(true);
    window.__LITTLE_CHAMPS_START_ARTWORK__ = {
      parent: "data:image/webp;base64,Z2VybWFu",
      [`parent:${language}`]: "data:image/webp;base64,bG9jYWxpemVk",
    };
    expect(getParentStartArtworkUrl(language)).toBe("data:image/webp;base64,bG9jYWxpemVk");
  },
);

it("does not show a legacy German bundle when another language is selected", () => {
  native.mockReturnValue(true);
  window.__LITTLE_CHAMPS_START_ARTWORK__ = { parent: "data:image/webp;base64,Z2VybWFu" };
  expect(getParentStartArtworkUrl("fr")).toBe("/images/welcome-start-fr.webp");
  expect(getParentStartArtworkUrl("de")).toBe(window.__LITTLE_CHAMPS_START_ARTWORK__.parent);
});

it("normalizes regional language codes and follows the English app fallback", () => {
  native.mockReturnValue(false);
  expect(getParentStartArtworkUrl("en-GB")).toBe("/images/welcome-start-en.webp");
  expect(getParentStartArtworkUrl("pt-BR")).toBe("/images/welcome-start-pt.webp");
  expect(getParentStartArtworkUrl("zh-Hans")).toBe("/images/welcome-start-zh.webp");
  expect(getParentStartArtworkUrl("DE_de")).toBe("/images/welcome-start.webp");
  expect(getParentStartArtworkUrl("unknown")).toBe("/images/welcome-start-en.webp");
  expect(getChildStartArtworkUrl("zh-Hans")).toBe("/images/welcome-kid-start-zh.webp");
  expect(getChildStartArtworkUrl("ja-JP")).toBe("/images/welcome-kid-start-ja.webp");
  expect(getChildStartArtworkUrl("unknown")).toBe("/images/welcome-kid-start-en.webp");
});

it.each(["de", "en", "es", "fr", "ja", "ko", "pt", "sv", "zh"])(
  "uses the matching %s child illustration on the website",
  language => {
    native.mockReturnValue(false);
    const file = language === "de" ? "welcome-kid-start.webp" : `welcome-kid-start-${language}.webp`;
    expect(getChildStartArtworkUrl(language)).toBe(`/images/${file}`);
  },
);

it.each(["en", "es", "fr", "ja", "ko", "pt", "sv", "zh"])(
  "uses the bundled %s child illustration in new native builds",
  language => {
    native.mockReturnValue(true);
    window.__LITTLE_CHAMPS_START_ARTWORK__ = {
      child: "data:image/webp;base64,Z2VybWFu",
      [`child:${language}`]: "data:image/webp;base64,bG9jYWxpemVk",
    };
    expect(getChildStartArtworkUrl(language)).toBe("data:image/webp;base64,bG9jYWxpemVk");
  },
);

it("does not reuse the German child bundle for another language on older iOS builds", () => {
  native.mockReturnValue(true);
  window.__LITTLE_CHAMPS_START_ARTWORK__ = { child: "data:image/webp;base64,Z2VybWFu" };
  expect(getChildStartArtworkUrl("fr")).toBe("/images/welcome-kid-start-fr.webp");
  expect(getChildStartArtworkUrl("de")).toBe(window.__LITTLE_CHAMPS_START_ARTWORK__.child);
});
