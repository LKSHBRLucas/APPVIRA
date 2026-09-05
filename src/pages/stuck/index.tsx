import { AlertTriangle, ArrowLeft, ArrowRight, Play, Save } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useLocation, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/use-auth";
import { useCheckin } from "@/hooks/use-checkin";
import { useIntentions } from "@/hooks/use-intentions";
import { useSessionMutations } from "@/hooks/use-session-mutations";
import { useTasks } from "@/hooks/use-tasks";
import { listObstacles } from "@/lib/data/catalogs";
import { createTask } from "@/lib/data/tasks";
import { recordInterventionResult } from "@/lib/data/intervention-results";
import { pickIntervention } from "@/lib/intervention/engine";
import type { ObstacleCode } from "@/lib/intervention/types";
import { OBSTACLE_TO_PROFILE } from "@/lib/behaviors/profiles";
import { suggestIntentions } from "@/lib/plan/suggestions";
import { useQuery } from "@tanstack/react-query";
import { cn } from "@/lib/utils";

/**
 * Estou travado — fluxo 100% ligado ao banco (Enter Cloud), sem mock.
 * Mapa de botões → funções reais:
 *  - Chip de tarefa         → seleção local de contexto (não grava; a tarefa
 *                            escolhida é persistida na sessão ao escolher obstáculo)
 *  - Botão de obstáculo     → sessions.insert (sessão "planned" já nasce no banco)
 *                            ou sessions.update ao trocar de obstáculo
 *  - Salvar plano Se→Então  → implementation_intentions.insert
 *  - Começar                → sessions.update (intervention_code) +
 *                            intervention_results.insert + navega para o modo foco
 *    (o texto digitado vira tasks.insert quando "Começar" é pressionado)
 */
type Step = "obstacle" | "intervention";

