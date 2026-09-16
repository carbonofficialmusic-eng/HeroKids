import { describe, expect, it } from "vitest";
import {
  calculateRecurringNextAvailableDate,
  hasActiveTeamContribution,
  isIndividualRecurringCompletionActive,
  isRecurringTaskSchedule,
  resolveMemberDailyTargetState,
  isTeamCompletionInCurrentPeriod,
  hasEveryTeamMemberSubmitted,
  resolveCompletionCoordination,
  shouldHideCompletedTaskFromChild,
  taskStructureChanged,
  validateSelectedTaskMemberIds,
} from "../task-mode-policy";
import { canRetryRejectedTeamContribution } from "../../shared/task-mode";

describe("task member selection policy", () => {
  const familyIds = ["child-a", "child-b", "child-c"];

  it("accepts unique family members for individual mode", () => {
    expect(validateSelectedTaskMemberIds(["child-a", "child-b"], familyIds, false))
      .toEqual(["child-a", "child-b"]);
  });

  it("waits for every team member before requesting collective approval", () => {
    const targetIds = ["liv", "juri", "peter"];

    expect(hasEveryTeamMemberSubmitted(targetIds, [
      { memberId: "liv", status: "pending" },
      { memberId: "juri", status: "pending" },
    ])).toBe(false);

    expect(hasEveryTeamMemberSubmitted(targetIds, [
      { memberId: "liv", status: "pending" },
      { memberId: "juri", status: "pending" },
      { memberId: "peter", status: "pending" },
    ])).toBe(true);
  });

  it("defers team points and requests one approval only after everyone submits", () => {
    expect(resolveCompletionCoordination({
      isTeamTask: true,
      requiresApproval: true,
      forceApproval: false,
      allTeamMembersSubmitted: false,
    })).toEqual({
      deferAwardOnCreate: true,
      requestParentApproval: true,
      autoApproveTeam: false,
      autoApproved: false,
    });

    expect(resolveCompletionCoordination({
      isTeamTask: true,
      requiresApproval: true,
      forceApproval: false,
      allTeamMembersSubmitted: true,
    }).autoApproveTeam).toBe(false);
  });

  it("awards a no-approval team only after the final contribution", () => {
    const beforeFinalSubmission = resolveCompletionCoordination({
      isTeamTask: true,
      requiresApproval: false,
      forceApproval: false,
      allTeamMembersSubmitted: false,
    });
    expect(beforeFinalSubmission.deferAwardOnCreate).toBe(true);
    expect(beforeFinalSubmission.autoApproved).toBe(false);
    expect(beforeFinalSubmission.autoApproveTeam).toBe(false);

    const afterFinalSubmission = resolveCompletionCoordination({
      isTeamTask: true,
      requiresApproval: false,
      forceApproval: false,
      allTeamMembersSubmitted: true,
    });
    expect(afterFinalSubmission.requestParentApproval).toBe(false);
    expect(afterFinalSubmission.autoApproveTeam).toBe(true);
    expect(afterFinalSubmission.autoApproved).toBe(true);
  });

  it("still forces parent approval for a late fixed-date team submission", () => {
    expect(resolveCompletionCoordination({
      isTeamTask: true,
      requiresApproval: false,
      forceApproval: true,
      allTeamMembersSubmitted: true,
    })).toMatchObject({
      requestParentApproval: true,
      autoApproveTeam: false,
      autoApproved: false,
    });
  });

  it("requires at least two members for team mode", () => {
    expect(() => validateSelectedTaskMemberIds(["child-a"], familyIds, true))
      .toThrow("at least two");
  });

  it("rejects duplicate or foreign member IDs", () => {
    expect(() => validateSelectedTaskMemberIds(["child-a", "child-a"], familyIds, false))
      .toThrow("unique");
    expect(() => validateSelectedTaskMemberIds(["child-a", "other"], familyIds, false))
      .toThrow("belong to your family");
  });

  it("keeps an immediate team contribution blocked through approval", () => {
    expect(hasActiveTeamContribution("pending")).toBe(true);
    expect(hasActiveTeamContribution("approved")).toBe(true);
    expect(hasActiveTeamContribution("rejected")).toBe(false);
    expect(hasActiveTeamContribution(null)).toBe(false);
  });

  it("resets individual recurring completions without waiting for teammates", () => {
    const base = {
      status: "approved" as const,
      completedAt: new Date("2026-09-07T10:00:00Z"),
      timezone: "Europe/Berlin",
    };
    expect(isIndividualRecurringCompletionActive({
      ...base,
      now: new Date("2026-09-12T10:00:00Z"),
      recurrence: "weekly",
      recurrenceDays: null,
    })).toBe(true);
    expect(isIndividualRecurringCompletionActive({
      ...base,
      now: new Date("2026-09-14T10:00:00Z"),
      recurrence: "weekly",
      recurrenceDays: null,
    })).toBe(false);
    expect(isIndividualRecurringCompletionActive({
      ...base,
      now: new Date("2026-09-10T10:00:00Z"),
      recurrence: "none",
      recurrenceDays: 3,
    })).toBe(false);
  });

  it("calculates the personal next date for custom recurring assignments", () => {
    expect(calculateRecurringNextAvailableDate({
      completedAt: new Date("2026-09-13T08:00:00Z"),
      recurrence: "none",
      recurrenceDays: 2,
      timezone: "Europe/Berlin",
    })?.toISOString()).toBe("2026-09-14T22:00:00.000Z");
  });

  it("does not reuse an old team contribution in a new period", () => {
    const boundary = new Date("2026-09-14T00:00:00Z");
    const now = new Date("2026-09-14T10:00:00Z");
    expect(isTeamCompletionInCurrentPeriod(
      new Date("2026-09-08T10:00:00Z"),
      boundary,
      now,
    )).toBe(false);
    expect(isTeamCompletionInCurrentPeriod(
      new Date("2026-09-14T09:00:00Z"),
      boundary,
      now,
    )).toBe(true);
  });

  it("lets only the rejected team member retry during the shared lock", () => {
    const nextPeriod = new Date("2026-09-21T00:00:00Z");
    const now = new Date("2026-09-15T10:00:00Z");
    expect(canRetryRejectedTeamContribution({
      isTeamTask: true,
      memberStatus: "rejected",
      nextAvailableDate: nextPeriod,
      now,
    })).toBe(true);
    expect(canRetryRejectedTeamContribution({
      isTeamTask: true,
      memberStatus: "approved",
      nextAvailableDate: nextPeriod,
      now,
    })).toBe(false);
    expect(canRetryRejectedTeamContribution({
      isTeamTask: false,
      memberStatus: "rejected",
      nextAvailableDate: nextPeriod,
      now,
    })).toBe(false);
  });

  it("does not hide custom-interval tasks as completed one-time tasks", () => {
    expect(isRecurringTaskSchedule("none", 2)).toBe(true);
    expect(shouldHideCompletedTaskFromChild({
      status: "completed",
      recurrence: "none",
      recurrenceDays: 2,
    })).toBe(false);
    expect(shouldHideCompletedTaskFromChild({
      status: "completed",
      recurrence: "none",
      recurrenceDays: null,
    })).toBe(true);
  });

  it("detects schedule and multi-member edits that must reactivate a task", () => {
    const base = {
      previousRecurrence: "none" as const,
      nextRecurrence: "none" as const,
      previousRecurrenceDays: 2,
      nextRecurrenceDays: 2,
      previousDailyTarget: 1,
      nextDailyTarget: 1,
      previousIsTeamTask: false,
      nextIsTeamTask: false,
      previousMemberIds: ["liv", "juri"],
      nextMemberIds: ["juri", "liv"],
    };
    expect(taskStructureChanged(base).changed).toBe(false);
    expect(taskStructureChanged({
      ...base,
      nextIsTeamTask: true,
    })).toEqual({
      scheduleChanged: false,
      assignmentChanged: true,
      changed: true,
    });
    expect(taskStructureChanged({
      ...base,
      nextRecurrenceDays: 3,
    })).toEqual({
      scheduleChanged: true,
      assignmentChanged: false,
      changed: true,
    });
    expect(taskStructureChanged({
      ...base,
      nextMemberIds: ["liv", "peter"],
    }).assignmentChanged).toBe(true);
  });

  it("keeps an approved multi-daily task open until the member reaches the target", () => {
    expect(resolveMemberDailyTargetState({
      recurrence: "daily",
      dailyTarget: 2,
      dailyProgress: 1,
      status: "approved",
    })).toEqual({
      hasCompleted: false,
      hasSubmitted: false,
    });
    expect(resolveMemberDailyTargetState({
      recurrence: "daily",
      dailyTarget: 2,
      dailyProgress: 2,
      status: "approved",
    })).toEqual({
      hasCompleted: true,
      hasSubmitted: true,
    });
    expect(resolveMemberDailyTargetState({
      recurrence: "daily",
      dailyTarget: 3,
      dailyProgress: 1,
      status: "pending",
    })).toEqual({
      hasCompleted: false,
      hasSubmitted: true,
    });
  });
});