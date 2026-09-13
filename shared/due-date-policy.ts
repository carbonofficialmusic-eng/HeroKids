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