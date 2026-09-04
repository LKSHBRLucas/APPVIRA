import type { ObstacleCode } from "@/lib/intervention/types";

export type ProcrastinationProfileCode =
  | "distraction"
  | "demand"
  | "initiation"
  | "low_energy"
  | "environment";

export interface ProcrastinationProfile {
  code: ProcrastinationProfileCode;
  label: string;
  description: string;
}

export const PROFILE_CATALOG: Record<ProcrastinationProfileCode, ProcrastinationProfile> = {
  distraction: {
    code: "distraction",
    label: "Perfil de distração",
    description:
      "A competição por atenção (celular, ruídos, estímulos) é o que mais te trava.",
  },
  demand: {
    code: "demand",
    label: "Perfil de exigência",
    description:
      "Perfeccionismo, medo de errar ou ansiedade aumentam o custo de começar.",
  },
  initiation: {
    code: "initiation",
    label: "Perfil de iniciação",
    description:
      "Tarefas grandes ou sem ponto de partida claro travam o primeiro passo.",
  },
  low_energy: {
    code: "low_energy",
    label: "Perfil de energia",
    description:
      "Cansaço ou baixa motivação reduzem a disposição para começar.",
  },
  environment: {
    code: "environment",
    label: "Perfil de ambiente e planejamento",
    description:
      "O contexto (horário, local) trabalha contra você mais do que a tarefa.",
  },
};

/** Map an obstacle to the procrastination profile it most signals. */
export const OBSTACLE_TO_PROFILE: Record<ObstacleCode, ProcrastinationProfileCode> = {
  phone: "distraction",
  distracted: "distraction",
  perfectionism: "demand",
  fear_of_failure: "demand",
  anxious: "demand",
  task_too_big: "initiation",
  no_start_point: "initiation",
  tired: "low_energy",
  no_motivation: "low_energy",
  no_environment: "environment",
  bad_time: "environment",
  other: "initiation",
};

/**
 * Rule-based procrastination profile: the obstacle picked most often in the
 * stuck flow wins; onboarding answers seed the count once. Deterministic.
 */
export function dominantProfile(
  obstacleCounts: Partial<Record<ObstacleCode, number>>,
): ProcrastinationProfile {
  const entries = Object.entries(obstacleCounts) as [
    ObstacleCode,
    number,
  ][];
  if (entries.length === 0) {
    return PROFILE_CATALOG.initiation;
  }
  const [top] = entries.sort((a, b) => b[1] - a[1]);
  return PROFILE_CATALOG[OBSTACLE_TO_PROFILE[top[0]]];
}
