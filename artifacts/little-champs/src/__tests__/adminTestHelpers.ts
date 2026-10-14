import { createElement } from "react";
import { vi, expect } from "vitest";

export const rechartsModuleMock = {
  BarChart: ({ children }: { children?: React.ReactNode }) => createElement("div", {}, children),
  Bar: ({ children }: { children?: React.ReactNode }) => createElement("div", {}, children),
  XAxis: ({ children }: { children?: React.ReactNode }) => createElement("div", {}, children),
  YAxis: ({ children }: { children?: React.ReactNode }) => createElement("div", {}, children),
  CartesianGrid: ({ children }: { children?: React.ReactNode }) => createElement("div", {}, children),
  Tooltip: ({ children }: { children?: React.ReactNode }) => createElement("div", {}, children),
  Legend: ({ children }: { children?: React.ReactNode }) => createElement("div", {}, children),
  ResponsiveContainer: ({ children }: { children?: React.ReactNode }) => createElement("div", {}, children),
  PieChart: ({ children }: { children?: React.ReactNode }) => createElement("div", {}, children),
  Pie: ({ children }: { children?: React.ReactNode }) => createElement("div", {}, children),
  Cell: ({ children }: { children?: React.ReactNode }) => createElement("div", {}, children),
  LineChart: ({ children }: { children?: React.ReactNode }) => createElement("div", {}, children),
  Line: ({ children }: { children?: React.ReactNode }) => createElement("div", {}, children),
};

export const jsonResponse = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });

export const healthyEmailStatus = {
  status: "healthy" as const,
  configured: true,
  provider: "resend",
  credentialSource: "replit_connection",
  fromAddress: "noreply@littlechamps.net",
  baseUrl: "https://littlechamps.net",
  linksUseExpectedDomain: true,
  productionLinksUseExpectedDomain: true,
  expectedProductionBaseUrl: "https://littlechamps.net",
  verificationUrlSample: "https://littlechamps.net/api/auth/verify-email?token=sample",
  passwordResetUrlSample: "https://littlechamps.net/?reset_token=sample",
  testSend: {
    attempted: false,
    succeeded: false,
  },
  issues: [],
};

export type AdminFamilyDetails = {
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
    repairedBy?: string | null;
    repairedAt: string;
  }>;
};

export const makeDefaultAdminFamilyDetails = (): AdminFamilyDetails => ({
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
});

export type FetchMockOverrides = {
  [methodAndPath: string]: (init?: RequestInit) => Response | Promise<Response>;
};

export function makeAdminFetchMock(
  getAdminFamilyDetails: () => AdminFamilyDetails,
  setAdminFamilyDetails: (d: AdminFamilyDetails) => void,
  overrides: FetchMockOverrides = {},
) {
  return vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    const path = url.startsWith("http") ? new URL(url).pathname : url;
    const method = init?.method || "GET";
    const key = `${method} ${path}`;

    if (key in overrides) {
      return overrides[key](init);
    }

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
      const details = getAdminFamilyDetails();
      return jsonResponse([
        {
          ...details.family,
          memberCount: details.members.length,
          parentCount: details.members.filter((member) => member.role === "parent").length,
          childCount: details.members.filter((member) => member.role === "child").length,
        },
      ]);
    }

    if (path === "/api/admin/families/Hero%20Family" && method === "GET") {
      return jsonResponse(getAdminFamilyDetails());
    }

    if (path === "/api/admin/families/Hero%20Family/members/member-diego/account" && method === "PATCH") {
      const body = JSON.parse(String(init?.body));
      expect(body).toMatchObject({ action: "unlink", adminActor: "Test Admin" });
      const details = getAdminFamilyDetails();
      setAdminFamilyDetails({
        ...details,
        members: details.members.map((member) =>
          member.id === "member-diego" ? { ...member, userId: null, account: null } : member,
        ),
      });
      return jsonResponse({ success: true, message: "Account unlinked from member" });
    }

    if (path === "/api/admin/families/Hero%20Family/members/member-riewert/account" && method === "PATCH") {
      const body = JSON.parse(String(init?.body));
      expect(body).toMatchObject({
        action: "link",
        email: "sonoastudio@me.com",
        adminActor: "Test Admin",
      });
      const details = getAdminFamilyDetails();
      if (!body.detachExisting && details.members.some((member) => member.userId === "user-sonoastudio")) {
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
      setAdminFamilyDetails({
        ...details,
        members: details.members.map((member) =>
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
          : details.accountLinkRepairHistory,
      });
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
      return jsonResponse(healthyEmailStatus);
    }

    if (path === "/api/admin/email-health/test" && method === "POST") {
      return jsonResponse(healthyEmailStatus);
    }

    return jsonResponse({ message: `Unhandled ${method} ${path}` }, 404);
  });
}
