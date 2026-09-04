import { Check, Pause, Play, RotateCcw, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useSession } from "@/hooks/use-sessions";
import { useSessionMutations } from "@/hooks/use-session-mutations";
import { useTasks } from "@/hooks/use-tasks";
import { insertFocusSession } from "@/lib/data/focus";
import { cn } from "@/lib/utils";

const RECOVERY_OPTIONS = [5, 15, 30] as const;

export default function SessionPage() {
  const { id } = useParams<{ id: string }>();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { data: session, isLoading } = useSession(id);
  const { patch, logEvent } = useSessionMutations();
  const { complete } = useTasks();

  const [startedAt, setStartedAt] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [paused, setPaused] = useState(false);
  const [phase, setPhase] = useState<"ready" | "focus" | "checkin" | "recovery">("ready");
  const [saving, setSaving] = useState(false);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current);
    };
  }, []);

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

  const handleStart = async () => {
    const startedIso = new Date().toISOString();
    setStartedAt(startedIso);
    setPhase("focus");
    await patch.mutateAsync({ id: session.id, patch: { actual_start: startedIso, status: "started" } });
    await logEvent.mutateAsync({ sessionId: session.id, type: "task_started" });

    timerRef.current = window.setInterval(() => {
      setElapsed((prev) => prev + 1);
    }, 1000);
  };

  const handleEnd = () => {
    setPhase("checkin");
    if (timerRef.current) window.clearInterval(timerRef.current);
  };

  const finishAs = async (outcome: "completed" | "abandoned") => {
    setSaving(true);
    const endedIso = new Date().toISOString();
    const duration = Math.round(elapsed / 60);
    const durationActual = Math.max(1, duration);
    const startIso = startedAt ?? session.actual_start ?? endedIso;

    await patch.mutateAsync({
      id: session.id,
      patch: {
        status: outcome,
        duration_actual: durationActual,
      },
    });

    await insertFocusSession(
      session.user_id,
      session.id,
      startIso,
      endedIso,
      durationActual,
    );

    if (outcome === "completed") {
      await logEvent.mutateAsync({ sessionId: session.id, type: "task_completed" });
      if (task) await complete.mutateAsync(task.id);
      setSaving(false);
      navigate("/", { replace: true });
    } else {
      await logEvent.mutateAsync({ sessionId: session.id, type: "task_abandoned" });
      setSaving(false);
      setPhase("recovery");
    }
  };

  const recover = async (minutes: number) => {
    setSaving(true);
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
      startedAt ?? session.actual_start ?? new Date().toISOString(),
      new Date().toISOString(),
      minutes,
    );
    setSaving(false);
    navigate("/", { replace: true });
  };

  const declineRecovery = async () => {
    await logEvent.mutateAsync({ sessionId: session.id, type: "recovery_declined" });
    navigate("/", { replace: true });
  };

  const mm = String(Math.floor(elapsed / 60)).padStart(2, "0");
  const ss = String(elapsed % 60).padStart(2, "0");

  return (
    <div className="animate-fade-in-up flex min-h-[calc(100vh-6rem)] flex-col">
      {phase === "ready" && (
        <>
          <p className="text-sm font-medium text-primary">{t("session.focusBadge")}</p>
          <h1 className="mt-1 text-2xl font-bold leading-tight">{task?.title ?? t("session.genericTask")}</h1>
          {task?.first_step && (
            <p className="mt-2 text-sm text-muted-foreground">
              {t("home.firstStep")}: {task.first_step}
            </p>
          )}

          <div className="mt-6 rounded-lg border border-border bg-card p-4 text-sm">
            <p className="font-medium">{t("session.planHeader")}</p>
            <p className="mt-1 text-muted-foreground">
              {session.intervention_code && t(`session.intervention.${session.intervention_code}`)}
            </p>
            <p className="mt-2 text-xs text-muted-foreground">
              {t("session.durationPlanned")}: {session.duration_planned} min
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
          <div className="text-center">
            <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
              {paused ? t("session.paused") : t("session.focusing")}
            </p>
            <p className="mt-3 font-mono text-6xl font-bold tabular-nums text-primary">
              {mm}:{ss}
            </p>
            <p className="mt-4 max-w-xs text-sm text-muted-foreground">{task?.title}</p>
          </div>

          <div className="mt-10 flex w-full max-w-xs gap-2">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => setPaused((p) => !p)}
            >
              {paused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
              {paused ? t("session.resume") : t("session.pause")}
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

          <div className="mt-6 space-y-3">
            <Button className="w-full" size="lg" onClick={() => finishAs("completed")} disabled={saving}>
              <Check className="h-5 w-5" />
              {t("session.completed")}
            </Button>
            <Button
              variant="outline"
              className="w-full"
              size="lg"
              onClick={() => finishAs("abandoned")}
              disabled={saving}
            >
              <X className="h-5 w-5" />
              {t("session.abandoned")}
            </Button>
          </div>
        </div>
      )}

      {phase === "recovery" && (
        <div className="flex flex-col">
          <h1 className="text-2xl font-bold">{t("recovery.title")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t("recovery.hint")}</p>

          <div className="mt-6 space-y-3">
            {RECOVERY_OPTIONS.map((minutes) => (
              <Button
                key={minutes}
                className="w-full"
                size="lg"
                variant="outline"
                onClick={() => recover(minutes)}
                disabled={saving}
              >
                <RotateCcw className="h-4 w-4" />
                {t("recovery.recover", { minutes })}
              </Button>
            ))}
            <Button
              variant="ghost"
              className="w-full"
              onClick={declineRecovery}
              disabled={saving}
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
