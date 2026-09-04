import { supabase } from "@/integrations/supabase/client";

export interface EnergyCheckinRow {
  id: string;
  user_id: string;
  level: number;
  context: string | null;
  checked_at: string;
}

export async function insertEnergyCheckin(
  userId: string,
  level: number,
  context?: string,
): Promise<void> {
  const { error } = await supabase.from("energy_checkins").insert({
    user_id: userId,
    level,
    context: context ?? null,
  });
  if (error) throw error;
}

export async function latestEnergy(
  userId: string,
): Promise<EnergyCheckinRow | null> {
  const { data, error } = await supabase
    .from("energy_checkins")
    .select("*")
    .eq("user_id", userId)
    .order("checked_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data as EnergyCheckinRow | null;
}
