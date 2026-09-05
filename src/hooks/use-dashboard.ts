import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { listFocusSessions } from "@/lib/data/focus";
import { listSessions } from "@/lib/data/sessions";
import { listSessionObstacleCounts } from "@/lib/data/session-obstacles";
import { buildDashboardReport, periodToRange, type PeriodKey } from "@/lib/metrics/dashboard";

/** All real dashboard data for a period: sessions, obstacle combos, check-ins. */
export function useDashboard(period: PeriodKey) {
  const { user } = useAuth();
  const { from, to } = periodToRange(period);

  const sessionsQ = useQuery({
    queryKey: ["sessions", "dashboard", user?.id, period],
    queryFn: () => listSessions(user!.id, from, to),
    enabled: !!user,
  });

  const obstaclesQ = useQuery({
    queryKey: ["session_obstacles", "dashboard", user?.id, period],
    queryFn: () => listSessionObstacleCounts(user!.id, from, to),
    enabled: !!user,
  });

  const checkinsQ = useQuery({
    queryKey: ["focus_sessions", "dashboard", user?.id, period],
    queryFn: () => listFocusSessions(user!.id, from, to),
    enabled: !!user,
  });

  const report = buildDashboardReport(
    sessionsQ.data ?? [],
    obstaclesQ.data ?? [],
    checkinsQ.data ?? [],
  );

  return {
    report,
    isLoading: sessionsQ.isLoading || obstaclesQ.isLoading || checkinsQ.isLoading,
  };
}
