import { describe, expect, it } from "vitest";
import { isAllowedTvApiRequest } from "./tvRouteAccess";

describe("TV shopping list operational boundary", () => {
  it("allows reading and toggling existing products only", () => {
    expect(isAllowedTvApiRequest("GET", "/api/tasks/task_1/shopping-items")).toBe(true);
    expect(isAllowedTvApiRequest("PATCH", "/api/shopping-items/item_1/toggle")).toBe(true);
  });
  it("does not grant list editing, deletion, nested paths or wrong methods", () => {
    const denied = [
      ["PATCH", "/api/tasks/task_1/shopping-items"],
      ["POST", "/api/tasks/task_1/shopping-items"],
      ["DELETE", "/api/shopping-items/item_1"],
      ["GET", "/api/shopping-items/item_1/toggle"],
      ["PATCH", "/api/shopping-items/item_1/toggle/extra"],
      ["GET", "/api/tasks/task%2Fother/shopping-items"],
    ];
    for (const [method, path] of denied) expect(isAllowedTvApiRequest(method, path)).toBe(false);
  });
});

describe("TV API route allowlist", () => {
  it("allows only the explicitly supported task, reward, request, and sharing routes", () => {
    const allowed = [
      ["GET", "/api/tasks/completions/pending"],
      ["POST", "/api/tasks/completions/completion_1/approve"],
      ["POST", "/api/tasks/completions/completion_1/reject"],
      ["GET", "/api/rewards"],
      ["POST", "/api/rewards/reward_1/redeem"],
      ["GET", "/api/reward-redemptions"],
      ["PATCH", "/api/reward-redemptions/redemption_1"],
      ["DELETE", "/api/reward-redemptions/redemption_1"],
      ["GET", "/api/reward-requests"],
      ["PATCH", "/api/reward-requests/request_1/approve"],
      ["PATCH", "/api/reward-requests/request_1/decline"],
      ["GET", "/api/rewards/shared"],
      ["GET", "/api/families/current"],
      ["GET", "/api/appointments"],
      ["PATCH", "/api/reward-redemptions/redemption%3Aoperation-1"],
      ["DELETE", "/api/reward-redemptions/redemption%3Aoperation-1"],
      ...["share", "join", "leave-sharing", "finalize", "cancel-sharing"].map(
        (action) => ["POST", `/api/rewards/redemptions/redemption_1/${action}`],
      ),
      ...["share", "join", "leave-sharing", "finalize", "cancel-sharing"].map(
        (action) => ["POST", `/api/rewards/redemptions/redemption%3Aoperation-1/${action}`],
      ),
    ] as const;

    for (const [method, path] of allowed) {
      expect(isAllowedTvApiRequest(method, path), `${method} ${path}`).toBe(true);
    }
  });

  it("rejects adjacent, nested, wrong-method, and unrelated endpoints", () => {
    const denied = [
      ["POST", "/api/rewards"],
      ["PUT", "/api/rewards/reward_1"],
      ["DELETE", "/api/rewards/reward_1"],
      ["POST", "/api/reward-requests"],
      ["PATCH", "/api/reward-requests/request_1"],
      ["GET", "/api/rewards/"],
      ["POST", "/api/reward-redemptions"],
      ["GET", "/api/reward-redemptions/pending-count"],
      ["PATCH", "/api/reward-requests/request_1/other"],
      ["POST", "/api/rewards/redemptions/id/share/extra"],
      ["GET", "/api/rewards/redemptions/id/share"],
      ["POST", "/api/rewards/redemptions/redemption%2Fanother/share"],
      ["POST", "/api/rewards/redemptions/redemption%253Aoperation-1/share"],
      ["POST", "/api/rewards/redemptions/redemption%3Aoperation-1/edit"],
      ["DELETE", "/api/rewards/redemptions/redemption%3Aoperation-1/share"],
      ["POST", "/api/tasks/completions/id/delete"],
      ["POST", "/api/admin/users"],
      ["GET", "/api/tasks/completions/a%2Fb/pending"],
    ] as const;

    for (const [method, path] of denied) {
      expect(isAllowedTvApiRequest(method, path), `${method} ${path}`).toBe(false);
    }
  });
});