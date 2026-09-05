import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { listFocusSessions } from "@/lib/data/focus";
import { listSessions } from "@/lib/data/sessions";
import { buildPersonalizationContext } from "@/lib/personalization/context";

/**
 * Real behavior data (all-time sessions + post-session check-ins) summarized
 * into a compact context for AI personalization. No mock — every number comes
 * from the user's own rows in Enter Cloud.
 */
export function usePersonalizationData() {
  const { user } = useAuth();

  const sessionsQ = useQuery({
    queryKey: ["sessions", "personalization", user?.id],
    queryFn: () => listSessions(user!.id),
    enabled: !!user,
  });

  const checkinsQ = useQuery({
    queryKey: ["focus_sessions", "personalization", user?.id],
    queryFn: () => listFocusSessions(user!.id),
    enabled: !!user,
  });

  const context = useMemo(
    () => buildPersonalizationContext(sessionsQ.data ?? [], checkinsQ.data ?? []),
    [sessionsQ.data, checkinsQ.data],
  );

  return { context, isLoading: sessionsQ.isLoading || checkinsQ.isLoading };
}
