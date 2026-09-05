import { AlertTriangle, ArrowLeft, ArrowRight, Check, Play, Save } from "lucide-react";
import { useMemo, useState } from "react";
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
import { replaceSessionObstacles } from "@/lib/data/session-obstacles";
import { pickIntervention } from "@/lib/intervention/engine";
import type { ObstacleCode } from "@/lib/intervention/types";
import { buildImplementationPlan } from "@/lib/plan/suggestions";
import { useQuery } from "@tanstack/react-query";
import { cn } from "@/lib/utils";

/**
 * Estou travado — fluxo 100% ligado ao banco (Enter Cloud), sem mock.
 * Mapa de botões → funções reais:
 *  - Chip de tarefa         → seleção local de contexto (persistida na sessão ao
 *                            escolher o obstáculo)
 *  - Botões de obstáculo    → seleção múltipla (até 3) + sessions.insert/update
 *                            + session_obstacles.insert (a combinação inteira)
 *  - Salvar plano Se→Então  → implementation_intentions.insert (formulário
 *                            editável pré-preenchido a partir da tarefa abstrata)
 *  - Começar                → sessions.update (intervention_code) +
 *                            intervention_results.insert (accepted=true, ou seja,
 *                            o usuário aceitou e iniciou) + navega para o modo foco
 *    (o texto digitado vira tasks.insert quando "Começar" é pressionado)
 *
 * As intenções salvas do usuário alimentam o motor: quando um obstáculo
 * selecionado casa com o trigger de uma intenção ativa, o motor tende a
 * implementação (bônus determinístico) — base para combinações futuras.
 */
const MAX_OBSTACLES = 3;
type Step = "obstacle" | "intervention";

