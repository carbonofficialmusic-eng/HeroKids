export function shouldSendTaskPendingPush(submitterRole: "parent" | "child"): boolean {
  return submitterRole === "child";
}