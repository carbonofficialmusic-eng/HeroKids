/**
 * Character Skin System Configuration
 * NEW: Mixed skin order with linear unlock (80 points per skin)
 * HeroKids Legacy skins remain at the end
 */

export const POINTS_PER_SKIN = 80;
export const LEGACY_UNLOCK_THRESHOLD = 9100; // Points needed to unlock Legacy skins

/**
 * All regular skin IDs in mixed order (alternating between different themes)
 * This creates variety so children always have something interesting to unlock
 */
export const MIXED_SKIN_ORDER: string[] = [
  // Mix skins from different packs for variety
  "junior-champion",      // Starter
  "t-rex",                // Dinosaur
  "princess-tiara",       // Princess
  "tech-ninja",           // Elite
  "astronaut-kid",        // Space
  "cat-girl",             // Animals
  "classic-vampire",      // Vampire
  "ballerina-pink",       // Ballerina
  "classic-superhero",    // Superhero
  "titan-mech",           // Mecha
  "ninja-shadow",         // Manga
  "pro-gamer",            // Gaming
  "pteranodon",           // Pterosaur
  
  "brave-explorer",       // Starter
  "triceratops",          // Dinosaur
  "purple-princess",      // Princess
  "ocean-guardian",       // Elite
  "space-cadet-blue",     // Space
  "bunny-girl",           // Animals
  "bat-boy",              // Vampire
  "swan-ballerina",       // Ballerina
  "lightning-speedster",  // Superhero
  "cyber-warrior",        // Mecha
  "spirit-fox",           // Manga
  "pixel-warrior",        // Gaming
  "quetzalcoatlus",       // Pterosaur
  
  "star-cadet",           // Starter
  "stegosaurus",          // Dinosaur
  "ice-princess",         // Princess
  "sky-knight",           // Elite
  "green-alien",          // Space
  "fox-girl",             // Animals
  "moonlight-vampire",    // Vampire
  "purple-ballerina",     // Ballerina
  "tech-hero",            // Superhero
  "iron-guardian",        // Mecha
  "dragon-slayer",        // Manga
  "controller-king",      // Gaming
  "rhamphorhynchus",      // Pterosaur
  
  "nature-scout",         // Starter
  "velociraptor",         // Dinosaur
  "rainbow-princess",     // Princess
  "fire-phoenix",         // Elite
  "rocket-pilot",         // Space
  "puppy-girl",           // Animals
  "gothic-vampire",       // Vampire
  "blue-ballerina",       // Ballerina
  "nature-guardian",      // Superhero
  "plasma-bot",           // Mecha
  "magical-girl",         // Manga
  "vr-champion",          // Gaming
  "pterodactylus",        // Pterosaur
  
  "speed-runner",         // Starter
  "brachiosaurus",        // Dinosaur
  "nature-princess",      // Princess
  "crystal-mage",         // Elite
  "moon-walker",          // Space
  "panda-girl",           // Animals
  "shadow-vampire",       // Vampire
  "golden-ballerina",     // Ballerina
  "ice-hero",             // Superhero
  "steel-samurai",        // Mecha
  "samurai-hero",         // Manga
  "stream-star",          // Gaming
  "dimorphodon",          // Pterosaur
  
  "book-wizard",          // Starter
  "spinosaurus",          // Dinosaur
  "sun-princess",         // Princess
  "neon-rebel",           // Elite
  "galaxy-scout",         // Space
  "deer-girl",            // Animals
  "night-hunter",         // Vampire
  "peach-ballerina",      // Ballerina
  "fire-hero",            // Superhero
  "thunder-mech",         // Mecha
  "elemental-master",     // Manga
  "arcade-master",        // Gaming
  "tapejara",             // Pterosaur
  
  "kitchen-hero",         // Starter
  "ankylosaurus",         // Dinosaur
  "ocean-princess",       // Princess
  "cosmic-drifter",       // Elite
  "robot-astronaut",      // Space
  "raccoon-girl",         // Animals
  "blood-moon-vampire",   // Vampire
  "mint-ballerina",       // Ballerina
  "shadow-ninja",         // Superhero
  "neon-droid",           // Mecha
  "cat-fighter",          // Manga
  "console-hero",         // Gaming
  "anhanguera",           // Pterosaur
  
  "art-master",           // Starter
  "allosaurus",           // Dinosaur
  "fairy-princess",       // Princess
  "thunder-champion",     // Elite
  "star-captain",         // Space
  "squirrel-girl",        // Animals
  "vampire-prince",       // Vampire
  "rainbow-ballerina",    // Ballerina
  "shield-hero",          // Superhero
  "battle-commander",     // Mecha
  "school-hero",          // Manga
  "level-boss",           // Gaming
  "dsungaripterus",       // Pterosaur
  
  // Bonus Adventure Pack (fills remaining slots)
  "pirate-captain",       // Adventure
  "wizard-kid",           // Adventure
  "rock-star",            // Adventure
  "detective-kid",        // Adventure
];

/**
 * Always available skins - these can be discovered from the start regardless of points
 * (Last 6 standard skins before Legacy)
 */
export const ALWAYS_AVAILABLE_SKINS: string[] = [
  "level-boss",           // Gaming
  "dsungaripterus",       // Pterosaur
  "pirate-captain",       // Adventure
  "wizard-kid",           // Adventure
  "rock-star",            // Adventure
  "detective-kid",        // Adventure
];

