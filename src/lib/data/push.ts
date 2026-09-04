import { supabase } from "@/integrations/supabase/client";

export interface PushSubscriptionRow {
  id: string;
  user_id: string;
  endpoint: string;
  keys: { p256dh: string; auth: string };
  user_agent: string | null;
  created_at: string;
}

export async function upsertPushSubscription(
  userId: string,
  subscription: PushSubscriptionRow["keys"] & { endpoint: string },
): Promise<void> {
  const { error } = await supabase
    .from("push_subscriptions")
    .upsert(
      {
        user_id: userId,
        endpoint: subscription.endpoint,
        keys: { p256dh: subscription.p256dh, auth: subscription.auth },
        user_agent: navigator.userAgent,
      },
      { onConflict: "endpoint" },
    );
  if (error) throw error;
}

export async function removePushSubscription(endpoint: string): Promise<void> {
  const { error } = await supabase
    .from("push_subscriptions")
    .delete()
    .eq("endpoint", endpoint);
  if (error) throw error;
}
