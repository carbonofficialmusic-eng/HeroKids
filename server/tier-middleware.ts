import { Request, Response, NextFunction } from "express";
import { getTierConfig, hasFeature, canAddMember, getMaxSkins } from "@shared/tier-config";
import type { SubscriptionTier, TierConfig } from "@shared/tier-config";
import type { FamilyMember, Family } from "@shared/schema";

/**
 * Extend Express Request to include tier capabilities
 */
declare global {
  namespace Express {
    interface Request {
      tierCapabilities?: TierConfig["features"];
      familyTier?: SubscriptionTier;
    }
  }
}

/**
 * Middleware to add tier capabilities to request
 * Should be used after authentication middleware
 */
export function addTierCapabilities(
  req: Request,
  res: Response,
  next: NextFunction
) {
  // Get family from request (assumes it's set by auth middleware)
  const family = (req as any).family as Family | undefined;
  
  if (!family) {
    return next();
  }

  const tier = family.subscriptionTier || "free";
  const config = getTierConfig(tier);
  
  req.tierCapabilities = config.features;
  req.familyTier = tier;
  
  next();
}

/**
 * Middleware factory to require a specific feature
 * Returns 403 if the family's tier doesn't have access to the feature
 */
export function requireFeature(featureName: keyof TierConfig["features"]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const tier = req.familyTier || "free";
    
    if (!hasFeature(tier, featureName)) {
      return res.status(403).json({
        message: `This feature requires a higher subscription tier`,
        feature: featureName,
        currentTier: tier,
        requiredTier: getRequiredTierForFeature(featureName),
      });
    }
    
    next();
  };
}

/**
 * Middleware to check if family can add more members
 */
export function checkMemberLimit(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const tier = req.familyTier || "free";
  const currentMemberCount = (req as any).currentMemberCount as number;
  
  if (!canAddMember(tier, currentMemberCount)) {
    const config = getTierConfig(tier);
    return res.status(403).json({
      message: `Member limit reached for ${config.name} tier`,
      currentMembers: currentMemberCount,
      maxMembers: config.maxMembers,
      upgradeTier: tier === "free" ? "family" : tier === "family" ? "family_plus" : "family_hero",
    });
  }
  
  next();
}

/**
 * Check if a skin can be unlocked based on tier limits
 */
export function canUnlockSkin(tier: SubscriptionTier, currentUnlockedCount: number): boolean {
  const maxSkins = getMaxSkins(tier);
  return currentUnlockedCount < maxSkins;
}

/**
 * Helper to get the minimum tier required for a feature
 */
function getRequiredTierForFeature(feature: keyof TierConfig["features"]): SubscriptionTier {
  const tiers: SubscriptionTier[] = ["free", "family", "family_plus", "family_hero"];
  
  for (const tier of tiers) {
    if (hasFeature(tier, feature)) {
      return tier;
    }
  }
  
  return "family_hero";
}

/**
 * Check if subscription is active and not expired
 */
export function checkSubscriptionActive(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const family = (req as any).family as Family | undefined;
  
  if (!family) {
    return next();
  }

  // Free tier never expires
  if (family.subscriptionTier === "free") {
    return next();
  }

  // Check if subscription is expired
  if (family.tierExpiresAt && new Date(family.tierExpiresAt) < new Date()) {
    return res.status(402).json({
      message: "Subscription has expired",
      tier: family.subscriptionTier,
      expiredAt: family.tierExpiresAt,
      downgradeDate: family.tierExpiresAt,
    });
  }

  // Check subscription status
  if (family.subscriptionStatus && !["active", "trialing"].includes(family.subscriptionStatus)) {
    return res.status(402).json({
      message: "Subscription is not active",
      status: family.subscriptionStatus,
      tier: family.subscriptionTier,
    });
  }

  next();
}
