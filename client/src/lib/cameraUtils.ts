/**
 * Returns true when the error thrown by the Capacitor Camera plugin represents
 * the user dismissing the photo picker without making a selection.
 *
 * Known cancellation messages by platform:
 *   iOS   – "User cancelled photos app", "User cancelled"
 *   Android – "User cancelled photos app", "No image picked" (picker dismissed),
 *             "dismissed" (some Android picker close events)
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
 * No-op kept for call-site compatibility. The window-scroll enforcement loop
 * in App.tsx now protects #root.scrollTop automatically when it calls
 * window.scrollTo(0,0), so no separate post-camera action is needed.
 */
export function syncScrollAfterCamera(): void {
  // intentionally empty
}
