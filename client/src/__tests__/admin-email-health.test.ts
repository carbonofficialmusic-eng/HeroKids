// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import express from "express";
import type { Server } from "node:http";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClientProvider } from "@tanstack/react-query";
import AdminPage from "../pages/admin";
import { queryClient } from "../lib/queryClient";
import { registerAdminEmailHealthRoutes } from "../../../server/adminEmailHealthRoutes";
import { checkTransactionalEmailHealth } from "../../../server/emailHealth";

vi.mock("recharts", () => {
  const Chart = ({ children }: { children?: React.ReactNode }) => createElement("div", {}, children);
  return {
    BarChart: Chart,
    Bar: Chart,
    XAxis: Chart,
    YAxis: Chart,
    CartesianGrid: Chart,
    Tooltip: Chart,
    Legend: Chart,
    ResponsiveContainer: Chart,
    PieChart: Chart,
    Pie: Chart,
    Cell: Chart,
    LineChart: Chart,
    Line: Chart,
  };
});

vi.mock("../../../server/emailHealth", () => ({
  checkTransactionalEmailHealth: vi.fn(),
}));

const mockCheckTransactionalEmailHealth = vi.mocked(checkTransactionalEmailHealth);

const healthyEmailStatus = {
  status: "healthy" as const,
  configured: true,
  provider: "resend",
  credentialSource: "replit_connection",
  fromAddress: "noreply@herokids.app",
  baseUrl: "https://herokids.app",
  linksUseExpectedDomain: true,
  productionLinksUseExpectedDomain: true,
  expectedProductionBaseUrl: "https://herokids.app",
  verificationUrlSample: "https://herokids.app/api/auth/verify-email?token=sample",
  passwordResetUrlSample: "https://herokids.app/?reset_token=sample",
  testSend: {
    attempted: false,
    succeeded: false,
  },
  issues: [],
};

type TestEmailHealthStatus = typeof healthyEmailStatus & {
  status: "healthy" | "warning" | "unhealthy";
  configured: boolean;
  provider: string | null;
  credentialSource: string | null;
  baseUrl: string | null;
  linksUseExpectedDomain: boolean;
  issues: string[];
};

const jsonResponse = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });

async function startAdminEmailHealthServer() {
  const app = express();
  app.use(express.json());
  const isAdmin = (req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (req.headers.authorization !== "Bearer admin-secret") {
      return res.status(401).json({ message: "Admin authentication required" });
    }
    next();
  };

  registerAdminEmailHealthRoutes(app, isAdmin);

  const server = await new Promise<Server>((resolve) => {
    const listeningServer = app.listen(0, () => resolve(listeningServer));
  });
  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Unable to start admin email health test server");
  }

  return {
    baseUrl: `http://127.0.0.1:${address.port}`,
    close: () => new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve()))),
  };
}

describe("admin email health routes", () => {
  let server: Awaited<ReturnType<typeof startAdminEmailHealthServer>> | null = null;

  beforeEach(() => {
    mockCheckTransactionalEmailHealth.mockReset();
  });

  afterEach(async () => {
    if (server) {
      await server.close();
      server = null;
    }
  });

  it("requires admin authorization for the email health status endpoint", async () => {
    server = await startAdminEmailHealthServer();

    const response = await fetch(`${server.baseUrl}/api/admin/email-health`);

    expect(response.status).toBe(401);
    expect(mockCheckTransactionalEmailHealth).not.toHaveBeenCalled();
  });

  it("returns protected email health status without forcing a test recipient issue", async () => {
    mockCheckTransactionalEmailHealth.mockResolvedValue(healthyEmailStatus);
    server = await startAdminEmailHealthServer();

    const response = await fetch(`${server.baseUrl}/api/admin/email-health`, {
      headers: { Authorization: "Bearer admin-secret" },
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      status: "healthy",
      provider: "resend",
      fromAddress: "noreply@herokids.app",
    });
    expect(mockCheckTransactionalEmailHealth).toHaveBeenCalledWith({
      includeMissingTestRecipientIssue: false,
    });
  });

  it("rejects invalid test-send recipients before calling the email provider", async () => {
    server = await startAdminEmailHealthServer();

    const response = await fetch(`${server.baseUrl}/api/admin/email-health/test`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer admin-secret",
      },
      body: JSON.stringify({ recipient: "not-an-email" }),
    });

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({
      message: "Enter a valid recipient email address",
    });
    expect(mockCheckTransactionalEmailHealth).not.toHaveBeenCalled();
  });
});

