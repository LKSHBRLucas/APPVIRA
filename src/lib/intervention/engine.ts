import { INTERVENTION_CATALOG } from "./catalog";
import type { InterventionPlan, ObstacleCode, ObstacleInput } from "./types";

type Engine = Record<
  ObstacleCode,
  (input: ObstacleInput) => InterventionPlan
>;

const byCode = (code: keyof typeof INTERVENTION_CATALOG) =>
  INTERVENTION_CATALOG[code];

/**
 * Deterministic rule-based engine: maps an obstacle (plus optional context like
 * energy or the task's first step) to a single intervention and a concrete CTA.
 * Pure function — no I/O, testable.
 */
const engine: Engine = {
  task_too_big: ({ task }) => ({
    intervention: byCode("micro_start"),
    message:
      "A tarefa parece grande porque você está tentando enxergar tudo de uma vez. Reduza para uma sessão mínima.",
    ctaLabel: "Começar com 15 min",
    firstStep: task?.firstStep ?? "Fazer apenas o início da tarefa por 15 minutos",
  }),

  no_start_point: ({ task }) => ({
    intervention: byCode("first_step"),
    message:
      "Falta um ponto de partida concreto. Vamos definir uma ação física e observável.",
    ctaLabel: "Definir e começar o primeiro passo",
    firstStep:
      task?.firstStep ?? "Escolher a primeira ação física (ex.: abrir o arquivo, montar o material)",
  }),

  phone: () => ({
    intervention: byCode("distraction_removal"),
    message:
      "O celular está roubando a sua atenção. Remova-o do alcance antes de começar.",
    ctaLabel: "Guardar o celular e iniciar",
  }),

  distracted: () => ({
    intervention: byCode("distraction_removal"),
    message:
      "Muitos estímulos competem com a tarefa. Reduza os concorrentes antes de começar.",
    ctaLabel: "Ativar modo foco e iniciar",
  }),

  tired: ({ energy }) => ({
    intervention: byCode("micro_start"),
    message:
      "Cansaço não precisa virar desistência. Uma sessão mínima exige menos energia do que você imagina.",
    ctaLabel: "Começar com 5–15 min",
    ...(energy !== undefined && energy <= 2
      ? { firstStep: "Sessão mínima de 5 minutos — só para destravar" }
      : {}),
  }),

  no_motivation: ({ note }) => {
    if (note && hasRecurrence(note)) {
      return {
        intervention: byCode("implementation_intention"),
        message:
          "Esse bloqueio se repete nos mesmos momentos. Automatize a decisão antes que ela aconteça.",
        ctaLabel: "Criar plano e começar",
        firstStep: "Escrever o plano: SE [situação], ENTÃO [primeira ação]",
      };
    }
    return {
      intervention: byCode("micro_start"),
      message:
        "Não dá para esperar a motivação aparecer. A motivação vem depois de começar — reduza a barreira.",
      ctaLabel: "Começar com 5 min",
    };
  },

  perfectionism: () => ({
    intervention: byCode("cognitive_restructuring"),
    message:
      "Feito é melhor que perfeito. Defina a versão mínima aceitável de hoje.",
    ctaLabel: "Redefinir para a versão mínima",
    firstStep: "Escrever qual é a versão mínima aceitável da tarefa",
  }),

  fear_of_failure: () => ({
    intervention: byCode("cognitive_restructuring"),
    message:
      "Errar faz parte do processo. O objetivo agora é só dar o primeiro passo, não acertar de primeira.",
    ctaLabel: "Começar mesmo assim",
    firstStep: "Dar o primeiro passo sem exigir resultado perfeito",
  }),

  anxious: () => ({
    intervention: byCode("cognitive_restructuring"),
    message:
      "Ansiedade costuma vir de exigência alta. Reduza a meta de hoje para algo iniciável.",
    ctaLabel: "Reduzir a meta e começar",
    firstStep: "Dividir a tarefa em um pedaço pequeno e iniciável",
  }),

  no_environment: () => ({
    intervention: byCode("restructuring"),
    message:
      "O ambiente está trabalhando contra você. Faça uma mudança física imediata.",
    ctaLabel: "Reestruturar o ambiente",
    firstStep: "Deixar o material à vista e fora do alcance de distrações",
  }),

  bad_time: () => ({
    intervention: byCode("replan"),
    message:
      "O horário não combina com o seu momento. Mova a atividade, não a abandone.",
    ctaLabel: "Reagendar para agora",
  }),

  other: ({ note }) => {
    if (note && hasRecurrence(note)) {
      return {
        intervention: byCode("implementation_intention"),
        message:
          "O padrão se repete. Automatize a decisão com um plano SE → ENTÃO antes do gatilho.",
        ctaLabel: "Criar plano e começar",
        firstStep: "Escrever: SE [situação], ENTÃO [primeira ação]",
      };
    }
    return {
      intervention: byCode("micro_start"),
      message:
        "Vamos simplificar: comece com uma sessão mínima e veja o que acontece.",
      ctaLabel: "Começar com 10 min",
    };
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

export function pickIntervention(input: ObstacleInput): InterventionPlan {
  const plan = engine[input.code](input);
  return {
    ...plan,
    firstStep: plan.firstStep ?? input.task?.firstStep ?? undefined,
  };
}
