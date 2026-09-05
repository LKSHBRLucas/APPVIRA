import { INTERVENTION_CATALOG } from "./catalog";
import type {
  InterventionCode,
  InterventionPlan,
  InterventionSelector,
  ObstacleCode,
  ObstacleInput,
} from "./types";

const byCode = (code: InterventionCode) => INTERVENTION_CATALOG[code];

/**
 * Deterministic rule engine (V2 — combination-aware).
 *
 * Each selected obstacle casts weighted votes toward one or more interventions.
 * The engine sums the votes across the whole combination (up to 3 obstacles)
 * and the intervention with the highest score wins. Ties are broken by a fixed
 * priority order (FIRST_WINS), so the outcome is 100% deterministic.
 *
 * A recurring-failure marker in the note adds a bonus vote for
 * implementation_intention — the only free-text signal used today. Swapping
 * this rule table for a data-driven model later requires no flow changes: the
 * engine surface (`pickIntervention`) and the persisted inputs (matchedObstacles
 * in session_obstacles) already capture everything a model would need.
 */
const OBSTACLE_VOTES: Record<
  ObstacleCode,
  Array<[InterventionCode, number]>
> = {
  task_too_big: [
    ["micro_start", 3],
    ["first_step", 1],
  ],
  no_start_point: [
    ["first_step", 3],
    ["micro_start", 1],
  ],
  phone: [["distraction_removal", 3]],
  distracted: [
    ["distraction_removal", 3],
    ["restructuring", 1],
  ],
  tired: [["micro_start", 3]],
  no_motivation: [
    ["micro_start", 3],
    ["implementation_intention", 1],
  ],
  perfectionism: [["cognitive_restructuring", 3]],
  fear_of_failure: [
    ["cognitive_restructuring", 3],
    ["first_step", 1],
  ],
  anxious: [
    ["cognitive_restructuring", 3],
    ["micro_start", 1],
  ],
  no_environment: [
    ["restructuring", 3],
    ["distraction_removal", 1],
  ],
  bad_time: [["replan", 3]],
  other: [["micro_start", 2]],
};

/** Deterministic tie-break: highest priority wins when scores are equal. */
const FIRST_WINS: InterventionCode[] = [
  "distraction_removal",
  "cognitive_restructuring",
  "first_step",
  "implementation_intention",
  "micro_start",
  "restructuring",
  "replan",
  "recovery",
];

const MESSAGES: Record<InterventionCode, { message: string; ctaLabel: string }> = {
  micro_start: {
    message:
      "A barreira fica menor quando a meta fica pequena. Vamos fazer uma sessão mínima agora.",
    ctaLabel: "Começar com 15 min",
  },
  first_step: {
    message:
      "Falta um ponto de partida concreto. Vamos definir uma ação física e observável.",
    ctaLabel: "Definir e começar o primeiro passo",
  },
  implementation_intention: {
    message:
      "Esse bloqueio se repete nos mesmos momentos. Automatize a decisão com um plano SE → ENTÃO.",
    ctaLabel: "Criar plano e começar",
  },
  distraction_removal: {
    message:
      "Estímulos concorrentes estão roubando a sua atenção. Remova a distração antes de começar.",
    ctaLabel: "Guardar o celular e iniciar",
  },
  cognitive_restructuring: {
    message:
      "Exigência alta aumenta o custo de começar. Redefina a meta para a versão mínima aceitável.",
    ctaLabel: "Reduzir a meta e começar",
  },
  restructuring: {
    message:
      "O ambiente está trabalhando contra você. Faça uma mudança física imediata.",
    ctaLabel: "Reestruturar o ambiente",
  },
  replan: {
    message:
      "O horário não combina com o seu momento. Mova a atividade, não a abandone.",
    ctaLabel: "Reagendar para agora",
  },
  recovery: {
    message: "Vamos recuperar a sessão com uma versão menor, sem culpa.",
    ctaLabel: "Recuperar com 5 min",
  },
};

const RECURRENCE_MARKERS = [
  "sempre",
  "todo dia",
  "todos os dias",
  "toda vez",
  "de novo",
  "novamente",
  "repetidamente",
  "direto",
  "recorrente",
  "nunca consigo",
  "toda semana",
];

/** Detects language suggesting a recurring failure pattern in the note. */
export function hasRecurrence(text: string): boolean {
  const lower = text.toLowerCase();
  return RECURRENCE_MARKERS.some((marker) => lower.includes(marker));
}

function normalizeCodes(input: ObstacleInput): ObstacleCode[] {
  const codes = input.codes ?? (input.code ? [input.code] : []);
  // Keep the first occurrence, cap at 3, drop "other" only when real obstacles exist.
  const seen = new Set<ObstacleCode>();
  const unique: ObstacleCode[] = [];
  for (const code of codes) {
    if (seen.has(code)) continue;
    seen.add(code);
    unique.push(code);
    if (unique.length === 3) break;
  }
  if (unique.includes("other") && unique.length > 1) {
    return unique.filter((c) => c !== "other");
  }
  return unique;
}

/** Votes for the picked intervention, plus ruleId for provenance. */
export function pickIntervention(input: ObstacleInput): InterventionPlan {
  const codes = normalizeCodes(input);
  const effective = codes.length > 0 ? codes : (["other"] as ObstacleCode[]);

  const scores = new Map<InterventionCode, number>();
  for (const code of effective) {
    for (const [intervention, weight] of OBSTACLE_VOTES[code]) {
      scores.set(intervention, (scores.get(intervention) ?? 0) + weight);
    }
  }

  // Free-text recurrence signal adds a deterministic bonus vote.
  if (input.note && hasRecurrence(input.note)) {
    scores.set(
      "implementation_intention",
      (scores.get("implementation_intention") ?? 0) + 2,
    );
  }

  // Saved-intention signal: if the user already has an active implementation
  // intention whose trigger matches a selected obstacle, boost
  // implementation_intention so stored plans influence future combinations.
  const triggers = new Set(
    (input.intentionTriggers ?? []).filter((t): t is string => !!t),
  );
  const matchedIntention = effective.some((code) => triggers.has(code));
  if (matchedIntention) {
    scores.set(
      "implementation_intention",
      (scores.get("implementation_intention") ?? 0) + 2,
    );
  }

  let winner: InterventionCode = "micro_start";
  let best = -1;
  for (const intervention of FIRST_WINS) {
    const score = scores.get(intervention) ?? 0;
    if (score > best) {
      best = score;
      winner = intervention;
    }
  }

  const copy = MESSAGES[winner];
  const plan: InterventionPlan = {
    intervention: byCode(winner),
    message: copy.message,
    ctaLabel: copy.ctaLabel,
    firstStep: input.task?.firstStep ?? undefined,
    matchedObstacles: effective,
    ruleId: `rules_v2:${[...effective].sort().join("+")}${matchedIntention ? ":ii" : ""}`,
  };

  if (winner === "micro_start") {
    plan.message =
      input.note && hasRecurrence(input.note)
        ? "O padrão se repete: comece pequeno e quebre o ciclo hoje."
        : plan.message;
  }

  return plan;
}

/**
 * The current selector: deterministic rules. This is the single seam where a
 * data-driven/AI selector can be swapped in later — the flow only talks to
 * getInterventionSelector(), never to pickIntervention directly.
 */
export const rulesSelector: InterventionSelector = {
  id: "rules-v2",
  pick: pickIntervention,
};

/** Active intervention selector. Swap this return to migrate to an AI model. */
export function getInterventionSelector(): InterventionSelector {
  return rulesSelector;
}
