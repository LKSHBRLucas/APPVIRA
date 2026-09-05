import { supabase } from "@/integrations/supabase/client";

export interface ProfileRow {
  id: string;
  name: string | null;
  work_start: string | null;
  work_end: string | null;
  arrival_time: string | null;
  sleep_time: string | null;
  work_days: number[] | null;
  main_goal: string | null;
  procrastination_profile: string | null;
  onboarding_completed: boolean;
  /** Free-form preferences (e.g. default_focus_min) — never user-visible raw JSON. */
  preferences: Record<string, unknown> | null;
}

/** Sanitized default focus duration from profile preferences, clamped 5–120. */
export function defaultFocusMin(profile: ProfileRow | null): number {
  const value = profile?.preferences?.default_focus_min;
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.min(120, Math.max(5, Math.round(value)));
  }
  return 25;
}

export async function getProfile(userId: string): Promise<ProfileRow | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .maybeSingle();
  if (error) throw error;
  return data as ProfileRow | null;
}

export async function updateProfile(
  userId: string,
  patch: Partial<ProfileRow>,
): Promise<ProfileRow | null> {
  const { data, error } = await supabase
    .from("profiles")
    .update(patch)
    .eq("id", userId)
    .select()
    .maybeSingle();
  if (error) throw error;
  return data as ProfileRow | null;
}
