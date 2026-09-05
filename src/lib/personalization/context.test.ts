import { describe, expect, it } from "vitest";
import { buildPersonalizationContext } from "./context";
import type { FocusCheckinLike, SessionLike } from "@/lib/metrics/metrics";

const at = (minutesAfterPlan: number) =>
  new Date(Date.UTC(2026, 0, 1, 9, minutesAfterPlan)).toISOString();

const s = (overrides: Partial<SessionLike> & { intervention_code?: string; obstacle_code?: string }): SessionLike => ({
  id: Math.random().toString(36).slice(2),
  status: "completed",
  planned_start: at(0),
  actual_start: at(5),
  duration_planned: 25,
  duration_actual: 25,
  intervention_code: "micro_start",
  obstacle_code: "tired",
  ...overrides,
});

const checkin = (overrides: Partial<FocusCheckinLike>): FocusCheckinLike => ({
  accomplished: "yes",
  intervention_helped: "yes",
  feeling: 4,
  ...overrides,
});

describe("buildPersonalizationContext", () => {
  it("handles empty history without crashing", () => {
    const ctx = buildPersonalizationContext([], []);
    expect(ctx.totalSessions).toBe(0);
    expect(ctx.startedSessions).toBe(0);
    expect(ctx.obstacleFrequency).toEqual([]);
    expect(ctx.interventionHistory).toEqual([]);
    expect(ctx.checkins.answered).toBe(0);
  });

  it("aggregates session totals and obstacle frequency", () => {
    const sessions = [
      s({ obstacle_code: "phone" }),
      s({ obstacle_code: "phone" }),
      s({ obstacle_code: "tired", status: "planned", actual_start: null }),
    ];
    const ctx = buildPersonalizationContext(sessions);
    expect(ctx.totalSessions).toBe(3);
    expect(ctx.startedSessions).toBe(2);
    expect(ctx.completedSessions).toBe(2);
    expect(ctx.obstacleFrequency[0]).toEqual({ code: "phone", count: 2 });
  });

  it("computes per-intervention completion rates from started sessions only", () => {
    const sessions = [
      s({ intervention_code: "micro_start", status: "completed" }),
      s({ intervention_code: "micro_start", status: "abandoned" }),
      s({ intervention_code: "first_step", status: "planned", actual_start: null }),
    ];
    const ctx = buildPersonalizationContext(sessions);
    const micro = ctx.interventionHistory.find((i) => i.code === "micro_start")!;
    const first = ctx.interventionHistory.find((i) => i.code === "first_step")!;
    expect(micro.count).toBe(2);
    expect(micro.completed).toBe(1);
    expect(micro.completionRate).toBe(0.5);
    // unstarted → no rate, but still counted as usage
    expect(first.count).toBe(1);
    expect(first.completionRate).toBeNull();
  });

  it("summarizes check-ins reusing the shared metric functions", () => {
    const checkins = [
      checkin({}),
      checkin({ intervention_helped: "no", feeling: 2 }),
      checkin({ accomplished: null, intervention_helped: null, feeling: null }),
    ];
    const ctx = buildPersonalizationContext([], checkins);
    expect(ctx.checkins.answered).toBe(2);
    expect(ctx.checkins.accomplishmentRate).toBe(1);
    expect(ctx.checkins.helpRate).toBe(0.5);
    expect(ctx.checkins.avgFeeling).toBe(3);
  });

  it("sorts obstacle frequency descending", () => {
    const sessions = [
      s({ obstacle_code: "tired" }),
      s({ obstacle_code: "phone" }),
      s({ obstacle_code: "phone" }),
    ];
    const ctx = buildPersonalizationContext(sessions);
    expect(ctx.obstacleFrequency.map((o) => o.code)).toEqual(["phone", "tired"]);
  });
});
