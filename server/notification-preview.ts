export function createNotificationPreview(message: string, maxLength = 100): string {
  const normalized = message.trim().replace(/\s+/g, " ");
  const characters = Array.from(normalized);

  if (characters.length <= maxLength) {
    return normalized;
  }

  return `${characters.slice(0, Math.max(0, maxLength - 1)).join("").trimEnd()}…`;
}