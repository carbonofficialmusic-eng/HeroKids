import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import express from "express";
import type { Server } from "node:http";
import { registerAdminMemberAccountRoutes } from "../../../server/adminMemberAccountRoutes";

const storageMocks = vi.hoisted(() => ({
  getFamilyMember: vi.fn(),
  getUser: vi.fn(),
  getUserByEmail: vi.fn(),
  getFamilyMemberByUserId: vi.fn(),
  unlinkUserFromFamilyMember: vi.fn(),
  linkUserToFamilyMember: vi.fn(),
  createAccountLinkRepairHistory: vi.fn(),
}));

vi.mock("../../../server/storage", () => ({
  storage: storageMocks,
}));

const parentMember = {
  id: "member-riewert",
  userId: null,
  familyName: "Hero Family",
  displayName: "Riewert",
  role: "parent",
  avatarUrl: "",
  color: "#8B5CF6",
};

const linkedChildMember = {
  id: "member-diego",
  userId: "user-carbon",
  familyName: "Hero Family",
  displayName: "Diego",
  role: "child",
  avatarUrl: "",
  color: "#8B5CF6",
};

const otherFamilyMember = {
  ...parentMember,
  id: "member-other",
  familyName: "Other Family",
};

const activeUser = {
  id: "user-sonoastudio",
  email: "sonoastudio@me.com",
  firstName: "Riewert",
  lastName: null,
  isDisabled: false,
  passwordHash: "secret-hash",
  passwordResetTokenHash: "reset-hash",
  passwordResetTokenExpiresAt: new Date(),
  emailVerificationTokenHash: "verify-hash",
  emailVerificationTokenExpiresAt: new Date(),
};

async function startAdminMemberAccountServer() {
  const app = express();
  app.use(express.json());
  const isAdmin = (req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (req.headers.authorization !== "Bearer admin-secret") {
      return res.status(401).json({ message: "Admin authentication required" });
    }
    next();
  };

  registerAdminMemberAccountRoutes(app, isAdmin);

  const server = await new Promise<Server>((resolve) => {
    const listeningServer = app.listen(0, () => resolve(listeningServer));
  });
  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Unable to start admin member account test server");
  }

  return {
    baseUrl: `http://127.0.0.1:${address.port}`,
    close: () => new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve()))),
  };
}

function adminPatch(server: Awaited<ReturnType<typeof startAdminMemberAccountServer>>, familyName: string, memberId: string, body: unknown) {
  return fetch(`${server.baseUrl}/api/admin/families/${encodeURIComponent(familyName)}/members/${memberId}/account`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer admin-secret",
    },
    body: JSON.stringify(body),
  });
}

