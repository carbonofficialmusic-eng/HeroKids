const TV_ID = "[A-Za-z0-9_-]+";
// Idempotent redemptions have IDs like redemption:<operationId>; the TV
// percent-encodes the colon in its request URL.
const TV_REDEMPTION_ID = `(?:${TV_ID}|redemption(?::|%3[Aa])${TV_ID})`;

const exactTvRoutes: Record<string, ReadonlySet<string>> = {
  GET: new Set([
    "/api/tasks/completions/pending",
    "/api/rewards",
    "/api/reward-redemptions",
    "/api/reward-requests",
    "/api/rewards/shared",
    "/api/families/current",
    "/api/appointments",
  ]),
};

const parameterizedTvRoutes: Partial<Record<string, readonly RegExp[]>> = {
  GET: [
    new RegExp(`^/api/tasks/${TV_ID}/shopping-items$`),
  ],
  POST: [
    new RegExp(`^/api/tasks/completions/${TV_ID}/approve$`),
    new RegExp(`^/api/tasks/completions/${TV_ID}/reject$`),
    new RegExp(`^/api/rewards/${TV_ID}/redeem$`),
    new RegExp(`^/api/rewards/redemptions/${TV_REDEMPTION_ID}/(share|join|leave-sharing|finalize|cancel-sharing)$`),
  ],
  DELETE: [
    new RegExp(`^/api/reward-redemptions/${TV_REDEMPTION_ID}$`),
  ],
  PATCH: [
    new RegExp(`^/api/shopping-items/${TV_ID}/toggle$`),
    new RegExp(`^/api/reward-redemptions/${TV_REDEMPTION_ID}$`),
    new RegExp(`^/api/reward-requests/${TV_ID}/(approve|decline)$`),
  ],
};

export function isAllowedTvApiRequest(method: string, path: string): boolean {
  const normalizedMethod = method.toUpperCase();
  if (exactTvRoutes[normalizedMethod]?.has(path)) return true;
  return parameterizedTvRoutes[normalizedMethod]?.some((route) => route.test(path)) ?? false;
}