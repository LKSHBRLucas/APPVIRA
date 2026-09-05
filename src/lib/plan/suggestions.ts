import type { ProcrastinationProfileCode } from "@/lib/behaviors/profiles";
import type { BehaviorInsights } from "@/lib/behaviors/insights";
import type { ObstacleCode } from "@/lib/intervention/types";
import { OBSTACLE_TO_PROFILE } from "@/lib/behaviors/profiles";

export interface PlanSuggestion {
  ifPart: string;
  thenPart: string;
  triggerCode: string | null;
}

export interface TaskContext {
  title: string;
  firstStep?: string | null;
}

/**
 * Builds a concrete SE → ENTÃO implementation plan from an abstract task.
 * The trigger comes from the procrastination profile (rule-based); the action
 * is bound to the task's first step when available, otherwise to a concrete,
 * observable behavior. Returns the plan plus the normalized SE/ENTÃO halves
 * ready to edit in the UI.
 */
export function buildImplementationPlan(
  obstacleCodes: ObstacleCode[],
  task?: TaskContext | null,
): PlanSuggestion {
  const primary = obstacleCodes[0] ?? "other";
  const base =
    suggestIntentions(OBSTACLE_TO_PROFILE[primary], null)[0] ??
    ({
      ifPart: `SE eu perceber que estou travando com "${primary.replaceAll("_", " ")}"`,
      thenPart: `ENTÃO abro a tarefa "${task?.title ?? "atual"}" e começo por 5 minutos`,
      triggerCode: primary,
    } satisfies PlanSuggestion);

  const taskName = task?.title?.trim();
  const step = task?.firstStep?.trim();

  const thenPart = step
    ? `ENTÃO executo o primeiro passo: ${step}`
    : taskName
      ? `ENTÃO abro "${taskName}" e faço 5 minutos`
      : base.thenPart.replace(/^ENTÃO /i, "ENTÃO abro a tarefa e faço 5 minutos");

  const ifPart = base.ifPart.replace(/^SE /i, "SE ");

  return { ifPart, thenPart, triggerCode: primary };
}

/**
 * Rule-based suggestion of implementation intentions (SE → ENTÃO), adapted to
 * the user's procrastination profile and behavioral insights. Pure function.
 */
export function suggestIntentions(
  profile: ProcrastinationProfileCode | null | undefined,
  insights?: BehaviorInsights | null,
): PlanSuggestion[] {
  const suggestions: PlanSuggestion[] = [];
  const bestHour = insights?.bestHour?.hour;

  if (bestHour !== undefined && bestHour !== null) {
    suggestions.push({
      ifPart: `SE forem ${String(bestHour).padStart(2, "0")}:00 e eu estiver em casa`,
      thenPart: "ENTÃO abro a tarefa e faço o primeiro passo por 5 minutos",
      triggerCode: "time",
    });
  }

  switch (profile) {
    case "distraction":
      suggestions.push({
        ifPart: "SE eu pegar o celular sem querer",
        thenPart: "ENTÃO coloco ele em outro cômodo e volto para a tarefa",
        triggerCode: "phone",
      });
      break;
    case "demand":
      suggestions.push({
        ifPart: "SE eu sentir que precisa ficar perfeito",
        thenPart: "ENTÃO escrevo a versão mínima aceitável e começo por ela",
        triggerCode: "perfectionism",
      });
      break;
    case "initiation":
      suggestions.push({
        ifPart: "SE eu não souber por onde começar",
        thenPart: "ENTÃO defino e executo o primeiro passo físico da tarefa",
        triggerCode: "no_start_point",
      });
      break;
    case "low_energy":
      suggestions.push({
        ifPart: "SE eu estiver cansado ao chegar em casa",
        thenPart: "ENTÃO faço 5 minutos da tarefa antes de sentar no sofá",
        triggerCode: "tired",
      });
      break;
    case "environment":
      suggestions.push({
        ifPart: "SE o horário planejado não funcionar",
        thenPart: "ENTÃO reagendo a tarefa para a próxima janela livre",
        triggerCode: "bad_time",
      });
      break;
    default:
      break;
  }

  return suggestions;
}
