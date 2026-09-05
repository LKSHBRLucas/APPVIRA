import { supabase } from "@/integrations/supabase/client";
import { listSessionIds } from "@/lib/data/sessions";
import type { ObstacleCode } from "@/lib/intervention/types";

/**
 * Persist the full combination of obstacles for a session (up to 3), one row
 * per obstacle. Sessions keep `obstacle_code` as the primary obstacle; this
 * table stores the whole selection for analytics and future adaptive models.
 */
export async function replaceSessionObstacles(
  userId: string,
  sessionId: string,
  codes: ObstacleCode[],
): Promise<void> {
  // Delete the previous selection for this session, then insert the new one.
  const { error: deleteError } = await supabase
    .from("session_obstacles")
    .delete()
    .eq("session_id", sessionId)
    .eq("user_id", userId);
  if (deleteError) throw deleteError;

  if (codes.length === 0) return;

  const { error: insertError } = await supabase.from("session_obstacles").insert(
    codes.map((code) => ({
      user_id: userId,
      session_id: sessionId,
      obstacle_code: code,
    })),
  );
  if (insertError) throw insertError;
}

/**
 * Count obstacles inside a period (by the linked session's planned_start).
 * Returns the full combination from session_obstacles, not just the primary.
 */
export async function listSessionObstacleCounts(
  userId: string,
  from?: string,
  to?: string,
): Promise<{ code: string; count: number }[]> {
  let query = supabase
    .from("session_obstacles")
    .select("obstacle_code")
    .eq("user_id", userId);

  if (from || to) {
    const ids = await listSessionIds(userId, from, to);
    if (ids.length === 0) return [];
    query = query.in("session_id", ids);
  }

  const { data, error } = await query;
  if (error) throw error;

  const counts = new Map<string, number>();
  for (const row of data ?? []) {
    counts.set(row.obstacle_code, (counts.get(row.obstacle_code) ?? 0) + 1);
  }
  return [...counts.entries()].map(([code, count]) => ({ code, count }));
}
