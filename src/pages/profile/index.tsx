import { Plus, Settings, Trash2 } from "lucide-react";
import { useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useIntentions } from "@/hooks/use-intentions";
import { useProfile } from "@/hooks/use-profile";
import { useSessions } from "@/hooks/use-sessions";
import { useSubscription } from "@/hooks/use-subscription";
import { deriveInsights } from "@/lib/behaviors/insights";
import type { ProcrastinationProfileCode } from "@/lib/behaviors/profiles";
import { handleError } from "@/lib/feedback";
import { suggestIntentions } from "@/lib/plan/suggestions";
import { cn } from "@/lib/utils";

type Tab = "plan" | "intentions";

export default function ProfilePage() {
  const { t } = useTranslation();
  const { profile } = useProfile();
  const { subscription } = useSubscription();
  const { intentions, create, toggle, remove } = useIntentions();
  const { data: sessions = [] } = useSessions(30);

  const [tab, setTab] = useState<Tab>("plan");
  const [ifPart, setIfPart] = useState("");
  const [thenPart, setThenPart] = useState("");
  const [saving, setSaving] = useState(false);

  const isPremium = subscription?.plan === "premium";
  const insights = deriveInsights(sessions);
  const suggestions = suggestIntentions(
    (profile?.procrastination_profile as ProcrastinationProfileCode | null) ?? null,
    insights,
  );

  const handleCreateIntention = async (event: FormEvent) => {
    event.preventDefault();
    if (!ifPart.trim() || !thenPart.trim() || saving) return;
    setSaving(true);
    try {
      await create.mutateAsync({
        if_part: ifPart.trim(),
        then_part: thenPart.trim(),
        trigger_code: null,
      });
      toast.success(t("profile.iiAdded"));
      setIfPart("");
      setThenPart("");
    } catch (error) {
      handleError(t, "profile.createIntention", error);
    } finally {
      setSaving(false);
    }
  };

  const tabs: { key: Tab; label: string }[] = [
    { key: "plan", label: t("profile.tab.plan") },
    { key: "intentions", label: t("profile.tab.intentions") },
  ];

  return (
    <div className="animate-fade-in-up space-y-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t("profile.title")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{profile?.name ?? ""}</p>
      </div>

      <Button asChild variant="outline" className="w-full">
        <Link to="/settings">
          <Settings className="h-4 w-4" />
          {t("nav.settings")}
        </Link>
      </Button>

      <div className="grid grid-cols-2 gap-1 rounded-lg bg-muted p-1">
        {tabs.map(({ key, label }) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={cn(
              "rounded-md py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              tab === key ? "bg-background text-foreground shadow-sm" : "text-muted-foreground",
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "plan" && (
        <Card className="border-border/60 bg-card/80">
          <CardHeader>
            <CardTitle className="text-lg">{t("profile.planTitle")}</CardTitle>
            <CardDescription>{t("profile.planHint")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div
              className={cn(
                "flex items-center justify-between rounded-lg border p-4",
                isPremium ? "border-primary/40 bg-primary/10" : "border-border",
              )}
            >
              <div>
                <p className="font-semibold">
                  {isPremium ? t("profile.premium") : t("profile.free")}
                </p>
                <p className="text-sm text-muted-foreground">
                  {isPremium ? t("profile.premiumDesc") : t("profile.freeDesc")}
                </p>
              </div>
              {isPremium && (
                <span className="text-sm font-semibold text-primary">{t("profile.active")}</span>
              )}
            </div>
            <p className="text-center text-xs text-muted-foreground">{t("profile.comingSoon")}</p>
          </CardContent>
        </Card>
      )}

      {tab === "intentions" && (
        <div className="space-y-4">
          <Button asChild variant="outline" className="w-full">
            <Link to="/plans">
              <Plus className="h-4 w-4" />
              {t("profile.iiFromTask")}
            </Link>
          </Button>

          <Card className="border-border/60 bg-card/80">
            <CardHeader>
              <CardTitle className="text-lg">{t("profile.iiTitle")}</CardTitle>
              <CardDescription>{t("profile.iiHint")}</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleCreateIntention} className="space-y-3">
                <div className="space-y-2">
                  <Label htmlFor="ii-if">{t("profile.iiIf")}</Label>
                  <Input
                    id="ii-if"
                    value={ifPart}
                    onChange={(e) => setIfPart(e.target.value)}
                    placeholder={t("profile.iiIfPlaceholder")}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ii-then">{t("profile.iiThen")}</Label>
                  <Input
                    id="ii-then"
                    value={thenPart}
                    onChange={(e) => setThenPart(e.target.value)}
                    placeholder={t("profile.iiThenPlaceholder")}
                  />
                </div>
                <Button
                  type="submit"
                  className="w-full"
                  disabled={saving || !ifPart.trim() || !thenPart.trim()}
                >
                  <Plus className="h-4 w-4" />
                  {t("profile.iiAdd")}
                </Button>
              </form>
            </CardContent>
          </Card>

          {suggestions.length > 0 && (
            <div className="rounded-lg border border-primary/30 bg-primary/5 p-4">
              <p className="text-sm font-medium text-primary">{t("profile.iiSuggestions")}</p>
              <div className="mt-2 space-y-1.5">
                {suggestions.map((s, i) => (
                  <p key={i} className="text-sm">
                    {s.ifPart} — {s.thenPart}
                  </p>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-2">
            {intentions.map((intention) => (
              <div key={intention.id} className="flex items-start gap-3 rounded-lg border border-border bg-card p-4">
                <Switch
                  checked={intention.active}
                  onCheckedChange={(active) => toggle.mutate({ id: intention.id, active })}
                />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{intention.if_part}</p>
                  <p className="mt-0.5 text-sm text-muted-foreground">{intention.then_part}</p>
                </div>
                <button
                  type="button"
                  onClick={() => remove.mutate(intention.id)}
                  className="text-muted-foreground hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  aria-label={t("profile.iiRemove")}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
            {intentions.length === 0 && (
              <p className="rounded-lg border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
                {t("profile.iiEmpty")}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
