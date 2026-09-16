import { describe, expect, it } from "vitest";
import { isTaskAssignedToMember } from "../../shared/task-assignment-visibility";

describe("task assignment visibility", () => {
  it("shows an individual task only to its assigned member", () => {
    const task = {
      assignedMemberCompletions: [{ memberId: "papa" }],
    };

    expect(isTaskAssignedToMember(task, "papa")).toBe(true);
    expect(isTaskAssignedToMember(task, "mama")).toBe(false);
  });

  it("shows a team task to every participant and nobody else", () => {
    const task = {
      sharedMemberCompletions: [
        { memberId: "liv" },
        { memberId: "juri" },
        { memberId: "peter" },
      ],
    };

    expect(isTaskAssignedToMember(task, "liv")).toBe(true);
    expect(isTaskAssignedToMember(task, "juri")).toBe(true);
    expect(isTaskAssignedToMember(task, "mama")).toBe(false);
  });

  it("uses selected member ids when completion metadata is not available", () => {
    const task = {
      sharedMemberIds: ["liv", "papa"],
    };

    expect(isTaskAssignedToMember(task, "liv")).toBe(true);
    expect(isTaskAssignedToMember(task, "mama")).toBe(false);
  });

  it("treats tasks without an explicit audience as family-wide", () => {
    expect(isTaskAssignedToMember({}, "liv")).toBe(true);
  });
});