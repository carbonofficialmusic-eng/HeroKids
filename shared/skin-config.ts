/**
 * Character Skin System Configuration
 * Defines tier unlocks, card costs, and skin discovery mechanics
 */

export interface SkinTierConfig {
  tier: number;
  name: string;
  unlockThreshold: number; // Total points required to unlock this tier's skins
  pointsPerCard: number; // Points required to earn 1 discovery card for this tier
  skinCount: number;
}

/**
 * Tier configuration for the skin discovery system
 */
export const SKIN_TIERS: SkinTierConfig[] = [
  {
    tier: 1,
    name: "Starter Heroes",
    unlockThreshold: 0, // Available from the start
    pointsPerCard: 80,
    skinCount: 8,
  },
  {
    tier: 2,
    name: "Elite Heroes",
    unlockThreshold: 700,
    pointsPerCard: 80,
    skinCount: 8,
  },
  {
    tier: 3,
    name: "Dinosaur Heroes",
    unlockThreshold: 1400,
    pointsPerCard: 80,
    skinCount: 8,
  },
  {
    tier: 4,
    name: "Magical Princess World",
    unlockThreshold: 2100,
    pointsPerCard: 80,
    skinCount: 8,
  },
  {
    tier: 5,
    name: "Space Explorers",
    unlockThreshold: 2800,
    pointsPerCard: 80,
    skinCount: 8,
  },
  {
    tier: 6,
    name: "Cute Animals",
    unlockThreshold: 3500,
    pointsPerCard: 80,
    skinCount: 8,
  },
  {
    tier: 7,
    name: "Vampire Adventure",
    unlockThreshold: 4200,
    pointsPerCard: 80,
    skinCount: 8,
  },
  {
    tier: 8,
    name: "Ballerina Dreams",
    unlockThreshold: 4900,
    pointsPerCard: 80,
    skinCount: 8,
  },
  {
    tier: 9,
    name: "Superhero Squad",
    unlockThreshold: 5600,
    pointsPerCard: 80,
    skinCount: 8,
  },
  {
    tier: 10,
    name: "Mecha Robots",
    unlockThreshold: 6300,
    pointsPerCard: 80,
    skinCount: 8,
  },
  {
    tier: 11,
    name: "Manga Heroes",
    unlockThreshold: 7000,
    pointsPerCard: 80,
    skinCount: 8,
  },
  {
    tier: 12,
    name: "Gaming Legends",
    unlockThreshold: 7700,
    pointsPerCard: 80,
    skinCount: 8,
  },
  {
    tier: 13,
    name: "Pterosaur Sky",
    unlockThreshold: 8400,
    pointsPerCard: 80,
    skinCount: 8,
  },
  {
    tier: 14,
    name: "HeroKids Legacy",
    unlockThreshold: 9100,
    pointsPerCard: 80,
    skinCount: 8,
  },
];

/**
 * Get tier configuration by tier number
 */
export function getTierConfig(tier: number): SkinTierConfig | undefined {
  return SKIN_TIERS.find(t => t.tier === tier);
}

/**
 * Determine which tier is unlocked based on total earned points
 */
export function getUnlockedTier(totalEarned: number): number {
  // Start from highest tier and work down
  for (let i = SKIN_TIERS.length - 1; i >= 0; i--) {
    if (totalEarned >= SKIN_TIERS[i].unlockThreshold) {
      return SKIN_TIERS[i].tier;
    }
  }
  return 1; // Default to tier 1
}

/**
 * Calculate total available discovery cards across all unlocked tiers
 * Simplified: All tiers cost 80 points per card
 * - Tier 1 unlocks at 0 points (8 skins = max 640 points to discover all)
 * - Tier 2 unlocks at 700 points (8 skins = max 640 points to discover all)
 * - Tier 3 unlocks at 1400 points (8 skins = max 640 points to discover all)
 */
export function calculateAvailableCards(totalEarned: number, discoveredCount: number): number {
  // Simple calculation: total points divided by 80, minus already discovered
  const totalCards = Math.floor(totalEarned / 80);
  const availableCards = totalCards - discoveredCount;
  
  // Never return negative cards
  return Math.max(0, availableCards);
}

/**
 * Calculate progress toward next discovery card in current tier
 * Returns { current: number, max: number } representing partial progress
 */
