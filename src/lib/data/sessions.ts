import { supabase } from "@/integrations/supabase/client";

export type SessionStatus =
  | "planned"
  | "started"
  | "completed"
  | "abandoned"
  | "recovered";

export interface SessionRow {
  id: string;
  user_id: string;
  task_id: string | null;
  planned_start: string;
  actual_start: string | null;
  status: SessionStatus;
  duration_planned: number;
  duration_actual: number | null;
  obstacle_code: string | null;
  intervention_code: string | null;
  energy: number | null;
  created_at: string;
}

export interface SessionWithTask extends SessionRow {
  tasks: {
    id: string;
    title: string;
    first_step: string | null;
    duration_min: number;
    category: string;
    breakdown_steps: string[] | null;
  } | null;
}

export type SessionInput = Pick<
  SessionRow,
  | "task_id"
  | "planned_start"
  | "duration_planned"
  | "obstacle_code"
  | "intervention_code"
  | "energy"
>;

export async function listSessions(
  userId: string,
  from?: string,
  to?: string,
): Promise<SessionWithTask[]> {
  let query = supabase
    .from("sessions")
    .select("*, tasks(id, title, first_step, duration_min, category, breakdown_steps)")
    .eq("user_id", userId)
    .order("planned_start", { ascending: false });
  if (from) query = query.gte("planned_start", from);
  if (to) query = query.lt("planned_start", to);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as SessionWithTask[];
}

export async function getSession(
  sessionId: string,
): Promise<SessionWithTask | null> {
  const { data, error } = await supabase
    .from("sessions")
    .select("*, tasks(id, title, first_step, duration_min, category, breakdown_steps)")
    .eq("id", sessionId)
    .maybeSingle();
  if (error) throw error;
  return data as SessionWithTask | null;
}

/** Only the ids of sessions inside a period — cheap helper for cross-table counts. */
export async function listSessionIds(
  userId: string,
  from?: string,
  to?: string,
): Promise<string[]> {
  let query = supabase
    .from("sessions")
    .select("id")
    .eq("user_id", userId);
  if (from) query = query.gte("planned_start", from);
  if (to) query = query.lt("planned_start", to);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []).map((r) => r.id);
}

export async function createSession(
  userId: string,
  input: SessionInput,
): Promise<SessionRow> {
  const { data, error } = await supabase
    .from("sessions")
    .insert({ user_id: userId, ...input })
    .select()
    .single();
  if (error) throw error;
  return data as SessionRow;
}

export async function updateSession(
  sessionId: string,
  patch: Partial<SessionRow>,
): Promise<void> {
  const { error } = await supabase
    .from("sessions")
    .update(patch)
    .eq("id", sessionId);
  if (error) throw error;
}

export type SessionEventType =
  | "task_started"
  | "task_completed"
  | "task_abandoned"
  | "checkin_answered"
  | "recovery_offered"
  | "recovery_accepted"
  | "recovery_completed"
  | "recovery_declined"
  | "escalation_accepted";

export async function insertSessionEvent(
  userId: string,
  sessionId: string,
  type: SessionEventType,
  payload?: Record<string, unknown>,
): Promise<void> {
  const { error } = await supabase.from("session_events").insert({
    user_id: userId,
    session_id: sessionId,
    type,
    payload: payload ?? null,
  });
  if (error) throw error;
}
