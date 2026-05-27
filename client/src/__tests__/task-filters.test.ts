import { describe, it, expect } from "vitest";
import { filterTasksByDate, filterKidTasksByDate } from "../lib/task-filters";

const weekdaysTask = { recurrence: "weekdays", dueDate: null };
const dailyTask = { recurrence: "daily", dueDate: null };
const immediateTask = { recurrence: "immediate", dueDate: null };
const weeklyTask = { recurrence: "weekly", dueDate: null };
const monthlyTask = { recurrence: "monthly", dueDate: null };
const yearlyTask = { recurrence: "yearly", dueDate: null };
const oneTimeTask = { recurrence: "none", dueDate: "2026-04-20" };
const oneTimeTaskNoDueDate = { recurrence: "none", dueDate: null };

// ---------------------------------------------------------------------------
// filterTasksByDate (parent dashboard)
// ---------------------------------------------------------------------------

describe("filterTasksByDate — parent dashboard", () => {
  describe('filter: "daily"', () => {
    it("includes daily tasks", () => {
      expect(filterTasksByDate([dailyTask], "daily")).toHaveLength(1);
    });

    it("includes weekdays tasks", () => {
      expect(filterTasksByDate([weekdaysTask], "daily")).toHaveLength(1);
    });

    it("includes immediate tasks", () => {
      expect(filterTasksByDate([immediateTask], "daily")).toHaveLength(1);
    });

    it("excludes weekly tasks", () => {
      expect(filterTasksByDate([weeklyTask], "daily")).toHaveLength(0);
    });

    it("excludes monthly tasks", () => {
      expect(filterTasksByDate([monthlyTask], "daily")).toHaveLength(0);
    });

    it("excludes one-time tasks", () => {
      expect(filterTasksByDate([oneTimeTask], "daily")).toHaveLength(0);
    });
  });

  describe('filter: "weekly"', () => {
    it("includes weekly tasks", () => {
      expect(filterTasksByDate([weeklyTask], "weekly")).toHaveLength(1);
    });

    it("excludes daily tasks", () => {
      expect(filterTasksByDate([dailyTask], "weekly")).toHaveLength(0);
    });

    it("excludes weekdays tasks", () => {
      expect(filterTasksByDate([weekdaysTask], "weekly")).toHaveLength(0);
    });

    it("excludes monthly tasks", () => {
      expect(filterTasksByDate([monthlyTask], "weekly")).toHaveLength(0);
    });

    it("excludes one-time tasks", () => {
      expect(filterTasksByDate([oneTimeTask], "weekly")).toHaveLength(0);
    });
  });

  describe('filter: "monthly"', () => {
    it("includes monthly tasks", () => {
      expect(filterTasksByDate([monthlyTask], "monthly")).toHaveLength(1);
    });

    it("excludes yearly tasks", () => {
      expect(filterTasksByDate([yearlyTask], "monthly")).toHaveLength(0);
    });

    it("excludes one-time tasks", () => {
      expect(filterTasksByDate([oneTimeTask], "monthly")).toHaveLength(0);
    });

    it("excludes one-time tasks with no due date", () => {
      expect(filterTasksByDate([oneTimeTaskNoDueDate], "monthly")).toHaveLength(0);
    });

    it("excludes daily tasks", () => {
      expect(filterTasksByDate([dailyTask], "monthly")).toHaveLength(0);
    });

    it("excludes weekly tasks", () => {
      expect(filterTasksByDate([weeklyTask], "monthly")).toHaveLength(0);
    });
  });

  describe('filter: "all"', () => {
    it("includes all task types", () => {
      const tasks = [weekdaysTask, dailyTask, immediateTask, weeklyTask, monthlyTask, yearlyTask, oneTimeTask, oneTimeTaskNoDueDate];
      expect(filterTasksByDate(tasks, "all")).toHaveLength(tasks.length);
    });

    it("includes yearly and one-time tasks that have no dedicated filter tab", () => {
      expect(filterTasksByDate([yearlyTask], "all")).toHaveLength(1);
      expect(filterTasksByDate([oneTimeTask], "all")).toHaveLength(1);
    });
  });

  describe("mixed task lists", () => {
    it("daily filter returns only daily/weekdays/immediate tasks", () => {
      const tasks = [dailyTask, weekdaysTask, immediateTask, weeklyTask, monthlyTask, oneTimeTask];
      const result = filterTasksByDate(tasks, "daily");
      expect(result).toHaveLength(3);
      expect(result.every(t => ["daily", "weekdays", "immediate"].includes(t.recurrence))).toBe(true);
    });

    it("monthly filter returns only monthly tasks", () => {
      const tasks = [dailyTask, weeklyTask, monthlyTask, yearlyTask, oneTimeTask];
      const result = filterTasksByDate(tasks, "monthly");
      expect(result).toHaveLength(1);
      expect(result[0].recurrence).toBe("monthly");
    });
  });
});

