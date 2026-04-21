// @vitest-environment jsdom
import "../i18n";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClientProvider } from "@tanstack/react-query";
import { ProfileMenu } from "../components/profile-menu";
import { queryClient } from "../lib/queryClient";

const jsonResponse = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });

const member = {
  id: "member-parent",
  userId: "user-parent",
  familyName: "Riewert Family",
  displayName: "Riewert",
  role: "parent" as const,
  avatarUrl: "",
  color: "#8B5CF6",
  totalEarned: 0,
  totalPoints: 0,
  weeklyPoints: 0,
  monthlyPoints: 0,
  rewardsRedeemed: 0,
  unlockedSkins: [],
  discoveredSkinIds: [],
  starsFound: 0,
  earnedLegacySkinIds: [],
  activeSkinId: null,
  useCustomAvatar: false,
  useThemeBackground: false,
  avatarHistory: [],
  lastReadChatAt: null,
  excludeFromLeaderboard: false,
  pinCode: null,
  createdAt: new Date("2026-04-21T00:00:00.000Z"),
  updatedAt: new Date("2026-04-21T00:00:00.000Z"),
};

const renderProfileMenu = (isEmailVerified: boolean) => {
  queryClient.setQueryData(["/api/auth/user"], {
    id: "user-parent",
    email: "sonoastudio@me.com",
    firstName: "Riewert",
    lastName: null,
    isEmailVerified,
  });

  return render(
    createElement(
      QueryClientProvider,
      { client: queryClient },
      createElement(ProfileMenu, {
        member,
        isParent: true,
        isRealParent: true,
        familyMemberCount: 1,
        onEditProfile: vi.fn(),
        onSwitchMember: vi.fn(),
      }),
    ),
  );
};

describe("profile menu email verification", () => {
  beforeEach(() => {
    queryClient.clear();
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
        const path = url.startsWith("http") ? new URL(url).pathname : url;
        const method = init?.method || "GET";

        if (path === "/api/auth/resend-verification" && method === "POST") {
          return jsonResponse({ message: "Bestätigungsmail wurde gesendet." });
        }

        return jsonResponse({ message: `Unhandled ${method} ${path}` }, 404);
      }),
    );
  });

  afterEach(() => {
    cleanup();
    queryClient.clear();
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it("lets an unverified parent request a new verification email", async () => {
    const user = userEvent.setup();
    renderProfileMenu(false);

    await user.click(screen.getByTestId("button-profile-menu"));
    await user.click(await screen.findByTestId("menu-item-resend-verification"));

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        "/api/auth/resend-verification",
        expect.objectContaining({ method: "POST" }),
      );
    });
  });

  it("hides the resend action after the parent email is verified", async () => {
    const user = userEvent.setup();
    renderProfileMenu(true);

    await user.click(screen.getByTestId("button-profile-menu"));

    expect(screen.queryByTestId("menu-item-resend-verification")).toBeNull();
  });
});
