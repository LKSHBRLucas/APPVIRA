import { ArrowRight, Plus, Save, Trash2, Wand2 } from "lucide-react";
import { useMemo, useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { EmptyState } from "@/components/empty-state";
import { useAuth } from "@/hooks/use-auth";
import { useIntentions } from "@/hooks/use-intentions";
import { useTasks } from "@/hooks/use-tasks";
import { handleError } from "@/lib/feedback";
import { buildImplementationPlan } from "@/lib/plan/suggestions";
import type { ObstacleCode } from "@/lib/intervention/types";
import { cn } from "@/lib/utils";

/**
 * Plano Se → Então — tela dedicada.
 * 1) Escolhe uma tarefa planejada (ou digita o que quer começar).
 * 2) O app transforma a tarefa abstrata em um plano SE → ENTÃO editável
 *    (ação amarrada ao primeiro passo quando existe).
 * 3) "Salvar plano" → implementation_intentions.insert (real).
 * 4) A lista abaixo lê de volta do banco (implementation_intentions.select)
 *    e permite ativar/desativar/excluir.
 * O motor de intervenção já consome as intenções ativas (trigger) para
 * combinações futuras; daqui o usuário pode ir direto ao fluxo travado.
 */
export default function PlansPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { tasks } = useTasks();
  const { intentions, isLoading, create, toggle, remove } = useIntentions();

  const plannedTasks = tasks.filter((task) => task.status === "planned");

  const [taskId, setTaskId] = useState<string | null>(null);
  const [freeText, setFreeText] = useState("");
  const [iiIf, setIiIf] = useState("");
  const [iiThen, setIiThen] = useState("");
  const [saving, setSaving] = useState(false);

  const selectedTask = taskId ? tasks.find((x) => x.id === taskId) : null;
  const taskTitle = selectedTask?.title ?? freeText.trim();

  const generate = () => {
    if (!taskTitle) return;
    const task =
      selectedTask?.title === taskTitle
        ? selectedTask
        : { title: taskTitle, firstStep: null };
    const plan = buildImplementationPlan(["other" as ObstacleCode], task);
    setIiIf(plan.ifPart);
    setIiThen(plan.thenPart);
    toast.success(t("plans.generated"));
  };

  const hasPlan = iiIf.trim().length > 0 || iiThen.trim().length > 0;

  const handleSave = async (event: FormEvent) => {
    event.preventDefault();
    if (!user || !iiIf.trim() || !iiThen.trim()) return;
    setSaving(true);
    try {
      await create.mutateAsync({
        if_part: iiIf.trim(),
        then_part: iiThen.trim(),
        trigger_code: "other",
      });
      toast.success(t("plans.saved"));
      setIiIf("");
      setIiThen("");
    } catch (error) {
      handleError(t, "plans.save", error);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="animate-fade-in-up space-y-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t("plans.title")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("plans.subtitle")}</p>
      </div>

      <Card className="border-border/60 bg-card/80">
        <CardHeader>
          <CardTitle className="text-lg">{t("plans.createTitle")}</CardTitle>
          <CardDescription>{t("plans.createHint")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {plannedTasks.length > 0 && (
            <div className="space-y-2">
              <Label>{t("plans.chooseTask")}</Label>
              <div className="flex flex-wrap gap-2">
                {plannedTasks.map((task) => (
                  <button
                    key={task.id}
                    type="button"
                    onClick={() => {
                      setTaskId(task.id);
                      setFreeText("");
                      setIiIf("");
                      setIiThen("");
                    }}
                    className={cn(
                      "rounded-full border px-3 py-1.5 text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      taskId === task.id
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border bg-card text-muted-foreground",
                    )}
                  >
                    {task.title}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="plans-free">{t("plans.orType")}</Label>
            <Input
              id="plans-free"
              value={freeText}
              onChange={(e) => {
                setFreeText(e.target.value);
                if (taskId) setTaskId(null);
              }}
              placeholder={t("plans.orTypePlaceholder")}
            />
          </div>

          <Button
            className="w-full"
            variant="outline"
            onClick={generate}
            disabled={!taskTitle}
          >
            <Wand2 className="h-4 w-4" />
            {t("plans.generate")}
          </Button>

          {hasPlan && (
            <form onSubmit={handleSave} className="space-y-3 rounded-lg border border-border bg-muted/30 p-4">
              <div className="space-y-1">
                <Label htmlFor="plans-if">{t("plans.if")}</Label>
                <Input
                  id="plans-if"
                  value={iiIf}
                  onChange={(e) => setIiIf(e.target.value)}
                  placeholder={t("plans.ifPlaceholder")}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="plans-then">{t("plans.then")}</Label>
                <Input
                  id="plans-then"
                  value={iiThen}
                  onChange={(e) => setIiThen(e.target.value)}
                  placeholder={t("plans.thenPlaceholder")}
                />
              </div>
              <Button
                type="submit"
                className="w-full"
                disabled={saving || !iiIf.trim() || !iiThen.trim()}
              >
                <Save className="h-4 w-4" />
                {saving ? t("plans.saving") : t("plans.save")}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>

      <Card className="border-border/60 bg-card/80">
        <CardHeader>
          <CardTitle className="text-lg">{t("plans.savedTitle")}</CardTitle>
          <CardDescription>{t("plans.savedHint")}</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-20 w-full" />
            </div>
          ) : intentions.length === 0 ? (
            <EmptyState icon={Save} title={t("plans.empty")} />
          ) : (
            <div className="space-y-2">
              {intentions.map((intention) => (
                <div
                  key={intention.id}
                  className="flex items-start gap-3 rounded-lg border border-border bg-card p-4"
                >
                  <Switch
                    checked={intention.active}
                    onCheckedChange={(active) =>
                      toggle.mutate({ id: intention.id, active })
                    }
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">{intention.if_part}</p>
                    <p className="mt-0.5 text-sm text-muted-foreground">
                      {intention.then_part}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => remove.mutate(intention.id)}
                    className="text-muted-foreground hover:text-destructive"
                    aria-label={t("plans.remove")}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Button asChild variant="outline" className="w-full">
        <Link to="/stuck">
          {t("plans.goStuck")}
          <ArrowRight className="h-4 w-4" />
        </Link>
      </Button>
    </div>
  );
}
