import { supabase } from "@/integrations/supabase/client";
import type { PersonalizationContext } from "@/lib/personalization/context";
import { buildPlan, rulesSelector } from "./engine";
import { INTERVENTION_CATALOG } from "./catalog";
import type {
  InterventionCode,
  InterventionPlan,
  InterventionSelector,
  ObstacleInput,
} from "./types";

/** Mirrors the backend function's catalog of valid codes. */
const VALID_CODES = Object.keys(INTERVENTION_CATALOG) as InterventionCode[];

/** Provenance tag written into the plan when the AI model picks. */
const MODEL_TAG = "model:gpt-5.6-luna";

export interface PersonalizedPick {
  plan: InterventionPlan;
  personalized: boolean;
  rationale?: string;
}

function isInterventionCode(value: unknown): value is InterventionCode {
  return typeof value === "string" && (VALID_CODES as string[]).includes(value);
}

/**
 * Personalized intervention selection: calls the `intervention-select`
 * backend function with the user's real behavior context, then validates the
 * model's pick against the catalog. On ANY failure (network, invalid code,
 * service error) it falls back to the deterministic rules so the flow never
 * blocks the user.
 */
export async function pickPersonalized(
  input: ObstacleInput,
  context: PersonalizationContext,
): Promise<PersonalizedPick> {
  const obstacles = input.codes ?? (input.code ? [input.code] : ["other"]);

  try {
    const { data, error } = await supabase.functions.invoke("intervention-select", {
      body: {
        obstacles,
        note: input.note ?? null,
        task: input.task
          ? {
              title: input.task.title,
              first_step: input.task.firstStep ?? null,
              duration_min: input.task.durationMin ?? null,
            }
          : null,
        context,
      },
    });

    if (error) throw new Error(error.message ?? "intervention-select failed");
    if (!data || !isInterventionCode(data.code)) throw new Error("invalid intervention code");

    const rationale = typeof data.rationale === "string" ? data.rationale.trim() : "";
    const plan = buildPlan(data.code, input, rationale || undefined);
    plan.ruleId = MODEL_TAG;

    return { plan, personalized: true, rationale };
  } catch {
    const plan = rulesSelector.pick(input);
    return { plan, personalized: false };
  }
}

/**
 * The active selector for the stuck flow: AI-backed personalization with a
 * deterministic safety net. `pick` remains the pure rules path for sync callers.
 */
export const personalizedSelector: InterventionSelector = {
  id: "personalized-v1",
  pick: (input) => rulesSelector.pick(input),
  pickPersonalized: async (input, context) => {
    const { plan, personalized } = await pickPersonalized(input, context);
    return { plan, personalized };
  },
};
