/**
 * Unit tests for the Fallback D / PRODUCT_CHANGE guard logic in rc-tier-resolver.ts.
 *
 * Three key scenarios for resolveFallbackD:
 *   1. Genuine downgrade — Family sub newer than FamilyPro → "family"
 *   2. Admin-reset — no Family sub in RC → "family_hero"
 *   3. Stale Family history — FamilyPro sub is newer → "family_hero"
 *
 * Plus edge cases: ties, yearly variants, empty map.
 * Same recency logic is also tested for isFamilySubNewerThanFamilyPro (webhook guard).
 */

import { describe, it, expect } from "vitest";
import { resolveFallbackD, isFamilySubNewerThanFamilyPro } from "../lib/rc-tier-resolver";

const now       = new Date("2026-08-12T21:00:00Z");
const yesterday = new Date("2026-08-11T21:00:00Z");
const twoDaysAgo = new Date("2026-08-10T21:00:00Z");

// ---------------------------------------------------------------------------
// resolveFallbackD
// ---------------------------------------------------------------------------

describe("resolveFallbackD", () => {
  it("Scenario A — family sub is newer: genuine downgrade → grants 'family'", () => {
    const allSubs = {
      "com.herokids.family.monthly":    { purchase_date: now.toISOString() },
      "com.herokids.familypro.monthly": { purchase_date: yesterday.toISOString() },
    };
    expect(resolveFallbackD(allSubs)).toBe("family");
  });

  it("Scenario B — no family sub exists: admin-reset → grants 'family_hero'", () => {
    const allSubs = {
      "com.herokids.familypro.monthly": { purchase_date: now.toISOString() },
    };
    expect(resolveFallbackD(allSubs)).toBe("family_hero");
  });

  it("Scenario B — family sub exists but is older than family_pro: stale history → grants 'family_hero'", () => {
    const allSubs = {
      "com.herokids.family.monthly":    { purchase_date: twoDaysAgo.toISOString() },
      "com.herokids.familypro.monthly": { purchase_date: now.toISOString() },
    };
    expect(resolveFallbackD(allSubs)).toBe("family_hero");
  });

  it("tie (equal purchase dates) → grants 'family_hero' (family_pro wins on tie)", () => {
    const d = now.toISOString();
    const allSubs = {
      "com.herokids.family.monthly":    { purchase_date: d },
      "com.herokids.familypro.monthly": { purchase_date: d },
    };
    expect(resolveFallbackD(allSubs)).toBe("family_hero");
  });

  it("yearly family vs monthly family_pro — uses correct product IDs", () => {
    const allSubs = {
      "com.herokids.family.yearly":     { purchase_date: now.toISOString() },
      "com.herokids.familypro.monthly": { purchase_date: yesterday.toISOString() },
    };
    expect(resolveFallbackD(allSubs)).toBe("family");
  });

  it("monthly family vs yearly family_pro — uses correct product IDs", () => {
    const allSubs = {
      "com.herokids.family.monthly":   { purchase_date: twoDaysAgo.toISOString() },
      "com.herokids.familypro.yearly": { purchase_date: now.toISOString() },
    };
    expect(resolveFallbackD(allSubs)).toBe("family_hero");
  });

  it("empty subscriptions map → grants 'family_hero'", () => {
    expect(resolveFallbackD({})).toBe("family_hero");
  });

  it("handles missing purchase_date gracefully (treats as epoch-0)", () => {
    // family entry exists but has no purchase_date; family_pro has a real date
    const allSubs = {
      "com.herokids.family.monthly":    {},
      "com.herokids.familypro.monthly": { purchase_date: now.toISOString() },
    };
    expect(resolveFallbackD(allSubs)).toBe("family_hero");
  });
});

// ---------------------------------------------------------------------------
// isFamilySubNewerThanFamilyPro (PRODUCT_CHANGE webhook guard)
// ---------------------------------------------------------------------------

describe("isFamilySubNewerThanFamilyPro", () => {
  it("family sub is newer → true (PRODUCT_CHANGE to family_pro should be suppressed)", () => {
    const subs = {
      "com.herokids.family.monthly":    { purchase_date: now.toISOString() },
      "com.herokids.familypro.monthly": { purchase_date: yesterday.toISOString() },
    };
    expect(isFamilySubNewerThanFamilyPro(subs)).toBe(true);
  });

  it("no family sub → false (PRODUCT_CHANGE should apply)", () => {
    const subs = {
      "com.herokids.familypro.monthly": { purchase_date: now.toISOString() },
    };
    expect(isFamilySubNewerThanFamilyPro(subs)).toBe(false);
  });

  it("family_pro sub is newer → false (PRODUCT_CHANGE should apply)", () => {
    const subs = {
      "com.herokids.family.monthly":    { purchase_date: yesterday.toISOString() },
      "com.herokids.familypro.monthly": { purchase_date: now.toISOString() },
    };
    expect(isFamilySubNewerThanFamilyPro(subs)).toBe(false);
  });

  it("equal dates → false (tie is not 'newer')", () => {
    const d = now.toISOString();
    const subs = {
      "com.herokids.family.monthly":    { purchase_date: d },
      "com.herokids.familypro.monthly": { purchase_date: d },
    };
    expect(isFamilySubNewerThanFamilyPro(subs)).toBe(false);
  });

  it("empty map → false", () => {
    expect(isFamilySubNewerThanFamilyPro({})).toBe(false);
  });
});
