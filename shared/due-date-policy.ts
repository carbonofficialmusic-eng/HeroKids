export type DueDateWindow = {
  daysPastDue: number;
  notYet: boolean;
  expired: boolean;
  isGraceDay: boolean;
};

function dateKeyToUtcMs(dateKey: string): number {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateKey);
  if (!match) throw new Error(`Invalid calendar date: ${dateKey}`);
  return Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}

export function getDueDateWindow(dueDateKey: string, todayKey: string): DueDateWindow {
  const daysPastDue = Math.round(
    (dateKeyToUtcMs(todayKey) - dateKeyToUtcMs(dueDateKey)) / 86_400_000,
  );

  return {
    daysPastDue,
    notYet: daysPastDue < 0,
    expired: daysPastDue > 1,
    isGraceDay: daysPastDue === 1,
  };
}

type FixedAppointmentTask = {
  dueDate?: string | null;
  recurrence?: string | null;
};

export function getLocalDateKey(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function isFixedAppointment(task: FixedAppointmentTask): boolean {
  return Boolean(task.dueDate && task.recurrence === "none");
}

export function isFixedAppointmentDueToday(task: FixedAppointmentTask, todayKey = getLocalDateKey()): boolean {
  return isFixedAppointment(task) && String(task.dueDate).substring(0, 10) === todayKey;
}

export function sortFixedAppointments<T extends FixedAppointmentTask>(tasks: T[], todayKey?: string): T[] {
  return tasks
    .map((task, index) => ({ task, index }))
    .sort((a, b) => {
      if (todayKey) {
        const todayOrder =
          Number(isFixedAppointmentDueToday(b.task, todayKey)) -
          Number(isFixedAppointmentDueToday(a.task, todayKey));
        if (todayOrder !== 0) return todayOrder;
      }
      const dateOrder = String(a.task.dueDate).localeCompare(String(b.task.dueDate));
      return dateOrder !== 0 ? dateOrder : a.index - b.index;
    })
    .map(({ task }) => task);
}