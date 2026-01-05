/**
 * Subscription Tier Configuration
 * Defines limits and features for each HeroKids subscription tier
 * 
 * NEW 3-Tier Structure (January 2026):
 * - Free: Basic features for small families
 * - Family: Full premium features for growing families
 * - Family Hero: Unlimited everything + future features
 */

export type SubscriptionTier = "free" | "family" | "family_hero";

// Keep family_plus for backward compatibility with existing database records
export type SubscriptionTierLegacy = SubscriptionTier | "family_plus";

export interface TierConfig {
  id: SubscriptionTier;
  name: string;
  price: number; // Monthly price in euros
  maxMembers: number;
  features: {
    // Core features (available in Free)
    customTasks: boolean;
    customRewards: boolean;
    monthlyLeaderboard: boolean;
    weeklyLeaderboard: boolean;
    darkMode: boolean;
    recurringTasks: boolean;
    statistics: boolean;
    
    // Premium features (Family+)
    photoProof: boolean;
    multiTask: boolean; // Multi-completion tasks
    familyGoals: boolean;
    sharedRewards: boolean;
    familyChat: boolean;
    deviceLinking: boolean;
    achievements: boolean;
    pushNotifications: boolean;
    
    // Legacy features (kept for compatibility)
    taskTemplates: boolean;
    advancedAnalytics: boolean;
    rewardRequests: boolean;
    taskComments: boolean;
    
    // Skin system
    maxSkins: number; // Maximum skins that can be unlocked
  };
  stripePriceId?: string; // Stripe price ID (configured in Stripe dashboard)
}

export const TIER_CONFIG: Record<SubscriptionTier, TierConfig> = {
  free: {
    id: "free",
    name: "Free",
    price: 0,
    maxMembers: 3,
    features: {
      // Core features - ALL available in Free
      customTasks: true,
      customRewards: true,
      monthlyLeaderboard: true,
      weeklyLeaderboard: true,
      darkMode: true,
      recurringTasks: true,
      statistics: true,
      
      // Premium features - NOT in Free
      photoProof: false,
      multiTask: false,
      familyGoals: false,
      sharedRewards: false,
      familyChat: false,
      deviceLinking: false,
      achievements: false,
      pushNotifications: false,
      
      // Legacy features
      taskTemplates: false,
      advancedAnalytics: false,
      rewardRequests: false,
      taskComments: false,
      
      maxSkins: 3, // Only 3 skins in Free tier
    },
  },
  family: {
    id: "family",
    name: "Family",
    price: 4.99,
    maxMembers: 6,
    features: {
      // Core features
      customTasks: true,
      customRewards: true,
      monthlyLeaderboard: true,
      weeklyLeaderboard: true,
      darkMode: true,
      recurringTasks: true,
      statistics: true,
      
      // Premium features - ALL available in Family
      photoProof: true,
      multiTask: true,
      familyGoals: true,
      sharedRewards: true,
      familyChat: true,
      deviceLinking: true,
      achievements: true,
      pushNotifications: true,
      
      // Legacy features
      taskTemplates: true,
      advancedAnalytics: true,
      rewardRequests: true,
      taskComments: true,
      
      maxSkins: 999, // All skins available
    },
    stripePriceId: typeof process !== 'undefined' ? process.env.STRIPE_PRICE_FAMILY : undefined,
  },
  family_hero: {
    id: "family_hero",
    name: "Family Hero",
    price: 12.99,
    maxMembers: 999, // Effectively unlimited
    features: {
      // Core features
      customTasks: true,
      customRewards: true,
      monthlyLeaderboard: true,
      weeklyLeaderboard: true,
      darkMode: true,
      recurringTasks: true,
      statistics: true,
      
      // Premium features - ALL available
      photoProof: true,
      multiTask: true,
      familyGoals: true,
      sharedRewards: true,
      familyChat: true,
      deviceLinking: true,
      achievements: true,
      pushNotifications: true,
      
      // Legacy features
      taskTemplates: true,
      advancedAnalytics: true,
      rewardRequests: true,
      taskComments: true,
      
      maxSkins: 999, // All skins available
    },
    stripePriceId: typeof process !== 'undefined' ? process.env.STRIPE_PRICE_FAMILY_HERO : undefined,
  },
};

// Legacy tier mapping for existing family_plus subscribers
// They get upgraded to family_hero features
export function normalizeTier(tier: SubscriptionTierLegacy): SubscriptionTier {
  if (tier === "family_plus") {
    return "family_hero"; // Upgrade family_plus users to family_hero
  }
  return tier;
}

/**
 * Get tier configuration for a subscription tier
 */
export function getTierConfig(tier: SubscriptionTierLegacy): TierConfig {
  const normalizedTier = normalizeTier(tier);
  return TIER_CONFIG[normalizedTier];
}

/**
 * Check if a tier has access to a specific feature
 */
export function hasFeature(tier: SubscriptionTierLegacy, feature: keyof TierConfig["features"]): boolean {
  const normalizedTier = normalizeTier(tier);
  const value = TIER_CONFIG[normalizedTier].features[feature];
  return typeof value === 'boolean' ? value : value > 0;
}

/**
 * Get the maximum number of family members allowed for a tier
 */
export function getMaxMembers(tier: SubscriptionTierLegacy): number {
  const normalizedTier = normalizeTier(tier);
  return TIER_CONFIG[normalizedTier].maxMembers;
}

/**
 * Get the maximum number of skins that can be unlocked for a tier
 */
export function getMaxSkins(tier: SubscriptionTierLegacy): number {
  const normalizedTier = normalizeTier(tier);
  return TIER_CONFIG[normalizedTier].features.maxSkins;
}

/**
 * Check if a family can add more members based on their tier
 */
export function canAddMember(tier: SubscriptionTierLegacy, currentMemberCount: number): boolean {
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
export function getUpgradeOptions(currentTier: SubscriptionTierLegacy): TierConfig[] {
  const normalizedTier = normalizeTier(currentTier);
  const currentPrice = TIER_CONFIG[normalizedTier].price;
  return getAllTiers().filter(tier => tier.price > currentPrice);
}
