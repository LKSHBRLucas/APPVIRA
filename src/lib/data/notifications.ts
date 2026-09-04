import { supabase } from "@/integrations/supabase/client";

export interface NotificationRow {
  id: string;
  user_id: string;
  type: string;
  title: string;
  body: string | null;
  scheduled_for: string | null;
  sent_at: string | null;
  opened_at: string | null;
  read: boolean;
  created_at: string;
}

export type NotificationInput = Pick<
  NotificationRow,
  "type" | "title" | "body" | "scheduled_for"
>;

export async function listNotifications(
  userId: string,
): Promise<NotificationRow[]> {
  const { data, error } = await supabase
    .from("notifications")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw error;
  return (data ?? []) as NotificationRow[];
}

export async function insertNotification(
  userId: string,
  input: NotificationInput,
): Promise<void> {
  const { error } = await supabase.from("notifications").insert({
    user_id: userId,
    ...input,
  });
  if (error) throw error;
}

export async function markNotificationRead(
  notificationId: string,
): Promise<void> {
  const { error } = await supabase
    .from("notifications")
    .update({ read: true, opened_at: new Date().toISOString() })
    .eq("id", notificationId);
  if (error) throw error;
}
