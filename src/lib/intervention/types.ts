/** Domain types for the intervention engine (VIRA). */

/** Obstacle codes — mirrored from the `obstacles` catalog seed. */
export type ObstacleCode =
  | "tired"
  | "no_motivation"
  | "phone"
  | "task_too_big"
  | "no_start_point"
  | "anxious"
  | "fear_of_failure"
  | "perfectionism"
  | "distracted"
  | "no_environment"
  | "bad_time"
  | "other";

/** Intervention codes — mirrored from the `interventions` catalog seed. */
export type InterventionCode =
  | "micro_start"
  | "first_step"
  | "implementation_intention"
  | "restructuring"
  | "distraction_removal"
  | "cognitive_restructuring"
  | "recovery"
  | "replan";

export interface InterventionDefinition {
  code: InterventionCode;
  name: string;
  mechanism: string;
  /** Guidance rendered to the user, pt-BR, action-oriented. */
  description: string;
  /** Suggested minimum session length in minutes. */
  durationMin: number;
}

/** What the engine returns for a given obstacle. */
export interface InterventionPlan {
  intervention: InterventionDefinition;
  /** Short user-facing message explaining the pick, pt-BR. */
  message: string;
  /** Label for the primary action button, pt-BR. */
  ctaLabel: string;
  /** Concrete first step suggested by the intervention, if any. */
  firstStep?: string;
  /** Obstacles that were analyzed (up to 3), persisted for analytics. */
  matchedObstacles: ObstacleCode[];
  /** Deterministic rule identifier that produced this pick. */
  ruleId: string;
}

export interface ObstacleInput {
  /** Selected obstacle(s). Single code for backward compatibility. */
  code?: ObstacleCode;
  /** Combination of up to 3 obstacles — the engine analyzes this list. */
  codes?: ObstacleCode[];
  /** User-typed note / free text from step 1 of the stuck flow. */
  note?: string;
  /** Task context when available. */
  task?: {
    id: string;
    title: string;
    firstStep?: string | null;
    durationMin?: number | null;
  };
  /** Current energy level 1–5 when provided by a check-in. */
  energy?: number;
}
