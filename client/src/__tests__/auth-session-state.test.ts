import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import express from "express";
import type { Server } from "node:http";
import { setupAuth } from "../../../server/replitAuth";

const authMocks = vi.hoisted(() => ({
  getUserByEmail: vi.fn(),
  getUserByPasswordResetToken: vi.fn(),
  getUser: vi.fn(),
  updateUserLastLogin: vi.fn(),
  updateUserAuthFields: vi.fn(),
  incrementAuthRateLimit: vi.fn(),
  bcryptCompare: vi.fn(),
  bcryptHash: vi.fn(),
}));

vi.mock("connect-pg-simple", () => ({
  default: (session: any) => session.MemoryStore,
}));

vi.mock("bcrypt", () => ({
  default: {
    compare: authMocks.bcryptCompare,
    hash: authMocks.bcryptHash,
  },
  compare: authMocks.bcryptCompare,
  hash: authMocks.bcryptHash,
}));

vi.mock("../../../server/storage", () => ({
  storage: {
    getUserByEmail: authMocks.getUserByEmail,
    getUserByPasswordResetToken: authMocks.getUserByPasswordResetToken,
    getUser: authMocks.getUser,
    updateUserLastLogin: authMocks.updateUserLastLogin,
    updateUserAuthFields: authMocks.updateUserAuthFields,
    incrementAuthRateLimit: authMocks.incrementAuthRateLimit,
  },
}));

vi.mock("../../../server/email", () => ({
  EmailProviderNotConfiguredError: class EmailProviderNotConfiguredError extends Error {},
  isTransactionalEmailConfigured: vi.fn(),
  sendPasswordResetEmail: vi.fn(),
  sendVerificationEmail: vi.fn(),
}));

vi.mock("../../../server/authLinks", () => ({
  createEmailVerificationUrl: vi.fn(() => "https://herokids.app/api/auth/verify-email?token=test"),
  createPasswordResetUrl: vi.fn(() => "https://herokids.app/?reset_token=test"),
}));

vi.mock("../../../server/mobileAuth", () => ({
  verifyAccessToken: vi.fn(),
}));

const testUser = {
  id: "parent-user",
  email: "parent@example.com",
  firstName: "Parent",
  lastName: null,
  passwordHash: "$2b$12$XpBKr9pkTYcweN4roM8bWeJhN1/XkTzC7e2jP1wPL38EQ91xA7XnK",
  isDisabled: false,
  passwordResetTokenExpiresAt: new Date(Date.now() + 60 * 60 * 1000),
};

async function startAuthServer() {
  process.env.SESSION_SECRET = "test-session-secret";
  process.env.DATABASE_URL = "postgres://test:test@localhost/test";
  const app = express();
  app.use(express.json());
  await setupAuth(app);

  app.post("/test/acting-as-child", (req: any, res) => {
    req.session.actingAsMemberId = "child-member";
    res.json({ actingAsMemberId: req.session.actingAsMemberId });
  });

  app.get("/test/session", (req: any, res) => {
    res.json({ actingAsMemberId: req.session.actingAsMemberId ?? null });
  });

  const server = await new Promise<Server>((resolve) => {
    const listeningServer = app.listen(0, () => resolve(listeningServer));
  });
  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Unable to start auth test server");
  }

  return {
    baseUrl: `http://127.0.0.1:${address.port}`,
    close: () => new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve()))),
  };
}

function readCookie(response: Response) {
  return response.headers.get("set-cookie")?.split(";")[0] || "";
}

const secureProxyHeaders = { "X-Forwarded-Proto": "https" };

describe("account auth session state", () => {
  let server: Awaited<ReturnType<typeof startAuthServer>> | null = null;

  beforeEach(async () => {
    authMocks.getUserByEmail.mockResolvedValue(testUser);
    authMocks.getUserByPasswordResetToken.mockResolvedValue(testUser);
    authMocks.getUser.mockResolvedValue(testUser);
    authMocks.updateUserLastLogin.mockResolvedValue(undefined);
    authMocks.updateUserAuthFields.mockResolvedValue(testUser);
    authMocks.incrementAuthRateLimit.mockResolvedValue({ allowed: true, retryAfter: 0 });
    authMocks.bcryptCompare.mockResolvedValue(true);
    authMocks.bcryptHash.mockResolvedValue("new-password-hash");
    server = await startAuthServer();
  });

  afterEach(async () => {
    if (server) {
      await server.close();
      server = null;
    }
    vi.clearAllMocks();
  });

  it("clears a child acting session when a parent logs in again", async () => {
    const actingResponse = await fetch(`${server!.baseUrl}/test/acting-as-child`, {
      method: "POST",
      headers: secureProxyHeaders,
    });
    const cookie = readCookie(actingResponse);
    expect(cookie).toBeTruthy();

    const loginResponse = await fetch(`${server!.baseUrl}/api/auth/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: cookie,
        ...secureProxyHeaders,
      },
      body: JSON.stringify({ email: "parent@example.com", password: "password123" }),
    });
    expect(loginResponse.status).toBe(200);

    const sessionResponse = await fetch(`${server!.baseUrl}/test/session`, {
      headers: { Cookie: readCookie(loginResponse) || cookie, ...secureProxyHeaders },
    });
    expect(await sessionResponse.json()).toMatchObject({ actingAsMemberId: null });
  });

  it("clears a child acting session when a password reset completes", async () => {
    const actingResponse = await fetch(`${server!.baseUrl}/test/acting-as-child`, {
      method: "POST",
      headers: secureProxyHeaders,
    });
    const cookie = readCookie(actingResponse);

    const resetResponse = await fetch(`${server!.baseUrl}/api/auth/reset-password`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: cookie,
        ...secureProxyHeaders,
      },
      body: JSON.stringify({ token: "a".repeat(32), password: "newPassword123" }),
    });
    expect(resetResponse.status).toBe(200);

    const sessionResponse = await fetch(`${server!.baseUrl}/test/session`, {
      headers: { Cookie: readCookie(resetResponse) || cookie, ...secureProxyHeaders },
    });
    expect(await sessionResponse.json()).toMatchObject({ actingAsMemberId: null });
  });
});