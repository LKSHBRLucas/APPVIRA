import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ArrowRight, BatteryLow, BatteryMedium, BatteryFull, Zap } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useCheckin } from "@/hooks/use-checkin";
import { useProfile } from "@/hooks/use-profile";
import { useTasks } from "@/hooks/use-tasks";
import { cn } from "@/lib/utils";

const EnergyIcon = ({ level }: { level: number }) => {
  if (level <= 2) return <BatteryLow className="h-4 w-4" />;
  if (level === 3) return <BatteryMedium className="h-4 w-4" />;
  return <BatteryFull className="h-4 w-4" />;
};

export default function HomePage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { profile } = useProfile();
  const { tasks, isLoading } = useTasks();
  const { latest, checkin } = useCheckin();
  const [energy, setEnergy] = useState<number | null>(null);

  const now = new Date();
  const nextAction =
    tasks
      .filter((task) => task.status === "planned")
      .sort((a, b) => {
        const at = (x: { scheduled_at: string | null }) =>
          x.scheduled_at ? new Date(x.scheduled_at).getTime() : Number.MAX_SAFE_INTEGER;
        return at(a) - at(b);
      })[0] ?? null;

  const upcoming = tasks
    .filter((task) => task.status === "planned" && task.scheduled_at)
    .sort(
      (a, b) =>
        new Date(a.scheduled_at!).getTime() - new Date(b.scheduled_at!).getTime(),
    )
    .slice(0, 3);

  const firstName = profile?.name?.trim()?.split(" ")[0] ?? t("home.friend");

  const pickEnergy = async (level: number) => {
    setEnergy(level);
    await checkin.mutateAsync(level);
  };

  return (
    <div className="animate-fade-in-up space-y-5">
      <div>
        <p className="text-sm text-muted-foreground">{t("home.greeting", { name: firstName })}</p>
        <h1 className="mt-0.5 text-2xl font-bold tracking-tight">{t("home.question")}</h1>
      </div>

      {/* Energy check-in */}
      <div className="rounded-lg border border-border bg-card p-4">
        <div className="flex items-center gap-2 text-sm font-medium">
          <EnergyIcon level={energy ?? latest?.level ?? 3} />
          <span>{t("home.energyLabel")}</span>
        </div>
        <div className="mt-3 flex gap-2">
          {[1, 2, 3, 4, 5].map((level) => (
            <button
              key={level}
              type="button"
              onClick={() => pickEnergy(level)}
              className={cn(
                "flex h-10 flex-1 items-center justify-center rounded-md border text-sm font-semibold transition-all",
                (energy ?? latest?.level) === level
                  ? "border-primary bg-primary/15 text-primary"
                  : "border-border bg-muted/40 text-muted-foreground hover:bg-muted",
              )}
              aria-label={t("home.energyLevel", { level })}
            >
              {level}
            </button>
          ))}
        </div>
      </div>

      {/* ESTOU TRAVADO CTA */}
      <button
        type="button"
        onClick={() => navigate("/stuck")}
        className="group relative w-full overflow-hidden rounded-xl bg-gradient-action p-5 text-left shadow-glow transition-transform active:scale-[0.99]"
      >
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-primary-foreground/80">
              {t("home.stuckBadge")}
            </p>
            <p className="mt-1 text-xl font-bold text-primary-foreground">
              {t("home.stuckTitle")}
            </p>
            <p className="mt-0.5 text-sm text-primary-foreground/90">
              {t("home.stuckHint")}
            </p>
          </div>
          <ArrowRight className="h-6 w-6 text-primary-foreground transition-transform group-hover:translate-x-1" />
        </div>
      </button>

      {/* Next action */}
      <div className="rounded-lg border border-border bg-card p-4">
        <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <Zap className="h-4 w-4 text-primary" />
          <span>{t("home.nextAction")}</span>
        </div>

        {isLoading ? (
          <div className="mt-3 h-16 animate-pulse rounded-md bg-muted" />
        ) : nextAction ? (
          <div className="mt-3">
            <p className="font-semibold leading-snug">{nextAction.title}</p>
            {nextAction.first_step && (
              <p className="mt-1 text-sm text-muted-foreground">
                {t("home.firstStep")}: {nextAction.first_step}
              </p>
            )}
            <Button
              className="mt-3 w-full"
              size="lg"
              onClick={() => navigate("/stuck", { state: { taskId: nextAction.id } })}
            >
              {t("home.start")}
            </Button>
          </div>
        ) : (
          <div className="mt-3">
            <p className="text-sm text-muted-foreground">{t("home.noTasks")}</p>
            <Button asChild className="mt-3 w-full" variant="outline">
              <Link to="/tasks/new">{t("home.addTask")}</Link>
            </Button>
          </div>
        )}
      </div>

      {/* Upcoming */}
      {upcoming.length > 0 && (
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-sm font-medium text-muted-foreground">{t("home.upcoming")}</p>
          <div className="mt-3 space-y-2">
            {upcoming.map((task) => (
              <div key={task.id} className="flex items-center justify-between gap-2">
                <p className="min-w-0 flex-1 truncate text-sm">{task.title}</p>
                <p className="shrink-0 text-xs text-muted-foreground">
                  {format(new Date(task.scheduled_at!), "EEE HH:mm", { locale: ptBR })}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
