import { createElement } from "react";

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