export function getCardProgress(totalEarned: number, discoveredCount: number): { current: number; max: number } {
  const unlockedTier = getUnlockedTier(totalEarned);
  const tierConfig = getTierConfig(unlockedTier);
  
  if (!tierConfig) {
    return { current: 0, max: 80 };
  }

  // Calculate how many points we've earned beyond this tier's unlock threshold
  const pointsIntoCurrentTier = totalEarned - tierConfig.unlockThreshold;
  
  // Calculate the remainder (progress toward next card in this tier)
  const remainder = pointsIntoCurrentTier % tierConfig.pointsPerCard;
  
  return {
    current: remainder,
    max: tierConfig.pointsPerCard,
  };
}

/**
 * Skin IDs grouped by tier for easy filtering
 */
export const SKIN_IDS_BY_TIER: Record<number, string[]> = {
  1: [
    "junior-champion",
    "brave-explorer",
    "star-cadet",
    "nature-scout",
    "speed-runner",
    "book-wizard",
    "kitchen-hero",
    "art-master",
  ],
  2: [
    "tech-ninja",
    "ocean-guardian",
    "sky-knight",
    "fire-phoenix",
    "crystal-mage",
    "neon-rebel",
    "cosmic-drifter",
    "thunder-champion",
  ],
  3: [
    "t-rex",
    "triceratops",
    "stegosaurus",
    "velociraptor",
    "brachiosaurus",
    "spinosaurus",
    "ankylosaurus",
    "allosaurus",
  ],
  4: [
    "princess-tiara",
    "purple-princess",
    "ice-princess",
    "rainbow-princess",
    "nature-princess",
    "sun-princess",
    "ocean-princess",
    "fairy-princess",
  ],
  5: [
    "astronaut-kid",
    "space-cadet-blue",
    "green-alien",
    "rocket-pilot",
    "moon-walker",
    "galaxy-scout",
    "robot-astronaut",
    "star-captain",
  ],
  6: [
    "cat-girl",
    "bunny-girl",
    "fox-girl",
    "puppy-girl",
    "panda-girl",
    "deer-girl",
    "raccoon-girl",
    "squirrel-girl",
  ],
  7: [
    "classic-vampire",
    "bat-boy",
    "moonlight-vampire",
    "gothic-vampire",
    "shadow-vampire",
    "night-hunter",
    "blood-moon-vampire",
    "vampire-prince",
  ],
  8: [
    "ballerina-pink",
    "swan-ballerina",
    "purple-ballerina",
    "blue-ballerina",
    "golden-ballerina",
    "peach-ballerina",
    "mint-ballerina",
    "rainbow-ballerina",
  ],
  9: [
    "classic-superhero",
    "lightning-speedster",
    "tech-hero",
    "nature-guardian",
    "ice-hero",
    "fire-hero",
    "shadow-ninja",
    "shield-hero",
  ],
  10: [
    "titan-mech",
    "cyber-warrior",
    "iron-guardian",
    "plasma-bot",
    "steel-samurai",
    "thunder-mech",
    "neon-droid",
    "battle-commander",
  ],
  11: [
    "ninja-shadow",
    "spirit-fox",
    "dragon-slayer",
    "magical-girl",
    "samurai-hero",
    "elemental-master",
    "cat-fighter",
    "school-hero",
  ],
  12: [
    "pro-gamer",
    "pixel-warrior",
    "controller-king",
    "vr-champion",
    "stream-star",
    "arcade-master",
    "console-hero",
    "level-boss",
  ],
  13: [
    "pteranodon",
    "quetzalcoatlus",
    "rhamphorhynchus",
    "pterodactylus",
    "dimorphodon",
    "tapejara",
    "anhanguera",
    "dsungaripterus",
  ],
  14: [
    "shield-blaze",
    "comet-dash",
    "wave-glider",
    "forest-guard",
    "luna-beacon",
    "sunrise-spark",
    "bloom-guardian",
    "breeze-captain",
  ],
};

/**
 * Get tier number for a specific skin ID
 */
export function getSkinTier(skinId: string): number {
  for (const [tier, skinIds] of Object.entries(SKIN_IDS_BY_TIER)) {
    if (skinIds.includes(skinId)) {
      return parseInt(tier);
    }
  }
  return 1; // Default to tier 1
}
