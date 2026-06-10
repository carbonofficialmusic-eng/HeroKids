import { useEffect } from "react";
import { Capacitor } from "@capacitor/core";
import { apiRequest } from "@/lib/queryClient";

async function registerDeviceToken(token: string) {
  try {
    await apiRequest("POST", "/api/device-tokens/register", { token, platform: "ios" });
    console.log("[Push] Device token registered");
  } catch (err) {
    console.error("[Push] Failed to register device token:", err);
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

        const permResult = await PushNotifications.requestPermissions();
        if (permResult.receive !== "granted") {
          console.warn("[Push] Permission not granted:", permResult.receive);
          return;
        }

        await PushNotifications.register();

        const registrationHandler = PushNotifications.addListener(
          "registration",
          (token) => {
            console.log("[Push] Got token:", token.value.substring(0, 8) + "...");
            registerDeviceToken(token.value);
          }
        );

        const errorHandler = PushNotifications.addListener(
          "registrationError",
          (err) => {
            console.error("[Push] Registration error:", err.error);
          }
        );

        cleanup = () => {
          registrationHandler.then((h) => h.remove());
          errorHandler.then((h) => h.remove());
        };
      } catch (err) {
        console.warn("[Push] @capacitor/push-notifications not available:", err);
      }
    })();

    return () => {
      cleanup?.();
    };
  }, [enabled]);
}
