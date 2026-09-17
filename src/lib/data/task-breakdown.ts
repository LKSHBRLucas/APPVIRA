import { supabase } from "@/integrations/supabase/client";

export interface TaskBreakdownResult {
  steps: string[];
  source: "model" | "fallback";
}

/**
 * Calls the `task-breakdown` backend function to turn an abstract, "too
 * big"/"don't know where to start" task into 3-5 concrete steps. Never
 * throws for a bad AI response — the function itself falls back to a
 * rule-based breakdown server-side, so this only throws on a real network/
 * infra failure (handled by the caller like any other data call).
 */
export async function generateTaskBreakdown(
  title: string,
  firstStep?: string | null,
  note?: string | null,
): Promise<TaskBreakdownResult> {
  const { data, error } = await supabase.functions.invoke("task-breakdown", {
    body: { title, first_step: firstStep ?? null, note: note ?? null },
  });
  if (error) throw error;
  if (!data || !Array.isArray(data.steps)) {
    throw new Error("task-breakdown returned an invalid response");
  }
  return { steps: data.steps as string[], source: data.source === "model" ? "model" : "fallback" };
}

/** Persist (or clear, with `null`) the breakdown steps on a task. */
export async function saveTaskBreakdown(
  taskId: string,
  steps: string[] | null,
): Promise<void> {
  const { error } = await supabase
    .from("tasks")
    .update({ breakdown_steps: steps })
    .eq("id", taskId);
  if (error) throw error;
}
