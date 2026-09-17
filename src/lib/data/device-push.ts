import { supabase } from "@/integrations/supabase/client";

export async function registerDeviceToken(
  userId: string,
  token: string,
  platform: string,
): Promise<void> {
  const { error } = await supabase.from("device_push_tokens").upsert(
    { user_id: userId, token, platform, last_seen_at: new Date().toISOString() },
    { onConflict: "token" },
  );
  if (error) throw error;
}

export async function removeDeviceToken(token: string): Promise<void> {
  const { error } = await supabase.from("device_push_tokens").delete().eq("token", token);
  if (error) throw error;
}
