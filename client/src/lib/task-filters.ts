import { startOfDay, addDays, parseISO } from "date-fns";

export interface FilterableTask {
  recurrence: string;
  dueDate?: string | Date | null;
}

/**
 * Filters tasks for the parent dashboard based on the selected date filter.
 *
 * @param taskList - Array of tasks to filter
 * @param taskFilter - The active filter: "today", "week", or "all"
 * @param now - The reference date (defaults to current date); injectable for testing
 */
export function filterTasksByDate<T extends FilterableTask>(
  taskList: T[],
  taskFilter: string,
  now: Date = new Date()
): T[] {
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);

  return taskList.filter((task) => {
    if (taskFilter === "all") return true;

    if (taskFilter === "today") {
      if (task.recurrence === "daily" || task.recurrence === "immediate") return true;
      if (task.recurrence === "weekdays") {
        const dow = today.getDay();
        return dow !== 0 && dow !== 6;
      }
      if (task.recurrence === "none") {
        if (task.dueDate) {
          const dateStr = String(task.dueDate).substring(0, 10);
          const due = new Date(dateStr + "T00:00:00");
          return (
            due.getFullYear() === today.getFullYear() &&
            due.getMonth() === today.getMonth() &&
            due.getDate() === today.getDate()
          );
        }
        return true;
      }
      return false;
    }

    if (taskFilter === "week") {
      if (
        task.recurrence === "daily" ||
        task.recurrence === "immediate" ||
        task.recurrence === "weekly" ||
        task.recurrence === "weekdays"
      )
        return true;
      if (task.recurrence === "none") {
        if (task.dueDate) {
          const dateStr = String(task.dueDate).substring(0, 10);
          const due = new Date(dateStr + "T00:00:00");
          const weekEnd = new Date(today);
          weekEnd.setDate(weekEnd.getDate() + 7);
          return due >= today && due < weekEnd;
        }
        return true;
      }
      return false;
    }

    return true;
  });
}

/**
 * Filters tasks for the kid dashboard based on the selected date filter.
 *
 * @param taskList - Array of tasks to filter
 * @param kidTaskFilter - The active filter: "today", "week", or "all"
 * @param now - The reference date (defaults to current date); injectable for testing
 */
export function filterKidTasksByDate<T extends FilterableTask>(
  taskList: T[],
  kidTaskFilter: string,
  now: Date = new Date()
): T[] {
  const today = startOfDay(now);
  const weekEnd = addDays(today, 7);

  return taskList.filter((task) => {
    if (kidTaskFilter === "all") return true;

    if (task.recurrence === "weekdays") {
      if (kidTaskFilter === "today") {
        const dow = now.getDay();
        return dow !== 0 && dow !== 6;
      }
      return true;
    }

    if (task.recurrence !== "none") {
      return true;
    }

    if (!task.dueDate) {
      return false;
    }

    const dueDate =
      typeof task.dueDate === "string" ? parseISO(task.dueDate) : task.dueDate;
    const dueDateStart = startOfDay(dueDate);

    if (kidTaskFilter === "today") {
      return dueDateStart.getTime() === today.getTime();
    }

    if (kidTaskFilter === "week") {
      return dueDateStart >= today && dueDateStart <= weekEnd;
    }

    return true;
  });
}
