import {
  AlertTriangle,
  BarChart3,
  ClipboardCheck,
  Clock,
  Flame,
  LineChart,
  Play,
  Sun,
  Target,
  TrendingUp,
  Trophy,
} from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { useDashboard } from "@/hooks/use-dashboard";
import { upsertBehaviorPattern } from "@/lib/data/behaviors";
import { OBSTACLE_LABELS } from "@/lib/intervention/catalog";
import type { PeriodKey } from "@/lib/metrics/dashboard";
import { cn } from "@/lib/utils";

const PERIODS: { key: PeriodKey; labelKey: string }[] = [
  { key: "today", labelKey: "dashboard.today" },
  { key: "7d", labelKey: "dashboard.sevenDays" },
  { key: "30d", labelKey: "dashboard.thirtyDays" },
  { key: "all", labelKey: "dashboard.allTime" },
];

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

function BarList({
  items,
  valueFormatter = (v) => String(v),
}: {
  items: { key: string; label: string; value: number }[];
  valueFormatter?: (v: number) => string;
}) {
  const max = Math.max(...items.map((i) => i.value), 1);
  return (
    <div className="space-y-2">
      {items.map((item) => (
        <div key={item.key} className="flex items-center gap-3">
          <span className="w-32 shrink-0 truncate text-xs text-muted-foreground">
            {item.label}
          </span>
          <div className="h-6 flex-1 overflow-hidden rounded-md bg-muted">
            <div
              className="h-full rounded-md bg-primary/80"
              style={{ width: `${(item.value / max) * 100}%` }}
            />
          </div>
          <span className="w-14 shrink-0 text-right text-xs font-medium tabular-nums">
            {valueFormatter(item.value)}
          </span>
        </div>
      ))}
    </div>
  );
}

function ChartCard({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: typeof Target;
  children: ReactNode;
}) {
  return (
    <section className="rounded-lg border border-border bg-card p-4">
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4 text-primary" />
        <h2 className="text-sm font-medium">{title}</h2>
      </div>
      <div className="mt-3">{children}</div>
    </section>
  );
}

function EmptyNote({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-lg border border-dashed border-border p-3 text-center text-xs text-muted-foreground">
      {children}
    </p>
  );
}

