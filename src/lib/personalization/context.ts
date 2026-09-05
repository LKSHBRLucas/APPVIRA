import type { FocusCheckinLike, SessionLike } from "@/lib/metrics/metrics";
import {
  accomplishmentRate,
  avgFeeling,
  interventionHelpRate,
} from "@/lib/metrics/metrics";

export interface InterventionHistoryStat {
  code: string;
  count: number;
  completed: number;
  completionRate: number | null;
}

/**
 * Compact, LLM-shaped summary of a user's real behavior. Built from the same
 * tables that feed the dashboard (sessions, focus_sessions), aggregated so the
 * prompt stays small and no raw free text leaks into analytics.
 */
export interface PersonalizationContext {
  totalSessions: number;
  startedSessions: number;
  completedSessions: number;
  obstacleFrequency: { code: string; count: number }[];
  interventionHistory: InterventionHistoryStat[];
  checkins: {
    answered: number;
    accomplishmentRate: number | null;
    helpRate: number | null;
    avgFeeling: number | null;
  };
}

export function buildPersonalizationContext(
  sessions: SessionLike[],
  checkins: FocusCheckinLike[] = [],
): PersonalizationContext {
  const started = sessions.filter((s) => s.actual_start !== null);

  const obstacleCounts = new Map<string, number>();
  for (const s of sessions) {
    if (!s.obstacle_code) continue;
    obstacleCounts.set(s.obstacle_code, (obstacleCounts.get(s.obstacle_code) ?? 0) + 1);
  }
  const obstacleFrequency = [...obstacleCounts.entries()]
    .map(([code, count]) => ({ code, count }))
    .sort((a, b) => b.count - a.count);

  const byCode = new Map<string, { count: number; completed: number; startedCount: number }>();
  for (const s of sessions) {
    if (!s.intervention_code) continue;
    const entry = byCode.get(s.intervention_code) ?? { count: 0, completed: 0, startedCount: 0 };
    entry.count += 1;
    if (s.status === "completed") entry.completed += 1;
    if (s.actual_start !== null) entry.startedCount += 1;
    byCode.set(s.intervention_code, entry);
  }
  const interventionHistory: InterventionHistoryStat[] = [...byCode.entries()]
    .map(([code, e]) => ({
      code,
      count: e.count,
      completed: e.completed,
      completionRate: e.startedCount === 0 ? null : e.completed / e.startedCount,
    }))
    .sort((a, b) => b.count - a.count);

  return {
    totalSessions: sessions.length,
    startedSessions: started.length,
    completedSessions: sessions.filter((s) => s.status === "completed").length,
    obstacleFrequency,
    interventionHistory,
    checkins: {
      answered: checkins.filter(
        (c) =>
          c.accomplished !== null ||
          c.intervention_helped !== null ||
          c.feeling !== null,
      ).length,
      accomplishmentRate: accomplishmentRate(checkins),
      helpRate: interventionHelpRate(checkins),
      avgFeeling: avgFeeling(checkins),
    },
  };
}
