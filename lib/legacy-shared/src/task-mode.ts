export type TaskMemberStatus = "pending" | "approved" | "rejected" | null | undefined;

// An individual submission can be celebrated as before; a team submission
// is not a payout until the server has approved the whole team's work.
export function shouldCelebrateTaskSubmission(options: {
  isTeamTask: boolean;
  autoApproved: boolean;
}): boolean {
  return !options.isTeamTask || options.autoApproved;
}

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