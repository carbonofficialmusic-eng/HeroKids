import { differenceInDays, parseISO, startOfDay } from "date-fns";

export interface FilterableTask {
  recurrence: string;
  recurrenceDays?: number | null;
  dueDate?: string | Date | null;
}

/**
 * Returns how many calendar days from today until the given due date.
 * Negative means past-due. 0 means today.
 */
function daysUntilDue(dueDate: string | Date): number {
  const due = startOfDay(typeof dueDate === "string" ? parseISO(dueDate) : dueDate);
  const today = startOfDay(new Date());
  return differenceInDays(due, today);
}

/**
 * Filters tasks by recurrence frequency group.
 *
 * - "daily"   → daily / weekdays recurring; custom intervals ≤ 3 days
 * - "weekly"  → weekly recurring; custom intervals 4–7 days
 * - "monthly" → monthly / yearly recurring; custom intervals 8–30 days
 * - "onetime" → true one-time tasks (recurrence "none", no recurrenceDays)
 *               + immediate tasks (recurrence "immediate")
 * - "all"     → everything
 *
 * Custom-interval tasks (recurrence "none" + recurrenceDays > 0) stay in
 * daily/weekly/monthly based on their interval length, not in "onetime".
 *
 * @param taskList - Array of tasks to filter
 * @param taskFilter - "daily" | "weekly" | "monthly" | "onetime" | "all"
 */
export function filterTasksByDate<T extends FilterableTask>(
  taskList: T[],
  taskFilter: string,
  _now: Date = new Date()
): T[] {
  return taskList.filter((task) => {
    if (taskFilter === "all") return true;

    // Custom interval tasks: distribute by recurrenceDays, never in "onetime"
    const isCustomInterval = task.recurrence === "none" && task.recurrenceDays != null && task.recurrenceDays > 0;
    if (isCustomInterval) {
      if (taskFilter === "onetime") return false;
      const d = task.recurrenceDays!;
      if (taskFilter === "daily")   return d <= 3;
      if (taskFilter === "weekly")  return d >= 4 && d <= 7;
      if (taskFilter === "monthly") return d >= 8 && d <= 30;
      return false;
    }

    // Immediate tasks → "onetime" tab
    if (task.recurrence === "immediate") {
      return taskFilter === "onetime";
    }

    // True one-time tasks (recurrence "none", no custom interval) → "onetime" tab
    if (task.recurrence === "none") {
      return taskFilter === "onetime";
    }

    // Recurring tasks
    if (taskFilter === "onetime") return false;

    if (taskFilter === "daily") {
      return task.recurrence === "daily" || task.recurrence === "weekdays";
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
 * - "daily"   → daily / weekdays recurring; custom intervals ≤ 3 days
 * - "weekly"  → weekly recurring; custom intervals 4–7 days
 * - "monthly" → monthly / yearly recurring; custom intervals 8–30 days
 * - "onetime" → true one-time tasks (recurrence "none", no recurrenceDays)
 *               + immediate tasks (recurrence "immediate")
 * - "all"     → everything
 *
 * Custom-interval tasks (recurrence "none" + recurrenceDays > 0) stay in
 * daily/weekly/monthly based on their interval length, not in "onetime".
 *
 * @param taskList - Array of tasks to filter
 * @param kidTaskFilter - "daily" | "weekly" | "monthly" | "onetime" | "all"
 */
export function filterKidTasksByDate<T extends FilterableTask>(
  taskList: T[],
  kidTaskFilter: string,
  _now: Date = new Date()
): T[] {
  return taskList.filter((task) => {
    if (kidTaskFilter === "all") return true;

    // Custom interval tasks: distribute by recurrenceDays, never in "onetime"
    const isCustomInterval = task.recurrence === "none" && task.recurrenceDays != null && task.recurrenceDays > 0;
    if (isCustomInterval) {
      if (kidTaskFilter === "onetime") return false;
      const d = task.recurrenceDays!;
      if (kidTaskFilter === "daily")   return d <= 3;
      if (kidTaskFilter === "weekly")  return d >= 4 && d <= 7;
      if (kidTaskFilter === "monthly") return d >= 8 && d <= 30;
      return false;
    }

    // Immediate tasks → "onetime" tab
    if (task.recurrence === "immediate") {
      return kidTaskFilter === "onetime";
    }

    // True one-time tasks (recurrence "none", no custom interval) → "onetime" tab
    if (task.recurrence === "none") {
      return kidTaskFilter === "onetime";
    }

    // Recurring tasks
    if (kidTaskFilter === "onetime") return false;

    if (kidTaskFilter === "daily") {
      return task.recurrence === "daily" || task.recurrence === "weekdays";
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
