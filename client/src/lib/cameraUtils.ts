/**
 * Returns true when the error thrown by the Capacitor Camera plugin represents
 * the user dismissing the photo picker without making a selection.
 */
export function isPhotoPickerCancelError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const msg = error.message?.toLowerCase() ?? "";
  return (
    msg.includes("cancel") ||
    msg.includes("no image picked") ||
    msg.includes("dismissed")
  );
}

/**
 * window-backed flag: set true after a native camera session, cleared when the
 * surrounding mutation's onSuccess handler dispatches the herokids:camera-fix event.
 * Using window ensures the value is always live — no ES module binding caveats.
 */
export function markCameraUsed(): void {
  (window as any).__herokidsCameraUsed = true;
}

export function clearCameraUsed(): void {
  (window as any).__herokidsCameraUsed = false;
}

export function isCameraUsed(): boolean {
  return !!(window as any).__herokidsCameraUsed;
}

/**
 * No-op kept for call-site compatibility.
 */
export function syncScrollAfterCamera(): void {}