describe("admin email health UI", () => {
  let currentEmailStatus: TestEmailHealthStatus;
  let adminFamilyDetails: {
    family: {
      familyName: string;
      subscriptionTier: string;
      memberCount: number;
      parentCount: number;
      childCount: number;
      taskCount: number;
      rewardCount: number;
      totalPointsEarned: number;
      createdAt: string;
    };
    members: Array<{
      id: string;
      userId: string | null;
      displayName: string;
      role: "parent" | "child";
      avatarUrl: string;
      activeSkinId: string | null;
      useCustomAvatar: boolean;
      totalEarned: number;
      totalPoints: number;
      weeklyPoints: number;
      monthlyPoints: number;
      account: {
        email: string;
        firstName: string;
        lastName: string | null;
        isEmailVerified: boolean;
        isDisabled: boolean;
        lastLoginAt: string | null;
        createdAt: string;
      } | null;
    }>;
    taskCount: number;
    rewardCount: number;
    accountLinkRepairHistory?: Array<{
      id: string;
      memberId: string;
      memberDisplayName: string;
      action: string;
      oldAccountEmail: string | null;
      newAccountEmail: string | null;
      repairedBy: string | null;
      repairedAt: string;
    }>;
  };

  const setupFetchMock = () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
        const path = url.startsWith("http") ? new URL(url).pathname : url;
        const method = init?.method || "GET";

        if (path === "/api/admin/stats" && method === "GET") {
          return jsonResponse({
            totalFamilies: 1,
            totalMembers: 2,
            totalTasks: 3,
            totalRewards: 4,
            totalPointsEarned: 50,
            tierCounts: { free: 1, family: 0, family_plus: 0, family_hero: 0 },
          });
        }

        if (path === "/api/admin/families" && method === "GET") {
          return jsonResponse([
            {
              ...adminFamilyDetails.family,
              memberCount: adminFamilyDetails.members.length,
              parentCount: adminFamilyDetails.members.filter((member) => member.role === "parent").length,
              childCount: adminFamilyDetails.members.filter((member) => member.role === "child").length,
            },
          ]);
        }

        if (path === "/api/admin/families/Hero%20Family" && method === "GET") {
          return jsonResponse(adminFamilyDetails);
        }

        if (path === "/api/admin/families/Hero%20Family/members/member-diego/account" && method === "PATCH") {
          const body = JSON.parse(String(init?.body));
          expect(body).toMatchObject({ action: "unlink" });
          adminFamilyDetails = {
            ...adminFamilyDetails,
            members: adminFamilyDetails.members.map((member) =>
              member.id === "member-diego" ? { ...member, userId: null, account: null } : member,
            ),
          };
          return jsonResponse({ success: true, message: "Account unlinked from member" });
        }

        if (path === "/api/admin/families/Hero%20Family/members/member-riewert/account" && method === "PATCH") {
          const body = JSON.parse(String(init?.body));
          expect(body).toMatchObject({
            action: "link",
            email: "sonoastudio@me.com",
          });
          if (!body.detachExisting && adminFamilyDetails.members.some((member) => member.userId === "user-sonoastudio")) {
            return jsonResponse({
              message: "This account is already linked to Diego. Unlink it there first or confirm moving it.",
              existingMember: {
                id: "member-diego",
                displayName: "Diego",
                familyName: "Hero Family",
                role: "child",
              },
            }, 409);
          }
          adminFamilyDetails = {
            ...adminFamilyDetails,
            members: adminFamilyDetails.members.map((member) =>
              member.id === "member-riewert"
                ? {
                    ...member,
                    userId: "user-sonoastudio",
                    account: {
                      email: "sonoastudio@me.com",
                      firstName: "Riewert",
                      lastName: null,
                      isEmailVerified: true,
                      isDisabled: false,
                      lastLoginAt: null,
                      createdAt: "2026-04-21T00:00:00.000Z",
                    },
                  }
                : member,
            ),
            accountLinkRepairHistory: body.detachExisting
              ? [
                  {
                    id: "repair-move-detach",
                    memberId: "member-diego",
                    memberDisplayName: "Diego",
                    action: "move_detach",
                    oldAccountEmail: "sonoastudio@me.com",
                    newAccountEmail: null,
                    repairedBy: "Admin",
                    repairedAt: "2026-04-21T00:00:00.000Z",
                  },
                  {
                    id: "repair-move-link",
                    memberId: "member-riewert",
                    memberDisplayName: "Riewert",
                    action: "move_link",
                    oldAccountEmail: null,
                    newAccountEmail: "sonoastudio@me.com",
                    repairedBy: "Admin",
                    repairedAt: "2026-04-21T00:01:00.000Z",
                  },
                ]
              : adminFamilyDetails.accountLinkRepairHistory,
          };
          return jsonResponse({ success: true, message: "Account linked to member" });
        }

        if (path === "/api/admin/skins/stats" && method === "GET") {
          return jsonResponse({ totalSkins: 122, stats: [] });
        }

        if (path === "/api/admin/analytics" && method === "GET") {
          return jsonResponse({
            weeklyRegistrations: [],
            monthlyRegistrations: [],
            activeFamilies: [],
            avgPointsPerChild: 0,
            pointsByRole: [],
            tierDistribution: [],
            totalChildren: 0,
            totalParents: 0,
          });
        }

        if (path === "/api/admin/email-health" && method === "GET") {
          return jsonResponse(currentEmailStatus);
        }

        if (path === "/api/admin/email-health/test" && method === "POST") {
          const body = JSON.parse(String(init?.body));
          currentEmailStatus = {
            ...healthyEmailStatus,
            testSend: {
              attempted: true,
              succeeded: true,
              recipient: body.recipient,
              provider: "resend",
            },
          };
          return jsonResponse(currentEmailStatus);
        }

        return jsonResponse({ message: `Unhandled ${method} ${path}` }, 404);
      }),
    );
  };

  beforeEach(() => {
    queryClient.clear();
    localStorage.setItem("admin_token", "admin-secret");
    currentEmailStatus = healthyEmailStatus;
    adminFamilyDetails = {
      family: {
        familyName: "Hero Family",
        subscriptionTier: "free",
        memberCount: 2,
        parentCount: 1,
        childCount: 1,
        taskCount: 0,
        rewardCount: 0,
        totalPointsEarned: 0,
        createdAt: "2026-04-21T00:00:00.000Z",
      },
      members: [
        {
          id: "member-riewert",
          userId: null,
          displayName: "Riewert",
          role: "parent",
          avatarUrl: "",
          activeSkinId: null,
          useCustomAvatar: false,
          totalEarned: 0,
          totalPoints: 0,
          weeklyPoints: 0,
          monthlyPoints: 0,
          account: null,
        },
        {
          id: "member-diego",
          userId: "user-carbon",
          displayName: "Diego",
          role: "child",
          avatarUrl: "",
          activeSkinId: null,
          useCustomAvatar: false,
          totalEarned: 0,
          totalPoints: 0,
          weeklyPoints: 0,
          monthlyPoints: 0,
          account: {
            email: "carbon.official.music@gmail.com",
            firstName: "Carbon",
            lastName: null,
            isEmailVerified: true,
            isDisabled: false,
            lastLoginAt: null,
            createdAt: "2026-04-21T00:00:00.000Z",
          },
        },
      ],
      taskCount: 0,
      rewardCount: 0,
      accountLinkRepairHistory: [],
    };
    setupFetchMock();
  });

  afterEach(() => {
    cleanup();
    queryClient.clear();
    localStorage.clear();
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  const renderAdmin = () =>
    render(
      createElement(
        QueryClientProvider,
        { client: queryClient },
        createElement(AdminPage),
      ),
    );

  it("shows provider and launch domain status to admins", async () => {
    renderAdmin();

    expect((await screen.findByTestId("badge-email-health-status")).textContent).toContain("Ready");
    expect(screen.getByTestId("text-email-provider").textContent).toContain("resend");
    expect(screen.getByTestId("text-email-sender").textContent).toContain("noreply@herokids.app");
    expect(screen.getByTestId("text-email-link-domain").textContent).toContain("Matches launch domain");
  });

  it("lets admins submit a test recipient from the email tab", async () => {
    const user = userEvent.setup();
    renderAdmin();

    await user.click(await screen.findByTestId("tab-email"));
    expect((await screen.findByTestId("text-email-detail-provider")).textContent).toContain("resend");
    expect(screen.getByTestId("text-email-current-domain").textContent).toContain("https://herokids.app");

    await user.type(screen.getByTestId("input-email-test-recipient"), "owner@example.com");
    await user.click(screen.getByTestId("button-send-email-health-test"));

    await waitFor(() => {
      expect(screen.getByTestId("text-email-test-result").textContent).toContain("Test to owner@example.com: succeeded");
    });
    expect(fetch).toHaveBeenCalledWith(
      "/api/admin/email-health/test",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ recipient: "owner@example.com" }),
      }),
    );
  });

  it("shows a prominent monitoring alert when transactional email becomes unhealthy", async () => {
    currentEmailStatus = {
      ...healthyEmailStatus,
      status: "unhealthy",
      configured: false,
      provider: null,
      credentialSource: null,
      baseUrl: null,
      linksUseExpectedDomain: false,
      issues: ["Resend credentials are missing."],
    };

    renderAdmin();

    expect((await screen.findByTestId("alert-email-health-monitoring")).textContent).toContain("Transactional email needs attention");
    expect(screen.getByTestId("text-email-health-alert-status").textContent).toContain("Status: Not ready");
    expect(screen.getByTestId("text-email-health-alert-issue").textContent).toContain("Resend credentials are missing.");
    expect(screen.getByTestId("button-refresh-email-health-alert")).toBeTruthy();
  });

  it("lets admins repair member account links from family details", async () => {
    const user = userEvent.setup();
    renderAdmin();

    await user.click(await screen.findByTestId("tab-families"));
    await user.click(await screen.findByText("Hero Family"));
    expect((await screen.findByTestId("badge-account-email-member-diego")).textContent).toContain("carbon.official.music@gmail.com");

    await user.click(screen.getByTestId("button-unlink-account-member-diego"));
    await waitFor(() => {
      expect(screen.getByTestId("button-link-account-member-diego")).toBeTruthy();
    });

    await user.click(screen.getByTestId("button-link-account-member-riewert"));
    await user.type(await screen.findByTestId("input-link-account-email"), "sonoastudio@me.com");
    await user.click(screen.getByTestId("button-confirm-link-account"));

    await waitFor(() => {
      expect(screen.getByTestId("badge-account-email-member-riewert").textContent).toContain("sonoastudio@me.com");
    });
  });

  it("asks admins to confirm moving an already linked account", async () => {
    const user = userEvent.setup();
    adminFamilyDetails = {
      ...adminFamilyDetails,
      members: adminFamilyDetails.members.map((member) =>
        member.id === "member-diego"
          ? {
              ...member,
              userId: "user-sonoastudio",
              account: {
                email: "sonoastudio@me.com",
                firstName: "Riewert",
                lastName: null,
                isEmailVerified: true,
                isDisabled: false,
                lastLoginAt: null,
                createdAt: "2026-04-21T00:00:00.000Z",
              },
            }
          : member,
      ),
    };
    renderAdmin();

    await user.click(await screen.findByTestId("tab-families"));
    await user.click(await screen.findByText("Hero Family"));
    await user.click(screen.getByTestId("button-link-account-member-riewert"));
    await user.type(await screen.findByTestId("input-link-account-email"), "sonoastudio@me.com");
    await user.click(screen.getByTestId("button-confirm-link-account"));

    expect((await screen.findByTestId("text-account-move-warning")).textContent).toContain("currently linked to Diego");
    expect(screen.getByTestId("text-account-move-target").textContent).toContain("link it to Riewert");

    await user.click(screen.getByTestId("button-confirm-move-account"));

    await waitFor(() => {
      expect(screen.getByTestId("badge-account-email-member-riewert").textContent).toContain("sonoastudio@me.com");
    });
    expect(screen.getByTestId("list-account-link-repair-history").textContent).toContain("Moved away");
    expect(screen.getByTestId("list-account-link-repair-history").textContent).toContain("Moved here");
  });
});