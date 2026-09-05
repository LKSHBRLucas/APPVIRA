import { supabase } from "@/integrations/supabase/client";

export type CheckinAnswers = {
  accomplished: "yes" | "partial" | "no";
  interventionHelped: "yes" | "partial" | "no";
  feeling: number;
};

export async function insertFocusSession(
  userId: string,
  sessionId: string,
  startedAt: string,
  endedAt: string,
  durationMinutes: number,
  checkin?: CheckinAnswers,
): Promise<void> {
  const { error } = await supabase.from("focus_sessions").insert({
    user_id: userId,
    session_id: sessionId,
    started_at: startedAt,
    ended_at: endedAt,
    duration_actual: durationMinutes,
    accomplished: checkin?.accomplished ?? null,
    intervention_helped: checkin?.interventionHelped ?? null,
    feeling: checkin?.feeling ?? null,
  });
  if (error) throw error;
}
