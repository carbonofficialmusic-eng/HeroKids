import { describe, it, expect } from "vitest";
import { filterTasksByDate, filterKidTasksByDate } from "../lib/task-filters";

// Reference dates for predictable testing
// April 18, 2026 is a Saturday (getDay() === 6)
const SATURDAY = new Date("2026-04-18T10:00:00");
// April 19, 2026 is a Sunday (getDay() === 0)
const SUNDAY = new Date("2026-04-19T10:00:00");
// April 20, 2026 is a Monday (getDay() === 1)
const MONDAY = new Date("2026-04-20T10:00:00");
// April 24, 2026 is a Friday (getDay() === 5)
const FRIDAY = new Date("2026-04-24T10:00:00");

const weekdaysTask = { recurrence: "weekdays", dueDate: null };
const dailyTask = { recurrence: "daily", dueDate: null };
const immediateTask = { recurrence: "immediate", dueDate: null };
const weeklyTask = { recurrence: "weekly", dueDate: null };
const oneTimeTaskToday = { recurrence: "none", dueDate: "2026-04-20" };
const oneTimeTaskFuture = { recurrence: "none", dueDate: "2026-04-25" };
const oneTimeTaskNoDueDate = { recurrence: "none", dueDate: null };

// ---------------------------------------------------------------------------
// filterTasksByDate (parent dashboard)
// ---------------------------------------------------------------------------

describe("filterTasksByDate — parent dashboard", () => {
  describe('filter: "today"', () => {
    it("excludes weekdays tasks on Saturday", () => {
      const result = filterTasksByDate([weekdaysTask], "today", SATURDAY);
      expect(result).toHaveLength(0);
    });

    it("excludes weekdays tasks on Sunday", () => {
      const result = filterTasksByDate([weekdaysTask], "today", SUNDAY);
      expect(result).toHaveLength(0);
    });

    it("includes weekdays tasks on Monday", () => {
      const result = filterTasksByDate([weekdaysTask], "today", MONDAY);
      expect(result).toHaveLength(1);
    });

    it("includes weekdays tasks on Friday", () => {
      const result = filterTasksByDate([weekdaysTask], "today", FRIDAY);
      expect(result).toHaveLength(1);
    });

    it("includes daily tasks on Saturday", () => {
      const result = filterTasksByDate([dailyTask], "today", SATURDAY);
      expect(result).toHaveLength(1);
    });

    it("includes immediate tasks on Saturday", () => {
      const result = filterTasksByDate([immediateTask], "today", SATURDAY);
      expect(result).toHaveLength(1);
    });

    it("includes one-time tasks whose dueDate matches today (Monday)", () => {
      const result = filterTasksByDate([oneTimeTaskToday], "today", MONDAY);
      expect(result).toHaveLength(1);
    });

    it("excludes one-time tasks whose dueDate does not match today", () => {
      const result = filterTasksByDate([oneTimeTaskFuture], "today", MONDAY);
      expect(result).toHaveLength(0);
    });

    it("includes one-time tasks with no dueDate in 'today' filter", () => {
      const result = filterTasksByDate([oneTimeTaskNoDueDate], "today", MONDAY);
      expect(result).toHaveLength(1);
    });

    it("excludes weekly tasks in 'today' filter", () => {
      const result = filterTasksByDate([weeklyTask], "today", MONDAY);
      expect(result).toHaveLength(0);
    });
  });

  describe('filter: "week"', () => {
    it("includes weekdays tasks on Saturday (week view shows all weekdays tasks)", () => {
      const result = filterTasksByDate([weekdaysTask], "week", SATURDAY);
      expect(result).toHaveLength(1);
    });

    it("includes weekdays tasks on Sunday (week view shows all weekdays tasks)", () => {
      const result = filterTasksByDate([weekdaysTask], "week", SUNDAY);
      expect(result).toHaveLength(1);
    });

    it("includes weekdays tasks on Monday in week view", () => {
      const result = filterTasksByDate([weekdaysTask], "week", MONDAY);
      expect(result).toHaveLength(1);
    });

    it("includes daily tasks in week view", () => {
      const result = filterTasksByDate([dailyTask], "week", SATURDAY);
      expect(result).toHaveLength(1);
    });

    it("includes weekly tasks in week view", () => {
      const result = filterTasksByDate([weeklyTask], "week", SATURDAY);
      expect(result).toHaveLength(1);
    });

    it("includes immediate tasks in week view", () => {
      const result = filterTasksByDate([immediateTask], "week", SATURDAY);
      expect(result).toHaveLength(1);
    });

    it("includes one-time tasks due within the next 7 days", () => {
      // MONDAY is April 20; oneTimeTaskFuture is April 25 (5 days ahead)
      const result = filterTasksByDate([oneTimeTaskFuture], "week", MONDAY);
      expect(result).toHaveLength(1);
    });

    it("excludes one-time tasks due outside the next 7 days", () => {
      const farFutureTask = { recurrence: "none", dueDate: "2026-05-30" };
      const result = filterTasksByDate([farFutureTask], "week", MONDAY);
      expect(result).toHaveLength(0);
    });
  });

  describe('filter: "all"', () => {
    it("includes weekdays tasks on Saturday in 'all' filter", () => {
      const result = filterTasksByDate([weekdaysTask], "all", SATURDAY);
      expect(result).toHaveLength(1);
    });

    it("includes weekdays tasks on Sunday in 'all' filter", () => {
      const result = filterTasksByDate([weekdaysTask], "all", SUNDAY);
      expect(result).toHaveLength(1);
    });

    it("includes all task types in 'all' filter", () => {
      const tasks = [weekdaysTask, dailyTask, weeklyTask, immediateTask, oneTimeTaskNoDueDate];
      const result = filterTasksByDate(tasks, "all", SATURDAY);
      expect(result).toHaveLength(tasks.length);
    });
  });

  describe("mixed task lists", () => {
    it("correctly separates weekdays tasks from daily tasks on a weekend (today filter)", () => {
      const tasks = [weekdaysTask, dailyTask];
      const result = filterTasksByDate(tasks, "today", SATURDAY);
      expect(result).toHaveLength(1);
      expect(result[0].recurrence).toBe("daily");
    });

    it("shows only weekdays tasks filtered out on Sunday but daily tasks remain", () => {
      const tasks = [weekdaysTask, dailyTask, immediateTask];
      const result = filterTasksByDate(tasks, "today", SUNDAY);
      expect(result).toHaveLength(2);
      expect(result.every((t) => t.recurrence !== "weekdays")).toBe(true);
    });
  });
});

