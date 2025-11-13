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
    unlockThreshold: 600,
    pointsPerCard: 100,
    skinCount: 8,
  },
  {
    tier: 3,
    name: "Dinosaur Heroes",
    unlockThreshold: 1500,
    pointsPerCard: 120,
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
 * This is a piecewise calculation:
 * - First 600 points earn cards at 80 points/card (Tier 1)
 * - Points 600-1500 earn cards at 100 points/card (Tier 2)
 * - Points 1500+ earn cards at 120 points/card (Tier 3)
 */
export function calculateAvailableCards(totalEarned: number, discoveredCount: number): number {
  let totalCards = 0;

  // Process each tier sequentially
  for (const tierConfig of SKIN_TIERS) {
    // Check if we have enough points to reach this tier
    if (totalEarned < tierConfig.unlockThreshold) {
      break;
    }

    // Calculate points spent in this tier
    const nextTierIndex = SKIN_TIERS.findIndex(t => t.tier === tierConfig.tier + 1);
    const nextTierThreshold = nextTierIndex >= 0 ? SKIN_TIERS[nextTierIndex].unlockThreshold : Infinity;
    
    const pointsInThisTier = Math.min(totalEarned, nextTierThreshold) - tierConfig.unlockThreshold;
    const cardsFromThisTier = Math.floor(pointsInThisTier / tierConfig.pointsPerCard);
    
    totalCards += cardsFromThisTier;
  }

  // Subtract already discovered skins
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
