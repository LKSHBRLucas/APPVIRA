import { supabase } from "@/integrations/supabase/client";

export interface BehaviorPatternRow {
  id: string;
  user_id: string;
  pattern_type: string;
  data: Record<string, unknown>;
  generated_at: string;
}

export async function listBehaviorPatterns(
  userId: string,
): Promise<BehaviorPatternRow[]> {
  const { data, error } = await supabase
    .from("behavior_patterns")
    .select("*")
    .eq("user_id", userId)
    .order("generated_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as BehaviorPatternRow[];
}

export async function upsertBehaviorPattern(
  userId: string,
  patternType: string,
  data: Record<string, unknown>,
): Promise<void> {
  const { error } = await supabase.from("behavior_patterns").insert({
    user_id: userId,
    pattern_type: patternType,
    data,
  });
  if (error) throw error;
}
