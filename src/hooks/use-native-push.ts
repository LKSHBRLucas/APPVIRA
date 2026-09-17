import { useCallback, useEffect, useState } from "react";
import { Capacitor } from "@capacitor/core";
import { useAuth } from "@/hooks/use-auth";
import { registerDeviceToken } from "@/lib/data/device-push";

/**
 * Native push registration (Capacitor + Firebase Cloud Messaging). This is
 * the mobile-app counterpart to `usePush` (Web Push/VAPID): different
 * transport, different token shape, so it gets its own hook and table
 * (`device_push_tokens`) rather than forcing the web shape onto it.
 *
 * A no-op everywhere except a native Android/iOS build — importing
 * `@capacitor/push-notifications` on the web is safe (Capacitor's web shim),
 * but there is nothing useful to register there since `usePush` already
 * covers the browser.
 */
export function useNativePush() {
  const { user } = useAuth();
  const [permission, setPermission] = useState<
    "granted" | "denied" | "prompt" | "unsupported"
  >(Capacitor.isNativePlatform() ? "prompt" : "unsupported");
  const [registering, setRegistering] = useState(false);

  const register = useCallback(async (): Promise<boolean> => {
    if (!Capacitor.isNativePlatform() || !user) return false;
    setRegistering(true);
    try {
      const { PushNotifications } = await import("@capacitor/push-notifications");

      const perm = await PushNotifications.requestPermissions();
      if (perm.receive !== "granted") {
        setPermission("denied");
        return false;
      }

      return await new Promise<boolean>((resolve) => {
        PushNotifications.addListener("registration", async (token) => {
          try {
            await registerDeviceToken(user.id, token.value, Capacitor.getPlatform());
            setPermission("granted");
            resolve(true);
          } catch {
            resolve(false);
          }
        });
        PushNotifications.addListener("registrationError", () => {
          setPermission("denied");
          resolve(false);
        });
        void PushNotifications.register();
      });
    } finally {
      setRegistering(false);
    }
  }, [user]);

  // Best-effort auto-register once per app start on native: the person
  // already granted (or will be prompted for) OS-level notification
  // permission when the app first asks, matching how most native apps behave
  // — no extra in-app toggle needed for the common case.
  useEffect(() => {
    if (!Capacitor.isNativePlatform() || !user) return;
    void register();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  return { supported: Capacitor.isNativePlatform(), permission, registering, register };
}
