import { describe, expect, it } from "vitest";
import {
  getInterventionSelector,
  hasRecurrence,
  pickIntervention,
  pickNextIntervention,
  rulesSelector,
} from "./engine";
import type { ObstacleInput } from "./types";

const base = (overrides: Partial<ObstacleInput>): ObstacleInput => ({
  code: "other",
  ...overrides,
});

describe("intervention selector seam (AI swap-ready)", () => {
  it("exposes the rules selector as the active one", () => {
    expect(getInterventionSelector().id).toBe("rules-v2");
    expect(rulesSelector.pick).toBe(pickIntervention);
  });

  it("selects through the interface with the same deterministic result", () => {
    const viaInterface = getInterventionSelector().pick(
      base({ code: "task_too_big" }),
    );
    expect(viaInterface).toEqual(pickIntervention(base({ code: "task_too_big" })));
    expect(viaInterface.ruleId).toContain("rules_v2");
  });
});

describe("pickIntervention (single obstacle, backward compatible)", () => {
  it("maps task_too_big to micro_start", () => {
    const plan = pickIntervention(base({ code: "task_too_big" }));
    expect(plan.intervention.code).toBe("micro_start");
    expect(plan.ctaLabel).toBeTruthy();
  });

  it("maps no_start_point to first_step and uses the task first step", () => {
    const plan = pickIntervention(
      base({ code: "no_start_point", task: { id: "t1", title: "Estudar", firstStep: "Abrir a aula 3" } })
    );
    expect(plan.intervention.code).toBe("first_step");
    expect(plan.firstStep).toBe("Abrir a aula 3");
  });

  it("maps phone and distracted to distraction_removal", () => {
    expect(pickIntervention(base({ code: "phone" })).intervention.code).toBe("distraction_removal");
    expect(pickIntervention(base({ code: "distracted" })).intervention.code).toBe("distraction_removal");
  });

  it("maps perfectionism, fear_of_failure and anxious to cognitive_restructuring", () => {
    for (const code of ["perfectionism", "fear_of_failure", "anxious"] as const) {
      expect(pickIntervention(base({ code })).intervention.code).toBe("cognitive_restructuring");
    }
  });

  it("maps bad_time to replan and no_environment to restructuring", () => {
    expect(pickIntervention(base({ code: "bad_time" })).intervention.code).toBe("replan");
    expect(pickIntervention(base({ code: "no_environment" })).intervention.code).toBe("restructuring");
  });

  it("maps other to micro_start as the default", () => {
    expect(pickIntervention(base({ code: "other" })).intervention.code).toBe("micro_start");
  });

  it("always returns a message, ctaLabel and matchedObstacles in pt-BR", () => {
    for (const code of [
      "tired",
      "no_motivation",
      "phone",
      "task_too_big",
      "no_start_point",
      "anxious",
      "fear_of_failure",
      "perfectionism",
      "distracted",
      "no_environment",
      "bad_time",
      "other",
    ] as const) {
      const plan = pickIntervention(base({ code }));
      expect(plan.message.length).toBeGreaterThan(0);
      expect(plan.ctaLabel.length).toBeGreaterThan(0);
      expect(plan.matchedObstacles).toContain(code);
      expect(plan.ruleId).toContain("rules_v2");
    }
  });
});

describe("pickIntervention (multi-obstacle combination)", () => {
  it("sums votes and picks the highest-scoring intervention", () => {
    // phone(3 distraction) + perfectionism(3 cognitive) + no_start_point(3 first_step)
    // all tie at 3 → FIRST_WINS: distraction_removal wins.
    const plan = pickIntervention(
      base({ codes: ["phone", "perfectionism", "no_start_point"] }),
    );
    expect(plan.intervention.code).toBe("distraction_removal");
    expect(plan.matchedObstacles).toHaveLength(3);
  });

  it("reinforces the same intervention when obstacles agree", () => {
    // tired(3 micro_start) + no_motivation(3 micro_start) = micro_start 6.
    const plan = pickIntervention(base({ codes: ["tired", "no_motivation"] }));
    expect(plan.intervention.code).toBe("micro_start");
  });

  it("first_step beats micro_start on no_start_point + task_too_big", () => {
    // no_start_point(3 first_step) vs task_too_big(3 micro_start) → tie.
    // FIRST_WINS: first_step comes before micro_start.
    const plan = pickIntervention(base({ codes: ["no_start_point", "task_too_big"] }));
    expect(plan.intervention.code).toBe("first_step");
  });

  it("caps the combination at 3 obstacles and dedupes", () => {
    const plan = pickIntervention(
      base({ codes: ["phone", "phone", "tired", "no_motivation", "bad_time"] }),
    );
    expect(plan.matchedObstacles).toHaveLength(3);
    expect(plan.matchedObstacles.filter((c) => c === "phone")).toHaveLength(1);
  });

  it("drops 'other' when real obstacles were also selected", () => {
    const plan = pickIntervention(base({ codes: ["other", "task_too_big"] }));
    expect(plan.matchedObstacles).not.toContain("other");
    expect(plan.intervention.code).toBe("micro_start");
  });

  it("still returns an 'other' default when nothing real is selected", () => {
    const plan = pickIntervention(base({ codes: ["other"] }));
    expect(plan.matchedObstacles).toEqual(["other"]);
    expect(plan.intervention.code).toBe("micro_start");
  });
});

