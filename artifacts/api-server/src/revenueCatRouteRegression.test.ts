import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { isFamilySubNewerThanFamilyPro, resolveFallbackD } from "./lib/rc-tier-resolver";
import {
  getRevenueCatEntitlements,
  getRevenueCatNonSubscriptions,
  getRevenueCatSubscriber,
  getRevenueCatSubscriptions,
  isRevenueCatEntitlementActive,
  RevenueCatVerificationError,
  requireVerifiedRevenueCatPayload,
  resolveRevenueCatSyncVerification,
  withVerifiedRevenueCatPayload,
} from "./lib/revenuecat-payload";

const routesSource = readFileSync(new URL("./routes/routes.ts", import.meta.url), "utf8");

describe("RevenueCat route compile/runtime regressions", () => {
  it("safely rejects null, primitive, array, and invalid nested RevenueCat JSON", () => {
    for (const payload of [null, "bad", 7, [], {}]) {
      expect(getRevenueCatSubscriber(payload)).toBeNull();
      expect(getRevenueCatEntitlements(payload)).toEqual({});
      expect(getRevenueCatSubscriptions(payload)).toEqual({});
      expect(getRevenueCatNonSubscriptions(payload)).toBeNull();
    }

    const malformedPayload = {
      subscriber: {
        entitlements: [
          { expires_date: null },
        ],
        subscriptions: null,
        non_subscriptions: ["not", "a", "record"],
      },
    };
    expect(getRevenueCatSubscriber(malformedPayload)).toEqual(malformedPayload.subscriber);
    expect(getRevenueCatEntitlements(malformedPayload)).toEqual({});
    expect(getRevenueCatSubscriptions(malformedPayload)).toEqual({});
    expect(getRevenueCatNonSubscriptions(malformedPayload)).toBeNull();
  });

  it("narrows valid and partial entitlement/subscription records without trusting bad fields", () => {
    const payload = {
      subscriber: {
        entitlements: {
          family: { expires_date: "2026-07-01T00:00:00Z", product_identifier: "family.monthly" },
          family_pro: { expires_date: null, product_identifier: "family-pro-lifetime" },
          partial: { product_identifier: "legacy-product" },
          invalid: { expires_date: 123, product_identifier: "bad-expiration" },
          malformed: null,
        },
        subscriptions: {
          monthly: {
            expires_date: "2026-07-01T00:00:00Z",
            purchase_date: "2026-06-01T00:00:00Z",
            unsubscribe_detected_at: null,
          },
          partial: { purchase_date: "2026-05-01T00:00:00Z" },
          noPurchaseDate: { expires_date: null },
          invalid: { purchase_date: 123 },
        },
        non_subscriptions: {
          lifetime: [{ id: "lifetime-transaction" }],
        },
      },
    };

    expect(getRevenueCatEntitlements(payload)).toStrictEqual({
      family: { expires_date: "2026-07-01T00:00:00Z", product_identifier: "family.monthly" },
      family_pro: { expires_date: null, product_identifier: "family-pro-lifetime" },
      partial: { expires_date: undefined, product_identifier: "legacy-product" },
      invalid: { expires_date: undefined, product_identifier: "bad-expiration" },
      malformed: {},
    });
    expect(getRevenueCatSubscriptions(payload)).toStrictEqual({
      monthly: {
        expires_date: "2026-07-01T00:00:00Z",
        purchase_date: "2026-06-01T00:00:00Z",
        unsubscribe_detected_at: null,
      },
      partial: {
        expires_date: undefined,
        purchase_date: "2026-05-01T00:00:00Z",
        unsubscribe_detected_at: undefined,
      },
      noPurchaseDate: {
        expires_date: null,
        purchase_date: undefined,
        unsubscribe_detected_at: undefined,
      },
      invalid: {
        expires_date: undefined,
        purchase_date: undefined,
        unsubscribe_detected_at: undefined,
      },
    });
    expect(getRevenueCatNonSubscriptions(payload)).toEqual({
      lifetime: [{ id: "lifetime-transaction" }],
    });
  });

  it("retains future active entitlement/subscription evidence when unrelated metadata is malformed", async () => {
    const payload = {
      subscriber: {
        entitlements: {
          family: { expires_date: "2026-07-01T00:00:00Z", product_identifier: { malformed: true } },
          family_pro: { expires_date: null },
        },
        subscriptions: {
          "com.herokids.family.monthly": {
            expires_date: "2026-07-01T00:00:00Z",
            purchase_date: 123,
            unsubscribe_detected_at: { malformed: true },
          },
        },
      },
    };
    const now = new Date("2026-06-15T00:00:00Z");
    const entitlements = getRevenueCatEntitlements(payload);
    const subscriptions = getRevenueCatSubscriptions(payload);

    expect(entitlements.family.product_identifier).toBeUndefined();
    expect(isRevenueCatEntitlementActive(entitlements.family, now)).toBe(true);
    expect(subscriptions["com.herokids.family.monthly"]).toStrictEqual({
      expires_date: "2026-07-01T00:00:00Z",
      purchase_date: undefined,
      unsubscribe_detected_at: undefined,
    });

    const mutation = vi.fn();
    await withVerifiedRevenueCatPayload(payload, mutation);
    expect(mutation).toHaveBeenCalledOnce();
  });

  it("rejects invalid destructive snapshots before the mutation callback can run", async () => {
    const valid = {
      subscriber: {
        entitlements: {
          family: { expires_date: "2026-07-01T00:00:00Z" },
        },
        subscriptions: {
          "com.herokids.family.monthly": { expires_date: null },
        },
      },
    };
    const malformedSnapshots: unknown[] = [
      null,
      {},
      { subscriber: { entitlements: {}, subscriptions: [] } },
      { subscriber: { entitlements: [], subscriptions: {} } },
      { subscriber: { entitlements: { family: null }, subscriptions: {} } },
      { subscriber: { entitlements: { family: {} }, subscriptions: {} } },
      { subscriber: { entitlements: { family: { expires_date: "not-a-date" } }, subscriptions: {} } },
      { subscriber: { entitlements: {}, subscriptions: { "com.herokids.family.monthly": null } } },
      { subscriber: { entitlements: {}, subscriptions: { "com.herokids.family.monthly": {} } } },
      { subscriber: { entitlements: {}, subscriptions: { "com.herokids.family.monthly": { expires_date: "bad" } } } },
    ];

    expect(requireVerifiedRevenueCatPayload(valid).subscriber.entitlements.family.expires_date)
      .toBe("2026-07-01T00:00:00Z");
    for (const snapshot of malformedSnapshots) {
      const mutation = vi.fn();
      await expect(withVerifiedRevenueCatPayload(snapshot, mutation)).rejects.toBeInstanceOf(RevenueCatVerificationError);
      expect(mutation).not.toHaveBeenCalled();
    }
  });

  it("preserves active, expired, invalid-date, and missing-expiration semantics", () => {
    const now = new Date("2026-06-15T00:00:00Z");

    expect(isRevenueCatEntitlementActive({ expires_date: null }, now)).toBe(true);
    expect(isRevenueCatEntitlementActive({ expires_date: "2026-06-16T00:00:00Z" }, now)).toBe(true);
    expect(isRevenueCatEntitlementActive({ expires_date: "2026-06-14T00:00:00Z" }, now)).toBe(false);
    expect(isRevenueCatEntitlementActive({ expires_date: "not-a-date" }, now)).toBe(false);
    expect(isRevenueCatEntitlementActive({}, now)).toBe(false);
    expect(isRevenueCatEntitlementActive(undefined, now)).toBe(false);
  });

  it("never treats client-only purchase flags as server verification", () => {
    expect(resolveRevenueCatSyncVerification(false, false, true)).toBe("retry");
    expect(resolveRevenueCatSyncVerification(false, false, false)).toBe("inactive");
    expect(resolveRevenueCatSyncVerification(true, false, true)).toBe("verified");
    expect(resolveRevenueCatSyncVerification(false, true, false)).toBe("verified");
    expect(routesSource).toContain("resolveRevenueCatSyncVerification(");
    expect(routesSource).not.toContain("verifiedViaClientSDK");
  });

  it("keeps an active later Family purchase as a downgrade instead of restoring FamilyPro", () => {
    const subscriptions = {
      "com.herokids.familypro.monthly": { purchase_date: "2026-05-01T00:00:00Z" },
      "com.herokids.family.monthly": { purchase_date: "2026-06-01T00:00:00Z" },
    };

    expect(isFamilySubNewerThanFamilyPro(subscriptions)).toBe(true);
    expect(resolveFallbackD(subscriptions)).toBe("family");
    expect(routesSource).toContain("if (isFamilySubNewerThanFamilyPro(subs))");
    expect(routesSource).toContain("getRevenueCatSubscriptions(rcSubData)");
  });

  it("verifies current RevenueCat entitlement state before webhook downgrade", () => {
    const expirationHandling = routesSource.slice(
      routesSource.indexOf('case "EXPIRATION":'),
      routesSource.indexOf('default:', routesSource.indexOf('case "EXPIRATION":')),
    );

    expect(expirationHandling).toContain("const currentEntitlements = getRevenueCatEntitlements(rcData)");
    expect(expirationHandling).toContain("if (activeEntitlement)");
    expect(expirationHandling).toContain('subscriptionTier: "free"');
    expect(expirationHandling).toContain("preserving tier");
    expect(expirationHandling).toContain("requireVerifiedRevenueCatPayload(await rcRes.json())");
    expect(expirationHandling).toContain("withVerifiedRevenueCatPayload(rcData, async () =>");
  });

  it("requires strict provider verification for reset and every end-promo reread", () => {
    const resetHandling = routesSource.slice(
      routesSource.indexOf('app.patch("/api/admin/families/:familyName/tier"'),
      routesSource.indexOf('// Grant RC Promotional Entitlement'),
    );
    const endPromoHandling = routesSource.slice(
      routesSource.indexOf('app.post("/api/admin/families/:familyName/end-promo"'),
      routesSource.indexOf("// Remove member from family"),
    );

    expect(resetHandling).toContain("requireVerifiedRevenueCatPayload(await rcRes.json())");
    expect(resetHandling).toContain("withVerifiedRevenueCatPayload(verifiedResetPayload, updateTier)");
    expect(resetHandling).not.toContain("RC unreachable — allow reset");
    expect(endPromoHandling).toContain("return requireVerifiedRevenueCatPayload(await response.json())");
    expect(endPromoHandling).toContain("withVerifiedRevenueCatPayload(subscriber, async () =>");
  });

  it("keeps the historical Stripe API version and resolves relocated email imports", () => {
    expect(routesSource).toContain('"2025-10-29.clover" as Stripe.LatestApiVersion');
    expect(routesSource).toContain('import("../email.js")');
    expect(routesSource).toContain('import("../email")');
    expect(routesSource).not.toContain('import("./email.js")');
    expect(routesSource).not.toContain('import("./email")');
  });

  it("uses Zod v4 issue fields and retains the legacy family_plus tier contract", () => {
    expect(routesSource).toContain("validation.error.issues");
    expect(routesSource).toContain("validationResult.error.issues");
    expect(routesSource).toContain("error.issues");
    expect(routesSource).not.toContain(".errors");
    expect(routesSource).toContain('value === "family_plus"');
    expect(routesSource).toContain("if (!isSubscriptionTierLegacy(tier))");
  });
});