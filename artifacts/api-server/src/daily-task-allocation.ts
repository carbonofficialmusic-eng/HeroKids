export type DailyContribution = { memberId: string; executionCount: number; firstExecutedAt: Date };

/** Largest remainder allocation. Equal remainders prefer the first contributor. */
export function allocateDailyTaskPoints(points: number, contributions: DailyContribution[]) {
  if (!Number.isSafeInteger(points) || points < 0 || !contributions.length) throw new Error("Invalid daily allocation");
  if (new Set(contributions.map(row => row.memberId)).size !== contributions.length
    || contributions.some(row => !Number.isSafeInteger(row.executionCount) || row.executionCount <= 0
      || !Number.isFinite(row.firstExecutedAt.getTime()))) throw new Error("Invalid daily contributions");
  const total = contributions.reduce((sum, row) => sum + row.executionCount, 0);
  const shares = contributions.map(row => ({
    ...row,
    points: Math.floor(points * row.executionCount / total),
    remainder: (points * row.executionCount) % total,
  }));
  shares.sort((a, b) => b.remainder - a.remainder
    || a.firstExecutedAt.getTime() - b.firstExecutedAt.getTime()
    || a.memberId.localeCompare(b.memberId));
  const remaining = points - shares.reduce((sum, row) => sum + row.points, 0);
  for (let index = 0; index < remaining; index++) shares[index].points++;
  return shares;
}
