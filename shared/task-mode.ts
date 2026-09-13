export type TaskMemberStatus = "pending" | "approved" | "rejected" | null | undefined;

export function canRetryRejectedTeamContribution(options: {
  isTeamTask: boolean;
  memberStatus: TaskMemberStatus;
  nextAvailableDate: Date | string | null;
  now?: Date;
}): boolean {
  const { isTeamTask, memberStatus, nextAvailableDate, now = new Date() } = options;
  return Boolean(
    isTeamTask
    && memberStatus === "rejected"
    && nextAvailableDate
    && new Date(nextAvailableDate) > now,
  );
}