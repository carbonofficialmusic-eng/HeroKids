import { resolveAvatarUrl } from "@/lib/avatarAssets";
import { isNativePlatform } from "@/lib/platform";
import { STARTER_SKIN_ID } from "@shared/skin-config";

// Avatars and the free starter background remain part of the local iOS web bundle.
// Other backgrounds are excluded from that bundle and loaded on demand from the
// production server. Web builds keep relative URLs so they use their own host.
const NATIVE_SKIN_ASSET_ORIGIN = "https://littlechamps.net";

export function getSkinImageUrl(skinId: string): string {
  return `/skins/avatars/${skinId}.png`;
}

// Bump this version when background images are updated to bust the immutable cache
const BACKGROUND_VERSION = 2;

export function getSkinBackgroundUrl(skinId: string): string {
  const path = `/skins/backgrounds/${skinId}.png?v=${BACKGROUND_VERSION}`;
  const hasLocalNativeAsset = skinId === STARTER_SKIN_ID;
  return isNativePlatform() && !hasLocalNativeAsset
    ? `${NATIVE_SKIN_ASSET_ORIGIN}${path}`
    : path;
}

// All valid skin IDs — used to check whether a URL exists.
const KNOWN_SKIN_IDS = new Set([
  // Tier 1 - Starter Heroes
  "junior-champion", "brave-explorer", "star-cadet", "nature-scout",
  "speed-runner", "book-wizard", "kitchen-hero", "art-master",
  // Tier 2 - Elite Heroes
  "tech-ninja", "ocean-guardian", "sky-knight", "fire-phoenix",
  "crystal-mage", "neon-rebel", "cosmic-drifter", "thunder-champion",
  // Tier 3 - Dinosaur Heroes
  "t-rex", "triceratops", "stegosaurus", "velociraptor",
  "brachiosaurus", "spinosaurus", "ankylosaurus", "allosaurus",
  // Tier 4 - Magical Princess World
  "princess-tiara", "purple-princess", "ice-princess", "rainbow-princess",
  "nature-princess", "sun-princess", "ocean-princess", "fairy-princess",
  // Tier 5 - Space Explorers
  "astronaut-kid", "space-cadet-blue", "green-alien", "rocket-pilot",
  "moon-walker", "galaxy-scout", "robot-astronaut", "star-captain",
  // Tier 6 - Cute Animals
  "cat-girl", "bunny-girl", "fox-girl", "puppy-girl",
  "panda-girl", "deer-girl", "raccoon-girl", "squirrel-girl",
  // Tier 7 - Vampire Adventure
  "classic-vampire", "bat-boy", "moonlight-vampire", "gothic-vampire",
  "shadow-vampire", "night-hunter", "blood-moon-vampire", "vampire-prince",
  // Tier 8 - Ballerina Dreams
  "ballerina-pink", "swan-ballerina", "purple-ballerina", "blue-ballerina",
  "golden-ballerina", "peach-ballerina", "mint-ballerina", "rainbow-ballerina",
  // Tier 9 - Superhero Squad
  "classic-superhero", "lightning-speedster", "tech-hero", "nature-guardian",
  "ice-hero", "fire-hero", "shadow-ninja", "shield-hero",
  // Tier 10 - Mecha Robots
  "titan-mech", "cyber-warrior", "iron-guardian", "plasma-bot",
  "steel-samurai", "thunder-mech", "neon-droid", "battle-commander",
  // Tier 11 - Manga Heroes
  "ninja-shadow", "spirit-fox", "dragon-slayer", "magical-girl",
  "samurai-hero", "elemental-master", "cat-fighter", "school-hero",
  // Tier 12 - Gaming Legends
  "pro-gamer", "pixel-warrior", "controller-king", "vr-champion",
  "stream-star", "arcade-master", "console-hero", "level-boss",
  // Tier 13 - Pterosaur Sky
  "pteranodon", "quetzalcoatlus", "rhamphorhynchus", "pterodactylus",
  "dimorphodon", "tapejara", "anhanguera", "dsungaripterus", "nemicolopterus",
  // Tier 14 - Little Champs Legacy
  "shield-blaze", "comet-dash", "wave-glider", "forest-guard",
  "luna-beacon", "sunrise-spark", "bloom-guardian", "breeze-captain",
  "storm-runner", "star-guardian", "thunder-bolt", "heart-shield",
  // Tier 15 - Bonus Adventure Pack
  "pirate-captain", "wizard-kid", "rock-star", "detective-kid", "skater-kid",
]);

// Legacy compatibility: components that use SKIN_IMAGES[id] or SKIN_BACKGROUNDS[id]
// get the same URL they would from the helpers above.
export const SKIN_IMAGES: Record<string, string> = new Proxy({} as Record<string, string>, {
  get(_target, prop: string) {
    if (KNOWN_SKIN_IDS.has(prop)) return getSkinImageUrl(prop);
    return undefined;
  },
  has(_target, prop: string) {
    return KNOWN_SKIN_IDS.has(prop as string);
  },
});

export const SKIN_BACKGROUNDS: Record<string, string> = new Proxy({} as Record<string, string>, {
  get(_target, prop: string) {
    if (KNOWN_SKIN_IDS.has(prop)) return getSkinBackgroundUrl(prop);
    return undefined;
  },
  has(_target, prop: string) {
    return KNOWN_SKIN_IDS.has(prop as string);
  },
});

// Cache-busting for user-uploaded /objects/ URLs (not skin assets)
function addCacheBuster(url: string | undefined, updatedAt?: Date | string | null): string | undefined {
  if (!url) return url;
  if (url.startsWith('/objects/') && updatedAt) {
    const timestamp = typeof updatedAt === 'string' ? new Date(updatedAt).getTime() : updatedAt.getTime();
    const separator = url.includes('?') ? '&' : '?';
    return `${url}${separator}v=${timestamp}`;
  }
  return url;
}

// Returns the avatar URL to display for a member.
// Respects useCustomAvatar flag so a custom photo can coexist with a skin background.
export function getAvatarUrl(
  activeSkinId: string | null | undefined,
  customAvatarUrl: string | null | undefined,
  useCustomAvatar: boolean = false,
  updatedAt?: Date | string | null
): string | undefined {
  if (useCustomAvatar && customAvatarUrl) {
    const resolvedUrl = resolveAvatarUrl(customAvatarUrl);
    if (resolvedUrl) {
      return addCacheBuster(resolvedUrl, updatedAt);
    }
  }
  if (activeSkinId && KNOWN_SKIN_IDS.has(activeSkinId)) {
    return getSkinImageUrl(activeSkinId);
  }
  const resolvedFallback = resolveAvatarUrl(customAvatarUrl);
  return addCacheBuster(resolvedFallback ?? undefined, updatedAt) || undefined;
}

// Returns the themed background URL for the active skin.
export function getBackgroundUrl(activeSkinId: string | null | undefined): string | undefined {
  if (activeSkinId && KNOWN_SKIN_IDS.has(activeSkinId)) {
    return getSkinBackgroundUrl(activeSkinId);
  }
  return undefined;
}
