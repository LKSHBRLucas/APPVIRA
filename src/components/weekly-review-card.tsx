import { Loader2, Sparkles } from "lucide-react";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useDashboard } from "@/hooks/use-dashboard";
import { useIntentions } from "@/hooks/use-intentions";
import { OBSTACLE_LABELS } from "@/lib/intervention/catalog";
import type { ObstacleCode } from "@/lib/intervention/types";
import { suggestIntentions } from "@/lib/plan/suggestions";
import { OBSTACLE_TO_PROFILE } from "@/lib/behaviors/profiles";

/** Obstacles need to show up at least this many times in the week to be
 * worth turning into a fixed plan — one-off obstacles are noise, not a
 * pattern. */
const MIN_OCCURRENCES = 2;

/**
 * Closes the loop between "we measured a pattern" and "the user acted on
 * it". The dashboard already computes the week's top obstacle
 * (report.topObstacles); this card is the one nudge that turns that number
 * into a saved SE → ENTÃO plan, instead of leaving it to sit passively in a
 * chart the user has to remember to check.
 */
export function WeeklyReviewCard() {
  const { t } = useTranslation();
  const { report, isLoading } = useDashboard("7d");
  const { intentions, create } = useIntentions();
  const [dismissed, setDismissed] = useState(false);
  const [saving, setSaving] = useState(false);

  const topObstacle = report.topObstacles[0] ?? null;

  const alreadyCovered = useMemo(() => {
    if (!topObstacle) return true;
    return intentions.some(
      (i) => i.active && i.trigger_code === topObstacle.code,
    );
  }, [intentions, topObstacle]);

  if (isLoading || dismissed || !topObstacle || alreadyCovered) return null;
  if (topObstacle.count < MIN_OCCURRENCES) return null;

  const code = topObstacle.code as ObstacleCode;
  const label = OBSTACLE_LABELS[code] ?? topObstacle.code;
  const profile = OBSTACLE_TO_PROFILE[code];
  const suggestion = suggestIntentions(profile, {
    bestHour: report.bestHours[0]
      ? { hour: report.bestHours[0].hour, count: report.bestHours[0].count }
      : null,
    topObstacle: { code, count: topObstacle.count },
    bestDurationRange: null,
    initiationRate: report.initiationRate,
  })[0];

  const handleCreate = async () => {
    if (!suggestion) return;
    setSaving(true);
    try {
      await create.mutateAsync({
        if_part: suggestion.ifPart,
        then_part: suggestion.thenPart,
        trigger_code: suggestion.triggerCode,
      });
      toast.success(t("dashboard.weeklyReviewSaved"));
    } catch {
      toast.error(t("session.saveError"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-lg border border-primary/30 bg-primary/5 p-4">
      <p className="text-sm font-medium">
        {t("dashboard.weeklyReviewTitle", { label, count: topObstacle.count })}
      </p>
      <p className="mt-1 text-sm text-muted-foreground">
        {t("dashboard.weeklyReviewHint")}
      </p>
      {suggestion && (
        <div className="mt-3 rounded-md border border-border bg-card p-3 text-xs text-muted-foreground">
          <p>{suggestion.ifPart}</p>
          <p className="mt-1">{suggestion.thenPart}</p>
        </div>
      )}
      <div className="mt-3 flex gap-2">
        <Button
          className="flex-1"
          onClick={handleCreate}
          disabled={saving || !suggestion}
        >
          {saving ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Sparkles className="h-4 w-4" />
          )}
          {t("dashboard.weeklyReviewCta")}
        </Button>
        <Button variant="ghost" onClick={() => setDismissed(true)} disabled={saving}>
          {t("dashboard.weeklyReviewSkip")}
        </Button>
      </div>
    </div>
  );
}
