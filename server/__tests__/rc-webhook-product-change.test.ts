/**
 * Integration tests for the RevenueCat webhook handler — specifically the
 * PRODUCT_CHANGE guard (guard is ONLY active for PRODUCT_CHANGE + family_pro).
 *
 * Covered scenarios:
 *   1. INITIAL_PURCHASE with family_pro  → tier updated to family_hero (guard never fires)
 *   2. RENEWAL with family_pro           → tier updated to family_hero (guard never fires)
 *   3. UNCANCELLATION with family_pro    → tier updated to family_hero (guard never fires)
 *   4. PRODUCT_CHANGE, family sub newer  → suppressed, tier unchanged
 *   5. PRODUCT_CHANGE, family_pro newer  → tier updated to family_hero
 */

import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from "vitest";
import express from "express";
import http from "http";
import { Pool, neonConfig } from "@neondatabase/serverless";
import ws from "ws";
import { drizzle } from "drizzle-orm/neon-serverless";
import { eq } from "drizzle-orm";
import { families } from "@shared/schema";
import crypto from "crypto";

// ---------------------------------------------------------------------------
// DB setup
// ---------------------------------------------------------------------------

neonConfig.webSocketConstructor = ws;
const pool = new Pool({ connectionString: process.env.DATABASE_URL! });
const testDb = drizzle({ client: pool });

const UID = `test-wh-${Date.now()}`;
const FAMILY = `${UID}-family`;

async function seedFamily(tier = "free") {
  await testDb.insert(families).values({
    familyName: FAMILY,
    joinCode: crypto.randomBytes(3).toString("hex").toUpperCase(),
    subscriptionTier: tier as any,
  });
}

async function getFamily() {
  const [row] = await testDb.select().from(families).where(eq(families.familyName, FAMILY));
  return row;
}

async function cleanupFamily() {
  await testDb.delete(families).where(eq(families.familyName, FAMILY));
}

// ---------------------------------------------------------------------------
// App bootstrap
// ---------------------------------------------------------------------------

let server: http.Server;
let baseUrl: string;

async function startApp() {
  // No webhook secret → all requests are accepted
  delete process.env.REVENUECAT_WEBHOOK_SECRET;

  const app = express();
  app.use(express.json());
  const { registerRoutes } = await import("../../server/routes");
  await registerRoutes(app);
  await new Promise<void>((resolve) => {
    server = app.listen(0, "127.0.0.1", () => resolve());
  });
  const addr = server.address() as { port: number };
  baseUrl = `http://127.0.0.1:${addr.port}`;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** POST a webhook event to the running server. */
async function sendWebhook(eventType: string, entitlementIds: string[]) {
  const res = await realFetch(`${baseUrl}/api/revenuecat-webhook`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      event: {
        type: eventType,
        app_user_id: FAMILY,
        entitlement_ids: entitlementIds,
        product_id: entitlementIds.includes("family_pro")
          ? "com.herokids.familypro.monthly"
          : "com.herokids.family.monthly",
      },
    }),
  });
  return { status: res.status, body: await res.json().catch(() => null) };
}

/** RC subscriber response with family_pro as the most-recent subscription. */
function rcWithFamilyProNewer() {
  const now = new Date().toISOString();
  const old = new Date(Date.now() - 86_400_000).toISOString();
  return {
    subscriber: {
      subscriptions: {
        "com.herokids.familypro.monthly": { purchase_date: now },
        "com.herokids.family.monthly":    { purchase_date: old },
      },
    },
  };
}

/** RC subscriber response with family as the most-recent subscription. */
function rcWithFamilyNewer() {
  const now = new Date().toISOString();
  const old = new Date(Date.now() - 86_400_000).toISOString();
  return {
    subscriber: {
      subscriptions: {
        "com.herokids.family.monthly":    { purchase_date: now },
        "com.herokids.familypro.monthly": { purchase_date: old },
      },
    },
  };
}

// Preserve the real fetch before any vi.spyOn overrides it
const realFetch = global.fetch;

/**
 * Intercept only calls to api.revenuecat.com and return the given data.
 * All other fetch calls (e.g. to baseUrl) are forwarded to the real fetch.
 */
