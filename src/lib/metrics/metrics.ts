/** Pure metric functions for the VIRA dashboard. */

export interface SessionLike {
  id: string;
  status: "planned" | "started" | "completed" | "abandoned" | "recovered";
  planned_start: string;
  actual_start: string | null;
  duration_planned: number;
  duration_actual: number | null;
}

/** Fraction of sessions actually started (0–1). */
export function initiationRate(sessions: SessionLike[]): number {
  if (sessions.length === 0) return 0;
  const started = sessions.filter((s) => s.actual_start !== null).length;
  return started / sessions.length;
}

/** Latency to action in minutes between planned_start and actual_start. */
export function latencyToAction(sessions: SessionLike[]): number | null {
  const latencies = sessions
    .filter((s) => s.actual_start !== null)
    .map((s) => {
      const planned = new Date(s.planned_start).getTime();
      const actual = new Date(s.actual_start as string).getTime();
      return Math.max(0, (actual - planned) / 60000);
    });
  if (latencies.length === 0) return null;
  return latencies.reduce((a, b) => a + b, 0) / latencies.length;
}

/** Fraction of started sessions that reached 'completed'. */
export function completionRate(sessions: SessionLike[]): number {
  const started = sessions.filter((s) => s.actual_start !== null);
  if (started.length === 0) return 0;
  const completed = started.filter((s) => s.status === "completed").length;
  return completed / started.length;
}

/** Fraction of non-completed sessions that were recovered. */
export function recoveryRate(sessions: SessionLike[]): number {
  const lost = sessions.filter(
    (s) => s.status === "abandoned" || s.status === "recovered",
  );
  if (lost.length === 0) return 0;
  const recovered = lost.filter((s) => s.status === "recovered").length;
  return recovered / lost.length;
}

/** Average actual duration in minutes of completed sessions. */
export function avgSessionDuration(sessions: SessionLike[]): number | null {
  const durations = sessions
    .filter((s) => s.status === "completed" && s.duration_actual !== null)
    .map((s) => s.duration_actual as number);
  if (durations.length === 0) return null;
  return durations.reduce((a, b) => a + b, 0) / durations.length;
}
