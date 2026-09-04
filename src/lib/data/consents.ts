import { supabase } from "@/integrations/supabase/client";

export interface ConsentRow {
  id: string;
  user_id: string;
  type: string;
  granted: boolean;
  version: string | null;
  granted_at: string;
}

export interface PrivacySettingsRow {
  id: string;
  user_id: string;
  notifications_enabled: boolean;
  behavioral_data_for_product: boolean;
  research_consent: boolean;
  updated_at: string;
}

export async function listConsents(userId: string): Promise<ConsentRow[]> {
  const { data, error } = await supabase
    .from("consents")
    .select("*")
    .eq("user_id", userId);
  if (error) throw error;
  return (data ?? []) as ConsentRow[];
}

export async function setConsent(
  userId: string,
  type: string,
  granted: boolean,
  version?: string,
): Promise<void> {
  const { data, error } = await supabase
    .from("consents")
    .select("id")
    .eq("user_id", userId)
    .eq("type", type)
    .maybeSingle();
  if (error) throw error;

  if (data) {
    const { error: updateError } = await supabase
      .from("consents")
      .update({ granted, version: version ?? null })
      .eq("id", data.id);
    if (updateError) throw updateError;
  } else {
    const { error: insertError } = await supabase.from("consents").insert({
      user_id: userId,
      type,
      granted,
      version: version ?? null,
    });
    if (insertError) throw insertError;
  }
}

export async function getPrivacySettings(
  userId: string,
): Promise<PrivacySettingsRow | null> {
  const { data, error } = await supabase
    .from("privacy_settings")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  return data as PrivacySettingsRow | null;
}

export async function updatePrivacySettings(
  userId: string,
  patch: Partial<PrivacySettingsRow>,
): Promise<void> {
  const { error } = await supabase
    .from("privacy_settings")
    .update(patch)
    .eq("user_id", userId);
  if (error) throw error;
}
