export type ImportedTaskStatus = "active" | "completed" | "archived";

export function resolveImportedTaskStatusOnUpdate(
  currentStatus: ImportedTaskStatus,
  wasCancelled: boolean,
  statusBeforeCancellation: string | null | undefined,
): ImportedTaskStatus {
  if (!wasCancelled) return currentStatus;
  return statusBeforeCancellation === "completed" ? "completed" : "active";
}

export function normalizeImportedTaskPoints(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(0, Math.min(1000, parsed)) : 10;
}

export function preserveFirstCancellationStatus(
  wasAlreadyCancelled: boolean,
  savedStatus: string | null | undefined,
  currentStatus: string | null | undefined,
): string {
  return wasAlreadyCancelled ? (savedStatus || "active") : (currentStatus || "active");
}