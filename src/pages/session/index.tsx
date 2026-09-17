import { Loader2, Pause, Play, RotateCcw, Sparkles, X } from "lucide-react";
import { useRef, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { trackEvent } from "@enter-pro/analytics-sdk";
import { Button } from "@/components/ui/button";
import { useTimer } from "@/hooks/use-timer";
import { useSession } from "@/hooks/use-sessions";
import { useSessionMutations } from "@/hooks/use-session-mutations";
import { useTasks } from "@/hooks/use-tasks";
import { insertFocusSession } from "@/lib/data/focus";
import { updateInterventionOutcome } from "@/lib/data/intervention-results";
import {
  getSessionObstacleCodes,
  replaceSessionObstacles,
} from "@/lib/data/session-obstacles";
import { pickNextIntervention } from "@/lib/intervention/engine";
import type { InterventionCode, ObstacleCode } from "@/lib/intervention/types";
import { cn } from "@/lib/utils";

const RECOVERY_OPTIONS = [5, 15, 30] as const;
const FEELING_MAX = 5;

type Accomplished = "yes" | "partial" | "no";
type Helped = "yes" | "partial" | "no";

function OptionChip({
  selected,
  onClick,
  children,
}: {
  selected: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex-1 rounded-lg border px-3 py-2.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        selected
          ? "border-primary bg-primary/10 text-primary"
          : "border-border bg-card text-muted-foreground hover:bg-muted",
      )}
    >
      {children}
    </button>
  );
}

