import { supabase } from "@/integrations/supabase/client";

export async function insertFocusSession(
  userId: string,
  sessionId: string,
  startedAt: string,
  endedAt: string,
  durationMinutes: number,
): Promise<void> {
  const { error } = await supabase.from("focus_sessions").insert({
    user_id: userId,
    session_id: sessionId,
    started_at: startedAt,
    ended_at: endedAt,
    duration_actual: durationMinutes,
  });
  if (error) throw error;
}