// ---------------------------------------------------------------------------
// filterKidTasksByDate (kid dashboard)
// ---------------------------------------------------------------------------

describe("filterKidTasksByDate — kid dashboard", () => {
  describe('filter: "today"', () => {
    it("excludes weekdays tasks on Saturday", () => {
      const result = filterKidTasksByDate([weekdaysTask], "today", SATURDAY);
      expect(result).toHaveLength(0);
    });

    it("excludes weekdays tasks on Sunday", () => {
      const result = filterKidTasksByDate([weekdaysTask], "today", SUNDAY);
      expect(result).toHaveLength(0);
    });

    it("includes weekdays tasks on Monday", () => {
      const result = filterKidTasksByDate([weekdaysTask], "today", MONDAY);
      expect(result).toHaveLength(1);
    });

    it("includes weekdays tasks on Friday", () => {
      const result = filterKidTasksByDate([weekdaysTask], "today", FRIDAY);
      expect(result).toHaveLength(1);
    });

    it("includes daily tasks on Saturday", () => {
      const result = filterKidTasksByDate([dailyTask], "today", SATURDAY);
      expect(result).toHaveLength(1);
    });

    it("includes weekly tasks on any day", () => {
      const result = filterKidTasksByDate([weeklyTask], "today", SATURDAY);
      expect(result).toHaveLength(1);
    });

    it("excludes one-time tasks with no due date", () => {
      const result = filterKidTasksByDate([oneTimeTaskNoDueDate], "today", MONDAY);
      expect(result).toHaveLength(0);
    });

    it("includes one-time tasks whose dueDate matches today (Monday)", () => {
      const result = filterKidTasksByDate([oneTimeTaskToday], "today", MONDAY);
      expect(result).toHaveLength(1);
    });

    it("excludes one-time tasks whose dueDate does not match today", () => {
      const result = filterKidTasksByDate([oneTimeTaskFuture], "today", MONDAY);
      expect(result).toHaveLength(0);
    });
  });

  describe('filter: "week"', () => {
    it("includes weekdays tasks on Saturday (week view shows all weekdays tasks)", () => {
      const result = filterKidTasksByDate([weekdaysTask], "week", SATURDAY);
      expect(result).toHaveLength(1);
    });

    it("includes weekdays tasks on Sunday (week view shows all weekdays tasks)", () => {
      const result = filterKidTasksByDate([weekdaysTask], "week", SUNDAY);
      expect(result).toHaveLength(1);
    });

    it("includes weekdays tasks on Monday in week view", () => {
      const result = filterKidTasksByDate([weekdaysTask], "week", MONDAY);
      expect(result).toHaveLength(1);
    });

    it("includes daily tasks in week view", () => {
      const result = filterKidTasksByDate([dailyTask], "week", SATURDAY);
      expect(result).toHaveLength(1);
    });

    it("includes weekly tasks in week view", () => {
      const result = filterKidTasksByDate([weeklyTask], "week", SATURDAY);
      expect(result).toHaveLength(1);
    });

    it("excludes one-time tasks with no due date in week view", () => {
      const result = filterKidTasksByDate([oneTimeTaskNoDueDate], "week", MONDAY);
      expect(result).toHaveLength(0);
    });

    it("includes one-time tasks due within the next 7 days", () => {
      const result = filterKidTasksByDate([oneTimeTaskFuture], "week", MONDAY);
      expect(result).toHaveLength(1);
    });

    it("excludes one-time tasks due outside the next 7 days", () => {
      const farFutureTask = { recurrence: "none", dueDate: "2026-05-30" };
      const result = filterKidTasksByDate([farFutureTask], "week", MONDAY);
      expect(result).toHaveLength(0);
    });
  });

  describe('filter: "all"', () => {
    it("includes weekdays tasks on Saturday in 'all' filter", () => {
      const result = filterKidTasksByDate([weekdaysTask], "all", SATURDAY);
      expect(result).toHaveLength(1);
    });

    it("includes weekdays tasks on Sunday in 'all' filter", () => {
      const result = filterKidTasksByDate([weekdaysTask], "all", SUNDAY);
      expect(result).toHaveLength(1);
    });

    it("includes all recurring task types on a weekend in 'all' filter", () => {
      const tasks = [weekdaysTask, dailyTask, weeklyTask];
      const result = filterKidTasksByDate(tasks, "all", SATURDAY);
      expect(result).toHaveLength(tasks.length);
    });
  });

  describe("mixed task lists", () => {
    it("correctly filters weekdays tasks out but keeps daily tasks on Saturday (today filter)", () => {
      const tasks = [weekdaysTask, dailyTask];
      const result = filterKidTasksByDate(tasks, "today", SATURDAY);
      expect(result).toHaveLength(1);
      expect(result[0].recurrence).toBe("daily");
    });

    it("shows all task types on Sunday in week view", () => {
      const tasks = [weekdaysTask, dailyTask, weeklyTask];
      const result = filterKidTasksByDate(tasks, "week", SUNDAY);
      expect(result).toHaveLength(3);
    });
  });
});

