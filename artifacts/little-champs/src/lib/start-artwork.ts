import { isNativePlatform } from "@/lib/platform";

type StartArtwork = "parent" | "child";
type StartArtworkKey = StartArtwork | `parent:${string}`;
const welcomeLanguages = new Set(["de", "en", "es", "fr", "ja", "ko", "pt", "sv", "zh"]);

declare global {
  interface Window {
    __LITTLE_CHAMPS_START_ARTWORK__?: Readonly<Partial<Record<StartArtworkKey, string>>>;
  }
}

/** iOS injects bundled illustrations into the remote website at document start.
 * Older builds must not substitute their German image for another language. */
export function getStartArtworkUrl(kind: StartArtwork, onlineUrl: string, language = "de"): string {
  const key: StartArtworkKey = kind === "parent" && language !== "de" ? `parent:${language}` : kind;
  const bundled = typeof window !== "undefined" && isNativePlatform()
    ? window.__LITTLE_CHAMPS_START_ARTWORK__?.[key]
    : undefined;
  return bundled?.startsWith("data:image/webp;base64,") ? bundled : onlineUrl;
}

export function getParentStartArtworkUrl(language: string): string {
  const requested = language.toLowerCase().split(/[-_]/)[0];
  const locale = welcomeLanguages.has(requested) ? requested : "en";
  const file = locale === "de" ? "welcome-start.webp" : `welcome-start-${locale}.webp`;
  return getStartArtworkUrl("parent", `${import.meta.env.BASE_URL}images/${file}`, locale);
}
