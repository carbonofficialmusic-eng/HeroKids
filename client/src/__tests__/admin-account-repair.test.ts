// @vitest-environment jsdom
import { afterEach, beforeEach, describe, it, expect, vi } from "vitest";
import { createElement } from "react";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClientProvider } from "@tanstack/react-query";
import AdminPage from "../pages/admin";
import { queryClient } from "../lib/queryClient";
import {
  jsonResponse,
  healthyEmailStatus,
  makeDefaultAdminFamilyDetails,
  type AdminFamilyDetails,
} from "./adminTestHelpers";

vi.mock("recharts", async () => {
  const { rechartsModuleMock } = await import("./adminTestHelpers");
  return rechartsModuleMock;
});

describe("admin account-link repair dashboard", () => {
  let adminFamilyDetails: AdminFamilyDetails;

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
          expect(body).toMatchObject({ action: "unlink", adminActor: "Test Admin" });
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
            adminActor: "Test Admin",
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
          return jsonResponse(healthyEmailStatus);
        }

        if (path === "/api/admin/email-health/test" && method === "POST") {
          return jsonResponse(healthyEmailStatus);
        }

        return jsonResponse({ message: `Unhandled ${method} ${path}` }, 404);
      }),
    );
  };

  beforeEach(() => {
    queryClient.clear();
    localStorage.setItem("admin_token", "admin-secret");
    localStorage.setItem("admin_actor", "Test Admin");
    adminFamilyDetails = makeDefaultAdminFamilyDetails();
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

  it("disables account repair controls until a specific admin name is entered", async () => {
    const renderFamilyDetailsWithActor = async (actor: string) => {
      cleanup();
      queryClient.clear();
      setupFetchMock();
      localStorage.setItem("admin_actor", actor);
      const user = userEvent.setup();
      renderAdmin();

      await user.click(await screen.findByTestId("tab-families"));
      await user.click(await screen.findByText("Hero Family"));

      return {
        unlinkButton: screen.getByTestId("button-unlink-account-member-diego") as HTMLButtonElement,
        linkButton: screen.getByTestId("button-link-account-member-riewert") as HTMLButtonElement,
      };
    };

    let controls = await renderFamilyDetailsWithActor("");
    expect(controls.unlinkButton.disabled).toBe(true);
    expect(controls.linkButton.disabled).toBe(true);

    controls = await renderFamilyDetailsWithActor("admin");
    expect(controls.unlinkButton.disabled).toBe(true);
    expect(controls.linkButton.disabled).toBe(true);

    controls = await renderFamilyDetailsWithActor("Casey Support");
    expect(controls.unlinkButton.disabled).toBe(false);
    expect(controls.linkButton.disabled).toBe(false);
  });

  it("shows repaired-by labels and older repair entries without an actor", async () => {
    const user = userEvent.setup();
    adminFamilyDetails = {
      ...adminFamilyDetails,
      accountLinkRepairHistory: [
        {
          id: "repair-with-actor",
          memberId: "member-diego",
          memberDisplayName: "Diego",
          action: "unlink",
          oldAccountEmail: "carbon.official.music@gmail.com",
          newAccountEmail: null,
          repairedBy: "Alice Admin",
          repairedAt: "2026-04-21T00:00:00.000Z",
        },
        {
          id: "repair-legacy",
          memberId: "member-riewert",
          memberDisplayName: "Riewert",
          action: "link",
          oldAccountEmail: null,
          newAccountEmail: "sonoastudio@me.com",
          repairedAt: "2026-04-21T00:01:00.000Z",
        },
      ],
    };
    renderAdmin();

    await user.click(await screen.findByTestId("tab-families"));
    await user.click(await screen.findByText("Hero Family"));

    expect((await screen.findByTestId("card-account-link-repair-repair-with-actor")).textContent).toContain("Alice Admin");
    expect(screen.getByTestId("text-account-link-actor-repair-with-actor").textContent).toContain("Repaired by: Alice Admin");
    expect(screen.getByTestId("card-account-link-repair-repair-legacy").textContent).toContain("Riewert");
    expect(screen.getByTestId("card-account-link-repair-repair-legacy").textContent).toContain("sonoastudio@me.com");
    expect(screen.queryByTestId("text-account-link-actor-repair-legacy")).toBeNull();
  });

  it("filters account-link repair history by member action and email", async () => {
    const user = userEvent.setup();
    adminFamilyDetails = {
      ...adminFamilyDetails,
      accountLinkRepairHistory: [
        {
          id: "repair-diego-unlink",
          memberId: "member-diego",
          memberDisplayName: "Diego",
          action: "unlink",
          oldAccountEmail: "carbon.official.music@gmail.com",
          newAccountEmail: null,
          repairedBy: "Alice Admin",
          repairedAt: "2026-04-21T00:00:00.000Z",
        },
        {
          id: "repair-riewert-link",
          memberId: "member-riewert",
          memberDisplayName: "Riewert",
          action: "link",
          oldAccountEmail: null,
          newAccountEmail: "sonoastudio@me.com",
          repairedBy: "Bob Admin",
          repairedAt: "2026-04-21T00:01:00.000Z",
        },
        {
          id: "repair-mila-move",
          memberId: "member-mila",
          memberDisplayName: "Mila",
          action: "move_link",
          oldAccountEmail: null,
          newAccountEmail: "mila@example.com",
          repairedBy: "Chris Admin",
          repairedAt: "2026-04-21T00:02:00.000Z",
        },
      ],
    };
    renderAdmin();

    await user.click(await screen.findByTestId("tab-families"));
    await user.click(await screen.findByText("Hero Family"));
    const search = await screen.findByTestId("input-account-link-repair-search");

    await user.type(search, "riewert");
    expect(screen.getByTestId("text-account-link-repair-filter-count").textContent).toContain("Showing 1 of 3 repairs");
    expect(screen.getByTestId("card-account-link-repair-repair-riewert-link").textContent).toContain("sonoastudio@me.com");
    expect(screen.queryByTestId("card-account-link-repair-repair-diego-unlink")).toBeNull();

    await user.clear(search);
    await user.type(search, "moved here");
    expect(screen.getByTestId("card-account-link-repair-repair-mila-move").textContent).toContain("Moved here");
    expect(screen.queryByTestId("card-account-link-repair-repair-riewert-link")).toBeNull();

    await user.clear(search);
    await user.type(search, "carbon.official");
    expect(screen.getByTestId("card-account-link-repair-repair-diego-unlink").textContent).toContain("carbon.official.music@gmail.com");
    expect(screen.queryByTestId("card-account-link-repair-repair-mila-move")).toBeNull();

    await user.clear(search);
    await user.type(search, "missing@example.com");
    expect(screen.getByTestId("text-account-link-history-no-results").textContent).toContain("No account-link repairs match this search.");
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
