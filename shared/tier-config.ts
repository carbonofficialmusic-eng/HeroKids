/**
 * Subscription Tier Configuration
 * Defines limits and features for each HomeHero subscription tier
 */

export type SubscriptionTier = "free" | "family" | "family_plus" | "family_hero";

export interface TierConfig {
  id: SubscriptionTier;
  name: string;
  price: number; // Monthly price in dollars
  maxMembers: number;
  features: {
    // Core features
    customTasks: boolean;
    customRewards: boolean;
    monthlyLeaderboard: boolean;
    weeklyLeaderboard: boolean;
    darkMode: boolean;
    
    // Premium features
    photoProof: boolean;
    recurringTasks: boolean;
    taskTemplates: boolean;
    advancedAnalytics: boolean;
    rewardRequests: boolean;
    
    // Advanced features
    familyChat: boolean;
    taskComments: boolean;
    pushNotifications: boolean;
    
    // Skin system
    maxSkins: number; // Maximum skins that can be unlocked (progression-based within limit)
  };
  stripePriceId?: string; // Stripe price ID (configured in Stripe dashboard)
}

export const TIER_CONFIG: Record<SubscriptionTier, TierConfig> = {
  free: {
    id: "free",
    name: "Free",
    price: 0,
    maxMembers: 2,
    features: {
      customTasks: true,
      customRewards: true,
      monthlyLeaderboard: true,
      weeklyLeaderboard: false,
      darkMode: true,
      photoProof: false,
      recurringTasks: false,
      taskTemplates: false,
      advancedAnalytics: false,
      rewardRequests: false,
      familyChat: false,
      taskComments: false,
      pushNotifications: false,
      maxSkins: 3, // Can unlock up to 3 skins through progression
    },
  },
  family: {
    id: "family",
    name: "Family",
    price: 3,
    maxMembers: 4,
    features: {
      customTasks: true,
      customRewards: true,
      monthlyLeaderboard: true,
      weeklyLeaderboard: true,
      darkMode: true,
      photoProof: true,
      recurringTasks: true,
      taskTemplates: true,
      advancedAnalytics: true,
      rewardRequests: true,
      familyChat: false,
      taskComments: false,
      pushNotifications: false,
      maxSkins: 10, // All skins available through progression
    },
    stripePriceId: process.env.STRIPE_PRICE_FAMILY, // Set via environment variable
  },
  family_plus: {
    id: "family_plus",
    name: "Family+",
    price: 9,
    maxMembers: 6,
    features: {
      customTasks: true,
      customRewards: true,
      monthlyLeaderboard: true,
      weeklyLeaderboard: true,
      darkMode: true,
      photoProof: true,
      recurringTasks: true,
      taskTemplates: true,
      advancedAnalytics: true,
      rewardRequests: true,
      familyChat: true,
      taskComments: true,
      pushNotifications: true,
      maxSkins: 10,
    },
    stripePriceId: process.env.STRIPE_PRICE_FAMILY_PLUS,
  },
  family_hero: {
    id: "family_hero",
    name: "Family Hero",
    price: 15,
    maxMembers: 999, // Effectively unlimited
    features: {
      customTasks: true,
      customRewards: true,
      monthlyLeaderboard: true,
      weeklyLeaderboard: true,
      darkMode: true,
      photoProof: true,
      recurringTasks: true,
      taskTemplates: true,
      advancedAnalytics: true,
      rewardRequests: true,
      familyChat: true,
      taskComments: true,
      pushNotifications: true,
      maxSkins: 10,
    },
    stripePriceId: process.env.STRIPE_PRICE_FAMILY_HERO,
  },
};

/**
 * Get tier configuration for a subscription tier
 */
export function getTierConfig(tier: SubscriptionTier): TierConfig {
  return TIER_CONFIG[tier];
}

/**
 * Check if a tier has access to a specific feature
 */
export function hasFeature(tier: SubscriptionTier, feature: keyof TierConfig["features"]): boolean {
  const value = TIER_CONFIG[tier].features[feature];
  return typeof value === 'boolean' ? value : value > 0;
}

/**
 * Get the maximum number of family members allowed for a tier
 */
export function getMaxMembers(tier: SubscriptionTier): number {
  return TIER_CONFIG[tier].maxMembers;
}

/**
 * Get the maximum number of skins that can be unlocked for a tier
 */
export function getMaxSkins(tier: SubscriptionTier): number {
  return TIER_CONFIG[tier].features.maxSkins;
}

/**
 * Check if a family can add more members based on their tier
 */
export function canAddMember(tier: SubscriptionTier, currentMemberCount: number): boolean {
  const maxMembers = getMaxMembers(tier);
  return currentMemberCount < maxMembers;
}

/**
 * Get all tiers sorted by price (for upgrade UI)
 */
export function getAllTiers(): TierConfig[] {
  return Object.values(TIER_CONFIG).sort((a, b) => a.price - b.price);
}

/**
 * Get upgrade options from current tier
 */
export function getUpgradeOptions(currentTier: SubscriptionTier): TierConfig[] {
  const currentPrice = TIER_CONFIG[currentTier].price;
  return getAllTiers().filter(tier => tier.price > currentPrice);
}