/**
 * Check if a skin is always available (no point requirement)
 */
export function isAlwaysAvailableSkin(skinId: string): boolean {
  return ALWAYS_AVAILABLE_SKINS.includes(skinId);
}

/**
 * HeroKids Legacy skins (unlock after all regular skins at 9100+ points)
 */
export const LEGACY_SKIN_ORDER: string[] = [
  "shield-blaze",
  "comet-dash",
  "wave-glider",
  "forest-guard",
  "luna-beacon",
  "sunrise-spark",
  "bloom-guardian",
  "breeze-captain",
  "storm-runner",
  "star-guardian",
  "thunder-bolt",
  "heart-shield",
];

/**
 * Get the position of a skin in the unlock order
 * Returns -1 if skin is not found in regular order (might be Legacy)
 */
export function getSkinPosition(skinId: string): number {
  const regularIndex = MIXED_SKIN_ORDER.indexOf(skinId);
  if (regularIndex !== -1) {
    return regularIndex;
  }
  
  // Check legacy skins
  const legacyIndex = LEGACY_SKIN_ORDER.indexOf(skinId);
  if (legacyIndex !== -1) {
    return MIXED_SKIN_ORDER.length + legacyIndex;
  }
  
  return -1;
}

/**
 * Check if a skin is a Legacy skin
 */
export function isLegacySkin(skinId: string): boolean {
  return LEGACY_SKIN_ORDER.includes(skinId);
}

/**
 * Calculate how many skins can be unlocked with given points
 * Regular skins: 80 points each
 * Legacy skins: only available after 9100 points
 */
export function calculateUnlockableSkins(totalEarned: number): number {
  // Regular skins: floor(points / 80), max 104
  const regularUnlocks = Math.min(
    Math.floor(totalEarned / POINTS_PER_SKIN),
    MIXED_SKIN_ORDER.length
  );
  
  // Legacy skins: available if points >= 9100
  if (totalEarned >= LEGACY_UNLOCK_THRESHOLD) {
    const pointsAfterThreshold = totalEarned - LEGACY_UNLOCK_THRESHOLD;
    const legacyUnlocks = Math.min(
      Math.floor(pointsAfterThreshold / POINTS_PER_SKIN) + 1,
      LEGACY_SKIN_ORDER.length
    );
    return regularUnlocks + legacyUnlocks;
  }
  
  return regularUnlocks;
}

/**
 * Calculate available discovery cards (skins that can be unlocked)
 */
export function calculateAvailableCards(totalEarned: number, discoveredCount: number): number {
  const maxUnlockable = calculateUnlockableSkins(totalEarned);
  const available = maxUnlockable - discoveredCount;
  return Math.max(0, available);
}

/**
 * Check if a specific skin can be unlocked based on its position and points
 */
export function canUnlockSkin(skinId: string, totalEarned: number, discoveredCount: number): boolean {
  const position = getSkinPosition(skinId);
  if (position === -1) return false;
  
  // Always-available skins can be discovered anytime (if not already discovered)
  if (isAlwaysAvailableSkin(skinId)) {
    return true;
  }
  
  // Check if we have available cards
  const availableCards = calculateAvailableCards(totalEarned, discoveredCount);
  if (availableCards <= 0) return false;
  
  // For legacy skins, check threshold
  if (isLegacySkin(skinId)) {
    return totalEarned >= LEGACY_UNLOCK_THRESHOLD;
  }
  
  // For regular skins, check if position is within unlockable range
  const maxUnlockable = calculateUnlockableSkins(totalEarned);
  return position < maxUnlockable;
}

/**
 * Get progress toward next skin unlock
 */
export function getCardProgress(totalEarned: number): { current: number; max: number } {
  const remainder = totalEarned % POINTS_PER_SKIN;
  return {
    current: remainder,
    max: POINTS_PER_SKIN,
  };
}

// Legacy exports for backward compatibility
export const SKIN_TIERS: any[] = []; // Empty - no longer used
export function getUnlockedTier(totalEarned: number): number {
  // Return a high number so all skins are "unlocked" tier-wise
  // The new system uses position-based unlocking
  return 999;
}
export function getSkinTier(skinId: string): number {
  // Legacy skins return tier 14, others return 1
  return isLegacySkin(skinId) ? 14 : 1;
}
export function getTierConfig(tier: number): any {
  return { tier, name: "", unlockThreshold: 0, pointsPerCard: 80, skinCount: 0 };
}

/**
 * Get all skins in the correct display order (mixed + legacy at end)
 */
export function getAllSkinsInOrder(): string[] {
  return [...MIXED_SKIN_ORDER, ...LEGACY_SKIN_ORDER];
}

/**
 * Get skin info including position and unlock requirements
 */
export function getSkinUnlockInfo(skinId: string): {
  position: number;
  pointsRequired: number;
  isLegacy: boolean;
} {
  const position = getSkinPosition(skinId);
  const isLegacy = isLegacySkin(skinId);
  
  let pointsRequired: number;
  if (isLegacy) {
    const legacyPosition = LEGACY_SKIN_ORDER.indexOf(skinId);
    pointsRequired = LEGACY_UNLOCK_THRESHOLD + (legacyPosition * POINTS_PER_SKIN);
  } else {
    pointsRequired = (position + 1) * POINTS_PER_SKIN;
  }
  
  return { position, pointsRequired, isLegacy };
}
