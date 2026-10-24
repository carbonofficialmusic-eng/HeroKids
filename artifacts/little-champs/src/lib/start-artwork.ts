import { isNativePlatform } from "@/lib/platform";

type StartArtwork = "parent" | "child";
type StartArtworkKey = StartArtwork | `${StartArtwork}:${string}`;
const welcomeLanguages = new Set(["de", "en", "es", "fr", "ja", "ko", "pt", "sv", "zh"]);

declare global {
  interface Window {
    __LITTLE_CHAMPS_START_ARTWORK__?: Readonly<Partial<Record<StartArtworkKey, string>>>;
  }
}

/** iOS injects bundled illustrations into the remote website at document start.
 * Older builds must not substitute their German image for another language. */
export function getStartArtworkUrl(kind: StartArtwork, onlineUrl: string, language = "de"): string {
  const key: StartArtworkKey = language !== "de" ? `${kind}:${language}` : kind;
  const bundled = typeof window !== "undefined" && isNativePlatform()
    ? window.__LITTLE_CHAMPS_START_ARTWORK__?.[key]
    : undefined;
  return bundled?.startsWith("data:image/webp;base64,") ? bundled : onlineUrl;
}

function getLocalizedStartArtworkUrl(kind: StartArtwork, language: string): string {
  const requested = language.toLowerCase().split(/[-_]/)[0];
  const locale = welcomeLanguages.has(requested) ? requested : "en";
  const stem = kind === "parent" ? "welcome-start" : "welcome-kid-start";
  const file = locale === "de" ? `${stem}.webp` : `${stem}-${locale}.webp`;
  return getStartArtworkUrl(kind, `${import.meta.env.BASE_URL}images/${file}`, locale);
}

export function getParentStartArtworkUrl(language: string): string {
  return getLocalizedStartArtworkUrl("parent", language);
}

export function getChildStartArtworkUrl(language: string): string {
  return getLocalizedStartArtworkUrl("child", language);
}
