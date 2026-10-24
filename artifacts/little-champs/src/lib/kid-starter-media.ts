import { isNativePlatform } from "@/lib/platform";
import { isStandardSkin } from "@shared/skin-config";
import { getChildStartArtworkUrl } from "@/lib/start-artwork";

// Dedicated artwork, never a replacement for the regular avatar/background pair.
const mediaBase = isNativePlatform()
  ? "https://littlechamps.net/api/kid-starter-media/v1/"
  : `${import.meta.env.BASE_URL}api/kid-starter-media/v1/`;
export function getKidStarterHeroUrl(id: string): string {
  if (!isStandardSkin(id)) throw new Error("Only standard heroes belong in the starter selection");
  return `${mediaBase}${encodeURIComponent(id)}.webp`;
}

export const KID_STARTER_CARD_BACKGROUND_URL = `${mediaBase}card-background.webp`;
export function getKidStarterBannerUrl(language: string): string {
  return getChildStartArtworkUrl(language);
}
