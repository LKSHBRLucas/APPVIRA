import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Brazil has not observed DST since 2019 — a fixed UTC-3 offset is accurate
// today. If that ever changes again, this constant is the one place to fix.
const BR_UTC_OFFSET_HOURS = -3;
const MIN_SESSIONS_FOR_PATTERN = 3;
const NOTIFICATION_TYPE = "best_hour_nudge";

interface FcmServiceAccount {
  client_email: string;
  private_key: string;
  project_id: string;
}

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function base64url(input: ArrayBuffer | string): string {
  const bytes =
    typeof input === "string" ? new TextEncoder().encode(input) : new Uint8Array(input);
  let str = "";
  for (const b of bytes) str += String.fromCharCode(b);
  return btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function pemToArrayBuffer(pem: string): ArrayBuffer {
  const b64 = pem
    .replace(/-----BEGIN PRIVATE KEY-----/, "")
    .replace(/-----END PRIVATE KEY-----/, "")
    .replace(/\s+/g, "");
  const raw = atob(b64);
  const buf = new ArrayBuffer(raw.length);
  const view = new Uint8Array(buf);
  for (let i = 0; i < raw.length; i++) view[i] = raw.charCodeAt(i);
  return buf;
}

/** Exchanges a Google service account for a short-lived OAuth2 access token
 * scoped to FCM, via a signed JWT (RS256) — no external auth library needed,
 * Deno's Web Crypto does the signing. */
async function getFcmAccessToken(account: FcmServiceAccount): Promise<string> {
  const header = { alg: "RS256", typ: "JWT" };
  const now = Math.floor(Date.now() / 1000);
  const claim = {
    iss: account.client_email,
    scope: "https://www.googleapis.com/auth/firebase.messaging",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  };
  const unsigned = `${base64url(JSON.stringify(header))}.${base64url(JSON.stringify(claim))}`;

  const key = await crypto.subtle.importKey(
    "pkcs8",
    pemToArrayBuffer(account.private_key),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    key,
    new TextEncoder().encode(unsigned),
  );
  const jwt = `${unsigned}.${base64url(signature)}`;

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });
  if (!res.ok) throw new Error(`FCM auth failed: ${await res.text()}`);
  const data = await res.json();
  return data.access_token as string;
}

async function sendFcm(
  account: FcmServiceAccount,
  accessToken: string,
  token: string,
  title: string,
  body: string,
): Promise<boolean> {
  const res = await fetch(
    `https://fcm.googleapis.com/v1/projects/${account.project_id}/messages:send`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message: { token, notification: { title, body } },
      }),
    },
  );
  return res.ok;
}

/** Parses the service account secret, tolerating a double-encoded JSON string
 * (some secret stores hand back the value wrapped in quotes). Returns the list
 * of missing keys instead of leaking a cryptic runtime error. */
