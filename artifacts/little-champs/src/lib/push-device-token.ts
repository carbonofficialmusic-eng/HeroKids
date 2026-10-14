const PUSH_DEVICE_TOKEN_KEY = "little-champs-push-device-token";

export function rememberPushDeviceToken(token: string): void {
  try {
    localStorage.setItem(PUSH_DEVICE_TOKEN_KEY, token);
  } catch {
    // Push registration still works when storage is unavailable.
  }
}

export function getRememberedPushDeviceToken(): string | null {
  try {
    return localStorage.getItem(PUSH_DEVICE_TOKEN_KEY);
  } catch {
    return null;
  }
}