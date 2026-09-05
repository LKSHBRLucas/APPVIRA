import { useMemo, useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { Navigate, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/use-auth";
import { useProfile } from "@/hooks/use-profile";
import { useTasks } from "@/hooks/use-tasks";
import { defaultFocusMin } from "@/lib/data/profiles";
import { handleError } from "@/lib/feedback";
import { cn } from "@/lib/utils";

const STEPS = ["name", "firstTask"] as const;
type Step = (typeof STEPS)[number];

/**
 * Short onboarding: name, then create the first task in the same flow.
 * Goal: a task created in under a minute. Nothing else.
 */
export default function OnboardingPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { profile, update } = useProfile();
  const { create: createTask } = useTasks();

  const [stepIndex, setStepIndex] = useState(0);
  const [name, setName] = useState("");
  const [taskTitle, setTaskTitle] = useState("");
  const [firstStep, setFirstStep] = useState("");
  const [saving, setSaving] = useState(false);

  const step = STEPS[stepIndex];

  const canNext = useMemo(() => {
    if (step === "name") return name.trim().length > 0;
    return taskTitle.trim().length > 0;
  }, [step, name, taskTitle]);

  if (!user) return <Navigate to="/auth" replace />;
  if (profile?.onboarding_completed) return <Navigate to="/" replace />;

  const next = async () => {
    if (stepIndex < STEPS.length - 1) {
      setStepIndex((i) => i + 1);
      return;
    }

    setSaving(true);

    try {
      // Create the first task right here — first step included.
      await createTask.mutateAsync({
        title: taskTitle.trim(),
        category: "other",
        first_step: firstStep.trim() || null,
        scheduled_at: null,
        duration_min: defaultFocusMin(profile),
      });

      // Mark onboarding complete.
      await update.mutateAsync({
        name: name.trim(),
        onboarding_completed: true,
      });
    } catch (error) {
      handleError(t, "onboarding.finish", error);
      setSaving(false);
      return;
    }

    setSaving(false);
    navigate("/", { replace: true });
  };

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (!canNext) return;
    void next();
  };

  const stepTitle =
    step === "name" ? t("onboarding.nameTitle") : t("onboarding.taskTitle");
  const stepHint =
    step === "name" ? t("onboarding.nameHint") : t("onboarding.taskHint");

  return (
    <div className="flex min-h-full flex-col bg-gradient-subtle px-4 pt-10 pb-6">
      <div className="mx-auto w-full max-w-md flex-1">
        <div className="mb-6 flex items-center gap-2">
          <div className="flex gap-1.5">
            {STEPS.map((s, i) => (
              <span
                key={s}
                className={cn(
                  "h-1.5 rounded-full transition-all",
                  i <= stepIndex ? "w-6 bg-primary" : "w-3 bg-border",
                )}
              />
            ))}
          </div>
          <span className="ml-auto text-xs text-muted-foreground">
            {stepIndex + 1}/{STEPS.length}
          </span>
        </div>

        <h1 className="text-2xl font-bold tracking-tight">{stepTitle}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{stepHint}</p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          {step === "name" && (
            <div className="space-y-2">
              <Label htmlFor="onboarding-name">{t("onboarding.nameLabel")}</Label>
              <Input
                id="onboarding-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t("auth.namePlaceholder")}
                autoFocus
              />
            </div>
          )}

          {step === "firstTask" && (
            <>
              <div className="space-y-2">
                <Label htmlFor="onboarding-task">{t("onboarding.taskLabel")}</Label>
                <Input
                  id="onboarding-task"
                  value={taskTitle}
                  onChange={(e) => setTaskTitle(e.target.value)}
                  placeholder={t("onboarding.taskPlaceholder")}
                  autoFocus
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="onboarding-first-step">{t("onboarding.firstStepLabel")}</Label>
                <Input
                  id="onboarding-first-step"
                  value={firstStep}
                  onChange={(e) => setFirstStep(e.target.value)}
                  placeholder={t("onboarding.firstStepPlaceholder")}
                />
                <p className="text-xs text-muted-foreground">
                  {t("onboarding.firstStepHint")}
                </p>
              </div>
            </>
          )}
        </form>
      </div>

      <div className="mx-auto w-full max-w-md">
        <Button
          className="w-full"
          size="lg"
          onClick={next}
          disabled={!canNext || saving}
        >
          {stepIndex === STEPS.length - 1
            ? saving
              ? t("onboarding.saving")
              : t("onboarding.finish")
            : t("onboarding.next")}
        </Button>
      </div>
    </div>
  );
}