function parseServiceAccount(raw: string): FcmServiceAccount | { missing: string[] } {
  let parsed: unknown = JSON.parse(raw);
  if (typeof parsed === "string") parsed = JSON.parse(parsed);
  const account = (parsed ?? {}) as Partial<FcmServiceAccount>;
  const missing = (["client_email", "private_key", "project_id"] as const).filter(
    (key) => typeof account[key] !== "string" || !account[key],
  );
  if (missing.length > 0) return { missing };
  return account as FcmServiceAccount;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
  const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const FCM_SERVICE_ACCOUNT_JSON = Deno.env.get("FCM_SERVICE_ACCOUNT_JSON");

  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    return jsonResponse({ error: "Missing Supabase service credentials" }, 500);
  }
  if (!FCM_SERVICE_ACCOUNT_JSON) {
    return jsonResponse(
      { error: "FCM_SERVICE_ACCOUNT_JSON secret is not configured — see deploy notes" },
      500,
    );
  }

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  let account: FcmServiceAccount;
  try {
    const parsed = parseServiceAccount(FCM_SERVICE_ACCOUNT_JSON);
    if ("missing" in parsed) {
      return jsonResponse(
        { error: `FCM service account JSON is missing required fields: ${parsed.missing.join(", ")}` },
        500,
      );
    }
    account = parsed;
  } catch {
    return jsonResponse({ error: "FCM_SERVICE_ACCOUNT_JSON is not valid JSON" }, 500);
  }

  const nowUtc = new Date();
  const localHour = (nowUtc.getUTCHours() + BR_UTC_OFFSET_HOURS + 24) % 24;
  const todayLocalDate = new Date(
    nowUtc.getTime() + BR_UTC_OFFSET_HOURS * 3600 * 1000,
  )
    .toISOString()
    .slice(0, 10);

  let accessToken: string;
  try {
    accessToken = await getFcmAccessToken(account);
  } catch (error) {
    return jsonResponse({ error: (error as Error).message }, 500);
  }

  // Every user with at least one registered device.
  const { data: tokenRows, error: tokenError } = await admin
    .from("device_push_tokens")
    .select("user_id, token");
  if (tokenError) return jsonResponse({ error: tokenError.message }, 500);

  const userIds = [...new Set((tokenRows ?? []).map((r) => r.user_id))];
  const results: Record<string, string> = {};

  for (const userId of userIds) {
    try {
      // Skip if we already nudged this user today.
      const { data: already } = await admin
        .from("notifications")
        .select("id")
        .eq("user_id", userId)
        .eq("type", NOTIFICATION_TYPE)
        .gte("created_at", `${todayLocalDate}T00:00:00Z`)
        .limit(1);
      if (already && already.length > 0) {
        results[userId] = "already_notified_today";
        continue;
      }

      // Compute this user's best hour from real session starts (same logic
      // as src/lib/behaviors/insights.ts deriveInsights, server-side).
      const { data: sessions } = await admin
        .from("sessions")
        .select("actual_start")
        .eq("user_id", userId)
        .not("actual_start", "is", null);

      const hourCounts = new Map<number, number>();
      for (const s of sessions ?? []) {
        const h =
          (new Date(s.actual_start as string).getUTCHours() + BR_UTC_OFFSET_HOURS + 24) % 24;
        hourCounts.set(h, (hourCounts.get(h) ?? 0) + 1);
      }
      let bestHour: number | null = null;
      let bestCount = 0;
      for (const [hour, count] of hourCounts) {
        if (count > bestCount) {
          bestCount = count;
          bestHour = hour;
        }
      }

      if (bestHour === null || bestCount < MIN_SESSIONS_FOR_PATTERN) {
        results[userId] = "not_enough_pattern_yet";
        continue;
      }
      if (bestHour !== localHour) {
        results[userId] = `not_best_hour (best=${bestHour}, now=${localHour})`;
        continue;
      }

      // Only nudge when there's an actual pending task — never a content-free
      // "open the app" notification.
      const { data: pendingTasks } = await admin
        .from("tasks")
        .select("id, title")
        .eq("user_id", userId)
        .eq("status", "planned")
        .limit(1);
      if (!pendingTasks || pendingTasks.length === 0) {
        results[userId] = "no_pending_task";
        continue;
      }

      const title = "Essa costuma ser sua melhor hora";
      const body = `Você costuma conseguir começar por volta desse horário. "${pendingTasks[0].title}" está te esperando.`;

      const { data: tokens } = await admin
        .from("device_push_tokens")
        .select("token")
        .eq("user_id", userId);

      let sentAny = false;
      for (const row of tokens ?? []) {
        const ok = await sendFcm(account, accessToken, row.token, title, body);
        sentAny = sentAny || ok;
      }

      await admin.from("notifications").insert({
        user_id: userId,
        type: NOTIFICATION_TYPE,
        title,
        body,
        scheduled_for: nowUtc.toISOString(),
        sent_at: sentAny ? nowUtc.toISOString() : null,
      });

      results[userId] = sentAny ? "sent" : "fcm_send_failed";
    } catch (error) {
      results[userId] = `error: ${(error as Error).message}`;
    }
  }

  return jsonResponse({ checked: userIds.length, results });
});
