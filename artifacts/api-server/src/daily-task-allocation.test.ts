import { describe, expect, it } from "vitest";
import { allocateDailyTaskPoints } from "./daily-task-allocation";

const contribution = (memberId: string, executionCount: number, order = 0) => ({
  memberId, executionCount, firstExecutedAt: new Date(1000 + order),
});

describe("daily contribution point allocation", () => {
  it.each([
    [30, [2, 1], [20, 10]],
    [10, [2, 1], [7, 3]],
    [10, [1, 1, 1], [4, 3, 3]],
    [1, [1, 1, 1], [1, 0, 0]],
    [0, [2, 1], [0, 0]],
    [5, [1, 1], [3, 2]],
    [10, [3], [10]],
  ])("splits %s points over %j", (points, counts, expected) => {
    const shares = allocateDailyTaskPoints(points as number,
      (counts as number[]).map((count, index) => contribution(String(index), count, index)));
    expect((counts as number[]).map((_, index) => shares.find(row => row.memberId === String(index))!.points)).toEqual(expected);
    expect(shares.reduce((total, row) => total + row.points, 0)).toBe(points);
  });

  it("uses first contribution rather than final submitter or input order for ties", () => {
    const rows = [contribution("last", 1, 3), contribution("first", 1, 1), contribution("middle", 1, 2)];
    expect(allocateDailyTaskPoints(10, rows).find(row => row.memberId === "first")?.points).toBe(4);
    expect(allocateDailyTaskPoints(10, [...rows].reverse())).toEqual(allocateDailyTaskPoints(10, rows));
  });

  it("rejects invalid contributions rather than silently mispaying", () => {
    expect(() => allocateDailyTaskPoints(10, [])).toThrow();
    expect(() => allocateDailyTaskPoints(10, [contribution("a", 0)])).toThrow();
    expect(() => allocateDailyTaskPoints(10, [contribution("a", 1), contribution("a", 2)])).toThrow();
    expect(() => allocateDailyTaskPoints(1.5, [contribution("a", 1)])).toThrow();
  });
});
