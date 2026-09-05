import { INTERVENTION_CATALOG } from "@/lib/intervention/catalog";
import {
  accomplishmentRate,
  avgFeeling,
  completionRate,
  initiationRate,
  interventionHelpRate,
  latencyToAction,
  recoveryRate,
  type FocusCheckinLike,
  type SessionLike,
} from "./metrics";

export type PeriodKey = "today" | "7d" | "30d" | "all";

export interface ObstacleCount {
  code: string;
  count: number;
}

export interface InterventionStat {
  code: string;
  name: string;
  count: number;
  completed: number;
  completionRate: number | null;
}

export interface CheckinStats {
  answered: number;
  accomplishmentRate: number | null;
  helpRate: number | null;
  avgFeeling: number | null;
}

export interface DashboardReport {
  total: number;
  started: number;
  completed: number;
  abandoned: number;
  recovered: number;
  initiationRate: number;
  avgLatencyMin: number | null;
  completionRate: number;
  recoveryRate: number;
  bestHours: { hour: number; count: number }[];
  topObstacles: ObstacleCount[];
  interventions: InterventionStat[];
  mostEffective: InterventionStat[];
  checkins: CheckinStats;
}

const interventionName = (code: string): string =>
  INTERVENTION_CATALOG[code as keyof typeof INTERVENTION_CATALOG]?.name ?? code;

/** Local-time range for each filter period. */
export function periodToRange(
  period: PeriodKey,
  now: Date = new Date(),
): { from?: string; to?: string } {
  switch (period) {
    case "today": {
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const end = new Date(start.getTime() + 86400000);
      return { from: start.toISOString(), to: end.toISOString() };
    }
    case "7d":
      return { from: new Date(now.getTime() - 7 * 86400000).toISOString(), to: undefined };
    case "30d":
      return { from: new Date(now.getTime() - 30 * 86400000).toISOString(), to: undefined };
    case "all":
      return { from: undefined, to: undefined };
  }
}

/**
 * Build the full dashboard report from raw, already period-filtered rows.
 * Pure function — no I/O, fully unit-testable.
 */
export function buildDashboardReport(
  sessions: SessionLike[],
  obstacleCounts: ObstacleCount[] = [],
  checkins: FocusCheckinLike[] = [],
): DashboardReport {
  const started = sessions.filter((s) => s.actual_start !== null);

  // Hour buckets of when sessions actually started (local time).
  const hourCounts = new Map<number, number>();
  for (const s of started) {
    const hour = new Date(s.actual_start as string).getHours();
    hourCounts.set(hour, (hourCounts.get(hour) ?? 0) + 1);
  }
  const bestHours = [...hourCounts.entries()]
    .map(([hour, count]) => ({ hour, count }))
    .sort((a, b) => b.count - a.count || a.hour - b.hour)
    .slice(0, 5);

  const topObstacles = [...obstacleCounts]
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  // Interventions: usage count + completion effectiveness.
  const byCode = new Map<string, { count: number; completed: number; startedCount: number }>();
  for (const s of sessions) {
    if (!s.intervention_code) continue;
    const entry = byCode.get(s.intervention_code) ?? { count: 0, completed: 0, startedCount: 0 };
    entry.count += 1;
    if (s.status === "completed") entry.completed += 1;
    if (s.actual_start !== null) entry.startedCount += 1;
    byCode.set(s.intervention_code, entry);
  }
  const interventions: InterventionStat[] = [...byCode.entries()]
    .map(([code, e]) => ({
      code,
      name: interventionName(code),
      count: e.count,
      completed: e.completed,
      completionRate: e.startedCount === 0 ? null : e.completed / e.startedCount,
    }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
  const mostEffective = [...interventions]
    .filter((i) => i.completionRate !== null)
    .sort(
      (a, b) =>
        (b.completionRate as number) - (a.completionRate as number) ||
        b.count - a.count,
    )
    .slice(0, 5);

  return {
    total: sessions.length,
    started: started.length,
    completed: sessions.filter((s) => s.status === "completed").length,
    abandoned: sessions.filter((s) => s.status === "abandoned").length,
    recovered: sessions.filter((s) => s.status === "recovered").length,
    initiationRate: initiationRate(sessions),
    avgLatencyMin: latencyToAction(sessions),
    completionRate: completionRate(sessions),
    recoveryRate: recoveryRate(sessions),
    bestHours,
    topObstacles,
    interventions,
    mostEffective,
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
