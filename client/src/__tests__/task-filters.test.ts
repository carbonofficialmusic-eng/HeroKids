import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { filterTasksByDate, filterKidTasksByDate } from "../lib/task-filters";

// Fix "today" so due-date tests are deterministic
const TODAY = new Date("2026-05-27T12:00:00Z");

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(TODAY);
});
afterEach(() => {
  vi.useRealTimers();
});

function daysFromToday(n: number): string {
  const d = new Date(TODAY);
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

// Standard recurrence fixtures
const weekdaysTask  = { recurrence: "weekdays",  recurrenceDays: null, dueDate: null };
const dailyTask     = { recurrence: "daily",     recurrenceDays: null, dueDate: null };
const immediateTask = { recurrence: "immediate", recurrenceDays: null, dueDate: null };
const weeklyTask    = { recurrence: "weekly",    recurrenceDays: null, dueDate: null };
const monthlyTask   = { recurrence: "monthly",   recurrenceDays: null, dueDate: null };
const yearlyTask    = { recurrence: "yearly",    recurrenceDays: null, dueDate: null };

// One-time tasks (recurrence "none", no recurrenceDays)
const oneTimeNoDate   = { recurrence: "none", recurrenceDays: null, dueDate: null };
const oneTimeToday    = { recurrence: "none", recurrenceDays: null, dueDate: daysFromToday(0) };
const oneTime3days    = { recurrence: "none", recurrenceDays: null, dueDate: daysFromToday(3) };
const oneTime4days    = { recurrence: "none", recurrenceDays: null, dueDate: daysFromToday(4) };
const oneTime7days    = { recurrence: "none", recurrenceDays: null, dueDate: daysFromToday(7) };
const oneTime8days    = { recurrence: "none", recurrenceDays: null, dueDate: daysFromToday(8) };
const oneTime30days   = { recurrence: "none", recurrenceDays: null, dueDate: daysFromToday(30) };
const oneTime31days   = { recurrence: "none", recurrenceDays: null, dueDate: daysFromToday(31) };
const oneTime90days   = { recurrence: "none", recurrenceDays: null, dueDate: daysFromToday(90) };

// Custom-interval tasks (recurrenceDays > 0)
const custom1day   = { recurrence: "none", recurrenceDays: 1,  dueDate: null };
const custom3days  = { recurrence: "none", recurrenceDays: 3,  dueDate: null };
const custom4days  = { recurrence: "none", recurrenceDays: 4,  dueDate: null };
const custom7days  = { recurrence: "none", recurrenceDays: 7,  dueDate: null };
const custom8days  = { recurrence: "none", recurrenceDays: 8,  dueDate: null };
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
    // One-time tasks
    it("includes one-time tasks with no due date", () => {
      expect(filterTasksByDate([oneTimeNoDate], "daily")).toHaveLength(1);
    });
    it("includes one-time tasks due today", () => {
      expect(filterTasksByDate([oneTimeToday], "daily")).toHaveLength(1);
    });
    it("includes one-time tasks due in 3 days", () => {
      expect(filterTasksByDate([oneTime3days], "daily")).toHaveLength(1);
    });
    it("excludes one-time tasks due in 4 days", () => {
      expect(filterTasksByDate([oneTime4days], "daily")).toHaveLength(0);
    });
    // Custom interval
    it("includes custom 1-day interval tasks", () => {
      expect(filterTasksByDate([custom1day], "daily")).toHaveLength(1);
    });
    it("includes custom 3-day interval tasks", () => {
      expect(filterTasksByDate([custom3days], "daily")).toHaveLength(1);
    });
    it("excludes custom 4-day interval tasks", () => {
      expect(filterTasksByDate([custom4days], "daily")).toHaveLength(0);
    });
    it("excludes weekly tasks", () => {
      expect(filterTasksByDate([weeklyTask], "daily")).toHaveLength(0);
    });
    it("excludes monthly tasks", () => {
      expect(filterTasksByDate([monthlyTask], "daily")).toHaveLength(0);
    });
  });

  describe('filter: "weekly"', () => {
    it("includes weekly tasks", () => {
      expect(filterTasksByDate([weeklyTask], "weekly")).toHaveLength(1);
    });
    // One-time tasks
    it("includes one-time tasks due in 4 days", () => {
      expect(filterTasksByDate([oneTime4days], "weekly")).toHaveLength(1);
    });
    it("includes one-time tasks due in 7 days", () => {
      expect(filterTasksByDate([oneTime7days], "weekly")).toHaveLength(1);
    });
    it("excludes one-time tasks with no date", () => {
      expect(filterTasksByDate([oneTimeNoDate], "weekly")).toHaveLength(0);
    });
    it("excludes one-time tasks due in 3 days", () => {
      expect(filterTasksByDate([oneTime3days], "weekly")).toHaveLength(0);
    });
    it("excludes one-time tasks due in 8 days", () => {
      expect(filterTasksByDate([oneTime8days], "weekly")).toHaveLength(0);
    });
    // Custom interval
    it("includes custom 4-day interval tasks", () => {
      expect(filterTasksByDate([custom4days], "weekly")).toHaveLength(1);
    });
    it("includes custom 7-day interval tasks", () => {
      expect(filterTasksByDate([custom7days], "weekly")).toHaveLength(1);
    });
    it("excludes custom 3-day interval tasks", () => {
      expect(filterTasksByDate([custom3days], "weekly")).toHaveLength(0);
    });
    it("excludes custom 8-day interval tasks", () => {
      expect(filterTasksByDate([custom8days], "weekly")).toHaveLength(0);
    });
    it("excludes daily tasks", () => {
      expect(filterTasksByDate([dailyTask], "weekly")).toHaveLength(0);
    });
    it("excludes monthly tasks", () => {
      expect(filterTasksByDate([monthlyTask], "weekly")).toHaveLength(0);
    });
  });

  describe('filter: "monthly"', () => {
    it("includes monthly tasks", () => {
      expect(filterTasksByDate([monthlyTask], "monthly")).toHaveLength(1);
    });
    // One-time tasks
    it("includes one-time tasks due in 8 days", () => {
      expect(filterTasksByDate([oneTime8days], "monthly")).toHaveLength(1);
    });
    it("includes one-time tasks due in 30 days", () => {
      expect(filterTasksByDate([oneTime30days], "monthly")).toHaveLength(1);
    });
    it("excludes one-time tasks with no date", () => {
      expect(filterTasksByDate([oneTimeNoDate], "monthly")).toHaveLength(0);
    });
    it("excludes one-time tasks due in 7 days", () => {
      expect(filterTasksByDate([oneTime7days], "monthly")).toHaveLength(0);
    });
    it("excludes one-time tasks due in 31 days", () => {
      expect(filterTasksByDate([oneTime31days], "monthly")).toHaveLength(0);
    });
    // Custom interval
    it("includes custom 8-day interval tasks", () => {
      expect(filterTasksByDate([custom8days], "monthly")).toHaveLength(1);
    });
    it("includes custom 30-day interval tasks", () => {
      expect(filterTasksByDate([custom30days], "monthly")).toHaveLength(1);
    });
    it("excludes custom 7-day interval tasks", () => {
      expect(filterTasksByDate([custom7days], "monthly")).toHaveLength(0);
    });
    it("excludes custom 31-day interval tasks", () => {
      expect(filterTasksByDate([custom31days], "monthly")).toHaveLength(0);
    });
    it("excludes yearly tasks", () => {
      expect(filterTasksByDate([yearlyTask], "monthly")).toHaveLength(0);
    });
    it("excludes daily tasks", () => {
      expect(filterTasksByDate([dailyTask], "monthly")).toHaveLength(0);
    });
  });

  describe('filter: "all"', () => {
    it("includes all standard recurrence types", () => {
      const tasks = [weekdaysTask, dailyTask, immediateTask, weeklyTask, monthlyTask, yearlyTask];
      expect(filterTasksByDate(tasks, "all")).toHaveLength(tasks.length);
    });
    it("includes yearly tasks (no dedicated tab)", () => {
      expect(filterTasksByDate([yearlyTask], "all")).toHaveLength(1);
    });
    it("includes one-time tasks with no date in all", () => {
      expect(filterTasksByDate([oneTimeNoDate], "all")).toHaveLength(1);
    });
    it("includes one-time tasks due in 31+ days", () => {
      expect(filterTasksByDate([oneTime31days], "all")).toHaveLength(1);
      expect(filterTasksByDate([oneTime90days], "all")).toHaveLength(1);
    });
    it("includes custom 31+ day interval tasks", () => {
      expect(filterTasksByDate([custom31days], "all")).toHaveLength(1);
      expect(filterTasksByDate([custom90days], "all")).toHaveLength(1);
    });
  });

  describe("mixed task lists", () => {
    it("daily filter groups daily/weekdays/immediate/one-time-no-date/custom≤3", () => {
      const tasks = [dailyTask, weekdaysTask, immediateTask, oneTimeNoDate, custom3days, custom4days, weeklyTask];
      const result = filterTasksByDate(tasks, "daily");
      expect(result).toHaveLength(5);
    });
    it("monthly filter returns only monthly and custom/one-time 8–30 day tasks", () => {
      const tasks = [dailyTask, weeklyTask, monthlyTask, yearlyTask, oneTime8days, custom8days, oneTime31days];
      const result = filterTasksByDate(tasks, "monthly");
      expect(result).toHaveLength(3); // monthlyTask, oneTime8days, custom8days
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
    it("includes immediate tasks", () => {
      expect(filterKidTasksByDate([immediateTask], "daily")).toHaveLength(1);
    });
    it("includes one-time tasks with no due date", () => {
      expect(filterKidTasksByDate([oneTimeNoDate], "daily")).toHaveLength(1);
    });
    it("includes one-time tasks due in 3 days", () => {
      expect(filterKidTasksByDate([oneTime3days], "daily")).toHaveLength(1);
    });
    it("excludes one-time tasks due in 4 days", () => {
      expect(filterKidTasksByDate([oneTime4days], "daily")).toHaveLength(0);
    });
    it("includes custom 3-day interval tasks", () => {
      expect(filterKidTasksByDate([custom3days], "daily")).toHaveLength(1);
    });
    it("excludes custom 4-day interval tasks", () => {
      expect(filterKidTasksByDate([custom4days], "daily")).toHaveLength(0);
    });
    it("excludes weekly tasks", () => {
      expect(filterKidTasksByDate([weeklyTask], "daily")).toHaveLength(0);
    });
    it("excludes monthly tasks", () => {
      expect(filterKidTasksByDate([monthlyTask], "daily")).toHaveLength(0);
    });
  });

  describe('filter: "weekly"', () => {
    it("includes weekly tasks", () => {
      expect(filterKidTasksByDate([weeklyTask], "weekly")).toHaveLength(1);
    });
    it("includes one-time tasks due in 4 days", () => {
      expect(filterKidTasksByDate([oneTime4days], "weekly")).toHaveLength(1);
    });
    it("includes one-time tasks due in 7 days", () => {
      expect(filterKidTasksByDate([oneTime7days], "weekly")).toHaveLength(1);
    });
    it("excludes one-time tasks with no date", () => {
      expect(filterKidTasksByDate([oneTimeNoDate], "weekly")).toHaveLength(0);
    });
    it("excludes one-time tasks due in 8 days", () => {
      expect(filterKidTasksByDate([oneTime8days], "weekly")).toHaveLength(0);
    });
    it("includes custom 4-day interval tasks", () => {
      expect(filterKidTasksByDate([custom4days], "weekly")).toHaveLength(1);
    });
    it("includes custom 7-day interval tasks", () => {
      expect(filterKidTasksByDate([custom7days], "weekly")).toHaveLength(1);
    });
    it("excludes daily tasks", () => {
      expect(filterKidTasksByDate([dailyTask], "weekly")).toHaveLength(0);
    });
    it("excludes monthly tasks", () => {
      expect(filterKidTasksByDate([monthlyTask], "weekly")).toHaveLength(0);
    });
  });

  describe('filter: "monthly"', () => {
    it("includes monthly tasks", () => {
      expect(filterKidTasksByDate([monthlyTask], "monthly")).toHaveLength(1);
    });
    it("includes one-time tasks due in 8 days", () => {
      expect(filterKidTasksByDate([oneTime8days], "monthly")).toHaveLength(1);
    });
    it("includes one-time tasks due in 30 days", () => {
      expect(filterKidTasksByDate([oneTime30days], "monthly")).toHaveLength(1);
    });
    it("excludes one-time tasks with no date", () => {
      expect(filterKidTasksByDate([oneTimeNoDate], "monthly")).toHaveLength(0);
    });
    it("excludes one-time tasks due in 31 days", () => {
      expect(filterKidTasksByDate([oneTime31days], "monthly")).toHaveLength(0);
    });
    it("includes custom 8-day interval tasks", () => {
      expect(filterKidTasksByDate([custom8days], "monthly")).toHaveLength(1);
    });
    it("includes custom 30-day interval tasks", () => {
      expect(filterKidTasksByDate([custom30days], "monthly")).toHaveLength(1);
    });
    it("excludes custom 31-day interval tasks", () => {
      expect(filterKidTasksByDate([custom31days], "monthly")).toHaveLength(0);
    });
    it("excludes yearly tasks", () => {
      expect(filterKidTasksByDate([yearlyTask], "monthly")).toHaveLength(0);
    });
    it("excludes daily tasks", () => {
      expect(filterKidTasksByDate([dailyTask], "monthly")).toHaveLength(0);
    });
  });

  describe('filter: "all"', () => {
    it("includes all task types", () => {
      const tasks = [weekdaysTask, dailyTask, immediateTask, weeklyTask, monthlyTask, yearlyTask, oneTimeNoDate];
      expect(filterKidTasksByDate(tasks, "all")).toHaveLength(tasks.length);
    });
    it("includes custom 31+ day tasks", () => {
      expect(filterKidTasksByDate([custom90days], "all")).toHaveLength(1);
    });
    it("includes one-time tasks due in 31+ days", () => {
      expect(filterKidTasksByDate([oneTime90days], "all")).toHaveLength(1);
    });
  });

  describe("mixed task lists", () => {
    it("daily filter groups correctly", () => {
      const tasks = [dailyTask, weekdaysTask, oneTimeNoDate, custom3days, custom4days, weeklyTask];
      const result = filterKidTasksByDate(tasks, "daily");
      expect(result).toHaveLength(4); // daily, weekdays, oneTimeNoDate, custom3
    });
    it("weekly filter groups correctly", () => {
      const tasks = [dailyTask, weeklyTask, monthlyTask, custom4days, custom7days, custom8days, oneTime4days];
      const result = filterKidTasksByDate(tasks, "weekly");
      expect(result).toHaveLength(4); // weekly, custom4, custom7, oneTime4
    });
    it("monthly filter groups correctly", () => {
      const tasks = [dailyTask, weeklyTask, monthlyTask, yearlyTask, custom8days, custom30days, custom31days, oneTime8days];
      const result = filterKidTasksByDate(tasks, "monthly");
      expect(result).toHaveLength(4); // monthly, custom8, custom30, oneTime8
    });
  });
});
