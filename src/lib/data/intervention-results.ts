import { supabase } from "@/integrations/supabase/client";

export interface InterventionResultRow {
  id: string;
  user_id: string;
  session_id: string | null;
  task_id: string | null;
  intervention_code: string;
  shown_at: string;
  accepted: boolean | null;
  outcome: string | null;
}

export async function recordInterventionResult(
  userId: string,
  input: {
    session_id: string | null;
    task_id: string | null;
    intervention_code: string;
    accepted?: boolean;
    outcome?: string;
  },
): Promise<void> {
  const { error } = await supabase.from("intervention_results").insert({
    user_id: userId,
    session_id: input.session_id,
    task_id: input.task_id,
    intervention_code: input.intervention_code,
    accepted: input.accepted ?? null,
    outcome: input.outcome ?? null,
  });
  if (error) throw error;
}

/** Close the loop on an intervention once the session finishes. */
export async function updateInterventionOutcome(
  userId: string,
  sessionId: string,
  outcome: string,
): Promise<void> {
  const { error } = await supabase
    .from("intervention_results")
    .update({ outcome })
    .eq("user_id", userId)
    .eq("session_id", sessionId);
  if (error) throw error;
}
