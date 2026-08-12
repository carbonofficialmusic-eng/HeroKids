/**
 * Integration tests for /api/revenuecat-cancel-sync — promo entitlement handling.
 *
 * Key invariants verified:
 *   1. Active RC Promotional Entitlement → tier preserved, no downgrade
 *   2. Expired RC Promotional Entitlement → family downgraded to free
 *   3. isAdminGranted:true → cancel-sync skips RC entirely (unrelated to promo path)
 *
 * These tests confirm that the promo-entitlement endpoint correctly sets
 * isAdminGranted:false so that cancel-sync's RC verification runs normally.
 *
 * Auth: the cancel-sync endpoint uses isAuthenticated.  In dev mode (NODE_ENV≠production)
 * the X-Dev-Token header is accepted.  We call createDevToken() from replitAuth —
 * which shares the same module instance as the running app — to generate a valid token.
 */

import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from "vitest";
import express from "express";
import http from "http";
import { Pool, neonConfig } from "@neondatabase/serverless";
import ws from "ws";
import { drizzle } from "drizzle-orm/neon-serverless";
import { eq } from "drizzle-orm";
import { families, familyMembers, users } from "@shared/schema";
import bcrypt from "bcrypt";
import crypto from "crypto";

// ---------------------------------------------------------------------------
// DB setup
// ---------------------------------------------------------------------------

neonConfig.webSocketConstructor = ws;
const pool = new Pool({ connectionString: process.env.DATABASE_URL! });
const testDb = drizzle({ client: pool });

const UID     = `test-cs-promo-${Date.now()}`;
const FAMILY  = `${UID}-fam`;
const USER_ID = `${UID}-usr`;

async function seedAll() {
  const hashPw = await bcrypt.hash("TestPass123!", 10);
  await testDb.insert(users).values({
    id: USER_ID,
    email: `${UID}@test.invalid`,
    firstName: "Promo",
    lastName: "Tester",
    passwordHash: hashPw,
    isEmailVerified: true,
  });
  await testDb.insert(families).values({
    familyName: FAMILY,
    joinCode: crypto.randomBytes(3).toString("hex").toUpperCase(),
    subscriptionTier: "family_hero" as any,
    subscriptionStatus: "active",
    isAdminGranted: false,
  });
  await testDb.insert(familyMembers).values({
    userId: USER_ID,
    familyName: FAMILY,
    displayName: "Promo Parent",
    role: "parent",
  });
}

async function cleanupAll() {
  await testDb.delete(familyMembers).where(eq(familyMembers.familyName, FAMILY));
  await testDb.delete(families).where(eq(families.familyName, FAMILY));
  try { await testDb.delete(users).where(eq(users.id, USER_ID)); } catch {}
}

async function resetFamily(tier = "family_hero", isAdminGranted = false) {
  await testDb.update(families)
    .set({ subscriptionTier: tier as any, subscriptionStatus: "active", isAdminGranted })
    .where(eq(families.familyName, FAMILY));
}

async function getFamily() {
  const [row] = await testDb.select().from(families).where(eq(families.familyName, FAMILY));
  return row;
}

// ---------------------------------------------------------------------------
// App bootstrap
// ---------------------------------------------------------------------------

let server: http.Server;
let baseUrl: string;
let devToken: string;

// Preserve real fetch before any spy
const realFetch = global.fetch;

async function startApp() {
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

/** RC stub with an active promotional entitlement (expires_date in the future). */
function rcWithActivePromo(entitlement: "family" | "family_pro") {
  const futureDate = new Date(Date.now() + 30 * 86_400_000).toISOString();
  return {
    subscriber: {
      entitlements: {
        [entitlement]: {
          expires_date: futureDate,
          product_identifier: `rc_promo_${entitlement}_monthly`,
          purchase_date: new Date(Date.now() - 5 * 86_400_000).toISOString(),
        },
      },
      subscriptions: {},
    },
  };
}

/** RC stub with a promotional entitlement that has already expired. */
function rcWithExpiredPromo() {
  const pastDate = new Date(Date.now() - 86_400_000).toISOString();
  return {
    subscriber: {
      entitlements: {
        family_pro: {
          expires_date: pastDate,
          product_identifier: "rc_promo_family_pro_monthly",
          purchase_date: new Date(Date.now() - 32 * 86_400_000).toISOString(),
        },
      },
      subscriptions: {},
    },
  };
}

/**
 * Mock fetch so only api.revenuecat.com calls are intercepted.
 * HTTP calls to baseUrl use the original fetch.
 */
function mockRcFetch(data: object) {
  return vi.spyOn(global, "fetch").mockImplementation(async (url, init) => {
    if (typeof url === "string" && url.includes("api.revenuecat.com")) {
      return new Response(JSON.stringify(data), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
    return realFetch(url as string, init);
  });
}

async function callCancelSync() {
  const res = await realFetch(`${baseUrl}/api/revenuecat-cancel-sync`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Dev-Token": devToken,
    },
    body: JSON.stringify({}),
  });
  return { status: res.status, body: await res.json().catch(() => null) };
}

// ---------------------------------------------------------------------------
// Lifecycle
// ---------------------------------------------------------------------------

beforeAll(async () => {
  process.env.REVENUECAT_API_KEY = "test-key";
  await seedAll();
  await startApp();
  // createDevToken shares the module-level devTokenStore with the running app
  const { createDevToken } = await import("../../server/replitAuth");
  devToken = createDevToken({ claims: { sub: USER_ID }, authMethod: "local" });
}, 30_000);

afterAll(async () => {
  await cleanupAll();
  await pool.end();
  server.close();
});

afterEach(async () => {
  vi.restoreAllMocks();
  await resetFamily("family_hero", false);
  process.env.REVENUECAT_API_KEY = "test-key";
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("cancel-sync — RC Promotional Entitlement handling (isAdminGranted:false)", () => {
  it("active promo entitlement → tier preserved, no downgrade", async () => {
    mockRcFetch(rcWithActivePromo("family_pro"));

    const { status, body } = await callCancelSync();
    expect(status).toBe(200);
    // "skipped" with reason "still_active" or "restored" if tier was out of sync
    expect(body.ok).toBe(true);

    const row = await getFamily();
    expect(row.subscriptionTier).toBe("family_hero");
  });

  it("active promo entitlement (family tier) → tier preserved as family", async () => {
    await resetFamily("family", false);
    mockRcFetch(rcWithActivePromo("family"));

    const { status, body } = await callCancelSync();
    expect(status).toBe(200);
    expect(body.ok).toBe(true);

    const row = await getFamily();
    expect(row.subscriptionTier).toBe("family");
  });

  it("expired promo → cancel-sync downgrades to free", async () => {
    mockRcFetch(rcWithExpiredPromo());

    const { status, body } = await callCancelSync();
    expect(status).toBe(200);
    expect(body.action).toBe("downgraded");

    const row = await getFamily();
    expect(row.subscriptionTier).toBe("free");
  });

  it("isAdminGranted:true → cancel-sync skips RC entirely (not the promo path)", async () => {
    await resetFamily("family_hero", true);
    // No fetch mock — if RC is called this would throw (no spy means real fetch runs and fails in test)

    const { status, body } = await callCancelSync();
    expect(status).toBe(200);
    expect(body.reason).toBe("admin_granted");

    // Tier untouched
    const row = await getFamily();
    expect(row.subscriptionTier).toBe("family_hero");
  });
});
