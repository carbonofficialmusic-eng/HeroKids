import { describe, it, expect } from "vitest";
import { filterTasksByDate, filterKidTasksByDate } from "../lib/task-filters";

const weekdaysTask = { recurrence: "weekdays", recurrenceDays: null, dueDate: null };
const dailyTask    = { recurrence: "daily",    recurrenceDays: null, dueDate: null };
const immediateTask = { recurrence: "immediate", recurrenceDays: null, dueDate: null };
const weeklyTask   = { recurrence: "weekly",   recurrenceDays: null, dueDate: null };
const monthlyTask  = { recurrence: "monthly",  recurrenceDays: null, dueDate: null };
const yearlyTask   = { recurrence: "yearly",   recurrenceDays: null, dueDate: null };
const oneTimeTask  = { recurrence: "none",     recurrenceDays: null, dueDate: "2026-04-20" };
const oneTimeTaskNoDueDate = { recurrence: "none", recurrenceDays: null, dueDate: null };

// Custom-interval tasks
const custom1day  = { recurrence: "none", recurrenceDays: 1,  dueDate: null };
const custom3days = { recurrence: "none", recurrenceDays: 3,  dueDate: null };
const custom4days = { recurrence: "none", recurrenceDays: 4,  dueDate: null };
const custom7days = { recurrence: "none", recurrenceDays: 7,  dueDate: null };
const custom8days = { recurrence: "none", recurrenceDays: 8,  dueDate: null };
const custom30days = { recurrence: "none", recurrenceDays: 30, dueDate: null };
const custom31days = { recurrence: "none", recurrenceDays: 31, dueDate: null };
const custom90days = { recurrence: "none", recurrenceDays: 90, dueDate: null };

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
    it("includes custom 1-day tasks", () => {
      expect(filterTasksByDate([custom1day], "daily")).toHaveLength(1);
    });
    it("includes custom 3-day tasks", () => {
      expect(filterTasksByDate([custom3days], "daily")).toHaveLength(1);
    });
    it("excludes custom 4-day tasks", () => {
      expect(filterTasksByDate([custom4days], "daily")).toHaveLength(0);
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
    it("includes custom 4-day tasks", () => {
      expect(filterTasksByDate([custom4days], "weekly")).toHaveLength(1);
    });
    it("includes custom 7-day tasks", () => {
      expect(filterTasksByDate([custom7days], "weekly")).toHaveLength(1);
    });
    it("excludes custom 3-day tasks", () => {
      expect(filterTasksByDate([custom3days], "weekly")).toHaveLength(0);
    });
    it("excludes custom 8-day tasks", () => {
      expect(filterTasksByDate([custom8days], "weekly")).toHaveLength(0);
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
    it("includes custom 8-day tasks", () => {
      expect(filterTasksByDate([custom8days], "monthly")).toHaveLength(1);
    });
    it("includes custom 30-day tasks", () => {
      expect(filterTasksByDate([custom30days], "monthly")).toHaveLength(1);
    });
    it("excludes custom 7-day tasks", () => {
      expect(filterTasksByDate([custom7days], "monthly")).toHaveLength(0);
    });
    it("excludes custom 31-day tasks", () => {
      expect(filterTasksByDate([custom31days], "monthly")).toHaveLength(0);
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
    it("includes yearly and plain one-time tasks that have no dedicated tab", () => {
      expect(filterTasksByDate([yearlyTask], "all")).toHaveLength(1);
      expect(filterTasksByDate([oneTimeTask], "all")).toHaveLength(1);
    });
    it("includes custom 31+ day tasks that have no dedicated tab", () => {
      expect(filterTasksByDate([custom31days], "all")).toHaveLength(1);
      expect(filterTasksByDate([custom90days], "all")).toHaveLength(1);
    });
  });

  describe("mixed task lists", () => {
    it("daily filter returns only daily/weekdays/immediate/custom≤3 tasks", () => {
      const tasks = [dailyTask, weekdaysTask, immediateTask, weeklyTask, monthlyTask, oneTimeTask, custom3days, custom4days];
      const result = filterTasksByDate(tasks, "daily");
      expect(result).toHaveLength(4); // daily, weekdays, immediate, custom3
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
    it("includes custom 1-day tasks", () => {
      expect(filterKidTasksByDate([custom1day], "daily")).toHaveLength(1);
    });
    it("includes custom 3-day tasks", () => {
      expect(filterKidTasksByDate([custom3days], "daily")).toHaveLength(1);
    });
    it("excludes custom 4-day tasks", () => {
      expect(filterKidTasksByDate([custom4days], "daily")).toHaveLength(0);
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
    it("includes custom 4-day tasks", () => {
      expect(filterKidTasksByDate([custom4days], "weekly")).toHaveLength(1);
    });
    it("includes custom 7-day tasks", () => {
      expect(filterKidTasksByDate([custom7days], "weekly")).toHaveLength(1);
    });
    it("excludes custom 3-day tasks", () => {
      expect(filterKidTasksByDate([custom3days], "weekly")).toHaveLength(0);
    });
    it("excludes custom 8-day tasks", () => {
      expect(filterKidTasksByDate([custom8days], "weekly")).toHaveLength(0);
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
    it("includes custom 8-day tasks", () => {
      expect(filterKidTasksByDate([custom8days], "monthly")).toHaveLength(1);
    });
    it("includes custom 30-day tasks", () => {
      expect(filterKidTasksByDate([custom30days], "monthly")).toHaveLength(1);
    });
    it("excludes custom 7-day tasks", () => {
      expect(filterKidTasksByDate([custom7days], "monthly")).toHaveLength(0);
    });
    it("excludes custom 31-day tasks", () => {
      expect(filterKidTasksByDate([custom31days], "monthly")).toHaveLength(0);
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
    it("includes custom 31+ day tasks", () => {
      expect(filterKidTasksByDate([custom90days], "all")).toHaveLength(1);
    });
  });

  describe("mixed task lists", () => {
    it("daily filter returns only daily/weekdays/immediate/custom≤3 tasks", () => {
      const tasks = [dailyTask, weekdaysTask, weeklyTask, monthlyTask, custom3days, custom4days];
      const result = filterKidTasksByDate(tasks, "daily");
      expect(result).toHaveLength(3); // daily, weekdays, custom3
    });
    it("weekly filter returns only weekly and custom 4-7 day tasks", () => {
      const tasks = [dailyTask, weeklyTask, monthlyTask, custom4days, custom7days, custom8days];
      const result = filterKidTasksByDate(tasks, "weekly");
      expect(result).toHaveLength(3); // weekly, custom4, custom7
    });
    it("monthly filter returns only monthly and custom 8-30 day tasks", () => {
      const tasks = [dailyTask, weeklyTask, monthlyTask, yearlyTask, custom8days, custom30days, custom31days];
      const result = filterKidTasksByDate(tasks, "monthly");
      expect(result).toHaveLength(3); // monthly, custom8, custom30
    });
  });
});
