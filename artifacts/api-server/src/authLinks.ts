export function getAccountEmailBaseUrl() {
  const configuredUrl = process.env.APP_BASE_URL || process.env.PUBLIC_APP_URL;
  if (configuredUrl) {
    return configuredUrl.replace(/\/$/, "");
  }

  if (process.env.REPLIT_DOMAINS) {
    return `https://${process.env.REPLIT_DOMAINS.split(",")[0]}`;
  }

  if (process.env.NODE_ENV === "development") {
    return "http://localhost:5000";
  }

  throw new Error("APP_BASE_URL must be configured for account email links");
}

export function createEmailVerificationUrl(token: string) {
  return `${getAccountEmailBaseUrl()}/api/auth/verify-email?token=${encodeURIComponent(token)}`;
}

export function createPasswordResetUrl(token: string) {
  return `${getAccountEmailBaseUrl()}/?reset_token=${encodeURIComponent(token)}`;
}