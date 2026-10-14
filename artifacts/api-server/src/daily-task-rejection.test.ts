import { describe, expect, it, vi } from "vitest";

const { mockDb } = vi.hoisted(() => ({ mockDb: {} as any }));
vi.mock("./db", () => ({ db: mockDb }));

import { dailyTaskProgress, families, taskAssignments, taskCompletions, tasks } from "@workspace/db";
import { PgDialect } from "drizzle-orm/pg-core";
import { DatabaseStorage } from "./storage";

function setup(options: {
  target?: number;
  assigned?: boolean;
  legacyMembers?: string[] | null;
  shared?: boolean;
  status?: string;
  recurrence?: string;
  grouped?: boolean;
} = {}) {
  const task = {
    id: "task", familyName: "family", recurrence: options.recurrence ?? "daily",
    dailyTarget: options.target ?? 3, isSharedTask: options.shared ?? false,
    sharedMemberIds: options.legacyMembers ?? null,
  };
  const completion = {
    id: "completion", taskId: task.id, memberId: "child",
    status: options.status ?? "pending", completedAt: new Date("2026-10-02T22:30:00Z"),
    dailyRoundId: options.grouped ? "round" : null,
  };
  const other = { ...completion, id: "other-completion", memberId: "other" };
  const writes: Array<{ table: any; values: any; query: ReturnType<PgDialect["sqlToQuery"]> }> = [];
  const tx = {
    select: () => {
      let table: any;
      let condition: any;
      const builder: any = {
        from(value: any) { table = value; return builder; },
        where(value: any) { condition = value; return builder; },
        for() { return builder; },
        limit() { return builder; },
        then(resolve: any, reject: any) {
          const params = condition ? new PgDialect().sqlToQuery(condition).params : [];
          const rows = table === tasks ? [task]
            : table === taskCompletions ? options.grouped && params.includes("round") ? [completion, other]
              : params.includes("other-completion") ? [other] : [completion]
            : table === families ? [{ timezone: "Europe/Berlin" }]
            : table === taskAssignments && options.assigned ? [{ memberId: "child" }]
            : [];
          return Promise.resolve(rows).then(resolve, reject);
        },
      };
      return builder;
    },
    update: (table: any) => ({
      set: (values: any) => ({
        where: async (condition: any) => {
          writes.push({ table, values, query: new PgDialect().sqlToQuery(condition) });
        },
      }),
    }),
  };
  mockDb.transaction = vi.fn(async (callback: any) => callback(tx));
  return { writes, storage: new DatabaseStorage() };
}

describe("multi-execution task rejection", () => {
  it.each([2, 3])("resets an assigned %s-execution attempt completely to zero", async target => {
    const { storage, writes } = setup({ target, assigned: true });
    await storage.rejectTaskCompletion("completion", "parent", "Try again");
    const reset = writes.find(write => write.table === dailyTaskProgress)!;
    expect(reset.values.executionCount).toBe(0);
    expect(reset.query.params).toEqual(["task", "2026-10-03", "child"]);
    expect(writes.find(write => write.table === taskCompletions)?.values.status).toBe("rejected");
  });

  it.each([false, true])("resets every legacy family counter, including an empty shared flag (%s)", async shared => {
    const { storage, writes } = setup({ shared, legacyMembers: [] });
    await storage.rejectTaskCompletion("completion", "parent", "Try again");
    const reset = writes.find(write => write.table === dailyTaskProgress)!;
    expect(reset.values.executionCount).toBe(0);
    expect(reset.query.params).toEqual(["task", "2026-10-03"]);
    expect(reset.query.sql).not.toContain("member_id");
  });

  it("keeps other team members' progress separate", async () => {
    const { storage, writes } = setup({ shared: true, legacyMembers: ["child", "other"] });
    await storage.rejectTaskCompletion("completion", "parent", "Try again");
    expect(writes.find(write => write.table === dailyTaskProgress)?.query.params)
      .toEqual(["task", "2026-10-03", "child"]);
  });

  it("does not reset progress twice for an already rejected decision", async () => {
    const { storage, writes } = setup({ status: "rejected" });
    await storage.rejectTaskCompletion("completion", "parent", "Try again");
    expect(writes).toHaveLength(0);
  });

  it("rejects every recipient of a persisted round and resets the shared counter even after reassignment", async () => {
    const { storage, writes } = setup({ grouped: true, assigned: true });
    await storage.rejectTaskCompletion("completion", "parent", "Try again");
    const decisions = writes.filter(write => write.table === taskCompletions);
    expect(decisions).toHaveLength(2);
    expect(decisions.map(write => write.query.params[0]).sort()).toEqual(["completion", "other-completion"]);
    expect(decisions.every(write => write.values.status === "rejected")).toBe(true);
    const resets = writes.filter(write => write.table === dailyTaskProgress);
    expect(resets.every(write => write.values.executionCount === 0
      && !write.query.sql.includes("member_id"))).toBe(true);
  });

  it("expands approval to every recipient, preserves saved shares and counts only one completed round", async () => {
    const { storage } = setup({ grouped: true });
    const approve = vi.spyOn(storage as any, "_approveCompletionInternal").mockResolvedValue(undefined);
    // Even a generic caller supplying full points cannot overwrite snapshots.
    await storage.approveTaskCompletions(["completion"], "parent", 30);
    expect(approve).toHaveBeenCalledTimes(2);
    expect(approve.mock.calls.map(call => call[1]).sort()).toEqual(["completion", "other-completion"]);
    expect(approve.mock.calls.every(call => (call[3] as any).pointsEarnedOverride === undefined)).toBe(true);
    expect(approve.mock.calls.filter(call => (call[3] as any).skipCompletionCount)).toHaveLength(1);
  });

  it("cannot reject an approved submission", async () => {
    const { storage, writes } = setup({ status: "approved" });
    await expect(storage.rejectTaskCompletion("completion", "parent", "Try again"))
      .rejects.toThrow("Cannot reject an approved task completion");
    expect(writes).toHaveLength(0);
  });

  it.each([{ target: 1 }, { recurrence: "weekly" }])("leaves non-multiple-daily progress untouched (%j)", async options => {
    const { storage, writes } = setup(options);
    await storage.rejectTaskCompletion("completion", "parent", "Try again");
    expect(writes.some(write => write.table === dailyTaskProgress)).toBe(false);
  });
});