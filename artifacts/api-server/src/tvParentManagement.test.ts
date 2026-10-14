import { describe, expect, it, vi } from "vitest";
import { resolveTvManagementParent } from "./tvParentManagement";

const parent = { id: "own-parent", role: "parent", isPaused: false, familyName: "family" };
const accountRequest = { user: { claims: { sub: "account" } } };

describe("real-account TV management", () => {
  it("allows the signed-in parent, including a switch back to their own profile", async () => {
    const lookup = vi.fn(async () => parent);
    expect(await resolveTvManagementParent(accountRequest, lookup)).toBe(parent);
    expect(await resolveTvManagementParent({
      ...accountRequest, session: { actingAsMemberId: parent.id },
    }, lookup)).toBe(parent);
    expect(lookup).toHaveBeenCalledWith("account");
  });

  it.each(["child", "other-parent", "foreign-family", "deleted-profile"])(
    "does not let the account manage TVs while selected as %s", async selected => {
      expect(await resolveTvManagementParent({
        ...accountRequest, session: { actingAsMemberId: selected },
      }, async () => parent)).toBeNull();
    },
  );

  it.each([
    {},
    { user: { claims: { sub: "tv:session" } } },
    { user: { claims: { sub: "mobile:member" } } },
    { user: { claims: { sub: "device:member" } } },
    { user: { claims: { sub: "account" }, authMethod: "device" } },
    { user: { claims: { sub: "account" }, authMethod: "mobile" } },
    { user: { claims: { sub: "account" }, tvSession: { id: "session" } } },
  ])("rejects non-account authentication before looking up a parent: %j", async req => {
    const lookup = vi.fn(async () => parent);
    expect(await resolveTvManagementParent(req, lookup)).toBeNull();
    expect(lookup).not.toHaveBeenCalled();
  });

  it.each([
    null,
    { ...parent, role: "child" },
    { ...parent, isPaused: true },
  ])("requires a current active parent in storage: %j", async member => {
    expect(await resolveTvManagementParent(accountRequest, async () => member)).toBeNull();
  });
});
