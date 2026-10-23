/** Put the active profile first without changing the server's member/status data. */
export function visibleTaskParticipants<T extends { memberId: string }>(
  members: readonly T[] | undefined,
  currentMemberId: string | undefined,
  expanded: boolean,
): T[] {
  const ordered = [...(members || [])];
  const activeIndex = ordered.findIndex(member => member.memberId === currentMemberId);
  if (activeIndex > 0) {
    ordered.unshift(...ordered.splice(activeIndex, 1));
  }
  return expanded ? ordered : ordered.slice(0, 3);
}
