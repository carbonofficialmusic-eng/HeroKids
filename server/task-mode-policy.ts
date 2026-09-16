import { formatInTimeZone, fromZonedTime } from "date-fns-tz";

type Recurrence = "none" | "daily" | "weekdays" | "weekly" | "monthly" | "yearly" | "immediate";

export function isRecurringTaskSchedule(
  recurrence: Recurrence,
  recurrenceDays: number | null | undefined,
): boolean {
  return recurrence !== "none" || recurrenceDays != null;
}

export function shouldHideCompletedTaskFromChild(options: {
  status: string;
  recurrence: Recurrence;
  recurrenceDays: number | null | undefined;
}): boolean {
  return options.status === "completed"
    && !isRecurringTaskSchedule(options.recurrence, options.recurrenceDays);
}

export function taskStructureChanged(options: {
  previousRecurrence: Recurrence;
  nextRecurrence: Recurrence;
  previousRecurrenceDays: number | null | undefined;
  nextRecurrenceDays: number | null | undefined;
  previousDailyTarget: number;
  nextDailyTarget: number;
  previousIsTeamTask: boolean;
  nextIsTeamTask: boolean;
  previousMemberIds: string[];
  nextMemberIds: string[];
}): { scheduleChanged: boolean; assignmentChanged: boolean; changed: boolean } {
  const scheduleChanged =
    options.previousRecurrence !== options.nextRecurrence
    || (options.previousRecurrenceDays ?? null) !== (options.nextRecurrenceDays ?? null)
    || options.previousDailyTarget !== options.nextDailyTarget;
  const previousIds = [...new Set(options.previousMemberIds)].sort();
  const nextIds = [...new Set(options.nextMemberIds)].sort();
  const assignmentChanged =
    options.previousIsTeamTask !== options.nextIsTeamTask
    || previousIds.length !== nextIds.length
    || previousIds.some((id, index) => id !== nextIds[index]);
  return {
    scheduleChanged,
    assignmentChanged,
    changed: scheduleChanged || assignmentChanged,
  };
}

export function resolveMemberDailyTargetState(options: {
  recurrence: Recurrence;
  dailyTarget: number;
  dailyProgress: number;
  status: "pending" | "approved" | "rejected" | null;
}): { hasCompleted: boolean; hasSubmitted: boolean } {
  const isMultiDaily = options.recurrence === "daily" && options.dailyTarget > 1;
  if (!isMultiDaily) {
    return {
      hasCompleted: options.status === "approved",
      hasSubmitted: options.status === "approved" || options.status === "pending",
    };
  }

  const hasCompleted = options.dailyProgress >= options.dailyTarget;
  return {
    hasCompleted,
    // Pending approval blocks another submission. An approved partial
    // completion does not: the child must be able to complete the next slot.
    hasSubmitted: options.status === "pending" || hasCompleted,
  };
}

/**
 * Pure validation for the editor-facing member selection shared by both
 * multi-member task modes.
 */
export function validateSelectedTaskMemberIds(
  memberIds: string[],
  familyMemberIds: Iterable<string>,
  isTeamTask: boolean,
): string[] {
  const uniqueIds = Array.from(new Set(memberIds));
  if (uniqueIds.length !== memberIds.length) {
    throw new Error("Selected task members must be unique");
  }
  if (isTeamTask && uniqueIds.length < 2) {
    throw new Error("Team tasks require at least two family members");
  }

  const familyIds = new Set(familyMemberIds);
  const invalidIds = uniqueIds.filter(id => !familyIds.has(id));
  if (invalidIds.length > 0) {
    throw new Error("Selected task members must belong to your family");
  }
  return uniqueIds;
}

/**
 * Team members stay blocked after either submitting or being approved until
 * every teammate has finished and the immediate team round is reset.
 */
export function hasActiveTeamContribution(
  status: "pending" | "approved" | "rejected" | null,
): boolean {
  return status === "pending" || status === "approved";
}

