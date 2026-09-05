# Motor de Intervenção — Regras Determinísticas (VIRA)

> Fase atual: **regras determinísticas, sem IA**. O motor é isolado atrás da
> interface `InterventionSelector` para que, no futuro, as regras possam ser
> substituídas por um modelo adaptativo/IA sem alterar o fluxo principal.

## Visão geral

O motor recebe a combinação de obstáculos selecionados pelo usuário no fluxo
"Estou travado" (até 3), opcionalmente com contexto (tarefa, energia, nota livre
e intenções Se→Então salvas), e produz um `InterventionPlan`:

```
{ intervention, message, ctaLabel, firstStep?, matchedObstacles, ruleId }
```

Tudo é **determinístico**: a mesma entrada sempre produz a mesma saída.

## Arquivos

| Arquivo | Responsabilidade |
|---|---|
| `src/lib/intervention/types.ts` | Códigos de obstáculo/intervenção, `InterventionPlan`, `InterventionSelector` |
| `src/lib/intervention/catalog.ts` | Catálogo das 8 intervenções (espelha o seed do banco) |
| `src/lib/intervention/engine.ts` | **Regras**: votação ponderada + desempate + bônus |
| `src/lib/intervention/engine.test.ts` | Testes unitários do processo de decisão |
| `src/lib/plan/suggestions.ts` | Gerador de plano Se→Então a partir da tarefa |
| `src/lib/data/session-obstacles.ts` | Persistência da combinação de obstáculos |
| `src/pages/stuck/index.tsx` | Fluxo que consome o motor e persiste no banco |

## Como o sistema decide qual intervenção aplicar

### 1. Normalização da entrada

- Junta `codes` (ou `code` único), remove duplicatas e limita a **3 obstáculos**.
- Se "outro" foi selecionado junto com obstáculos reais, "outro" é descartado.
- Sem obstáculo real, usa `["other"]` como padrão.

### 2. Votação ponderada (obstáculo → intervenções)

Cada obstáculo vota com pesos nas intervenções candidatas:

| Obstáculo | Votos |
|---|---|
| `task_too_big` (tarefa grande) | `micro_start` +3, `first_step` +1 |
| `no_start_point` (sem ponto de partida) | `first_step` +3, `micro_start` +1 |
| `phone` (preso no celular) | `distraction_removal` +3 |
| `distracted` (distraído) | `distraction_removal` +3, `restructuring` +1 |
| `tired` (cansado) | `micro_start` +3 |
| `no_motivation` (sem vontade) | `micro_start` +3, `implementation_intention` +1 |
| `perfectionism` (perfeccionismo) | `cognitive_restructuring` +3 |
| `fear_of_failure` (medo de errar) | `cognitive_restructuring` +3, `first_step` +1 |
| `anxious` (ansioso) | `cognitive_restructuring` +3, `micro_start` +1 |
| `no_environment` (ambiente inadequado) | `restructuring` +3, `distraction_removal` +1 |
| `bad_time` (horário inadequado) | `replan` +3 |
| `other` (outro) | `micro_start` +2 |

A **soma** dos votos da combinação inteira decide. Ex.: `tired` + `no_motivation`
= `micro_start` 6 — reforço na mesma intervenção.

### 3. Bônus determinísticos

- **Recorrência na nota** (ex.: "toda vez", "sempre", "nunca consigo") → +2 para
  `implementation_intention`.
- **Intenção Se→Então salva e ativa** cujo `trigger_code` casa com um obstáculo
  selecionado → +2 para `implementation_intention` (o usuário já automatizou
  aquele gatilho antes).

### 4. Desempate (`FIRST_WINS`)

Empate é resolvido por ordem fixa de prioridade:

```
distraction_removal > cognitive_restructuring > first_step
> implementation_intention > micro_start > restructuring > replan > recovery
```

## Intervenções implementadas (as 5 pedidas + reforço)

| Intervenção | Quando é escolhida | Exemplo de CTA |
|---|---|---|
| **Micro-start (5–15 min)** | tarefa grande, cansaço, sem vontade, combinações de energia | "Começar com 15 min" |
| **Primeiro passo** | não sei por onde começar, tarefa abstrata | "Definir e começar o primeiro passo" |
| **Plano Se→Então** | recorrência na nota ou intenção salva que casa com o obstáculo | "Criar plano e começar" |
| **Replanejamento** | horário/ocasião inadequada | "Reagendar para agora" |
| **Redução de distrações** | celular/distração | "Guardar o celular e iniciar" |
| Reestruturação cognitiva breve | perfeccionismo, medo, ansiedade | "Reduzir a meta e começar" |
| Reestruturação do ambiente | ambiente inadequado | "Reestruturar o ambiente" |

## Persistência no banco (sem mock)

| Dado | Tabela | Quando |
|---|---|---|
| Combinação de obstáculos (até 3) | `session_obstacles` (insert/update) | ao analisar obstáculos |
| Obstáculo primário, `planned_start`, energia | `sessions` (insert) | ao analisar obstáculos |
| Intervenção aplicada + tarefa | `sessions` (update `intervention_code`) | ao clicar "Começar agora" |
| Intervenção mostrada + aceite | `intervention_results` (`accepted=true`, `outcome="started"`) | ao clicar "Começar agora" |
| Início real (`actual_start`) | `sessions` + `session_events.task_started` | modo foco |
| Tempo até iniciar (LTA) | derivado: `actual_start − planned_start` | cálculo em `lib/metrics` |
| Conclusão/abandono | `sessions.status` + `session_events` | check-in pós-sessão |
| Duração real | `focus_sessions.duration_actual` | fim da sessão |

## Preparação para IA (troca futura)

O fluxo (página `/stuck`) chama **somente** `getInterventionSelector().pick(...)`.
Para trocar regras por IA/adaptativo:

1. Implementar a interface `InterventionSelector` (`id` + `pick`).
2. Trocar o retorno de `getInterventionSelector()` em `src/lib/intervention/engine.ts`.
3. Nada mais muda — UI, persistência e métricas já leem `InterventionPlan`.

O `ruleId` (ex.: `rules_v2:phone+task_too_big:ii`) fica registrado para comparar
desempenho entre regras e modelo futuro.
