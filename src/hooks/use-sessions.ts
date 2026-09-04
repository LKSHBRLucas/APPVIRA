import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import {
  getSession,
  listSessions,
  type SessionWithTask,
} from "@/lib/data/sessions";

/** All sessions from the last N days, for the dashboard. */
export function useSessions(days = 14) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["sessions", user?.id, days],
    queryFn: async () => {
      const from = new Date(Date.now() - days * 86400000).toISOString();
      return listSessions(user!.id, from);
    },
    enabled: !!user,
  });
}

export function useSession(sessionId: string | undefined) {
  return useQuery<SessionWithTask | null>({
    queryKey: ["session", sessionId],
    queryFn: () => getSession(sessionId!),
    enabled: !!sessionId,
  });
}