// ---------------------------------------------------------------------------
// Date boundary semantics: parent vs kid "week" filter window
//
// Both filters start from Monday April 20, 2026.
// Parent filter uses  due >= today && due < weekEnd   (exclusive upper bound)
// Kid filter uses     due >= today && due <= weekEnd  (inclusive upper bound)
//
// This means a task due exactly 7 days out (April 27) is treated differently:
//   - parent: excluded  (strict less-than fails at the boundary)
//   - kid:    included  (less-than-or-equal passes at the boundary)
// ---------------------------------------------------------------------------

describe("Date boundary: 'week' filter window — parent vs kid", () => {
  // Task due exactly 7 days from MONDAY = April 27, 2026
  const taskDueAt7Days = { recurrence: "none", dueDate: "2026-04-27" };
  // Task due 6 days from MONDAY = April 26, 2026 (inside both windows)
  const taskDueAt6Days = { recurrence: "none", dueDate: "2026-04-26" };
  // Task due 8 days from MONDAY = April 28, 2026 (outside both windows)
  const taskDueAt8Days = { recurrence: "none", dueDate: "2026-04-28" };

  it("parent filter: excludes a one-time task due exactly 7 days from now", () => {
    const result = filterTasksByDate([taskDueAt7Days], "week", MONDAY);
    expect(result).toHaveLength(0);
  });

  it("kid filter: includes a one-time task due exactly 7 days from now", () => {
    const result = filterKidTasksByDate([taskDueAt7Days], "week", MONDAY);
    expect(result).toHaveLength(1);
  });

  it("both filters: include a one-time task due 6 days from now", () => {
    expect(filterTasksByDate([taskDueAt6Days], "week", MONDAY)).toHaveLength(1);
    expect(filterKidTasksByDate([taskDueAt6Days], "week", MONDAY)).toHaveLength(1);
  });

  it("both filters: exclude a one-time task due 8 days from now", () => {
    expect(filterTasksByDate([taskDueAt8Days], "week", MONDAY)).toHaveLength(0);
    expect(filterKidTasksByDate([taskDueAt8Days], "week", MONDAY)).toHaveLength(0);
  });
});
