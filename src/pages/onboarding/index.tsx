import { useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Navigate, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/use-auth";
import { useProfile } from "@/hooks/use-profile";
import { dominantProfile, PROFILE_CATALOG } from "@/lib/behaviors/profiles";
import type { ObstacleCode } from "@/lib/intervention/types";
import { cn } from "@/lib/utils";

const OBSTACLE_OPTIONS: { code: ObstacleCode; labelKey: string }[] = [
  { code: "phone", labelKey: "onboarding.obstacle.phone" },
  { code: "task_too_big", labelKey: "onboarding.obstacle.taskTooBig" },
  { code: "no_start_point", labelKey: "onboarding.obstacle.noStartPoint" },
  { code: "perfectionism", labelKey: "onboarding.obstacle.perfectionism" },
  { code: "fear_of_failure", labelKey: "onboarding.obstacle.fearOfFailure" },
  { code: "tired", labelKey: "onboarding.obstacle.tired" },
  { code: "no_motivation", labelKey: "onboarding.obstacle.noMotivation" },
  { code: "distracted", labelKey: "onboarding.obstacle.distracted" },
];

const STEPS = ["name", "routine", "goal", "obstacles"] as const;
type Step = (typeof STEPS)[number];

export default function OnboardingPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { profile, update } = useProfile();

  const [stepIndex, setStepIndex] = useState(0);
  const [name, setName] = useState("");
  const [workStart, setWorkStart] = useState("09:00");
  const [workEnd, setWorkEnd] = useState("18:00");
  const [sleepTime, setSleepTime] = useState("23:00");
  const [mainGoal, setMainGoal] = useState("");
  const [selectedObstacles, setSelectedObstacles] = useState<ObstacleCode[]>([]);
  const [saving, setSaving] = useState(false);

  const step = STEPS[stepIndex];

  const canNext = useMemo(() => {
    if (step === "name") return name.trim().length > 0;
    if (step === "goal") return mainGoal.trim().length > 0;
    if (step === "obstacles") return selectedObstacles.length > 0;
    return true;
  }, [step, name, mainGoal, selectedObstacles]);

  // Already onboarded → straight to the app.
  if (!user) return <Navigate to="/auth" replace />;
  if (profile?.onboarding_completed) return <Navigate to="/" replace />;

  const toggleObstacle = (code: ObstacleCode) => {
    setSelectedObstacles((prev) =>
      prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code],
    );
  };

  const next = async () => {
    if (stepIndex < STEPS.length - 1) {
      setStepIndex((i) => i + 1);
      return;
    }

    setSaving(true);
    const counts = selectedObstacles.reduce<Partial<Record<ObstacleCode, number>>>(
      (acc, code) => {
        acc[code] = (acc[code] ?? 0) + 1;
        return acc;
      },
      {},
    );
    const profileType = dominantProfile(counts);

    await update.mutateAsync({
      name: name.trim(),
      work_start: `${workStart}:00`,
      work_end: `${workEnd}:00`,
      sleep_time: `${sleepTime}:00`,
      main_goal: mainGoal.trim(),
      procrastination_profile: profileType.code,
      onboarding_completed: true,
    });
    setSaving(false);
    navigate("/", { replace: true });
  };

  const stepTitle =
    step === "name"
      ? t("onboarding.nameTitle")
      : step === "routine"
        ? t("onboarding.routineTitle")
        : step === "goal"
          ? t("onboarding.goalTitle")
          : t("onboarding.obstacleTitle");

  const stepHint =
    step === "name"
      ? t("onboarding.nameHint")
      : step === "routine"
        ? t("onboarding.routineHint")
        : step === "goal"
          ? t("onboarding.goalHint")
          : t("onboarding.obstacleHint");

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

        <div className="mt-6 space-y-4">
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

          {step === "routine" && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="onboarding-start">{t("onboarding.workStart")}</Label>
                <Input
                  id="onboarding-start"
                  type="time"
                  value={workStart}
                  onChange={(e) => setWorkStart(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="onboarding-end">{t("onboarding.workEnd")}</Label>
                <Input
                  id="onboarding-end"
                  type="time"
                  value={workEnd}
                  onChange={(e) => setWorkEnd(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="onboarding-sleep">{t("onboarding.sleepTime")}</Label>
                <Input
                  id="onboarding-sleep"
                  type="time"
                  value={sleepTime}
                  onChange={(e) => setSleepTime(e.target.value)}
                />
              </div>
            </div>
          )}

          {step === "goal" && (
            <div className="space-y-2">
              <Label htmlFor="onboarding-goal">{t("onboarding.goalLabel")}</Label>
              <Input
                id="onboarding-goal"
                value={mainGoal}
                onChange={(e) => setMainGoal(e.target.value)}
                placeholder={t("onboarding.goalPlaceholder")}
                autoFocus
              />
            </div>
          )}

          {step === "obstacles" && (
            <div className="space-y-2">
              {OBSTACLE_OPTIONS.map(({ code, labelKey }) => (
                <button
                  key={code}
                  type="button"
                  onClick={() => toggleObstacle(code)}
                  className={cn(
                    "flex w-full items-center justify-between rounded-lg border px-4 py-3 text-left text-sm transition-colors",
                    selectedObstacles.includes(code)
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border bg-card hover:bg-muted",
                  )}
                >
                  {t(labelKey)}
                </button>
              ))}
            </div>
          )}
        </div>
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
