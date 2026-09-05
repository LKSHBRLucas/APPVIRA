import { describe, expect, it } from "vitest";
import {
  buildDashboardReport,
  periodToRange,
  type InterventionStat,
  type ObstacleCount,
} from "./dashboard";
import type { FocusCheckinLike, SessionLike } from "./metrics";

const at = (minutesAfterPlan: number, hour = 9) =>
  new Date(Date.UTC(2026, 0, 1, hour, minutesAfterPlan)).toISOString();
const planned = at(0);

const s = (overrides: Partial<SessionLike> & { intervention_code?: string }): SessionLike & {
  intervention_code?: string;
} => ({
  id: Math.random().toString(36).slice(2),
  status: "completed",
  planned_start: planned,
  actual_start: at(5),
  duration_planned: 25,
  duration_actual: 25,
  intervention_code: "micro_start",
  ...overrides,
});

const obstacle = (code: string, count: number): ObstacleCount => ({ code, count });

const checkin = (overrides: Partial<FocusCheckinLike>): FocusCheckinLike => ({
  accomplished: "yes",
  intervention_helped: "yes",
  feeling: 4,
  ...overrides,
});

describe("periodToRange", () => {
  it("today covers the local calendar day", () => {
    const now = new Date(2026, 0, 15, 14, 30);
    const { from, to } = periodToRange("today", now);
    expect(new Date(from as string).getHours()).toBe(0);
    expect(new Date(to as string).getDate()).toBe(16);
  });

  it("7d and 30d set from and leave to open", () => {
    const now = new Date(2026, 0, 15, 14, 30);
    const r7 = periodToRange("7d", now);
    expect(r7.from).toBe(new Date(now.getTime() - 7 * 86400000).toISOString());
    expect(r7.to).toBeUndefined();
    const r30 = periodToRange("30d", now);
    expect(r30.from).toBe(new Date(now.getTime() - 30 * 86400000).toISOString());
    expect(r30.to).toBeUndefined();
  });

  it("all leaves the range open", () => {
    expect(periodToRange("all")).toEqual({ from: undefined, to: undefined });
  });
});

describe("buildDashboardReport", () => {
  it("handles no data gracefully", () => {
    const report = buildDashboardReport([], [], []);
    expect(report.total).toBe(0);
    expect(report.initiationRate).toBe(0);
    expect(report.avgLatencyMin).toBeNull();
    expect(report.bestHours).toEqual([]);
    expect(report.topObstacles).toEqual([]);
    expect(report.interventions).toEqual([]);
    expect(report.mostEffective).toEqual([]);
    expect(report.checkins.answered).toBe(0);
  });

  it("computes core rates from sessions", () => {
    const sessions = [
      s({ status: "completed" }),
      s({ actual_start: null, status: "planned" }),
      s({ status: "abandoned" }),
      s({ status: "recovered" }),
    ];
    const report = buildDashboardReport(sessions);
    expect(report.total).toBe(4);
    expect(report.started).toBe(3);
    expect(report.initiationRate).toBe(0.75);
    expect(report.completionRate).toBe(1 / 3);
    expect(report.recoveryRate).toBe(0.5);
  });

  it("averages latency to action in minutes", () => {
    const sessions = [s({ actual_start: at(10) }), s({ actual_start: at(30) })];
    expect(buildDashboardReport(sessions).avgLatencyMin).toBe(20);
  });

  it("ranks best hours by actual start, capped at 5", () => {
    const sessions = [
      s({ actual_start: at(1, 8) }),
      s({ actual_start: at(2, 8) }),
      s({ actual_start: at(3, 20) }),
      s({ actual_start: at(4, 14) }),
      s({ actual_start: at(5, 14) }),
      s({ actual_start: at(6, 14) }),
      s({ actual_start: at(7, 14) }),
    ];
    const { bestHours } = buildDashboardReport(sessions);
    expect(bestHours[0]).toEqual({ hour: 14, count: 4 });
    expect(bestHours.length).toBeLessThanOrEqual(5);
  });

  it("sorts top obstacles by count", () => {
    const report = buildDashboardReport([], [
      obstacle("phone", 2),
      obstacle("tired", 5),
      obstacle("anxious", 1),
    ]);
    expect(report.topObstacles[0]).toEqual({ code: "tired", count: 5 });
  });

  it("aggregates intervention usage and effectiveness", () => {
    const sessions = [
      s({ intervention_code: "micro_start", status: "completed" }),
      s({ intervention_code: "micro_start", status: "completed" }),
      s({ intervention_code: "first_step", status: "abandoned" }),
      s({ intervention_code: "first_step", status: "completed" }),
    ];
    const report = buildDashboardReport(sessions);
    const byCode = new Map(report.interventions.map((i: InterventionStat) => [i.code, i]));
    const micro = byCode.get("micro_start")!;
    const first = byCode.get("first_step")!;
    expect(micro.count).toBe(2);
    expect(micro.completionRate).toBe(1);
    expect(first.completionRate).toBe(0.5);
    // mostEffective ranks micro_start first
    expect(report.mostEffective[0].code).toBe("micro_start");
    expect(report.mostEffective[0].name).toBe("Micro-start");
  });

  it("excludes unstarted interventions from effectiveness", () => {
    const sessions = [s({ intervention_code: "micro_start", actual_start: null, status: "planned" })];
    const report = buildDashboardReport(sessions);
    expect(report.interventions[0].completionRate).toBeNull();
    expect(report.mostEffective).toEqual([]);
  });

  it("summarizes check-in answers", () => {
    const checkins = [
      checkin({}),
      checkin({ intervention_helped: "no" }),
      checkin({ accomplished: "no", feeling: 1 }),
      checkin({ accomplished: null, intervention_helped: null, feeling: null }),
    ];
    const { checkins: stats } = buildDashboardReport([], [], checkins);
    expect(stats.answered).toBe(3);
    expect(stats.accomplishmentRate).toBeCloseTo(2 / 3);
    expect(stats.helpRate).toBeCloseTo(2 / 3);
    expect(stats.avgFeeling).toBe(3);
  });
});
