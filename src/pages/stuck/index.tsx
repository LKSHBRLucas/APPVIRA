import { AlertTriangle, ArrowLeft, ArrowRight, Play } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useTasks } from "@/hooks/use-tasks";
import { useCheckin } from "@/hooks/use-checkin";
import { useSessionMutations } from "@/hooks/use-session-mutations";
import { recordInterventionResult } from "@/lib/data/intervention-results";
import { listObstacles } from "@/lib/data/catalogs";
import { useQuery } from "@tanstack/react-query";
import { pickIntervention } from "@/lib/intervention/engine";
import type { ObstacleCode } from "@/lib/intervention/types";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";

type Step = "activity" | "obstacle" | "intervention";

export default function StuckPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const { tasks } = useTasks();
  const { latest } = useCheckin();
  const { start } = useSessionMutations();

  const incomingTaskId = (location.state as { taskId?: string } | null)?.taskId;

  const [step, setStep] = useState<Step>(incomingTaskId ? "obstacle" : "activity");
  const [taskId, setTaskId] = useState<string | null>(incomingTaskId ?? null);
  const [obstacleCode, setObstacleCode] = useState<ObstacleCode | null>(null);
  const [starting, setStarting] = useState(false);

  const { data: obstacles = [] } = useQuery({
    queryKey: ["obstacles"],
    queryFn: listObstacles,
  });

  const plan = obstacleCode
    ? pickIntervention({
        code: obstacleCode,
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

  const handleStart = async () => {
    if (!obstacleCode || !plan) return;
    setStarting(true);
    const selectedTask = taskId ? tasks.find((x) => x.id === taskId) : null;

    const { session } = await start.mutateAsync({
      task_id: taskId,
      planned_start: new Date().toISOString(),
      duration_planned: plan.intervention.durationMin,
      obstacle_code: obstacleCode,
      intervention_code: plan.intervention.code,
      energy: latest?.level ?? null,
    });

    await recordInterventionResult(user!.id, {
      session_id: session.id,
      task_id: taskId,
      intervention_code: plan.intervention.code,
    });

    setStarting(false);
    navigate(`/session/${session.id}`, { replace: true });
  };

  const goBack = () => {
    if (step === "obstacle") setStep("activity");
    else if (step === "intervention") setStep("obstacle");
  };

  return (
    <div className="animate-fade-in-up">
      <button
        type="button"
        onClick={goBack}
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        aria-label={t("stuck.back")}
      >
        <ArrowLeft className="h-4 w-4" />
        {t("stuck.back")}
      </button>

      <div className="mb-5 flex gap-1.5">
        {(["activity", "obstacle", "intervention"] as Step[]).map((s) => {
          const idx = ["activity", "obstacle", "intervention"].indexOf(s);
          const current = ["activity", "obstacle", "intervention"].indexOf(step);
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

      {step === "activity" && (
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t("stuck.activityTitle")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t("stuck.activityHint")}</p>

          <div className="mt-5 space-y-2">
            {tasks
              .filter((task) => task.status === "planned")
              .map((task) => (
                <button
                  key={task.id}
                  type="button"
                  onClick={() => {
                    setTaskId(task.id);
                    setStep("obstacle");
                  }}
                  className="w-full rounded-lg border border-border bg-card p-4 text-left transition-colors hover:border-primary/50 hover:bg-muted"
                >
                  <p className="font-medium">{task.title}</p>
                  {task.first_step && (
                    <p className="mt-0.5 text-sm text-muted-foreground">{task.first_step}</p>
                  )}
                </button>
              ))}
            {tasks.filter((task) => task.status === "planned").length === 0 && (
              <p className="rounded-lg border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
                {t("stuck.noTasks")}
              </p>
            )}
          </div>
        </div>
      )}

      {step === "obstacle" && (
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t("stuck.obstacleTitle")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t("stuck.obstacleHint")}</p>

          <div className="mt-5 space-y-2">
            {obstacles.map((obstacle) => (
              <button
                key={obstacle.code}
                type="button"
                onClick={() => {
                  setObstacleCode(obstacle.code as ObstacleCode);
                  setStep("intervention");
                }}
                className={cn(
                  "flex w-full items-center justify-between rounded-lg border px-4 py-3 text-left text-sm transition-colors",
                  obstacleCode === obstacle.code
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border bg-card hover:bg-muted",
                )}
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
