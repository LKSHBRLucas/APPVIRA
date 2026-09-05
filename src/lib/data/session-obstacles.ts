import { supabase } from "@/integrations/supabase/client";
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
