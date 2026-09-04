import { supabase } from "@/integrations/supabase/client";

export interface ObstacleRow {
  code: string;
  label: string;
  obstacle_group: string;
}

export interface InterventionRow {
  code: string;
  name: string;
  mechanism: string;
  indication: string;
  contraindication: string | null;
  context: string | null;
  duration_min: number | null;
  description: string;
}

export async function listObstacles(): Promise<ObstacleRow[]> {
  const { data, error } = await supabase
    .from("obstacles")
    .select("*")
    .order("code");
  if (error) throw error;
  return (data ?? []) as ObstacleRow[];
}

export async function listInterventions(): Promise<InterventionRow[]> {
  const { data, error } = await supabase
    .from("interventions")
    .select("*")
    .order("code");
  if (error) throw error;
  return (data ?? []) as InterventionRow[];
}