// ---------------------------------------------------------------------------
// filterKidTasksByDate (kid dashboard)
// ---------------------------------------------------------------------------

describe("filterKidTasksByDate — kid dashboard", () => {
  describe('filter: "daily"', () => {
    it("includes daily tasks", () => {
      expect(filterKidTasksByDate([dailyTask], "daily")).toHaveLength(1);
    });

    it("includes weekdays tasks", () => {
      expect(filterKidTasksByDate([weekdaysTask], "daily")).toHaveLength(1);
    });

    it("includes immediate tasks", () => {
      expect(filterKidTasksByDate([immediateTask], "daily")).toHaveLength(1);
    });

    it("excludes weekly tasks", () => {
      expect(filterKidTasksByDate([weeklyTask], "daily")).toHaveLength(0);
    });

    it("excludes monthly tasks", () => {
      expect(filterKidTasksByDate([monthlyTask], "daily")).toHaveLength(0);
    });

    it("excludes one-time tasks", () => {
      expect(filterKidTasksByDate([oneTimeTask], "daily")).toHaveLength(0);
    });
  });

  describe('filter: "weekly"', () => {
    it("includes weekly tasks", () => {
      expect(filterKidTasksByDate([weeklyTask], "weekly")).toHaveLength(1);
    });

    it("excludes daily tasks", () => {
      expect(filterKidTasksByDate([dailyTask], "weekly")).toHaveLength(0);
    });

    it("excludes monthly tasks", () => {
      expect(filterKidTasksByDate([monthlyTask], "weekly")).toHaveLength(0);
    });

    it("excludes one-time tasks", () => {
      expect(filterKidTasksByDate([oneTimeTask], "weekly")).toHaveLength(0);
    });
  });

  describe('filter: "monthly"', () => {
    it("includes monthly tasks", () => {
      expect(filterKidTasksByDate([monthlyTask], "monthly")).toHaveLength(1);
    });

    it("excludes yearly tasks", () => {
      expect(filterKidTasksByDate([yearlyTask], "monthly")).toHaveLength(0);
    });

    it("excludes one-time tasks", () => {
      expect(filterKidTasksByDate([oneTimeTask], "monthly")).toHaveLength(0);
    });

    it("excludes one-time tasks with no due date", () => {
      expect(filterKidTasksByDate([oneTimeTaskNoDueDate], "monthly")).toHaveLength(0);
    });

    it("excludes daily tasks", () => {
      expect(filterKidTasksByDate([dailyTask], "monthly")).toHaveLength(0);
    });

    it("excludes weekly tasks", () => {
      expect(filterKidTasksByDate([weeklyTask], "monthly")).toHaveLength(0);
    });
  });

  describe('filter: "all"', () => {
    it("includes all task types", () => {
      const tasks = [weekdaysTask, dailyTask, immediateTask, weeklyTask, monthlyTask, yearlyTask, oneTimeTask, oneTimeTaskNoDueDate];
      expect(filterKidTasksByDate(tasks, "all")).toHaveLength(tasks.length);
    });
  });

  describe("mixed task lists", () => {
    it("daily filter returns only daily/weekdays/immediate tasks", () => {
      const tasks = [dailyTask, weekdaysTask, weeklyTask, monthlyTask];
      const result = filterKidTasksByDate(tasks, "daily");
      expect(result).toHaveLength(2);
      expect(result.every(t => ["daily", "weekdays", "immediate"].includes(t.recurrence))).toBe(true);
    });

    it("weekly filter returns only weekly tasks", () => {
      const tasks = [dailyTask, weeklyTask, monthlyTask];
      const result = filterKidTasksByDate(tasks, "weekly");
      expect(result).toHaveLength(1);
      expect(result[0].recurrence).toBe("weekly");
    });

    it("monthly filter returns only monthly tasks", () => {
      const tasks = [dailyTask, weeklyTask, monthlyTask, yearlyTask, oneTimeTask];
      const result = filterKidTasksByDate(tasks, "monthly");
      expect(result).toHaveLength(1);
      expect(result[0].recurrence).toBe("monthly");
    });
  });
});
