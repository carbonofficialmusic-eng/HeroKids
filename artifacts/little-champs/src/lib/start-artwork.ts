import { isNativePlatform } from "@/lib/platform";

type StartArtwork = "parent" | "child";

declare global {
  interface Window {
    __LITTLE_CHAMPS_START_ARTWORK__?: Readonly<Partial<Record<StartArtwork, string>>>;
  }
}

/** The new iOS build injects these two bundled illustrations at document start,
 * including into the remote website. Older builds and browsers stay online. */
export function getStartArtworkUrl(kind: StartArtwork, onlineUrl: string): string {
  const bundled = typeof window !== "undefined" && isNativePlatform()
    ? window.__LITTLE_CHAMPS_START_ARTWORK__?.[kind]
    : undefined;
  return bundled?.startsWith("data:image/webp;base64,") ? bundled : onlineUrl;
}