describe("recurrence → implementation_intention", () => {
  it("uses implementation_intention when the note signals recurrence", () => {
    for (const code of ["no_motivation", "other"] as const) {
      const plan = pickIntervention(
        base({ code, note: "Isso acontece toda vez que chego em casa" }),
      );
      expect(plan.intervention.code).toBe("implementation_intention");
      expect(plan.ctaLabel).toBe("Criar plano e começar");
    }
  });

  it("keeps micro_start when the note does not signal recurrence", () => {
    const plan = pickIntervention(
      base({ code: "no_motivation", note: "hoje só não estou a fim" }),
    );
    expect(plan.intervention.code).toBe("micro_start");
  });

  it("detects recurrence markers case-insensitively", () => {
    expect(hasRecurrence("SEMPRE travo")).toBe(true);
    expect(hasRecurrence("nunca consigo começar")).toBe(true);
    expect(hasRecurrence("um dia normal")).toBe(false);
  });
});

describe("saved implementation intentions influence the engine", () => {
  it("boosts implementation_intention when a selected obstacle matches a saved trigger", () => {
    // no_motivation alone votes micro_start(3) vs intention(1). With a saved
    // plan triggered by no_motivation, intention receives +2 → 3 (tie with
    // micro_start) and FIRST_WINS picks implementation_intention.
    const plan = pickIntervention(
      base({ code: "no_motivation", intentionTriggers: ["no_motivation"] }),
    );
    expect(plan.intervention.code).toBe("implementation_intention");
    expect(plan.ruleId).toContain(":ii");
  });

  it("does not boost when the saved trigger does not match the selection", () => {
    const plan = pickIntervention(
      base({ code: "no_motivation", intentionTriggers: ["phone"] }),
    );
    expect(plan.intervention.code).toBe("micro_start");
  });

  it("ignores null/empty saved triggers", () => {
    const plan = pickIntervention(
      base({
        code: "no_motivation",
        intentionTriggers: [null, "", "no_motivation"],
      }),
    );
    expect(plan.intervention.code).toBe("implementation_intention");
  });
});

describe("pickNextIntervention (escalation after a failed check-in)", () => {
  it("excludes the already-tried intervention and picks the next best", () => {
    // task_too_big alone: micro_start(3) > first_step(1). Excluding
    // micro_start (already tried and unhelpful) should surface first_step.
    const plan = pickNextIntervention(base({ code: "task_too_big" }), [
      "micro_start",
    ]);
    expect(plan.intervention.code).toBe("first_step");
    expect(plan.intervention.code).not.toBe("micro_start");
    expect(plan.ruleId).toContain("rules_v2_escalated");
  });

  it("never returns an excluded code even with a combination of obstacles", () => {
    const plan = pickNextIntervention(
      base({ codes: ["phone", "distracted"] }),
      ["distraction_removal"],
    );
    expect(plan.intervention.code).not.toBe("distraction_removal");
  });

  it("falls back to recovery when every scored option is excluded", () => {
    const plan = pickNextIntervention(base({ code: "phone" }), [
      "distraction_removal",
    ]);
    expect(plan.intervention.code).toBe("recovery");
  });

  it("falls back to micro_start when recovery is also excluded", () => {
    const plan = pickNextIntervention(base({ code: "phone" }), [
      "distraction_removal",
      "recovery",
    ]);
    expect(plan.intervention.code).toBe("micro_start");
  });

  it("keeps working across repeated escalations without ever repeating a code", () => {
    const tried: string[] = [];
    let excluded: Parameters<typeof pickNextIntervention>[1] = [];
    for (let i = 0; i < 4; i += 1) {
      const plan = pickNextIntervention(
        base({ codes: ["task_too_big", "no_start_point"] }),
        excluded,
      );
      expect(tried).not.toContain(plan.intervention.code);
      tried.push(plan.intervention.code);
      excluded = [...excluded, plan.intervention.code];
    }
  });
});
