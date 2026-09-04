import { supabase } from "@/integrations/supabase/client";

export interface ImplementationIntentionRow {
  id: string;
  user_id: string;
  if_part: string;
  then_part: string;
  trigger_code: string | null;
  active: boolean;
  created_at: string;
}

export type IntentionInput = Pick<
  ImplementationIntentionRow,
  "if_part" | "then_part" | "trigger_code"
>;

export async function listIntentions(
  userId: string,
): Promise<ImplementationIntentionRow[]> {
  const { data, error } = await supabase
    .from("implementation_intentions")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as ImplementationIntentionRow[];
}

export async function createIntention(
  userId: string,
  input: IntentionInput,
): Promise<ImplementationIntentionRow> {
  const { data, error } = await supabase
    .from("implementation_intentions")
    .insert({ user_id: userId, ...input })
    .select()
    .single();
  if (error) throw error;
  return data as ImplementationIntentionRow;
}

export async function setIntentionActive(
  intentionId: string,
  active: boolean,
): Promise<void> {
  const { error } = await supabase
    .from("implementation_intentions")
    .update({ active })
    .eq("id", intentionId);
  if (error) throw error;
}

export async function deleteIntention(intentionId: string): Promise<void> {
  const { error } = await supabase
    .from("implementation_intentions")
    .delete()
    .eq("id", intentionId);
  if (error) throw error;
}
