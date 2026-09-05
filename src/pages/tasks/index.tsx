import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Check, Circle, ListTodo, Plus, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/empty-state";
import { useTasks } from "@/hooks/use-tasks";
import { cn } from "@/lib/utils";

function formatSchedule(value: string | null): string | null {
  if (!value) return null;
  return format(new Date(value), "EEE d 'de' MMM · HH:mm", { locale: ptBR });
}

export default function TasksPage() {
  const { t } = useTranslation();
  const { tasks, isLoading, complete, remove } = useTasks();

  const open = tasks.filter((task) => task.status === "planned");
  const done = tasks.filter((task) => task.status === "done");

  return (
    <div className="animate-fade-in-up">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t("tasks.title")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t("tasks.subtitle")}</p>
        </div>
        <Button asChild size="icon" className="h-11 w-11">
          <Link to="/tasks/new" aria-label={t("tasks.add")}>
            <Plus className="h-5 w-5" />
          </Link>
        </Button>
      </div>

      {isLoading && (
        <div className="space-y-2">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      )}

      {!isLoading && open.length === 0 && (
        <EmptyState
          icon={ListTodo}
          title={t("tasks.empty")}
          action={
            <Button asChild className="mt-1">
              <Link to="/tasks/new">{t("tasks.createFirst")}</Link>
            </Button>
          }
        />
      )}

      {open.length > 0 && (
        <div className="space-y-2">
          {open.map((task) => (
            <div
              key={task.id}
              className="flex items-start gap-3 rounded-lg border border-border bg-card p-4"
            >
              <button
                type="button"
                onClick={() => complete.mutate(task.id)}
                className="mt-0.5 text-muted-foreground transition-colors hover:text-primary"
                aria-label={t("tasks.markDone")}
              >
                <Circle className="h-5 w-5" />
              </button>
              <div className="min-w-0 flex-1">
                <p className="font-medium leading-snug">{task.title}</p>
                {task.first_step && (
                  <p className="mt-0.5 truncate text-sm text-muted-foreground">
                    {task.first_step}
                  </p>
                )}
                <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <span className="rounded-full bg-muted px-2 py-0.5">
                    {t(`tasks.category.${task.category}`)}
                  </span>
                  <span>{task.duration_min} min</span>
                  {formatSchedule(task.scheduled_at) && (
                    <span>{formatSchedule(task.scheduled_at)}</span>
                  )}
                </div>
              </div>
              <button
                type="button"
                onClick={() => remove.mutate(task.id)}
                className="mt-0.5 text-muted-foreground transition-colors hover:text-destructive"
                aria-label={t("tasks.delete")}
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      {done.length > 0 && (
        <div className="mt-6">
          <h2 className="mb-2 text-sm font-medium text-muted-foreground">
            {t("tasks.done")}
          </h2>
          <div className="space-y-2">
            {done.map((task) => (
              <div
                key={task.id}
                className={cn(
                  "flex items-center gap-3 rounded-lg border border-border/60 bg-card/60 p-4",
                )}
              >
                <Check className="h-5 w-5 text-primary" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-muted-foreground line-through">
                    {task.title}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
