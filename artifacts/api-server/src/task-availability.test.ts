import { describe, expect, it } from "vitest";
import { calculateMemberRecurringNextAvailableDate } from "./task-mode-policy";

const friday = new Date("2026-05-29T12:00:00Z");
const monday = new Date("2026-06-01T12:00:00Z");
const completions = [
  { memberId: "a", status: "approved", completedAt: friday },
  { memberId: "b", status: "approved", completedAt: monday },
];

describe("individual child task availability", () => {
  it.each([
    ["daily", null, "2026-05-29T22:00:00.000Z"],
    ["weekdays", null, "2026-05-31T22:00:00.000Z"],
    ["weekly", null, "2026-05-31T22:00:00.000Z"],
    ["monthly", null, "2026-05-31T22:00:00.000Z"],
    ["yearly", null, "2026-12-31T23:00:00.000Z"],
    ["none", 4, "2026-06-01T22:00:00.000Z"],
  ] as const)("computes %s/%s from this member's approval in the family timezone", (recurrence, recurrenceDays, expected) => {
    expect(calculateMemberRecurringNextAvailableDate({
      memberId: "a", status: "approved", completions, recurrence, recurrenceDays, timezone: "Europe/Berlin",
    })?.toISOString()).toBe(expected);
  });

  it("never takes another member's date or a pending submission", () => {
    const input = { memberId: "a", completions, recurrence: "weekly" as const, recurrenceDays: null, timezone: "Europe/Berlin" };
    expect(calculateMemberRecurringNextAvailableDate({ ...input, status: "pending" })).toBeNull();
    expect(calculateMemberRecurringNextAvailableDate({ ...input, status: "approved", completions: completions.slice(1) })).toBeNull();
    expect(calculateMemberRecurringNextAvailableDate({ ...input, status: "rejected" })).toBeNull();
    expect(calculateMemberRecurringNextAvailableDate({ ...input, status: null })).toBeNull();
  });
});