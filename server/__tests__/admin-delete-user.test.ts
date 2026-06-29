/**
 * End-to-end integration tests for DELETE /api/admin/users/:replitUserId
 *
 * These tests:
 *  1. Boot the real Express app via registerRoutes (same code path as production)
 *  2. Seed real rows in the test database (user + family + linked member)
 *  3. Call DELETE /api/admin/users/:id through HTTP
 *  4. Query the database to assert the expected post-delete state:
 *       - user row is gone
 *       - family member row still exists
 *       - member.userId is null (account detached, not cascade-deleted)
 *       - family row still exists
 *
 * Background:
 *   familyMembers.userId references users.id with onDelete:"cascade".
 *   If the user row is deleted directly, the member row (and all its tasks,
 *   points history, etc.) would also be deleted via cascade.  The fix in
 *   routes.ts nulls out member.userId first, then deletes the user row.
 */

import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import express from "express";
import http from "http";
import { Pool, neonConfig } from "@neondatabase/serverless";
import ws from "ws";
import { drizzle } from "drizzle-orm/neon-serverless";
import { eq } from "drizzle-orm";
import { users, families, familyMembers } from "@shared/schema";
import bcrypt from "bcrypt";
import crypto from "crypto";

// ---------------------------------------------------------------------------
// DB helpers – connect directly for seeding and assertion queries
// ---------------------------------------------------------------------------

neonConfig.webSocketConstructor = ws;
const pool = new Pool({ connectionString: process.env.DATABASE_URL! });
const testDb = drizzle({ client: pool });

// Unique prefix so test rows never collide with real data
const UID = `test-del-${Date.now()}`;
const TEST_USER_ID = `${UID}-user`;
const TEST_FAMILY = `${UID}-family`;

async function seedTestData() {
  const hashPw = await bcrypt.hash("SomePass123!", 10);
  await testDb.insert(users).values({
    id: TEST_USER_ID,
    email: `${UID}@test.invalid`,
    firstName: "Test",
    lastName: "User",
    passwordHash: hashPw,
    isEmailVerified: true,
  });
  await testDb.insert(families).values({
    familyName: TEST_FAMILY,
    joinCode: crypto.randomBytes(3).toString("hex").toUpperCase(),
    subscriptionTier: "free",
  });
  await testDb.insert(familyMembers).values({
    userId: TEST_USER_ID,
    familyName: TEST_FAMILY,
    displayName: "Test User",
    role: "parent",
  });
}

async function cleanupTestData() {
  // Members may already be gone or detached; clean up in order
  await testDb.delete(familyMembers).where(eq(familyMembers.familyName, TEST_FAMILY));
  await testDb.delete(families).where(eq(families.familyName, TEST_FAMILY));
  // User may already be deleted by the test; ignore errors
  try { await testDb.delete(users).where(eq(users.id, TEST_USER_ID)); } catch {}
}

// ---------------------------------------------------------------------------
// App bootstrap – real registerRoutes, minimal express wrapper
// ---------------------------------------------------------------------------

let server: http.Server;
let baseUrl: string;
let adminToken: string;

const ADMIN_PASSWORD = "e2e-test-admin-pw-12345";

async function startApp(): Promise<void> {
  process.env.ADMIN_PASSWORD = ADMIN_PASSWORD;

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

async function getAdminToken(): Promise<string> {
  const res = await fetch(`${baseUrl}/api/admin/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password: ADMIN_PASSWORD }),
  });
  const data = await res.json() as { token: string };
  return data.token;
}

async function deleteUser(userId: string): Promise<{ status: number; body: unknown }> {
  const res = await fetch(`${baseUrl}/api/admin/users/${userId}`, {
    method: "DELETE",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${adminToken}`,
    },
  });
  return { status: res.status, body: await res.json() };
}

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

beforeAll(async () => {
  await startApp();
  adminToken = await getAdminToken();
  await cleanupTestData();   // defensive pre-clean
  await seedTestData();
}, 30_000);

afterAll(async () => {
  await cleanupTestData();
  await new Promise<void>((resolve) => server.close(() => resolve()));
  await pool.end();
  delete process.env.ADMIN_PASSWORD;
}, 15_000);

describe("DELETE /api/admin/users/:replitUserId — end-to-end with real DB", () => {
  it("returns 401 when no Bearer token is provided", async () => {
    const res = await fetch(`${baseUrl}/api/admin/users/${TEST_USER_ID}`, {
      method: "DELETE",
    });
    expect(res.status).toBe(401);
  });

  it("returns 401 when an invalid Bearer token is provided", async () => {
    const res = await fetch(`${baseUrl}/api/admin/users/${TEST_USER_ID}`, {
      method: "DELETE",
      headers: { Authorization: "Bearer not-a-real-token" },
    });
    expect(res.status).toBe(401);
  });

  it("returns 200 and the deleted user id", async () => {
    const { status, body } = await deleteUser(TEST_USER_ID);
    expect(status).toBe(200);
    expect(body).toMatchObject({ success: true, deleted: TEST_USER_ID });
  });

  it("removes the user row from the database", async () => {
    const [row] = await testDb.select().from(users).where(eq(users.id, TEST_USER_ID));
    expect(row).toBeUndefined();
  });

  it("preserves the linked family member row — it is NOT cascade-deleted", async () => {
    const [member] = await testDb.select().from(familyMembers).where(eq(familyMembers.familyName, TEST_FAMILY));
    expect(member).toBeDefined();
  });

  it("sets member.userId to null after the account is deleted", async () => {
    const [member] = await testDb.select().from(familyMembers).where(eq(familyMembers.familyName, TEST_FAMILY));
    expect(member?.userId).toBeNull();
  });

  it("leaves the family row intact and reachable", async () => {
    const [family] = await testDb.select().from(families).where(eq(families.familyName, TEST_FAMILY));
    expect(family).toBeDefined();
    expect(family?.familyName).toBe(TEST_FAMILY);
  });

  it("is idempotent — deleting an already-absent user returns 200 without error", async () => {
    const { status, body } = await deleteUser(TEST_USER_ID);
    expect(status).toBe(200);
    expect((body as any).success).toBe(true);
  });
});
