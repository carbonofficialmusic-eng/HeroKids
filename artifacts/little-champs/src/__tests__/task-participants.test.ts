import { describe, expect, it } from "vitest";
import { visibleTaskParticipants } from "../lib/task-participants";

const members = [
  { memberId: "a", status: null },
  { memberId: "b", status: "pending" },
  { memberId: "c", status: "approved" },
  { memberId: "d", status: "rejected" },
  { memberId: "e", status: null },
];

describe("task participant visibility", () => {
  it("shows three, with the active profile first even when originally below the cutoff", () => {
    expect(visibleTaskParticipants(members, "e", false).map(m => m.memberId)).toEqual(["e", "a", "b"]);
  });
  it("expands all members while preserving other members' order and status", () => {
    const visible = visibleTaskParticipants(members, "d", true);
    expect(visible.map(m => m.memberId)).toEqual(["d", "a", "b", "c", "e"]);
    expect(visible[0]).toBe(members[3]);
    expect(visible[3].status).toBe("approved");
    expect(members.map(m => m.memberId)).toEqual(["a", "b", "c", "d", "e"]);
  });
  it("uses the switched profile rather than keeping the original member first", () => {
    expect(visibleTaskParticipants(members, "b", false).map(m => m.memberId)).toEqual(["b", "a", "c"]);
    expect(visibleTaskParticipants(members, "d", false).map(m => m.memberId)).toEqual(["d", "a", "b"]);
  });
  it("does not invent an assignment for viewers who are not assigned", () => {
    expect(visibleTaskParticipants(members, "parent", false)).toEqual(members.slice(0, 3));
  });
  it("handles no members, small lists, and a missing active profile", () => {
    expect(visibleTaskParticipants(undefined, undefined, false)).toEqual([]);
    expect(visibleTaskParticipants(members.slice(0, 2), "b", false)).toEqual([members[1], members[0]]);
    expect(visibleTaskParticipants(members, undefined, true)).toEqual(members);
  });
});
