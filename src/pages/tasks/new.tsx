import { useEffect, useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useNotifications } from "@/hooks/use-notifications";
import { usePrivacy } from "@/hooks/use-privacy";
import { useProfile } from "@/hooks/use-profile";
import { useTasks } from "@/hooks/use-tasks";
import { defaultFocusMin } from "@/lib/data/profiles";
import { handleError } from "@/lib/feedback";

const CATEGORIES = ["study", "training", "project", "reading", "organizing", "other"] as const;

export default function NewTaskPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { create } = useTasks();
  const { create: createNotification } = useNotifications();
  const { profile } = useProfile();
  const { settings } = usePrivacy();

  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<string>("study");
  const [firstStep, setFirstStep] = useState("");
  const [duration, setDuration] = useState(() => String(defaultFocusMin(profile)));
  const [scheduledAt, setScheduledAt] = useState("");
  const [saving, setSaving] = useState(false);

  const durationNum = Number(duration);
  const durationInvalid = !Number.isFinite(durationNum) || durationNum < 1 || durationNum > 480;
  const scheduleInvalid = scheduledAt !== "" && Number.isNaN(new Date(scheduledAt).getTime());

  useEffect(() => {
    if (profile && duration === String(25)) {
      setDuration(String(defaultFocusMin(profile)));
    }
  }, [profile, duration]);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!title.trim() || durationInvalid || scheduleInvalid || saving) return;
    setSaving(true);
    try {
      await create.mutateAsync({
        title: title.trim(),
        category,
        first_step: firstStep.trim() || null,
        duration_min: Math.round(durationNum),
        scheduled_at: scheduledAt ? new Date(scheduledAt).toISOString() : null,
      });

      if (scheduledAt && (settings?.notifications_enabled ?? true)) {
        await createNotification.mutateAsync({
          type: "reminder",
          title: title.trim(),
          body: t("tasks.reminderBody"),
          scheduled_for: new Date(scheduledAt).toISOString(),
        });
      }

      toast.success(t("tasks.created"));
      navigate("/tasks", { replace: true });
    } catch (error) {
      handleError(t, "tasks.create", error);
      setSaving(false);
    }
  };

  return (
    <div className="animate-fade-in-up">
      <h1 className="text-2xl font-bold tracking-tight">{t("tasks.newTitle")}</h1>
      <p className="mt-1 text-sm text-muted-foreground">{t("tasks.newHint")}</p>

      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        <div className="space-y-2">
          <Label htmlFor="task-title">{t("tasks.titleLabel")}</Label>
          <Input
            id="task-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={t("tasks.titlePlaceholder")}
            autoFocus
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="task-category">{t("tasks.categoryLabel")}</Label>
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger id="task-category" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CATEGORIES.map((c) => (
                <SelectItem key={c} value={c}>
                  {t(`tasks.category.${c}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="task-first-step">{t("tasks.firstStepLabel")}</Label>
          <Input
            id="task-first-step"
            value={firstStep}
            onChange={(e) => setFirstStep(e.target.value)}
            placeholder={t("tasks.firstStepPlaceholder")}
          />
          <p className="text-xs text-muted-foreground">{t("tasks.firstStepHint")}</p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label htmlFor="task-duration">{t("tasks.durationLabel")}</Label>
            <Input
              id="task-duration"
              type="number"
              min={1}
              max={480}
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
              aria-invalid={durationInvalid}
            />
            {durationInvalid && (
              <p className="text-xs text-destructive">{t("tasks.durationInvalid")}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="task-scheduled">{t("tasks.scheduledLabel")}</Label>
            <Input
              id="task-scheduled"
              type="datetime-local"
              value={scheduledAt}
              onChange={(e) => setScheduledAt(e.target.value)}
              aria-invalid={scheduleInvalid}
            />
            {scheduleInvalid && (
              <p className="text-xs text-destructive">{t("tasks.scheduleInvalid")}</p>
            )}
          </div>
        </div>

        <Button
          type="submit"
          className="w-full"
          size="lg"
          disabled={saving || !title.trim() || durationInvalid || scheduleInvalid}
        >
          {saving ? t("tasks.saving") : t("tasks.save")}
        </Button>
      </form>
    </div>
  );
}
