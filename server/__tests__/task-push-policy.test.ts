import { describe, expect, it } from "vitest";
import { shouldSendTaskPendingPush } from "../task-push-policy";

describe("task pending push policy", () => {
  it("notifies parents when a child submits a task", () => {
    expect(shouldSendTaskPendingPush("child")).toBe(true);
  });

  it("does not send parent-to-parent pushes for parent submissions", () => {
    expect(shouldSendTaskPendingPush("parent")).toBe(false);
  });
});