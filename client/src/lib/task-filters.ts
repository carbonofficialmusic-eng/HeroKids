import { startOfDay, addDays, parseISO } from "date-fns";

export interface FilterableTask {
  recurrence: string;
  dueDate?: string | Date | null;
}

/**
 * Filters tasks by recurrence frequency group.
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
