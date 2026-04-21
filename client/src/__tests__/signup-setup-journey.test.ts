// @vitest-environment jsdom
import "../i18n";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "../App";
import { queryClient } from "../lib/queryClient";

type MockUser = {
  id: string;
  email: string;
  firstName: string;
  lastName: string | null;
};

type MockMember = {
  id: string;
  userId: string;
  familyName: string;
  displayName: string;
  role: "parent" | "child";
  avatarUrl: string;
  color: string;
  totalEarned: number;
  totalPoints: number;
  weeklyPoints: number;
  monthlyPoints: number;
  rewardsRedeemed: number;
  starsFound: number;
  activeSkinId: string | null;
  useCustomAvatar: boolean;
  useThemeBackground: boolean;
  discoveredSkinIds: string[];
  earnedLegacySkinIds: string[];
  updatedAt: string;
};

type CreatedFamilyPayload = {
  familyName: string;
  displayName: string;
  role: "parent";
  avatarUrl: string;
  color: string;
};

const jsonResponse = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });

class MockWebSocket {
  onopen: (() => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  onclose: (() => void) | null = null;

  constructor() {
    setTimeout(() => this.onopen?.(), 0);
  }

  send = vi.fn();
  close = vi.fn();
  addEventListener = vi.fn();
  removeEventListener = vi.fn();
}

describe("sign-up setup journey", () => {
  let currentUser: MockUser | null;
  let currentMember: MockMember | null;
  let createdFamilyPayload: CreatedFamilyPayload | null;

  const setupFetchMock = () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
        const path = url.startsWith("http") ? new URL(url).pathname : url;
        const method = init?.method || "GET";

        if (path === "/api/auth/user" && method === "GET") {
          return currentUser
            ? jsonResponse(currentUser)
            : jsonResponse({ message: "Unauthorized" }, 401);
        }

        if (path === "/api/auth/register" && method === "POST") {
          const body = JSON.parse(String(init?.body));
          currentUser = {
            id: "user-new-parent",
            email: body.email,
            firstName: body.firstName,
            lastName: body.lastName || null,
          };
          return jsonResponse(
            {
              user: currentUser,
              emailStatus: {
                status: "not_configured",
                message: "Email delivery disabled in tests.",
              },
            },
            201,
          );
        }

        if (
          (path === "/api/family-members/current" || path === "/api/family-members/real") &&
          method === "GET"
        ) {
          return currentMember
            ? jsonResponse(currentMember)
            : jsonResponse({ message: "Family member not found" }, 404);
        }

        if (path === "/api/family-members" && method === "POST") {
          const payload = JSON.parse(String(init?.body)) as CreatedFamilyPayload;
          createdFamilyPayload = payload;
          currentMember = {
            id: "member-new-parent",
            userId: currentUser?.id || "user-new-parent",
            familyName: payload.familyName,
            displayName: payload.displayName,
            role: "parent",
            avatarUrl: payload.avatarUrl,
            color: payload.color,
            totalEarned: 0,
            totalPoints: 0,
            weeklyPoints: 0,
            monthlyPoints: 0,
            rewardsRedeemed: 0,
            starsFound: 0,
            activeSkinId: null,
            useCustomAvatar: false,
            useThemeBackground: false,
            discoveredSkinIds: [],
            earnedLegacySkinIds: [],
            updatedAt: "2026-04-21T00:00:00.000Z",
          };
          return jsonResponse(currentMember);
        }

        if (path === "/api/family-members" && method === "GET") {
          return jsonResponse(currentMember ? [currentMember] : []);
        }

        if ((path === "/api/families/current" || path === "/api/families/settings") && method === "GET") {
          return jsonResponse({
            familyName: currentMember?.familyName || "Test Family",
            subscriptionTier: "free",
            subscriptionStatus: "active",
            memberCount: currentMember ? 1 : 0,
            showLeaderboard: true,
            singleDeviceMode: false,
            language: "en",
            timezone: "Europe/Berlin",
          });
        }

        if (
          [
            "/api/tasks",
            "/api/rewards",
            "/api/reward-requests",
            "/api/achievements",
            "/api/notifications",
          ].includes(path) &&
          method === "GET"
        ) {
          return jsonResponse([]);
        }

        if (path === "/api/stars" && method === "GET") {
          return jsonResponse({ starsFound: 0, totalStars: 48, earnedLegacySkinIds: [] });
        }

        if (
          [
            "/api/chat/unread-count",
            "/api/tasks/pending-count",
            "/api/reward-redemptions/pending-count",
            "/api/notifications/unread-count",
          ].includes(path) &&
          method === "GET"
        ) {
          return jsonResponse({ count: 0 });
        }

        return jsonResponse({ message: `Unhandled ${method} ${path}` }, 404);
      }),
    );
  };

  beforeEach(() => {
    currentUser = null;
    currentMember = null;
    createdFamilyPayload = null;
    queryClient.clear();
    sessionStorage.clear();
    localStorage.clear();
    window.history.replaceState({}, "", "/");
    vi.stubGlobal("WebSocket", MockWebSocket);
    setupFetchMock();
  });

  afterEach(() => {
    cleanup();
    queryClient.clear();
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it("registers a new parent, redirects to setup, creates the first family, and reaches the dashboard", async () => {
    const user = userEvent.setup();
    render(createElement(App));

    await user.click(await screen.findByTestId("tab-register"));
    await user.type(screen.getByTestId("input-register-first-name"), "Ada");
    await user.type(screen.getByTestId("input-register-last-name"), "Lovelace");
    await user.type(screen.getByTestId("input-register-email"), "ada.lovelace@example.com");
    await user.type(screen.getByTestId("input-register-password"), "super-secret-password");
    await user.click(screen.getByTestId("button-submit-register"));

    await waitFor(() => expect(window.location.pathname).toBe("/setup"));
    expect(await screen.findByTestId("status-registration-next-step")).toBeTruthy();
    expect(screen.getByTestId("input-display-name")).toHaveProperty("value", "Ada Lovelace");

    await user.clear(screen.getByTestId("input-family-name"));
    await user.type(screen.getByTestId("input-family-name"), "Automated Lovelace Family");
    await user.click(screen.getByTestId("button-complete-setup"));

    await waitFor(() => expect(window.location.pathname).toBe("/dashboard"));
    expect((await screen.findByTestId("text-user-name")).textContent).toContain("Ada Lovelace");
    expect(createdFamilyPayload).toMatchObject({
      familyName: "Automated Lovelace Family",
      displayName: "Ada Lovelace",
      role: "parent",
    });
    expect(currentMember?.role).toBe("parent");
  });

  it("keeps returning parent-family routing covered by redirecting an existing parent to the dashboard", async () => {
    currentUser = {
      id: "user-returning-parent",
      email: "grace.hopper@example.com",
      firstName: "Grace",
      lastName: "Hopper",
    };
    currentMember = {
      id: "member-returning-parent",
      userId: currentUser.id,
      familyName: "Hopper Family",
      displayName: "Grace Hopper",
      role: "parent",
      avatarUrl: "/avatars/default.png",
      color: "#8B5CF6",
      totalEarned: 0,
      totalPoints: 0,
      weeklyPoints: 0,
      monthlyPoints: 0,
      rewardsRedeemed: 0,
      starsFound: 0,
      activeSkinId: null,
      useCustomAvatar: false,
      useThemeBackground: false,
      discoveredSkinIds: [],
      earnedLegacySkinIds: [],
      updatedAt: "2026-04-21T00:00:00.000Z",
    };

    render(createElement(App));

    await waitFor(() => expect(window.location.pathname).toBe("/dashboard"));
    expect((await screen.findByTestId("text-user-name")).textContent).toContain("Grace Hopper");
    expect(screen.queryByTestId("text-setup-title")).toBeNull();
  });
});