export default function DashboardPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [period, setPeriod] = useState<PeriodKey>("30d");
  const { report, isLoading } = useDashboard(period);

  useEffect(() => {
    if (!user || report.total === 0) return;
    void upsertBehaviorPattern(user.id, "dashboard_insights", {
      period,
      total: report.total,
      started: report.started,
      completed: report.completed,
      recovered: report.recovered,
      abandoned: report.abandoned,
      initiationRate: report.initiationRate,
      completionRate: report.completionRate,
      generatedAt: new Date().toISOString(),
    });
  }, [
    user,
    period,
    report.total,
    report.started,
    report.completed,
    report.recovered,
    report.abandoned,
    report.initiationRate,
    report.completionRate,
  ]);

  const pct = (rate: number) => `${Math.round(rate * 100)}%`;
  const min = report.avgLatencyMin === null ? "—" : `${Math.round(report.avgLatencyMin)} min`;

  const interventionsBars = report.interventions.map((i) => ({
    key: i.code,
    label: i.name,
    value: i.count,
  }));
  const effectiveBars = report.mostEffective.map((i) => ({
    key: i.code,
    label: i.name,
    value: Math.round((i.completionRate as number) * 100),
  }));
  const hoursBars = report.bestHours.map((h) => ({
    key: String(h.hour),
    label: `${String(h.hour).padStart(2, "0")}:00`,
    value: h.count,
  }));
  const obstacleBars = report.topObstacles.map((o) => ({
    key: o.code,
    label: OBSTACLE_LABELS[o.code as keyof typeof OBSTACLE_LABELS] ?? o.code,
    value: o.count,
  }));

  return (
    <div className="animate-fade-in-up space-y-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t("dashboard.title")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("dashboard.subtitle")}</p>
      </div>

      <div className="flex gap-1 rounded-lg border border-border bg-card p-1">
        {PERIODS.map((p) => (
          <button
            key={p.key}
            type="button"
            onClick={() => setPeriod(p.key)}
            className={cn(
              "flex-1 rounded-md px-2 py-1.5 text-xs font-medium transition-colors",
              period === p.key
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {t(p.labelKey)}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-24 animate-pulse rounded-lg bg-muted" />
          ))}
        </div>
      ) : report.total === 0 ? (
        <div className="flex flex-col items-center rounded-lg border border-dashed border-border p-8 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted">
            <LineChart className="h-7 w-7 text-primary" />
          </div>
          <h2 className="mt-4 text-lg font-bold">{t("dashboard.emptyTitle")}</h2>
          <p className="mt-1 max-w-xs text-sm text-muted-foreground">
            {t("dashboard.emptyHint")}
          </p>
          <Button className="mt-5 w-full" size="lg" onClick={() => navigate("/stuck")}>
            <Play className="h-4 w-4" />
            {t("dashboard.emptyCta")}
          </Button>
        </div>
      ) : (
        <>
          {report.started === 0 && (
            <div className="rounded-lg border border-primary/30 bg-primary/5 p-4">
              <p className="text-sm font-medium">{t("dashboard.startEmptyTitle")}</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {t("dashboard.startEmptyHint", { count: report.total })}
              </p>
              <Button
                variant="outline"
                className="mt-3 w-full"
                onClick={() => navigate("/stuck")}
              >
                <Play className="h-4 w-4" />
                {t("dashboard.startEmptyCta")}
              </Button>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <MetricCard
              icon={Target}
              label={t("dashboard.initiation")}
              value={pct(report.initiationRate)}
              hint={t("dashboard.initiationHint")}
            />
            <MetricCard
              icon={Clock}
              label={t("dashboard.lta")}
              value={min}
              hint={t("dashboard.ltaHint")}
            />
            <MetricCard
              icon={TrendingUp}
              label={t("dashboard.completion")}
              value={pct(report.completionRate)}
              hint={t("dashboard.completionHint")}
            />
            <MetricCard
              icon={Flame}
              label={t("dashboard.recovery")}
              value={pct(report.recoveryRate)}
              hint={t("dashboard.recoveryHint")}
            />
          </div>

          {report.interventions.length > 0 && (
            <ChartCard title={t("dashboard.interventionsTitle")} icon={BarChart3}>
              <BarList items={interventionsBars} />
            </ChartCard>
          )}

          {report.mostEffective.length > 0 ? (
            <ChartCard title={t("dashboard.effectiveTitle")} icon={Trophy}>
              <p className="mb-2 text-xs text-muted-foreground">
                {t("dashboard.effectiveHint")}
              </p>
              <BarList items={effectiveBars} valueFormatter={(v) => `${v}%`} />
            </ChartCard>
          ) : (
            <ChartCard title={t("dashboard.effectiveTitle")} icon={Trophy}>
              <EmptyNote>{t("dashboard.effectiveEmpty")}</EmptyNote>
            </ChartCard>
          )}

          {report.bestHours.length > 0 && (
            <ChartCard title={t("dashboard.hoursTitle")} icon={Sun}>
              <BarList items={hoursBars} />
            </ChartCard>
          )}

          {report.topObstacles.length > 0 && (
            <ChartCard title={t("dashboard.obstaclesTitle")} icon={AlertTriangle}>
              <BarList items={obstacleBars} />
            </ChartCard>
          )}

          {report.checkins.answered > 0 ? (
            <ChartCard title={t("dashboard.checkinsTitle")} icon={ClipboardCheck}>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="rounded-lg bg-muted p-3">
                  <p className="text-lg font-bold tabular-nums">
                    {report.checkins.accomplishmentRate === null
                      ? "—"
                      : pct(report.checkins.accomplishmentRate)}
                  </p>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    {t("dashboard.checkinAccomplished")}
                  </p>
                </div>
                <div className="rounded-lg bg-muted p-3">
                  <p className="text-lg font-bold tabular-nums">
                    {report.checkins.helpRate === null ? "—" : pct(report.checkins.helpRate)}
                  </p>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    {t("dashboard.checkinHelp")}
                  </p>
                </div>
                <div className="rounded-lg bg-muted p-3">
                  <p className="text-lg font-bold tabular-nums">
                    {report.checkins.avgFeeling === null
                      ? "—"
                      : report.checkins.avgFeeling.toFixed(1)}
                  </p>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    {t("dashboard.checkinFeeling")}
                  </p>
                </div>
              </div>
            </ChartCard>
          ) : (
            <ChartCard title={t("dashboard.checkinsTitle")} icon={ClipboardCheck}>
              <EmptyNote>{t("dashboard.checkinsEmpty")}</EmptyNote>
            </ChartCard>
          )}
        </>
      )}
    </div>
  );
}
