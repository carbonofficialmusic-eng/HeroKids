/**
 * Pure helpers for resolving the correct subscription tier from RevenueCat
 * subscriber data.  Extracted so the decision logic can be unit-tested
 * independently of the Express route handler.
 */

export const FAMILY_SUB_IDS     = ["com.herokids.family.monthly",    "com.herokids.family.yearly"]    as const;
export const FAMILY_PRO_SUB_IDS = ["com.herokids.familypro.monthly", "com.herokids.familypro.yearly"] as const;

type SubRecord = { purchase_date?: string };

/** Latest purchase_date among the given product IDs, or epoch-0 if none found. */
function latestPurchaseDate(
  ids: readonly string[],
  subs: Record<string, SubRecord>,
): Date {
  return ids.reduce((best, pid) => {
    const raw = subs[pid]?.purchase_date;
    if (!raw) return best;
    const parsed = new Date(raw);
    return parsed > best ? parsed : best;
  }, new Date(0));
}

/**
 * Resolve Fallback D: the client claims 'family' but family_pro is currently
 * active in RevenueCat.  Two mutually exclusive scenarios:
 *
 * A) Genuine downgrade — user purchased Family as a scheduled downgrade from
 *    FamilyPro.  Apple keeps FamilyPro active until the next billing date, so
 *    the 'family' entitlement is not yet live in RC.  Indicator: the most-recent
 *    Family subscription purchase_date is STRICTLY LATER than the most-recent
 *    FamilyPro purchase_date.  → grant "family".
 *
 * B) Admin-reset scenario — the DB was set to Free by an admin while the RC
 *    family_pro subscription is still live.  Apple won't create a new 'family'
 *    subscription on top of an active family_pro, so either no Family key exists
 *    in RC's subscriptions map, or the existing one is older than the family_pro
 *    entry.  → grant "family_hero" to reflect what is actually active in RC.
 *
 * Note: RC's subscriptions map retains historical entries (including expired
 * ones), so the *existence* of a 'family' key alone is not sufficient evidence
 * of a genuine downgrade — we require it to be strictly newer.
 */
export function resolveFallbackD(
  allSubs: Record<string, SubRecord>,
): "family" | "family_hero" {
  const latestFamily    = latestPurchaseDate(FAMILY_SUB_IDS,     allSubs);
  const latestFamilyPro = latestPurchaseDate(FAMILY_PRO_SUB_IDS, allSubs);
  return latestFamily > latestFamilyPro ? "family" : "family_hero";
}

/**
 * PRODUCT_CHANGE webhook guard: returns true when the most-recent Family
 * subscription purchase_date is strictly later than the most-recent FamilyPro
 * purchase_date, meaning the PRODUCT_CHANGE to family_pro is a renewal/overlap
 * event during an in-progress downgrade and should be suppressed.
 */
export function isFamilySubNewerThanFamilyPro(
  subs: Record<string, SubRecord>,
): boolean {
  return latestPurchaseDate(FAMILY_SUB_IDS, subs) > latestPurchaseDate(FAMILY_PRO_SUB_IDS, subs);
}