export default function SessionPage() {
  const { id } = useParams<{ id: string }>();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { data: session, isLoading } = useSession(id);
  const { start, patch, logEvent } = useSessionMutations();
  const { complete } = useTasks();
  const timer = useTimer();

  const [phase, setPhase] = useState<"ready" | "focus" | "checkin" | "recovery">("ready");
  const [saving, setSaving] = useState(false);
  const [accomplished, setAccomplished] = useState<Accomplished | null>(null);
  const [helped, setHelped] = useState<Helped | null>(null);
  const [feeling, setFeeling] = useState<number | null>(null);
  const [escalating, setEscalating] = useState(false);
  const startedAtRef = useRef<string | null>(null);

  if (isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-border border-t-primary" />
      </div>
    );
  }

  if (!session) {
    return (
      <div className="py-10 text-center text-muted-foreground">{t("session.notFound")}</div>
    );
  }

  const task = session.tasks;
  const plannedMin = session.duration_planned;

  /** Real calls: sessions.update(actual_start, started) + session_events.task_started. */
  const handleStart = async () => {
    startedAtRef.current = new Date().toISOString();
    timer.start();
    setPhase("focus");
    try {
      await patch.mutateAsync({
        id: session.id,
        patch: { actual_start: startedAtRef.current, status: "started" },
      });
      await logEvent.mutateAsync({ sessionId: session.id, type: "task_started" });

      trackEvent("session_started", {
        eventType: "custom",
        properties: {
          intervention_code: session.intervention_code ?? "none",
          duration_planned_min: plannedMin,
        },
      });
    } catch {
      toast.error(t("session.saveError"));
    }
  };

  /** Finish early (or at the end of focus) → check-in. */
  const handleEnd = () => {
    timer.stop();
    setPhase("checkin");
  };

  /** Real calls: sessions.update(final status) + focus_sessions.insert (with the
   *  three check-in answers) + session_events + intervention_results.update. */
  const handleSubmit = async () => {
    if (!accomplished || !helped || feeling === null) return;
    setSaving(true);

    const endedIso = new Date().toISOString();
    const duration = Math.max(1, Math.round(timer.elapsedSeconds / 60));
    const startIso = startedAtRef.current ?? session.actual_start ?? endedIso;
    const outcome: "completed" | "abandoned" =
      accomplished === "no" ? "abandoned" : "completed";

    try {
      await patch.mutateAsync({
        id: session.id,
        patch: { status: outcome, duration_actual: duration },
      });

      await insertFocusSession(session.user_id, session.id, startIso, endedIso, duration, {
        accomplished,
        interventionHelped: helped,
        feeling,
      });

      await logEvent.mutateAsync({
        sessionId: session.id,
        type: "checkin_answered",
        payload: { accomplished, intervention_helped: helped, feeling },
      });

      await updateInterventionOutcome(session.user_id, session.id, outcome);

      trackEvent(outcome === "completed" ? "session_completed" : "session_abandoned", {
        eventType: outcome === "completed" ? "conversion" : "custom",
        properties: {
          intervention_code: session.intervention_code ?? "none",
          duration_actual_min: duration,
          accomplished,
          intervention_helped: helped,
          feeling,
        },
      });

      if (outcome === "completed") {
        await logEvent.mutateAsync({ sessionId: session.id, type: "task_completed" });
        if (task && accomplished === "yes") await complete.mutateAsync(task.id);
      } else {
        await logEvent.mutateAsync({ sessionId: session.id, type: "task_abandoned" });
      }
    } catch {
      toast.error(t("session.saveError"));
      setSaving(false);
      return;
    }

    setSaving(false);
    if (outcome === "completed") {
      navigate("/", { replace: true });
    } else {
      setPhase("recovery");
    }
  };

  const recover = async (minutes: number) => {
    setSaving(true);
    try {
      await patch.mutateAsync({
        id: session.id,
        patch: { status: "recovered", duration_actual: minutes },
      });
      await logEvent.mutateAsync({
        sessionId: session.id,
        type: "recovery_accepted",
        payload: { minutes },
      });
      await insertFocusSession(
        session.user_id,
        session.id,
        startedAtRef.current ?? session.actual_start ?? new Date().toISOString(),
        new Date().toISOString(),
        minutes,
      );
    } catch {
      toast.error(t("session.saveError"));
    } finally {
      setSaving(false);
      navigate("/", { replace: true });
    }
  };

  const declineRecovery = async () => {
    await logEvent.mutateAsync({ sessionId: session.id, type: "recovery_declined" });
    navigate("/", { replace: true });
  };

  /**
   * Escalation: the check-in reported the intervention did NOT help. Instead
   * of only logging a failure, pick the next-best intervention (excluding
   * the one just tried) from the same obstacle combination and start a new
   * session with it right away — closing the loop instead of ending it.
   */
  const escalate = async () => {
    setEscalating(true);
    try {
      const obstacleCodes = await getSessionObstacleCodes(session.id);
      const codes: ObstacleCode[] =
        obstacleCodes.length > 0
          ? obstacleCodes
          : session.obstacle_code
            ? [session.obstacle_code as ObstacleCode]
            : [];

      const excluded: InterventionCode[] = session.intervention_code
        ? [session.intervention_code as InterventionCode]
        : [];

      const nextPlan = pickNextIntervention(
        {
          codes,
          task: task
            ? {
                id: task.id,
                title: task.title,
                firstStep: task.first_step,
                durationMin: task.duration_min,
              }
            : undefined,
        },
        excluded,
      );

      const { session: newSession } = await start.mutateAsync({
        task_id: session.task_id,
        planned_start: new Date().toISOString(),
        duration_planned: nextPlan.intervention.durationMin,
        obstacle_code: session.obstacle_code,
        intervention_code: nextPlan.intervention.code,
        energy: session.energy,
      });

      if (codes.length > 0) {
        await replaceSessionObstacles(session.user_id, newSession.id, codes);
      }

      await logEvent.mutateAsync({
        sessionId: session.id,
        type: "escalation_accepted",
        payload: { from: session.intervention_code, to: nextPlan.intervention.code },
      });

      navigate(`/session/${newSession.id}`, { replace: true });
    } catch {
      toast.error(t("session.saveError"));
      setEscalating(false);
    }
  };

  const elapsedFloor = Math.floor(timer.elapsedSeconds);
  const mm = String(Math.floor(elapsedFloor / 60)).padStart(2, "0");
  const ss = String(elapsedFloor % 60).padStart(2, "0");
  const progress = Math.min(1, timer.elapsedSeconds / (plannedMin * 60));
  const RING_R = 88;
  const RING_C = 2 * Math.PI * RING_R;
  const canSubmit = accomplished !== null && helped !== null && feeling !== null;

  return (
    <div className="animate-fade-in-up flex min-h-[calc(100vh-6rem)] flex-col">
      {phase === "ready" && (
        <>
          <p className="text-sm font-medium text-primary">{t("session.focusBadge")}</p>
          <h1 className="mt-1 text-2xl font-bold leading-tight">
            {task?.title ?? t("session.genericTask")}
          </h1>
          {task?.first_step && (
            <p className="mt-2 text-sm text-muted-foreground">
              {t("home.firstStep")}: {task.first_step}
            </p>
          )}

          {task?.breakdown_steps && task.breakdown_steps.length > 0 && (
            <div className="mt-3 rounded-lg border border-border bg-card p-3">
              <p className="text-xs font-medium text-muted-foreground">
                {t("session.breakdownTitle")}
              </p>
              <ol className="mt-2 space-y-1.5">
                {task.breakdown_steps.map((step, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm">
                    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/15 text-[11px] font-semibold text-primary">
                      {i + 1}
                    </span>
                    {step}
                  </li>
                ))}
              </ol>
            </div>
          )}

          <div className="mt-6 space-y-2 rounded-lg border border-border bg-card p-4 text-sm">
            <p className="font-medium">{t("session.planHeader")}</p>
            <p className="text-muted-foreground">
              {session.intervention_code &&
                t(`session.intervention.${session.intervention_code}`)}
            </p>
            <p className="text-xs text-muted-foreground">
              {t("session.durationPlanned")}: {plannedMin} min
            </p>
          </div>

          <div className="mt-auto pt-6">
            <Button className="w-full" size="lg" onClick={handleStart}>
              <Play className="h-5 w-5" />
              {t("session.start")}
            </Button>
          </div>
        </>
      )}

      {phase === "focus" && (
        <div className="flex flex-1 flex-col items-center justify-center">
          <div className="relative h-56 w-56">
            <svg viewBox="0 0 200 200" className="h-full w-full -rotate-90">
              <circle
                cx="100"
                cy="100"
                r={RING_R}
                fill="none"
                strokeWidth="8"
                style={{ stroke: "hsl(var(--border))" }}
              />
              <circle
                cx="100"
                cy="100"
                r={RING_R}
                fill="none"
                strokeWidth="8"
                strokeLinecap="round"
                strokeDasharray={RING_C}
                strokeDashoffset={RING_C * (1 - progress)}
                style={{ stroke: "hsl(var(--primary))" }}
                className="transition-[stroke-dashoffset] duration-500 ease-linear"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <p className="font-mono text-5xl font-bold tabular-nums">
                {mm}:{ss}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">/ {plannedMin} min</p>
            </div>
          </div>

          <p className="mt-6 max-w-xs text-center text-sm text-muted-foreground">
            {task?.title}
          </p>

          <div className="mt-8 flex w-full max-w-xs gap-2">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => (timer.running ? timer.pause() : timer.resume())}
            >
              {timer.running ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
              {timer.running ? t("session.pause") : t("session.resume")}
            </Button>
            <Button variant="danger" className="flex-1" onClick={handleEnd}>
              <X className="h-4 w-4" />
              {t("session.end")}
            </Button>
          </div>
        </div>
      )}

      {phase === "checkin" && (
        <div>
          <h1 className="text-2xl font-bold">{t("session.checkinTitle")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t("session.checkinHint")}</p>

          <div className="mt-6 space-y-6">
            <div>
              <p className="text-sm font-medium">{t("session.checkinQ1")}</p>
              <div className="mt-2 flex gap-2">
                <OptionChip selected={accomplished === "yes"} onClick={() => setAccomplished("yes")}>
                  {t("session.checkinYes")}
                </OptionChip>
                <OptionChip
                  selected={accomplished === "partial"}
                  onClick={() => setAccomplished("partial")}
                >
                  {t("session.checkinPartial")}
                </OptionChip>
                <OptionChip selected={accomplished === "no"} onClick={() => setAccomplished("no")}>
                  {t("session.checkinNo")}
                </OptionChip>
              </div>
            </div>

            <div>
              <p className="text-sm font-medium">{t("session.checkinQ2")}</p>
              <div className="mt-2 flex gap-2">
                <OptionChip selected={helped === "yes"} onClick={() => setHelped("yes")}>
                  {t("session.checkinYes")}
                </OptionChip>
                <OptionChip selected={helped === "partial"} onClick={() => setHelped("partial")}>
                  {t("session.checkinPartial")}
                </OptionChip>
                <OptionChip selected={helped === "no"} onClick={() => setHelped("no")}>
                  {t("session.checkinNo")}
                </OptionChip>
              </div>
            </div>

            <div>
              <p className="text-sm font-medium">{t("session.checkinQ3")}</p>
              <div className="mt-2 flex items-center gap-1.5">
                <span className="text-xs text-muted-foreground">{t("session.feelingLow")}</span>
                {Array.from({ length: FEELING_MAX }, (_, i) => i + 1).map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setFeeling(n)}
                    className={cn(
                      "h-11 flex-1 rounded-lg border text-sm font-semibold tabular-nums transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      feeling === n
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border bg-card text-muted-foreground hover:bg-muted",
                    )}
                  >
                    {n}
                  </button>
                ))}
                <span className="text-xs text-muted-foreground">{t("session.feelingHigh")}</span>
              </div>
            </div>
          </div>

          <Button
            className="mt-8 w-full"
            size="lg"
            onClick={handleSubmit}
            disabled={!canSubmit || saving}
          >
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            {saving ? t("session.checkinSaving") : t("session.checkinSubmit")}
          </Button>
        </div>
      )}

      {phase === "recovery" && (
        <div className="flex flex-col">
          <h1 className="text-2xl font-bold">{t("recovery.title")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t("recovery.hint")}</p>

          {helped === "no" && (
            <div className="mt-6 rounded-lg border border-primary/30 bg-primary/5 p-4">
              <p className="text-sm font-medium">{t("recovery.escalateTitle")}</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {t("recovery.escalateHint")}
              </p>
              <Button
                className="mt-3 w-full"
                size="lg"
                onClick={escalate}
                disabled={escalating || saving}
              >
                {escalating ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Sparkles className="h-4 w-4" />
                )}
                {t("recovery.escalateCta")}
              </Button>
            </div>
          )}

          <div className="mt-6 space-y-3">
            {RECOVERY_OPTIONS.map((minutes) => (
              <Button
                key={minutes}
                className="w-full"
                size="lg"
                variant="outline"
                onClick={() => recover(minutes)}
                disabled={saving || escalating}
              >
                <RotateCcw className="h-4 w-4" />
                {t("recovery.recover", { minutes })}
              </Button>
            ))}
            <Button
              variant="ghost"
              className="w-full"
              onClick={declineRecovery}
              disabled={saving || escalating}
            >
              {t("recovery.skip")}
            </Button>
          </div>

          <p className="mt-6 text-center text-xs text-muted-foreground">{t("recovery.note")}</p>
        </div>
      )}
    </div>
  );
}
