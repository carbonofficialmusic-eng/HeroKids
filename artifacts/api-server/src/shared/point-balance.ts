/**
 * Available points are a spendable subset of lifetime-earned points.
 * Refunds may restore spent points, but must never create new lifetime value.
 */
export function clampAvailablePoints(totalEarned: number, totalPoints: number): number {
  return Math.max(0, Math.min(totalPoints, totalEarned));
}