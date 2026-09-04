import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useSessions } from "@/hooks/use-sessions";
import {
  avgSessionDuration,
  completionRate,
  initiationRate,
  latencyToAction,
  recoveryRate,
  type SessionLike,
} from "@/lib/metrics/metrics";
import { deriveInsights, deriveWeekly } from "@/lib/behaviors/insights";
import { OBSTACLE_LABELS } from "@/lib/intervention/catalog";
import { upsertBehaviorPattern } from "@/lib/data/behaviors";
import { useAuth } from "@/hooks/use-auth";
import { Clock, Flame, Target, TrendingUp, Zap } from "lucide-react";

function MetricCard({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: typeof Target;
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
        <Icon className="h-4 w-4 text-primary" />
        <span>{label}</span>
      </div>
      <p className="mt-2 text-2xl font-bold tabular-nums">{value}</p>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

export default function DashboardPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { data: sessions = [], isLoading } = useSessions(14);

  useEffect(() => {
    if (!user || sessions.length === 0) return;
    const insights = deriveInsights(sessions);
    void upsertBehaviorPattern(user.id, "weekly_insights", {
      ...insights,
      generatedAt: new Date().toISOString(),
    });
  }, [user, sessions]);

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-24 animate-pulse rounded-lg bg-muted" />
        ))}
      </div>
    );
  }

  const weekly = deriveWeekly(sessions);
  const like = sessions as SessionLike[];
  const initRate = initiationRate(like);
  const lta = latencyToAction(like);
  const compRate = completionRate(like);
  const recRate = recoveryRate(like);
  const avgDur = avgSessionDuration(like);
  const insights = deriveInsights(sessions);

  return (
    <div className="animate-fade-in-up space-y-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t("dashboard.title")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("dashboard.subtitle")}</p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <MetricCard
          icon={Target}
          label={t("dashboard.initiation")}
          value={`${Math.round(initRate * 100)}%`}
          hint={t("dashboard.initiationHint")}
        />
        <MetricCard
          icon={Clock}
          label={t("dashboard.lta")}
          value={lta === null ? "—" : `${Math.round(lta)} min`}
          hint={t("dashboard.ltaHint")}
        />
        <MetricCard
          icon={TrendingUp}
          label={t("dashboard.completion")}
          value={`${Math.round(compRate * 100)}%`}
          hint={t("dashboard.completionHint")}
        />
        <MetricCard
          icon={Flame}
          label={t("dashboard.recovery")}
          value={`${Math.round(recRate * 100)}%`}
          hint={t("dashboard.recoveryHint")}
        />
      </div>

      <div className="rounded-lg border border-border bg-card p-4">
        <p className="text-sm font-medium text-muted-foreground">{t("dashboard.weeklyTitle")}</p>
        <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
          <div className="flex items-center gap-2">
            <Zap className="h-4 w-4 text-primary" />
            <span>{t("dashboard.weeklyStarted", { count: weekly.startedCount })}</span>
          </div>
          <div className="flex items-center gap-2">
            <Target className="h-4 w-4 text-primary" />
            <span>{t("dashboard.weeklyCompleted", { count: weekly.completedCount })}</span>
          </div>
          <div className="flex items-center gap-2">
            <Flame className="h-4 w-4 text-primary" />
            <span>{t("dashboard.weeklyRecovered", { count: weekly.recoveredCount })}</span>
          </div>
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-primary" />
            <span>{t("dashboard.weeklyAbandoned", { count: weekly.abandonedCount })}</span>
          </div>
        </div>
      </div>

      {(insights.bestHour || insights.topObstacle || insights.bestDurationRange) && (
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-sm font-medium text-muted-foreground">{t("dashboard.insightsTitle")}</p>
          <div className="mt-3 space-y-2 text-sm">
            {insights.bestHour && (
              <p>
                <span className="font-medium">{t("dashboard.bestHour")}:</span>{" "}
                {String(insights.bestHour.hour).padStart(2, "0")}:00
              </p>
            )}
            {insights.topObstacle && (
              <p>
                <span className="font-medium">{t("dashboard.topObstacle")}:</span>{" "}
                {OBSTACLE_LABELS[insights.topObstacle.code as keyof typeof OBSTACLE_LABELS] ??
                  insights.topObstacle.code}
              </p>
            )}
            {insights.bestDurationRange && (
              <p>
                <span className="font-medium">{t("dashboard.bestDuration")}:</span>{" "}
                {insights.bestDurationRange.label} ({Math.round(insights.bestDurationRange.rate * 100)}% de conclusão)
              </p>
            )}
            {avgDur !== null && (
              <p className="text-xs text-muted-foreground">
                {t("dashboard.avgDuration", { minutes: Math.round(avgDur) })}
              </p>
            )}
          </div>
        </div>
      )}

      {sessions.length === 0 && (
        <div className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
          {t("dashboard.empty")}
        </div>
      )}
    </div>
  );
}
