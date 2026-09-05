import { describe, expect, it } from "vitest";
import { hasRecurrence, pickIntervention } from "./engine";
import type { ObstacleInput } from "./types";

const base = (overrides: Partial<ObstacleInput>): ObstacleInput => ({
  code: "other",
  ...overrides,
});

describe("pickIntervention", () => {
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

  it("suggests a minimal 5-min session when energy is low (tired + energy 1/2)", () => {
    const plan = pickIntervention(base({ code: "tired", energy: 1 }));
    expect(plan.intervention.code).toBe("micro_start");
    expect(plan.firstStep).toContain("5 minutos");
  });

  it("maps bad_time to replan and no_environment to restructuring", () => {
    expect(pickIntervention(base({ code: "bad_time" })).intervention.code).toBe("replan");
    expect(pickIntervention(base({ code: "no_environment" })).intervention.code).toBe("restructuring");
  });

  it("maps other to micro_start as the default", () => {
    expect(pickIntervention(base({ code: "other" })).intervention.code).toBe("micro_start");
  });

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

  it("always returns a message and ctaLabel in pt-BR", () => {
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
    }
  });
});