export default function StuckPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const { tasks } = useTasks();
  const { latest } = useCheckin();
  const { start, patch } = useSessionMutations();
  const { create: createIntention } = useIntentions();

  const incomingTaskId = (location.state as { taskId?: string } | null)?.taskId;

  const [step, setStep] = useState<Step>("obstacle");
  const [taskId, setTaskId] = useState<string | null>(incomingTaskId ?? null);
  const [note, setNote] = useState("");
  const [obstacleCode, setObstacleCode] = useState<ObstacleCode | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [savingIntention, setSavingIntention] = useState(false);
  const [intentionSaved, setIntentionSaved] = useState(false);

  const { data: obstacles = [] } = useQuery({
    queryKey: ["obstacles"],
    queryFn: listObstacles,
  });

  const plannedTasks = tasks.filter((task) => task.status === "planned");

  const plan = obstacleCode
    ? pickIntervention({
        code: obstacleCode,
        note: note.trim() || undefined,
        task:
          taskId && (() => {
            const task = tasks.find((x) => x.id === taskId);
            return task
              ? {
                  id: task.id,
                  title: task.title,
                  firstStep: task.first_step,
                  durationMin: task.duration_min,
                }
              : undefined;
          })(),
        energy: latest?.level,
      })
    : null;

  const intentionSuggestion = obstacleCode
    ? suggestIntentions(OBSTACLE_TO_PROFILE[obstacleCode], null)[0] ?? null
    : null;

  const planIsIntention = plan?.intervention.code === "implementation_intention";

  /** Real call: sessions.insert (first pick) or sessions.update (changing obstacle). */
  const handleObstaclePick = async (code: ObstacleCode) => {
    const nextPlan = pickIntervention({
      code,
      note: note.trim() || undefined,
      task:
        taskId && (() => {
          const task = tasks.find((x) => x.id === taskId);
          return task
            ? {
                id: task.id,
                title: task.title,
                firstStep: task.first_step,
                durationMin: task.duration_min,
              }
            : undefined;
        })(),
      energy: latest?.level,
    });

    if (sessionId) {
      // Already have a draft session — persist the new obstacle (UPDATE).
      await patch.mutateAsync({
        id: sessionId,
        patch: { obstacle_code: code, task_id: taskId },
      });
    } else {
      // Real INSERT — the planned session is created in the database right now.
      const { session } = await start.mutateAsync({
        task_id: taskId,
        planned_start: new Date().toISOString(),
        duration_planned: nextPlan.intervention.durationMin,
        obstacle_code: code,
        intervention_code: null,
        energy: latest?.level ?? null,
      });
      setSessionId(session.id);
    }

    setObstacleCode(code);
    setStep("intervention");
  };

  /** Real call: implementation_intentions.insert. */
  const handleSaveIntention = async () => {
    if (!user || !intentionSuggestion) return;
    setSavingIntention(true);
    try {
      await createIntention.mutateAsync({
        if_part: intentionSuggestion.ifPart,
        then_part: intentionSuggestion.thenPart,
        trigger_code: obstacleCode,
      });
      setIntentionSaved(true);
      toast.success(t("stuck.intentionSaved"));
    } finally {
      setSavingIntention(false);
    }
  };

  /** Real calls: tasks.insert (note) + sessions.update + intervention_results.insert. */
  const handleStart = async () => {
    if (!obstacleCode || !plan || !sessionId) return;
    setStarting(true);

    // Resolve the task context: selected task, or a real task created from the note.
    let resolvedTaskId = taskId;
    if (!resolvedTaskId && note.trim()) {
      const task = await createTask(user!.id, {
        title: note.trim(),
        category: "other",
        first_step: plan.firstStep ?? null,
        scheduled_at: null,
        duration_min: plan.intervention.durationMin,
      });
      resolvedTaskId = task.id;
    }

    // sessions.update — stamp the intervention on the planned session.
    await patch.mutateAsync({
      id: sessionId,
      patch: {
        intervention_code: plan.intervention.code,
        task_id: resolvedTaskId,
      },
    });

    // intervention_results.insert — what was shown for this session.
    await recordInterventionResult(user!.id, {
      session_id: sessionId,
      task_id: resolvedTaskId,
      intervention_code: plan.intervention.code,
    });

    setStarting(false);
    navigate(`/session/${sessionId}`, { replace: true });
  };

  const goBack = () => {
    setStep("obstacle");
    // Keeping the created session as a draft — changing the obstacle later updates it.
  };

  return (
    <div className="animate-fade-in-up">
      <button
        type="button"
        onClick={goBack}
        className={cn(
          "mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground",
          step === "obstacle" && "invisible",
        )}
        aria-label={t("stuck.back")}
      >
        <ArrowLeft className="h-4 w-4" />
        {t("stuck.back")}
      </button>

      <div className="mb-5 flex gap-1.5">
        {(["obstacle", "intervention"] as Step[]).map((s) => {
          const idx = ["obstacle", "intervention"].indexOf(s);
          const current = ["obstacle", "intervention"].indexOf(step);
          return (
            <span
              key={s}
              className={cn(
                "h-1.5 flex-1 rounded-full",
                idx <= current ? "bg-primary" : "bg-border",
              )}
            />
          );
        })}
      </div>

      {step === "obstacle" && (
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t("stuck.obstacleTitle")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t("stuck.obstacleHint")}</p>

          <div className="mt-5 space-y-2">
            <div className="space-y-2">
              <Label htmlFor="stuck-note">{t("stuck.whatLabel")}</Label>
              <Input
                id="stuck-note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder={t("stuck.whatPlaceholder")}
              />
            </div>

            {plannedTasks.length > 0 && (
              <div className="flex gap-2 overflow-x-auto pb-1">
                {plannedTasks.map((task) => (
                  <button
                    key={task.id}
                    type="button"
                    onClick={() => setTaskId(task.id)}
                    className={cn(
                      "shrink-0 rounded-full border px-3 py-1.5 text-xs transition-colors",
                      taskId === task.id
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border bg-card text-muted-foreground",
                    )}
                  >
                    {task.title}
                  </button>
                ))}
              </div>
            )}

            {obstacles.map((obstacle) => (
              <button
                key={obstacle.code}
                type="button"
                onClick={() => void handleObstaclePick(obstacle.code as ObstacleCode)}
                className="flex w-full items-center justify-between rounded-lg border border-border bg-card px-4 py-3 text-left text-sm transition-colors hover:border-primary/50 hover:bg-muted"
              >
                {obstacle.label}
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
              </button>
            ))}
          </div>
        </div>
      )}

      {step === "intervention" && plan && (
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t("stuck.planTitle")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t("stuck.planHint")}</p>

          <div className="mt-5 rounded-xl border border-primary/30 bg-primary/5 p-5">
            <p className="text-xs font-semibold uppercase tracking-wider text-primary">
              {plan.intervention.name}
            </p>
            <p className="mt-2 text-sm leading-relaxed">{plan.message}</p>
            {plan.firstStep && (
              <p className="mt-3 rounded-lg bg-card/80 p-3 text-sm">
                <span className="font-medium">{t("stuck.firstStepLabel")}:</span>{" "}
                {plan.firstStep}
              </p>
            )}
          </div>

          {planIsIntention && intentionSuggestion && (
            <div className="mt-4 rounded-lg border border-border bg-card p-4">
              <p className="text-sm font-medium">{t("stuck.intentionTitle")}</p>
              <div className="mt-3 space-y-2 text-sm">
                <p className="rounded-md bg-muted p-3">
                  <span className="font-semibold text-primary">SE</span>{" "}
                  {intentionSuggestion.ifPart.replace(/^SE /i, "")}
                </p>
                <p className="rounded-md bg-muted p-3">
                  <span className="font-semibold text-primary">ENTÃO</span>{" "}
                  {intentionSuggestion.thenPart.replace(/^ENTÃO /i, "")}
                </p>
              </div>
              <Button
                className="mt-3 w-full"
                variant={intentionSaved ? "outline" : "secondary"}
                size="sm"
                onClick={handleSaveIntention}
                disabled={savingIntention || intentionSaved}
              >
                <Save className="h-4 w-4" />
                {intentionSaved
                  ? t("stuck.intentionSavedLabel")
                  : t("stuck.intentionSave")}
              </Button>
            </div>
          )}

          <div className="mt-4 flex items-start gap-2 rounded-lg border border-border bg-card p-3 text-xs text-muted-foreground">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            <p>{t("stuck.note")}</p>
          </div>

          <Button
            className="mt-5 w-full"
            size="lg"
            onClick={handleStart}
            disabled={starting}
          >
            {starting ? t("stuck.starting") : plan.ctaLabel}
            {!starting && <Play className="h-4 w-4" />}
          </Button>
        </div>
      )}
    </div>
  );
}
