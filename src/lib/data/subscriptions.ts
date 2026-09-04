import { supabase } from "@/integrations/supabase/client";

export interface SubscriptionRow {
  id: string;
  user_id: string;
  plan: "free" | "premium";
  status: string;
  price_monthly_brl: number | null;
  current_period_end: string | null;
  created_at: string;
}

export async function getSubscription(
  userId: string,
): Promise<SubscriptionRow | null> {
  const { data, error } = await supabase
    .from("subscriptions")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  return data as SubscriptionRow | null;
}

/** Mock upgrade — persists the premium plan, no real payment. */
export async function setPlan(
  userId: string,
  plan: "free" | "premium",
): Promise<void> {
  const { error } = await supabase
    .from("subscriptions")
    .update({ plan, status: "active", current_period_end: null })
    .eq("user_id", userId);
  if (error) throw error;
}
