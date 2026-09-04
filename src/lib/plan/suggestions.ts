import type { ProcrastinationProfileCode } from "@/lib/behaviors/profiles";
import type { BehaviorInsights } from "@/lib/behaviors/insights";

export interface PlanSuggestion {
  ifPart: string;
  thenPart: string;
  triggerCode: string | null;
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