describe("admin member account repair routes", () => {
  let server: Awaited<ReturnType<typeof startAdminMemberAccountServer>> | null = null;

  beforeEach(async () => {
    storageMocks.getFamilyMember.mockResolvedValue(parentMember);
    storageMocks.getUser.mockImplementation(async (id: string) => (
      id === activeUser.id ? activeUser : { id, email: "carbon@example.com" }
    ));
    storageMocks.getUserByEmail.mockResolvedValue(activeUser);
    storageMocks.getFamilyMemberByUserId.mockResolvedValue(undefined);
    storageMocks.unlinkUserFromFamilyMember.mockResolvedValue({ ...linkedChildMember, userId: null });
    storageMocks.linkUserToFamilyMember.mockResolvedValue({ ...parentMember, userId: activeUser.id });
    storageMocks.createAccountLinkRepairHistory.mockImplementation(async (history) => ({ id: "repair-1", ...history }));
    server = await startAdminMemberAccountServer();
  });

  afterEach(async () => {
    if (server) {
      await server.close();
      server = null;
    }
    vi.clearAllMocks();
  });

  it("unlinks an account from a member", async () => {
    storageMocks.getFamilyMember.mockResolvedValue(linkedChildMember);

    const response = await adminPatch(server!, "Hero Family", "member-diego", {
      action: "unlink",
      adminActor: " Alice\nAdmin ",
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      success: true,
      account: null,
      message: "Account unlinked from member",
    });
    expect(storageMocks.unlinkUserFromFamilyMember).toHaveBeenCalledWith("member-diego");
    expect(storageMocks.createAccountLinkRepairHistory).toHaveBeenCalledWith(expect.objectContaining({
      familyName: "Hero Family",
      memberId: "member-diego",
      action: "unlink",
      oldAccountId: "user-carbon",
      oldAccountEmail: "carbon@example.com",
      newAccountId: null,
      newAccountEmail: null,
      repairedBy: "Alice Admin",
    }));
  });

  it("links an active account to an unlinked member", async () => {
    const response = await adminPatch(server!, "Hero Family", "member-riewert", {
      action: "link",
      email: " SonoAStudio@Me.com ",
      adminActor: "Riewert",
    });

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toMatchObject({
      success: true,
      message: "Account linked to member",
      account: {
        id: "user-sonoastudio",
        email: "sonoastudio@me.com",
      },
    });
    expect(body.account.passwordHash).toBeUndefined();
    expect(storageMocks.getUserByEmail).toHaveBeenCalledWith("sonoastudio@me.com");
    expect(storageMocks.linkUserToFamilyMember).toHaveBeenCalledWith("member-riewert", "user-sonoastudio", {
      displayName: "Riewert",
      avatarUrl: "",
      color: "#8B5CF6",
    });
    expect(storageMocks.createAccountLinkRepairHistory).toHaveBeenCalledWith(expect.objectContaining({
      familyName: "Hero Family",
      memberId: "member-riewert",
      action: "link",
      oldAccountId: null,
      oldAccountEmail: null,
      newAccountId: "user-sonoastudio",
      newAccountEmail: "sonoastudio@me.com",
      repairedBy: "Riewert",
    }));
  });

  it("rejects account changes for a member from another family", async () => {
    storageMocks.getFamilyMember.mockResolvedValue(otherFamilyMember);

    const response = await adminPatch(server!, "Hero Family", "member-other", {
      action: "link",
      email: "sonoastudio@me.com",
    });

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ message: "Member not in this family" });
    expect(storageMocks.linkUserToFamilyMember).not.toHaveBeenCalled();
  });

  it("rejects linking disabled accounts", async () => {
    storageMocks.getUserByEmail.mockResolvedValue({ ...activeUser, isDisabled: true });

    const response = await adminPatch(server!, "Hero Family", "member-riewert", {
      action: "link",
      email: "sonoastudio@me.com",
    });

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ message: "Disabled accounts cannot be linked to a member" });
    expect(storageMocks.linkUserToFamilyMember).not.toHaveBeenCalled();
  });

  it("rejects accounts that are already linked until explicitly detached", async () => {
    storageMocks.getFamilyMemberByUserId.mockResolvedValue(linkedChildMember);

    const response = await adminPatch(server!, "Hero Family", "member-riewert", {
      action: "link",
      email: "sonoastudio@me.com",
    });

    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({
      message: "This account is already linked to Diego. Unlink it there first or confirm moving it.",
      existingMember: {
        id: "member-diego",
        displayName: "Diego",
        familyName: "Hero Family",
        role: "child",
      },
    });
    expect(storageMocks.unlinkUserFromFamilyMember).not.toHaveBeenCalled();
    expect(storageMocks.linkUserToFamilyMember).not.toHaveBeenCalled();
  });

  it("moves an already linked account only when detachExisting is confirmed", async () => {
    storageMocks.getFamilyMemberByUserId.mockResolvedValue(linkedChildMember);

    const response = await adminPatch(server!, "Hero Family", "member-riewert", {
      action: "link",
      email: "sonoastudio@me.com",
      detachExisting: true,
      adminActor: "Support Admin",
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      success: true,
      message: "Account linked to member",
    });
    expect(storageMocks.unlinkUserFromFamilyMember).toHaveBeenCalledWith("member-diego");
    expect(storageMocks.linkUserToFamilyMember).toHaveBeenCalledWith("member-riewert", "user-sonoastudio", expect.any(Object));
    expect(storageMocks.createAccountLinkRepairHistory).toHaveBeenCalledWith(expect.objectContaining({
      memberId: "member-diego",
      action: "move_detach",
      repairedBy: "Support Admin",
    }));
    expect(storageMocks.createAccountLinkRepairHistory).toHaveBeenCalledWith(expect.objectContaining({
      memberId: "member-riewert",
      action: "move_link",
      repairedBy: "Support Admin",
    }));
  });
});