import { CachedImage, warmImagesEarly } from "@/lib/image-cache";

const BUILT_IN_REWARD_ICONS = [
  "ice-cream", "cinema", "board-game", "amusement-park", "pizza", "bicycle",
  "football", "books", "baking", "trophy", "gaming", "gift", "dice", "guitar",
  "circus", "bowling-pin", "clock", "carnival-mask",
].map((name) => `/reward-icons/${name}.png`);

// The picker is used from a dialog that mounts on demand. Start warming these
// stable built-in assets when this module is first loaded, not on every open.
warmImagesEarly(BUILT_IN_REWARD_ICONS);

export function isImageIcon(icon: string | null | undefined): boolean {
  if (!icon) return false;
  return icon.startsWith("/") || icon.startsWith("http");
}

export function RewardIconDisplay({
  icon,
  textClassName = "text-4xl leading-none",
  imgClassName = "w-full h-full object-contain drop-shadow-sm",
}: {
  icon: string | null | undefined;
  textClassName?: string;
  imgClassName?: string;
}) {
  const value = icon || "🎁";
  if (isImageIcon(value)) {
    return <CachedImage src={value} alt="" className={imgClassName} />;
  }
  return <span className={textClassName}>{value}</span>;
}
