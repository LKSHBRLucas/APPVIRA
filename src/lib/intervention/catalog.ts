import type { InterventionDefinition, ObstacleCode } from "./types";

/** Full catalog of the 8 interventions, mirrored from the DB seed. */
export const INTERVENTION_CATALOG: Record<
  InterventionDefinition["code"],
  InterventionDefinition
> = {
  micro_start: {
    code: "micro_start",
    name: "Micro-start",
    mechanism: "Redução de barreira de iniciação via sessão mínima (5–15 min)",
    description:
      "Reduza a tarefa para uma sessão mínima de 5 a 15 minutos. Depois de começar, você decide se continua.",
    durationMin: 15,
  },
  first_step: {
    code: "first_step",
    name: "Primeiro passo",
    mechanism: "Criação de ação física e observável de baixo custo",
    description:
      "Transforme a tarefa abstrata em uma ação concreta e observável. Ex.: abrir o PDF e resolver a questão 1.",
    durationMin: 5,
  },
  implementation_intention: {
    code: "implementation_intention",
    name: "Plano se → então",
    mechanism: "Vínculo estímulo–resposta pré-decidido",
    description:
      "Crie um plano: SE contexto X, ENTÃO ação Y. A decisão já fica tomada para o momento crítico.",
    durationMin: 5,
  },
  restructuring: {
    code: "restructuring",
    name: "Reestruturação do ambiente",
    mechanism: "Controle de estímulos / restructuração do ambiente",
    description:
      "Mude fisicamente o ambiente para remover o atrito entre você e a tarefa. Ex.: deixar o material à vista.",
    durationMin: 5,
  },
  distraction_removal: {
    code: "distraction_removal",
    name: "Remoção de distração",
    mechanism: "Controle de estímulos (redução de estímulos concorrentes)",
    description:
      "Remova a distração: celular fora do alcance e modo foco ativado com uma tarefa única.",
    durationMin: 5,
  },
  cognitive_restructuring: {
    code: "cognitive_restructuring",
    name: "Reestruturação cognitiva breve",
    mechanism: "Reformulação de pensamento de evitação em formulação operacional",
    description:
      "Identifique o padrão exigente/evitativo e substitua por uma versão mínima aceitável e iniciável.",
    durationMin: 5,
  },
  recovery: {
    code: "recovery",
    name: "Recovery",
    mechanism: "Recuperação de sessão perdida sem punição",
    description:
      "Recupere a sessão perdida no mesmo dia com uma versão menor, sem culpa e sem zerar nada.",
    durationMin: 5,
  },
  replan: {
    code: "replan",
    name: "Replanejamento",
    mechanism: "Ajuste de contexto/ocasião (horário não realista)",
    description:
      "Se o horário original não é realista, mova a atividade para uma ocasião viável hoje.",
    durationMin: 5,
  },
};

export const OBSTACLE_LABELS: Record<ObstacleCode, string> = {
  tired: "Estou cansado",
  no_motivation: "Estou sem vontade",
  phone: "Estou preso no celular",
  task_too_big: "A tarefa parece grande demais",
  no_start_point: "Não sei por onde começar",
  anxious: "Estou ansioso",
  fear_of_failure: "Tenho medo de fazer errado",
  perfectionism: "Quero fazer perfeito",
  distracted: "Estou distraído",
  no_environment: "Não tenho um ambiente adequado",
  bad_time: "Horário inadequado",
  other: "Outro",
};
