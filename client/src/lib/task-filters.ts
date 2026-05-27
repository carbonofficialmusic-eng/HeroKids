import { startOfDay, addDays, parseISO } from "date-fns";

export interface FilterableTask {
  recurrence: string;
  recurrenceDays?: number | null;
  dueDate?: string | Date | null;
}

/**
 * Filters tasks by recurrence frequency group.
 *
 * Custom-interval tasks (recurrence === "none" && recurrenceDays > 0):
 *   1–3 days   → daily
 *   4–7 days   → weekly
 *   8–30 days  → monthly
 *   31+ days   → only "all"
 *
 * @param taskList - Array of tasks to filter
 * @param taskFilter - "daily" | "weekly" | "monthly" | "all"
 */
export function filterTasksByDate<T extends FilterableTask>(
  taskList: T[],
  taskFilter: string,
  _now: Date = new Date()
): T[] {
  return taskList.filter((task) => {
    if (taskFilter === "all") return true;

    const isCustom = task.recurrence === "none" && task.recurrenceDays != null && task.recurrenceDays > 0;

    if (isCustom) {
      const d = task.recurrenceDays!;
      if (taskFilter === "daily")   return d <= 3;
      if (taskFilter === "weekly")  return d >= 4 && d <= 7;
      if (taskFilter === "monthly") return d >= 8 && d <= 30;
      return false;
    }

    if (taskFilter === "daily") {
      return (
        task.recurrence === "daily" ||
        task.recurrence === "weekdays" ||
        task.recurrence === "immediate"
      );
    }

    if (taskFilter === "weekly") {
      return task.recurrence === "weekly";
    }

    if (taskFilter === "monthly") {
      return task.recurrence === "monthly";
    }

    return true;
  });
}

/**
 * Filters kid tasks by recurrence frequency group.
 *
 * Custom-interval tasks (recurrence === "none" && recurrenceDays > 0):
 *   1–3 days   → daily
 *   4–7 days   → weekly
 *   8–30 days  → monthly
 *   31+ days   → only "all"
 *
 * @param taskList - Array of tasks to filter
 * @param kidTaskFilter - "daily" | "weekly" | "monthly" | "all"
 */
export function filterKidTasksByDate<T extends FilterableTask>(
  taskList: T[],
  kidTaskFilter: string,
  _now: Date = new Date()
): T[] {
  return taskList.filter((task) => {
    if (kidTaskFilter === "all") return true;

    const isCustom = task.recurrence === "none" && task.recurrenceDays != null && task.recurrenceDays > 0;

    if (isCustom) {
      const d = task.recurrenceDays!;
      if (kidTaskFilter === "daily")   return d <= 3;
      if (kidTaskFilter === "weekly")  return d >= 4 && d <= 7;
      if (kidTaskFilter === "monthly") return d >= 8 && d <= 30;
      return false;
    }

    if (kidTaskFilter === "daily") {
      return (
        task.recurrence === "daily" ||
        task.recurrence === "weekdays" ||
        task.recurrence === "immediate"
      );
    }

    if (kidTaskFilter === "weekly") {
      return task.recurrence === "weekly";
    }

    if (kidTaskFilter === "monthly") {
      return task.recurrence === "monthly";
    }

    return true;
  });
}
