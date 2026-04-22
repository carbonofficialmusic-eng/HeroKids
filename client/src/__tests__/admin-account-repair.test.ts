// @vitest-environment jsdom
import { afterEach, beforeEach, describe, it, expect, vi } from "vitest";
import { createElement } from "react";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClientProvider } from "@tanstack/react-query";
import AdminPage from "../pages/admin";
import { queryClient } from "../lib/queryClient";
import {
  makeDefaultAdminFamilyDetails,
  makeAdminFetchMock,
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
      makeAdminFetchMock(
        () => adminFamilyDetails,
        (d) => { adminFamilyDetails = d; },
      ),
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