function mockRcFetch(subscriberData: object) {
  return vi.spyOn(global, "fetch").mockImplementation(async (url, init) => {
    if (typeof url === "string" && url.includes("api.revenuecat.com")) {
      return new Response(JSON.stringify(subscriberData), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
    return realFetch(url as string, init);
  });
}

// ---------------------------------------------------------------------------
// Lifecycle
// ---------------------------------------------------------------------------

beforeAll(async () => {
  await startApp();
}, 30_000);

afterAll(async () => {
  await cleanupFamily();
  await pool.end();
  server.close();
});

afterEach(async () => {
  vi.restoreAllMocks();
  // Reset tier to "free" so each test starts from a clean state
  await testDb.update(families)
    .set({ subscriptionTier: "free" as any, subscriptionStatus: "canceled" })
    .where(eq(families.familyName, FAMILY));
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("RC webhook — PRODUCT_CHANGE guard only fires for PRODUCT_CHANGE + family_pro", () => {
  beforeAll(async () => {
    await seedFamily("free");
  });

  it("INITIAL_PURCHASE with family_pro → updates tier to family_hero (guard does not fire)", async () => {
    const { status } = await sendWebhook("INITIAL_PURCHASE", ["family_pro"]);
    expect(status).toBe(200);
    const row = await getFamily();
    expect(row.subscriptionTier).toBe("family_hero");
  });

  it("RENEWAL with family_pro → updates tier to family_hero (guard does not fire)", async () => {
    const { status } = await sendWebhook("RENEWAL", ["family_pro"]);
    expect(status).toBe(200);
    const row = await getFamily();
    expect(row.subscriptionTier).toBe("family_hero");
  });

  it("UNCANCELLATION with family_pro → updates tier to family_hero (guard does not fire)", async () => {
    const { status } = await sendWebhook("UNCANCELLATION", ["family_pro"]);
    expect(status).toBe(200);
    const row = await getFamily();
    expect(row.subscriptionTier).toBe("family_hero");
  });

  it("PRODUCT_CHANGE with family_pro + family sub is newer → suppressed, tier unchanged", async () => {
    // The test must set REVENUECAT_API_KEY for the guard's RC lookup to run
    process.env.REVENUECAT_API_KEY = "test-key";
    mockRcFetch(rcWithFamilyNewer());

    const { status } = await sendWebhook("PRODUCT_CHANGE", ["family_pro"]);
    expect(status).toBe(200);
    const row = await getFamily();
    // Tier should remain "free" — the PRODUCT_CHANGE was suppressed
    expect(row.subscriptionTier).toBe("free");

    delete process.env.REVENUECAT_API_KEY;
  });

  it("PRODUCT_CHANGE with family_pro + family_pro is newer → updates tier to family_hero", async () => {
    process.env.REVENUECAT_API_KEY = "test-key";
    mockRcFetch(rcWithFamilyProNewer());

    const { status } = await sendWebhook("PRODUCT_CHANGE", ["family_pro"]);
    expect(status).toBe(200);
    const row = await getFamily();
    expect(row.subscriptionTier).toBe("family_hero");

    delete process.env.REVENUECAT_API_KEY;
  });

  it("PRODUCT_CHANGE with family entitlement → updates tier to family (no guard for family entitlement)", async () => {
    const { status } = await sendWebhook("PRODUCT_CHANGE", ["family"]);
    expect(status).toBe(200);
    const row = await getFamily();
    expect(row.subscriptionTier).toBe("family");
  });
});

describe("RC webhook — EXPIRATION downgrades promo families correctly", () => {
  beforeAll(async () => {
    // family was already seeded above; ensure it exists
  });

  it("EXPIRATION with isAdminGranted:false (promo family) → downgrades to free", async () => {
    // Set family to paid with isAdminGranted=false (how promo grants are stored)
    await testDb.update(families)
      .set({ subscriptionTier: "family_hero" as any, subscriptionStatus: "active", isAdminGranted: false })
      .where(eq(families.familyName, FAMILY));

    const res = await realFetch(`${baseUrl}/api/revenuecat-webhook`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        event: {
          type: "EXPIRATION",
          app_user_id: FAMILY,
          entitlement_ids: ["family_pro"],
          product_id: "rc_promo_family_pro_monthly",
        },
      }),
    });
    expect(res.status).toBe(200);
    const row = await getFamily();
    expect(row.subscriptionTier).toBe("free");
  });

  it("EXPIRATION with isAdminGranted:true (direct DB override) → tier unchanged, admin grant protected", async () => {
    // Set family to paid with isAdminGranted=true (emergency DB override — should NOT be downgraded by webhook)
    await testDb.update(families)
      .set({ subscriptionTier: "family_hero" as any, subscriptionStatus: "active", isAdminGranted: true })
      .where(eq(families.familyName, FAMILY));

    const res = await realFetch(`${baseUrl}/api/revenuecat-webhook`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        event: {
          type: "EXPIRATION",
          app_user_id: FAMILY,
          entitlement_ids: ["family_pro"],
          product_id: "com.herokids.familypro.monthly",
        },
      }),
    });
    expect(res.status).toBe(200);
    const row = await getFamily();
    // isAdminGranted:true prevents EXPIRATION from downgrading
    expect(row.subscriptionTier).toBe("family_hero");
  });

  it("NON_RENEWING_PURCHASE with rc_promo product → self-heals DB tier if endpoint write had failed", async () => {
    // Start from free to simulate a state where the promo endpoint RC call succeeded
    // but the DB write failed; the webhook should heal it.
    await testDb.update(families)
      .set({ subscriptionTier: "free" as any, subscriptionStatus: "canceled", isAdminGranted: false })
      .where(eq(families.familyName, FAMILY));

    const res = await realFetch(`${baseUrl}/api/revenuecat-webhook`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        event: {
          type: "NON_RENEWING_PURCHASE",
          app_user_id: FAMILY,
          entitlement_ids: ["family_pro"],
          product_id: "rc_promo_family_pro_monthly",
        },
      }),
    });
    expect(res.status).toBe(200);
    const row = await getFamily();
    // Webhook healed the DB — tier now reflects the promo grant
    expect(row.subscriptionTier).toBe("family_hero");
  });
});