export function isIndividualRecurringCompletionActive(options: {
  status: "pending" | "approved" | "rejected";
  completedAt: Date;
  now: Date;
  recurrence: Recurrence;
  recurrenceDays: number | null;
  timezone: string;
}): boolean {
  const { status, completedAt, now, recurrence, recurrenceDays, timezone } = options;
  if (status === "pending") return true;
  if (status === "rejected") return false;

  if (recurrenceDays) {
    const completedDate = formatInTimeZone(completedAt, timezone, "yyyy-MM-dd");
    const [year, month, day] = completedDate.split("-").map(Number);
    const nextDate = new Date(Date.UTC(year, month - 1, day + recurrenceDays));
    const nextDateString = `${nextDate.getUTCFullYear()}-${String(nextDate.getUTCMonth() + 1).padStart(2, "0")}-${String(nextDate.getUTCDate()).padStart(2, "0")} 00:00:00`;
    return now < fromZonedTime(nextDateString, timezone);
  }

  const periodFormat = recurrence === "weekly"
    ? "RRRR-'W'II"
    : recurrence === "monthly"
      ? "yyyy-MM"
      : recurrence === "yearly"
        ? "yyyy"
        : null;
  if (!periodFormat) return false;
  return formatInTimeZone(completedAt, timezone, periodFormat)
    === formatInTimeZone(now, timezone, periodFormat);
}

export function calculateRecurringNextAvailableDate(options: {
  completedAt: Date;
  recurrence: Recurrence;
  recurrenceDays: number | null | undefined;
  timezone: string;
}): Date | null {
  const { completedAt, recurrence, recurrenceDays, timezone } = options;
  const completedDate = formatInTimeZone(completedAt, timezone, "yyyy-MM-dd");
  const [year, month, day] = completedDate.split("-").map(Number);
  const completedDayOfWeek = Number(formatInTimeZone(completedAt, timezone, "i"));

  const atLocalMidnight = (target: Date) => fromZonedTime(
    `${target.getUTCFullYear()}-${String(target.getUTCMonth() + 1).padStart(2, "0")}-${String(target.getUTCDate()).padStart(2, "0")} 00:00:00`,
    timezone,
  );

  if (recurrenceDays) {
    return atLocalMidnight(new Date(Date.UTC(year, month - 1, day + recurrenceDays)));
  }

  switch (recurrence) {
    case "daily":
      return atLocalMidnight(new Date(Date.UTC(year, month - 1, day + 1)));
    case "weekdays": {
      const daysToAdd = completedDayOfWeek === 5 ? 3 : completedDayOfWeek === 6 ? 2 : 1;
      return atLocalMidnight(new Date(Date.UTC(year, month - 1, day + daysToAdd)));
    }
    case "weekly": {
      const daysToMonday = completedDayOfWeek === 1 ? 7 : 8 - completedDayOfWeek;
      return atLocalMidnight(new Date(Date.UTC(year, month - 1, day + daysToMonday)));
    }
    case "monthly":
      return atLocalMidnight(new Date(Date.UTC(year, month, 1)));
    case "yearly":
      return atLocalMidnight(new Date(Date.UTC(year + 1, 0, 1)));
    default:
      return null;
  }
}

export function isTeamCompletionInCurrentPeriod(
  completedAt: Date | null,
  nextAvailableDate: Date | null,
  now: Date,
): boolean {
  if (!completedAt) return false;
  if (!nextAvailableDate || nextAvailableDate > now) return true;
  return completedAt >= nextAvailableDate;
}

type TeamSubmission = {
  memberId: string;
  status: string;
};

export function hasEveryTeamMemberSubmitted(
  targetMemberIds: string[],
  submissions: TeamSubmission[],
): boolean {
  if (targetMemberIds.length === 0) return false;
  const submittedMemberIds = new Set(
    submissions
      .filter((submission) => submission.status === "pending" || submission.status === "approved")
      .map((submission) => submission.memberId),
  );
  return targetMemberIds.every((memberId) => submittedMemberIds.has(memberId));
}

export function resolveCompletionCoordination(options: {
  isTeamTask: boolean;
  requiresApproval: boolean;
  forceApproval: boolean;
  allTeamMembersSubmitted: boolean;
}): {
  deferAwardOnCreate: boolean;
  requestParentApproval: boolean;
  autoApproveTeam: boolean;
  autoApproved: boolean;
} {
  const requestParentApproval = options.requiresApproval || options.forceApproval;
  const autoApproveTeam = options.isTeamTask
    && !requestParentApproval
    && options.allTeamMembersSubmitted;

  return {
    // Every team contribution must wait until the full team has submitted.
    // Regular approval-required tasks already defer inside storage.
    deferAwardOnCreate: options.isTeamTask,
    requestParentApproval,
    autoApproveTeam,
    autoApproved: options.isTeamTask ? autoApproveTeam : !requestParentApproval,
  };
}