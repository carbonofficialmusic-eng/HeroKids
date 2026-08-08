import { useEffect } from "react";
import { Capacitor } from "@capacitor/core";
import { apiRequest } from "@/lib/queryClient";

async function registerDeviceToken(token: string) {
  try {
    const res = await apiRequest("POST", "/api/device-tokens/register", { token, platform: "ios" });
    console.log("[Push] Device token registered successfully");
  } catch (err: any) {
    console.error("[Push] Failed to register device token:", err?.message ?? err);
  }
}

export function usePushNotifications(enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;
    if (!Capacitor.isNativePlatform()) return;

    let cleanup: (() => void) | undefined;

    (async () => {
      try {
        const { PushNotifications } = await import("@capacitor/push-notifications");

        // ⚠️ Listeners MUST be set up BEFORE calling register(),
        // otherwise fast APNs responses may fire before the handler is attached.
        const registrationHandler = await PushNotifications.addListener(
          "registration",
          (token) => {
            console.log("[Push] Got APNs token:", token.value.substring(0, 10) + "...");
            registerDeviceToken(token.value);
          }
        );

        const errorHandler = await PushNotifications.addListener(
          "registrationError",
          (err) => {
            console.error("[Push] APNs registration error:", JSON.stringify(err));
          }
        );

        cleanup = () => {
          registrationHandler.remove();
          errorHandler.remove();
        };

        const permResult = await PushNotifications.requestPermissions();
        console.log("[Push] Permission status:", permResult.receive);

        if (permResult.receive !== "granted") {
          console.warn("[Push] Permission not granted — skipping register()");
          return;
        }

        console.log("[Push] Calling PushNotifications.register()...");
        await PushNotifications.register();
        console.log("[Push] register() returned — waiting for token event");

      } catch (err: any) {
        console.warn("[Push] Error in push setup:", err?.message ?? err);
      }
    })();

    return () => {
      cleanup?.();
    };
  }, [enabled]);
}
