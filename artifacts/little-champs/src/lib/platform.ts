import { Capacitor } from "@capacitor/core";

/**
 * Returns true when the app runs as a native iOS/Android build (Capacitor).
 * Returns false in all browser/web contexts.
 *
 * Use this to hide Stripe payment UI that is not allowed in App Store builds.
 */
export function isNativePlatform(): boolean {
  return Capacitor.isNativePlatform();
}
