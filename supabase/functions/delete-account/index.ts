import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

/**
 * User-owned tables in dependency order (children before parents). RLS alone
 * cannot delete a user row with the service role client, so we enumerate the
 * tables explicitly. profiles must go last (its FK to auth.users has no
 * cascade) and auth.users is deleted via the admin API after all rows are gone.
 */
const USER_TABLES = [
  "session_obstacles",
  "intervention_results",
  "focus_sessions",
  "session_events",
  "sessions",
  "tasks",
  "goals",
  "energy_checkins",
  "implementation_intentions",
  "behavior_patterns",
  "notifications",
  "push_subscriptions",
  "subscriptions",
  "consents",
  "privacy_settings",
  "audit_logs",
  "experiment_assignments",
  "experiments",
  "profiles",
];

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } },
    );

    const jwt = (req.headers.get("Authorization") ?? "").replace("Bearer ", "");
    const { data: { user }, error: userError } = await supabase.auth.getUser(jwt);
    if (userError || !user) {
      return jsonResponse(
        { error: { message: "Não foi possível autenticar. Recarregue a página.", type: "authentication_error" } },
        401,
      );
    }

    for (const table of USER_TABLES) {
      const { error } = await supabase.from(table).delete().eq("user_id", user.id);
      if (error) throw new Error(`delete ${table}: ${error.message}`);
    }

    const { error: deleteError } = await supabase.auth.admin.deleteUser(user.id);
    if (deleteError) throw new Error(`delete auth user: ${deleteError.message}`);

    return jsonResponse({ ok: true });
  } catch (error) {
    console.error("delete-account", error);
    return jsonResponse(
      { error: { message: "Não foi possível excluir a conta agora. Tente de novo.", type: "api_error" } },
      500,
    );
  }
});
