import { describe, expect, it } from "vitest";
import {
  calculateTaskCompletionCapacity,
  lockTaskRowsInOrder,
  resolveCompletionDecision,
  shouldResetRecurringMultiCompletionTask,
  taskCompletionCapacityApiFields,
} from "./task-mode-policy";

describe("max-completion task capacity", () => {
  it("reserves the last slot for an active pending submission", () => {
    expect(calculateTaskCompletionCapacity({
      maxCompletions: 3,
      completionCount: 2,
      pendingCompletionCount: 1,
    })).toMatchObject({
      reservedCompletionCount: 3,
      remainingSlots: 0,
      canReserve: false,
    });
  });

  it("serializes different members reserving the last slot", async () => {
    let completionCount = 0;
    let pendingCount = 0;
    let lockQueue = Promise.resolve();

    const reserve = async () => {
      const previous = lockQueue;
      let unlock!: () => void;
      lockQueue = new Promise<void>((resolve) => { unlock = resolve; });
      await previous;
      try {
        const capacity = calculateTaskCompletionCapacity({
          maxCompletions: 1,
          completionCount,
          pendingCompletionCount: pendingCount,
        });
        if (!capacity.canReserve) return false;
        pendingCount += 1;
        return true;
      } finally {
        unlock();
      }
    };

    const reservations = await Promise.all([reserve(), reserve()]);
    expect(reservations.filter(Boolean)).toHaveLength(1);
    expect(pendingCount).toBe(1);
    expect(calculateTaskCompletionCapacity({
      maxCompletions: 1,
      completionCount,
      pendingCompletionCount: pendingCount,
    }).remainingSlots).toBe(0);
  });

  it("does not consume an additional slot when a pending submission is approved", () => {
    const beforeApproval = calculateTaskCompletionCapacity({
      maxCompletions: 2,
      completionCount: 1,
      pendingCompletionCount: 1,
    });
    const afterApproval = calculateTaskCompletionCapacity({
      maxCompletions: 2,
      completionCount: beforeApproval.completionCount + 1,
      pendingCompletionCount: beforeApproval.pendingCompletionCount - 1,
    });

    expect(beforeApproval.reservedCompletionCount).toBe(2);
    expect(afterApproval.reservedCompletionCount).toBe(2);
    expect(afterApproval.remainingSlots).toBe(0);
  });

  it("releases a reservation when a pending submission is rejected", () => {
    const afterReject = calculateTaskCompletionCapacity({
      maxCompletions: 2,
      completionCount: 1,
      pendingCompletionCount: 0,
    });
    expect(afterReject.remainingSlots).toBe(1);
    expect(afterReject.canReserve).toBe(true);
  });

  it("leaves uncapped tasks unaffected", () => {
    expect(calculateTaskCompletionCapacity({
      maxCompletions: null,
      completionCount: 9,
      pendingCompletionCount: 14,
    })).toMatchObject({
      reservedCompletionCount: 23,
      remainingSlots: null,
      canReserve: true,
    });
  });

  it("does not repair or delete historical over-cap counters", () => {
    expect(calculateTaskCompletionCapacity({
      maxCompletions: 2,
      completionCount: 4,
      pendingCompletionCount: 1,
    })).toMatchObject({
      completionCount: 4,
      reservedCompletionCount: 5,
      remainingSlots: 0,
      canReserve: false,
    });
  });

  it("uses one remainingSlots projection for parent and child API task views", () => {
    const capacity = calculateTaskCompletionCapacity({
      maxCompletions: 4,
      completionCount: 2,
      pendingCompletionCount: 1,
    });
    const parentFields = taskCompletionCapacityApiFields(capacity);
    const childFields = taskCompletionCapacityApiFields(capacity);

    expect(parentFields).toEqual({ completionCount: 2, remainingSlots: 1 });
    expect(childFields).toEqual(parentFields);
  });

  it("keeps even old pending rows reserved until a decision or reset removes them", () => {
    const oldPendingCompletionDate = new Date("2026-05-01T09:00:00.000Z");
    expect(oldPendingCompletionDate.getTime()).toBeLessThan(new Date("2026-06-01T00:00:00.000Z").getTime());
    expect(calculateTaskCompletionCapacity({
      maxCompletions: 2,
      completionCount: 1,
      pendingCompletionCount: 1,
    })).toMatchObject({
      remainingSlots: 0,
      canReserve: false,
    });
  });

  it("acquires multi-task decision locks in sorted unique order through the shared lock lifecycle", async () => {
    const acquired: string[] = [];
    const rows = await lockTaskRowsInOrder(
      ["task-b", "task-a", "task-b", "task-c"],
      async (taskId) => {
        acquired.push(taskId);
        return { id: taskId };
      },
    );
    expect(acquired).toEqual(["task-a", "task-b", "task-c"]);
    expect([...rows.keys()]).toEqual(acquired);
  });

  it("only applies decisions to pending rows; retries are idempotent", () => {
    expect(resolveCompletionDecision("pending", "approve")).toBe("apply");
    expect(resolveCompletionDecision("pending", "reject")).toBe("apply");
    expect(resolveCompletionDecision("approved", "approve")).toBe("noop");
    expect(resolveCompletionDecision("rejected", "reject")).toBe("noop");
    expect(() => resolveCompletionDecision("rejected", "approve"))
      .toThrow("Cannot approve a rejected task completion");
    expect(() => resolveCompletionDecision("approved", "reject"))
      .toThrow("Cannot reject an approved task completion");
    expect(resolveCompletionDecision("approved", "approve", true)).toBe("apply");
  });

  it("does not apply a stale recurring reset after the expired boundary changes", () => {
    const original = {
      recurrence: "weekly" as const,
      recurrenceDays: null,
      maxCompletions: 3,
      completionCount: 3,
      nextAvailableDate: new Date("2026-06-01T00:00:00Z"),
    };
    const now = new Date("2026-06-08T12:00:00Z");

    expect(shouldResetRecurringMultiCompletionTask(
      original,
      { ...original, completionCount: 1, nextAvailableDate: new Date("2026-06-15T00:00:00Z") },
      now,
    )).toBe(false);
    expect(shouldResetRecurringMultiCompletionTask(
      original,
      { ...original, completionCount: 1, nextAvailableDate: null },
      now,
    )).toBe(false);
    expect(shouldResetRecurringMultiCompletionTask(original, original, now)).toBe(true);
  });
});