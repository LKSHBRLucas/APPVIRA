import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { removePushSubscription, upsertPushSubscription } from "@/lib/data/push";

/**
 * Honest web push wrapper: registers the service worker, then subscribes the
 * browser when VAPID keys are configured. When push is not configured (empty
 * VAPID public key) the UI shows the real limitation instead of a dead button.
 */
export const VAPID_PUBLIC_KEY = "";

export function usePush() {
  const { user } = useAuth();
  const [supported] = useState(
    () =>
      typeof window !== "undefined" &&
      "serviceWorker" in navigator &&
      "PushManager" in window,
  );
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">(
    "unsupported",
  );

  useEffect(() => {
    if (!supported) return;
    setPermission(Notification.permission);
  }, [supported]);

  const register = useCallback(async () => {
    if (!supported) return;
    await navigator.serviceWorker.register("/sw.js");
  }, [supported]);

  const subscribe = useCallback(async (): Promise<boolean> => {
    if (!user || !supported) return false;
    if (!VAPID_PUBLIC_KEY) return false;

    await register();
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: VAPID_PUBLIC_KEY,
    });

    await upsertPushSubscription(user.id, subscription.toJSON() as never);
    setPermission("granted");
    return true;
  }, [supported, user, register]);

  const unsubscribe = useCallback(async (): Promise<void> => {
    if (!supported) return;
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    if (subscription) {
      await removePushSubscription(subscription.endpoint);
      await subscription.unsubscribe();
    }
    setPermission("default");
  }, [supported]);

  return {
    supported,
    permission,
    subscribe,
    unsubscribe,
    register,
  };
}
