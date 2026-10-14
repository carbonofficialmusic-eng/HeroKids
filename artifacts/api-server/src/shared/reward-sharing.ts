/**
 * Split a reward cost without rounding the total up.
 *
 * IDs are sorted before the remainder is assigned, making retries and
 * concurrent callers deterministic. The returned values always sum exactly
 * to `totalPoints`.
 */
export function allocateRewardShares(
  totalPoints: number,
  memberIds: string[],
): Map<string, number> {
  if (!Number.isSafeInteger(totalPoints) || totalPoints < 0) {
    throw new Error("Reward cost must be a non-negative integer");
  }
  const ids = Array.from(new Set(memberIds)).sort();
  if (ids.length === 0) throw new Error("At least one member is required");
  const base = Math.floor(totalPoints / ids.length);
  const remainder = totalPoints % ids.length;
  return new Map(ids.map((id, index) => [id, base + (index < remainder ? 1 : 0)]));
}