import type { SessionWithTask } from "@/lib/data/sessions";

export interface BehaviorInsights {
  bestHour: { hour: number; count: number } | null;
  topObstacle: { code: string; count: number } | null;
  bestDurationRange: { label: string; rate: number; count: number } | null;
  initiationRate: number;
}

export interface WeeklyInsights {
  startedCount: number;
  completedCount: number;
  recoveredCount: number;
  abandonedCount: number;
  totalPlanned: number;
}

const hourBucket = (iso: string): number => new Date(iso).getHours();

/**
 * Rule-based insights from a user's sessions. Pure function — testable,
 * no I/O. Returns null fields when there isn't enough data.
 */
export function deriveInsights(sessions: SessionWithTask[]): BehaviorInsights {
  const started = sessions.filter((s) => s.actual_start !== null);

  // Best hour: hour bucket with most task_started events (started sessions).
  const hourCounts = new Map<number, number>();
  for (const s of started) {
    const h = hourBucket(s.actual_start as string);
    hourCounts.set(h, (hourCounts.get(h) ?? 0) + 1);
  }
  let bestHour: BehaviorInsights["bestHour"] = null;
  let bestCount = 0;
  for (const [hour, count] of hourCounts) {
    if (count > bestCount) {
      bestCount = count;
      bestHour = { hour, count };
    }
  }

  // Top obstacle among sessions that recorded one.
  const obstacleCounts = new Map<string, number>();
  for (const s of sessions) {
    if (!s.obstacle_code) continue;
    obstacleCounts.set(s.obstacle_code, (obstacleCounts.get(s.obstacle_code) ?? 0) + 1);
  }
  let topObstacle: BehaviorInsights["topObstacle"] = null;
  let topCount = 0;
  for (const [code, count] of obstacleCounts) {
    if (count > topCount) {
      topCount = count;
      topObstacle = { code, count };
    }
  }

  // Duration range with the best completion rate.
  const ranges: Record<string, number[]> = {};
  for (const s of started) {
    const d = s.duration_planned ?? s.duration_actual ?? 25;
    const key = d <= 15 ? "≤15 min" : d <= 30 ? "16–30 min" : "30+ min";
    (ranges[key] ??= []).push(s.status === "completed" ? 1 : 0);
  }
  let bestDurationRange: BehaviorInsights["bestDurationRange"] = null;
  for (const [label, values] of Object.entries(ranges)) {
    const rate = values.reduce((a, b) => a + b, 0) / values.length;
    if (!bestDurationRange || rate > bestDurationRange.rate) {
      bestDurationRange = { label, rate, count: values.length };
    }
  }

  return {
    bestHour,
    topObstacle,
    bestDurationRange,
    initiationRate: sessions.length === 0 ? 0 : started.length / sessions.length,
  };
}

export function deriveWeekly(sessions: SessionWithTask[]): WeeklyInsights {
  return {
    startedCount: sessions.filter((s) => s.actual_start !== null).length,
    completedCount: sessions.filter((s) => s.status === "completed").length,
    recoveredCount: sessions.filter((s) => s.status === "recovered").length,
    abandonedCount: sessions.filter((s) => s.status === "abandoned").length,
    totalPlanned: sessions.length,
  };
}
