import { describe, expect, it } from "vitest";
import {
  accomplishmentRate,
  avgFeeling,
  avgSessionDuration,
  completionRate,
  initiationRate,
  interventionHelpRate,
  latencyToAction,
  recoveryRate,
  type FocusCheckinLike,
  type SessionLike,
} from "./metrics";

const at = (minutesAfterPlan: number) =>
  new Date(Date.UTC(2026, 0, 1, 9, minutesAfterPlan)).toISOString();
const planned = at(0);

const s = (overrides: Partial<SessionLike>): SessionLike => ({
  id: Math.random().toString(36).slice(2),
  status: "completed",
  planned_start: planned,
  actual_start: at(5),
  duration_planned: 25,
  duration_actual: 25,
  ...overrides,
});

describe("initiationRate", () => {
  it("returns 0 for no sessions", () => {
    expect(initiationRate([])).toBe(0);
  });

  it("counts only sessions with actual_start", () => {
    const sessions = [s({}), s({ actual_start: null })];
    expect(initiationRate(sessions)).toBe(0.5);
  });
});

describe("latencyToAction", () => {
  it("returns null when nothing started", () => {
    expect(latencyToAction([s({ actual_start: null })])).toBeNull();
  });

  it("averages the delay between planned and actual start in minutes", () => {
    const sessions = [s({ actual_start: at(10) }), s({ actual_start: at(30) })];
    expect(latencyToAction(sessions)).toBe(20);
  });
});

describe("completionRate", () => {
  it("returns 0 when nothing started", () => {
    expect(completionRate([s({ actual_start: null })])).toBe(0);
  });

  it("fractions completed over started", () => {
    const sessions = [
      s({ status: "completed" }),
      s({ status: "abandoned" }),
      s({ status: "completed" }),
      s({ status: "started" }),
    ];
    expect(completionRate(sessions)).toBe(0.5);
  });
});

describe("recoveryRate", () => {
  it("returns 0 when nothing was lost", () => {
    expect(recoveryRate([s({ status: "completed" })])).toBe(0);
  });

  it("fractions recovered over abandoned", () => {
    const sessions = [
      s({ status: "recovered" }),
      s({ status: "abandoned" }),
      s({ status: "recovered" }),
    ];
    expect(recoveryRate(sessions)).toBe(2 / 3);
  });
});

describe("avgSessionDuration", () => {
  it("averages actual durations of completed sessions", () => {
    const sessions = [s({ duration_actual: 15 }), s({ duration_actual: 35 })];
    expect(avgSessionDuration(sessions)).toBe(25);
  });

  it("returns null when no completed session has a duration", () => {
    expect(avgSessionDuration([s({ duration_actual: null })])).toBeNull();
  });
});

const checkin = (overrides: Partial<FocusCheckinLike>): FocusCheckinLike => ({
  accomplished: "yes",
  intervention_helped: "yes",
  feeling: 4,
  ...overrides,
});

describe("accomplishmentRate", () => {
  it("returns null when no check-in was answered", () => {
    expect(accomplishmentRate([])).toBeNull();
    expect(accomplishmentRate([checkin({ accomplished: null })])).toBeNull();
  });

  it("counts yes and partial as accomplished", () => {
    const checkins = [
      checkin({ accomplished: "yes" }),
      checkin({ accomplished: "partial" }),
      checkin({ accomplished: "no" }),
    ];
    expect(accomplishmentRate(checkins)).toBeCloseTo(2 / 3);
  });
});

describe("interventionHelpRate", () => {
  it("returns null when no intervention feedback was given", () => {
    expect(interventionHelpRate([checkin({ intervention_helped: null })])).toBeNull();
  });

  it("counts yes and partial as helpful", () => {
    const checkins = [
      checkin({ intervention_helped: "yes" }),
      checkin({ intervention_helped: "no" }),
      checkin({ intervention_helped: "partial" }),
    ];
    expect(interventionHelpRate(checkins)).toBeCloseTo(2 / 3);
  });
});

describe("avgFeeling", () => {
  it("returns null when no feeling was recorded", () => {
    expect(avgFeeling([checkin({ feeling: null })])).toBeNull();
  });

  it("averages the 1-5 feelings", () => {
    const checkins = [checkin({ feeling: 2 }), checkin({ feeling: 4 }), checkin({ feeling: 3 })];
    expect(avgFeeling(checkins)).toBe(3);
  });
});
