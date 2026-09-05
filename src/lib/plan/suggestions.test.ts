import { describe, expect, it } from "vitest";
import { buildImplementationPlan } from "./suggestions";

describe("buildImplementationPlan", () => {
  it("binds the action to the task's first step", () => {
    const plan = buildImplementationPlan(["phone"], {
      title: "Estudar matemática",
      firstStep: "Abrir o PDF e resolver a questão 1",
    });
    expect(plan.ifPart).toMatch(/^SE /);
    expect(plan.thenPart).toContain("Abrir o PDF e resolver a questão 1");
    expect(plan.triggerCode).toBe("phone");
  });

  it("falls back to the task title when there is no first step", () => {
    const plan = buildImplementationPlan(["tired"], { title: "Treinar" });
    expect(plan.thenPart).toContain("Treinar");
  });

  it("falls back to a generic action when there is no task", () => {
    const plan = buildImplementationPlan(["no_motivation"], null);
    expect(plan.thenPart).toMatch(/^ENTÃO /);
    expect(plan.thenPart.length).toBeGreaterThan(10);
  });
});
