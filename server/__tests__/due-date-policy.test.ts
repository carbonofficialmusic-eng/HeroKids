import { describe, expect, it } from "vitest";
import {
  getLocalDateKey,
  getDueDateWindow,
  isFixedAppointment,
  isFixedAppointmentDueToday,
  sortFixedAppointments,
} from "../../shared/due-date-policy";

describe("fixed appointment grace period", () => {
  it("keeps future appointments locked", () => {
    expect(getDueDateWindow("2026-10-08", "2026-10-07")).toMatchObject({
      notYet: true,
      expired: false,
      isGraceDay: false,
    });
  });

  it("allows completion on the appointment date without forced approval", () => {
    expect(getDueDateWindow("2026-10-08", "2026-10-08")).toMatchObject({
      notYet: false,
      expired: false,
      isGraceDay: false,
    });
  });

  it("allows one late day and marks it for forced approval", () => {
    expect(getDueDateWindow("2026-10-08", "2026-10-09")).toMatchObject({
      notYet: false,
      expired: false,
      isGraceDay: true,
    });
  });

  it("expires the appointment on the second late day", () => {
    expect(getDueDateWindow("2026-10-08", "2026-10-10")).toMatchObject({
      notYet: false,
      expired: true,
      isGraceDay: false,
    });
  });
});

describe("fixed appointment category", () => {
  it("only recognizes one-time tasks with an explicit date", () => {
    expect(isFixedAppointment({ dueDate: "2026-10-08", recurrence: "none" })).toBe(true);
    expect(isFixedAppointment({ dueDate: null, recurrence: "none" })).toBe(false);
    expect(isFixedAppointment({ dueDate: "2026-10-08", recurrence: "weekly" })).toBe(false);
  });

  it("sorts appointments chronologically and keeps equal dates stable", () => {
    const tasks = [
      { id: "later", dueDate: "2026-10-12", recurrence: "none" },
      { id: "same-first", dueDate: "2026-10-08", recurrence: "none" },
      { id: "same-second", dueDate: "2026-10-08", recurrence: "none" },
    ];
    expect(sortFixedAppointments(tasks).map((task) => task.id)).toEqual([
      "same-first",
      "same-second",
      "later",
    ]);
  });

  it("puts today's appointments before older and future appointments", () => {
    const tasks = [
      { id: "past", dueDate: "2026-10-07", recurrence: "none" },
      { id: "future", dueDate: "2026-10-09", recurrence: "none" },
      { id: "today", dueDate: "2026-10-08", recurrence: "none" },
    ];

    expect(sortFixedAppointments(tasks, "2026-10-08").map((task) => task.id)).toEqual([
      "today",
      "past",
      "future",
    ]);
    expect(isFixedAppointmentDueToday(tasks[2], "2026-10-08")).toBe(true);
  });

  it("formats a local calendar key without converting through UTC", () => {
    expect(getLocalDateKey(new Date(2026, 9, 8, 23, 45))).toBe("2026-10-08");
  });
});