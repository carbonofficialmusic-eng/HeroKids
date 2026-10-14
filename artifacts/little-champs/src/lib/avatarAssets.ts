// Avatar asset imports for family member customization
import foxAvatar from "@assets/generated_images/Cute_fox_avatar_character_e27462ae.png";
import bearAvatar from "@assets/generated_images/Cute_bear_avatar_character_c2930694.png";
import rabbitAvatar from "@assets/generated_images/Cute_rabbit_avatar_character_12cf3f2c.png";
import catAvatar from "@assets/generated_images/Cute_cat_avatar_character_0fe91690.png";
import penguinAvatar from "@assets/generated_images/Cute_penguin_avatar_character_8788d7ad.png";
import lionAvatar from "@assets/generated_images/Cute_lion_avatar_character_5e5b20aa.png";

export const avatarAssets = [
  { id: "fox", name: "Fox", url: foxAvatar },
  { id: "bear", name: "Bear", url: bearAvatar },
  { id: "rabbit", name: "Rabbit", url: rabbitAvatar },
  { id: "cat", name: "Cat", url: catAvatar },
  { id: "penguin", name: "Penguin", url: penguinAvatar },
  { id: "lion", name: "Lion", url: lionAvatar },
];

export const colorOptions = [
  { id: "purple", value: "#8B5CF6", name: "Purple" },
  { id: "blue", value: "#3B82F6", name: "Blue" },
  { id: "green", value: "#10B981", name: "Green" },
  { id: "yellow", value: "#F59E0B", name: "Yellow" },
  { id: "pink", value: "#EC4899", name: "Pink" },
  { id: "orange", value: "#F97316", name: "Orange" },
  { id: "red", value: "#EF4444", name: "Red" },
  { id: "teal", value: "#14B8A6", name: "Teal" },
];

// Default avatar IDs that the backend can use (prefixed with "default:")
export const DEFAULT_AVATAR_PREFIX = "default:";

// Get the default avatar IDs that can be stored in the database
export const DEFAULT_AVATAR_IDS = avatarAssets.map(a => `${DEFAULT_AVATAR_PREFIX}${a.id}`);

// Resolve a default avatar marker to the actual bundled URL
export function resolveAvatarUrl(avatarUrl: string | null | undefined): string | null {
  if (!avatarUrl) return null;
  
  // Check if it's a default avatar marker (e.g., "default:fox")
  if (avatarUrl.startsWith(DEFAULT_AVATAR_PREFIX)) {
    const avatarId = avatarUrl.slice(DEFAULT_AVATAR_PREFIX.length);
    const asset = avatarAssets.find(a => a.id === avatarId);
    return asset?.url || avatarAssets[0].url; // Fallback to fox if not found
  }
  
  // Regular URL, return as-is
  return avatarUrl;
}

// Get a random default avatar marker for factory reset
export function getRandomDefaultAvatarMarker(): string {
  const randomIndex = Math.floor(Math.random() * avatarAssets.length);
  return `${DEFAULT_AVATAR_PREFIX}${avatarAssets[randomIndex].id}`;
}
