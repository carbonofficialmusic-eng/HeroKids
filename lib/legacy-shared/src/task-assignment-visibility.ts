type MemberReference = {
  memberId: string;
};

type TaskAssignmentAudience = {
  assignedMemberCompletions?: MemberReference[] | null;
  sharedMemberCompletions?: MemberReference[] | null;
  sharedMemberIds?: string[] | null;
};

/**
 * Tasks without an explicit audience belong to the whole family. Once any
 * assignment representation is present, only listed members own the task.
 */
export function isTaskAssignedToMember(
  task: TaskAssignmentAudience,
  memberId: string,
): boolean {
  const assignedIds = task.assignedMemberCompletions?.map((entry) => entry.memberId) ?? [];
  if (assignedIds.length > 0) return assignedIds.includes(memberId);

  const sharedCompletionIds = task.sharedMemberCompletions?.map((entry) => entry.memberId) ?? [];
  if (sharedCompletionIds.length > 0) return sharedCompletionIds.includes(memberId);

  const selectedIds = task.sharedMemberIds ?? [];
  if (selectedIds.length > 0) return selectedIds.includes(memberId);

  return true;
}