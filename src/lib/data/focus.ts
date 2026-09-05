import { supabase } from "@/integrations/supabase/client";
import type { FocusCheckinLike } from "@/lib/metrics/metrics";

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

/**
 * Post-session check-ins (accomplished / intervention_helped / feeling),
 * filtered by the session's ended_at (when the check-in happened).
 */
export async function listFocusSessions(
  userId: string,
  from?: string,
  to?: string,
): Promise<FocusCheckinLike[]> {
  let query = supabase
    .from("focus_sessions")
    .select("accomplished, intervention_helped, feeling, ended_at")
    .eq("user_id", userId)
    .order("ended_at", { ascending: false });
  if (from) query = query.gte("ended_at", from);
  if (to) query = query.lt("ended_at", to);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as FocusCheckinLike[];
}