export default function StuckPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const { tasks } = useTasks();
  const { latest } = useCheckin();
  const { start, patch } = useSessionMutations();
  const { intentions, create: createIntention } = useIntentions();

  const incomingTaskId = (location.state as { taskId?: string } | null)?.taskId;

  const [step, setStep] = useState<Step>("obstacle");
  const [taskId, setTaskId] = useState<string | null>(incomingTaskId ?? null);
  const [note, setNote] = useState("");
  const [selectedCodes, setSelectedCodes] = useState<ObstacleCode[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [savingIntention, setSavingIntention] = useState(false);
  const [intentionSaved, setIntentionSaved] = useState(false);
  const [iiIf, setIiIf] = useState("");
  const [iiThen, setIiThen] = useState("");

  const { data: obstacles = [] } = useQuery({
    queryKey: ["obstacles"],
    queryFn: listObstacles,
  });

  const plannedTasks = tasks.filter((task) => task.status === "planned");
  const selectedTask = taskId ? tasks.find((x) => x.id === taskId) : null;

  const intentionTriggers = useMemo(
    () =>
      intentions
        .filter((i) => i.active)
        .map((i) => i.trigger_code),
    [intentions],
  );

  const plan = useMemo(
    () =>
      selectedCodes.length > 0
        ? pickIntervention({
            codes: selectedCodes,
            note: note.trim() || undefined,
            task: selectedTask
              ? {
                  id: selectedTask.id,
                  title: selectedTask.title,
                  firstStep: selectedTask.first_step,
                  durationMin: selectedTask.duration_min,
                }
              : undefined,
            energy: latest?.level,
            intentionTriggers,
          })
        : null,
    [selectedCodes, note, selectedTask, latest?.level, intentionTriggers],
  );

  const planIsIntention = plan?.intervention.code === "implementation_intention";

  const intentionPlan = useMemo(
    () =>
      selectedCodes.length > 0
        ? buildImplementationPlan(selectedCodes, selectedTask)
        : null,
    [selectedCodes, selectedTask],
  );

  const toggleObstacle = (code: ObstacleCode) => {
    setSelectedCodes((prev) => {
      if (prev.includes(code)) return prev.filter((c) => c !== code);
      if (prev.length >= MAX_OBSTACLES) return prev;
      return [...prev, code];
    });
  };

  const handleAnalyze = async () => {
    if (!plan || selectedCodes.length === 0) return;
    const primaryCode = selectedCodes[0];

    if (sessionId) {
      await patch.mutateAsync({
        id: sessionId,
        patch: { obstacle_code: primaryCode, task_id: taskId },
      });
      await replaceSessionObstacles(user!.id, sessionId, selectedCodes);
    } else {
      const { session } = await start.mutateAsync({
        task_id: taskId,
        planned_start: new Date().toISOString(),
        duration_planned: plan.intervention.durationMin,
        obstacle_code: primaryCode,
        intervention_code: null,
        energy: latest?.level ?? null,
      });
      setSessionId(session.id);
      await replaceSessionObstacles(user!.id, session.id, selectedCodes);
    }

    // Pre-fill the editable SE → ENTÃO form from the abstract task.
    if (intentionPlan) {
      setIiIf(intentionPlan.ifPart);
      setIiThen(intentionPlan.thenPart);
    }
    setStep("intervention");
  };

  /** Real call: implementation_intentions.insert with the user's edited plan. */
  const handleSaveIntention = async () => {
    if (!user || !selectedCodes[0]) return;
    if (!iiIf.trim() || !iiThen.trim()) return;
    setSavingIntention(true);
    try {
      await createIntention.mutateAsync({
        if_part: iiIf.trim(),
        then_part: iiThen.trim(),
        trigger_code: selectedCodes[0],
      });
      setIntentionSaved(true);
      toast.success(t("stuck.intentionSaved"));
    } finally {
      setSavingIntention(false);
    }
  };

  /** Real calls: tasks.insert (note) + sessions.update + intervention_results.insert. */
  const handleStart = async () => {
    if (!plan || !sessionId) return;
    setStarting(true);

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

    await patch.mutateAsync({
      id: sessionId,
      patch: {
        intervention_code: plan.intervention.code,
        task_id: resolvedTaskId,
      },
    });

    // accepted=true → the user saw the intervention and pressed start.
    await recordInterventionResult(user!.id, {
      session_id: sessionId,
      task_id: resolvedTaskId,
      intervention_code: plan.intervention.code,
      accepted: true,
      outcome: "started",
    });

    setStarting(false);
    navigate(`/session/${sessionId}`, { replace: true });
  };

  const goBack = () => {
    setStep("obstacle");
    // The draft session stays in the database; re-analyzing updates it.
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

            <div className="rounded-lg border border-border bg-card p-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">{t("stuck.selectTitle")}</p>
                <p className="text-xs text-muted-foreground">
                  {selectedCodes.length}/{MAX_OBSTACLES}
                </p>
              </div>
            </div>

            {obstacles.map((obstacle) => {
              const isSelected = selectedCodes.includes(obstacle.code as ObstacleCode);
              const isFull = selectedCodes.length >= MAX_OBSTACLES && !isSelected;
              return (
                <button
                  key={obstacle.code}
                  type="button"
                  onClick={() => toggleObstacle(obstacle.code as ObstacleCode)}
                  disabled={isFull}
                  className={cn(
                    "flex w-full items-center justify-between rounded-lg border px-4 py-3 text-left text-sm transition-colors",
                    isSelected
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border bg-card hover:bg-muted",
                    isFull && "opacity-50",
                  )}
                >
                  {obstacle.label}
                  {isSelected ? (
                    <Check className="h-4 w-4" />
                  ) : (
                    <span className="h-4 w-4 rounded-full border border-border" />
                  )}
                </button>
              );
            })}
          </div>

          <Button
            className="mt-5 w-full"
            size="lg"
            onClick={handleAnalyze}
            disabled={selectedCodes.length === 0}
          >
            {t("stuck.analyze")}
            <ArrowRight className="h-4 w-4" />
          </Button>
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

          {planIsIntention && intentionPlan && (
            <div className="mt-4 rounded-lg border border-border bg-card p-4">
              <p className="text-sm font-medium">{t("stuck.intentionTitle")}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {t("stuck.intentionHint")}
              </p>
              <div className="mt-3 space-y-2">
                <div className="space-y-1">
                  <Label htmlFor="ii-if">{t("stuck.intentionIf")}</Label>
                  <Input
                    id="ii-if"
                    value={iiIf}
                    onChange={(e) => setIiIf(e.target.value)}
                    placeholder={t("stuck.intentionIfPlaceholder")}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="ii-then">{t("stuck.intentionThen")}</Label>
                  <Input
                    id="ii-then"
                    value={iiThen}
                    onChange={(e) => setIiThen(e.target.value)}
                    placeholder={t("stuck.intentionThenPlaceholder")}
                  />
                </div>
              </div>
              <Button
                className="mt-3 w-full"
                variant={intentionSaved ? "outline" : "secondary"}
                size="sm"
                onClick={handleSaveIntention}
                disabled={
                  savingIntention ||
                  intentionSaved ||
                  !iiIf.trim() ||
                  !iiThen.trim()
                }
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
