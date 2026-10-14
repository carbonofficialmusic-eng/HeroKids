export function shouldSendTaskPendingPush(submitterRole: "parent" | "child"): boolean {
  return submitterRole === "child";
}

export function excludeOriginDeviceToken(tokens: string[], originToken?: string): string[] {
  if (!originToken) return tokens;
  return tokens.filter(token => token !== originToken);
}