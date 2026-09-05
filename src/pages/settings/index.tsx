import { Bell, Download, Loader2, Lock, LogOut, SlidersHorizontal, Trash2, User } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { LanguageSwitcher } from "@/components/language-switcher";
import { useAuth } from "@/hooks/use-auth";
import { usePrivacy } from "@/hooks/use-privacy";
import { useProfile } from "@/hooks/use-profile";
import { usePush } from "@/hooks/use-push";
import { useSessions } from "@/hooks/use-sessions";
import { dominantProfile } from "@/lib/behaviors/profiles";
import { listBehaviorPatterns } from "@/lib/data/behaviors";
import { getPrivacySettings, listConsents } from "@/lib/data/consents";
import { listFocusSessions } from "@/lib/data/focus";
import { listIntentions } from "@/lib/data/intentions";
import { getProfile } from "@/lib/data/profiles";
import { listSessions } from "@/lib/data/sessions";
import { listTasks } from "@/lib/data/tasks";
import { handleError } from "@/lib/feedback";
import type { ObstacleCode } from "@/lib/intervention/types";
import { cn } from "@/lib/utils";

const GOALS = ["estudos", "trabalho", "saude", "organizacao", "outro"] as const;

type Tab = "profile" | "preferences" | "notifications" | "privacy";

export default function SettingsPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const { profile, isLoading: profileLoading, update: updateProfile } = useProfile();
  const { settings, isLoading: privacyLoading, update: updatePrivacy } = usePrivacy();
  const { supported, permission, subscribe, unsubscribe } = usePush();
  const { data: recentSessions = [] } = useSessions(60);

  const [tab, setTab] = useState<Tab>("profile");

  // Perfil
  const [name, setName] = useState("");
  const [mainGoal, setMainGoal] = useState<string>("outro");
  const [savingProfile, setSavingProfile] = useState(false);

  // Preferências
  const [focusMin, setFocusMin] = useState("25");
  const [savingPrefs, setSavingPrefs] = useState(false);

  // Privacidade
  const [exporting, setExporting] = useState(false);
  const [deleteStep, setDeleteStep] = useState<"idle" | "confirm" | "deleting">("idle");
  const [confirmText, setConfirmText] = useState("");
  const [privacyPending, setPrivacyPending] = useState(false);
  const [pushBusy, setPushBusy] = useState(false);

  useEffect(() => {
    if (profile) {
      setName(profile.name ?? "");
      setMainGoal(profile.main_goal ?? "outro");
      setFocusMin(String(defaultFocus(profile.preferences?.default_focus_min)));
    }
  }, [profile]);

  const nameValid = name.trim().length > 0 && name.trim().length <= 80;

  const dominant = useMemo(() => {
    if (recentSessions.length === 0) return null;
    const counts: Partial<Record<ObstacleCode, number>> = {};
    for (const s of recentSessions) {
      if (!s.obstacle_code) continue;
      const code = s.obstacle_code as ObstacleCode;
      counts[code] = (counts[code] ?? 0) + 1;
    }
    return dominantProfile(counts);
  }, [recentSessions]);

  const saveProfile = async () => {
    if (!nameValid) return;
    setSavingProfile(true);
    try {
      await updateProfile.mutateAsync({ name: name.trim(), main_goal: mainGoal });
      toast.success(t("settings.saved"));
    } catch (error) {
      handleError(t, "settings.saveProfile", error);
    } finally {
      setSavingProfile(false);
    }
  };

  const savePreferences = async () => {
    const value = Number(focusMin);
    if (!Number.isFinite(value) || value < 5 || value > 120) return;
    setSavingPrefs(true);
    try {
      await updateProfile.mutateAsync({
        preferences: { ...(profile?.preferences ?? {}), default_focus_min: Math.round(value) },
      });
      toast.success(t("settings.saved"));
    } catch (error) {
      handleError(t, "settings.savePrefs", error);
    } finally {
      setSavingPrefs(false);
    }
  };

  const setPrivacy = async (patch: Parameters<typeof updatePrivacy.mutateAsync>[0]) => {
    if (privacyPending) return;
    setPrivacyPending(true);
    try {
      await updatePrivacy.mutateAsync(patch);
      toast.success(t("settings.saved"));
    } catch (error) {
      handleError(t, "settings.savePrefs", error);
    } finally {
      setPrivacyPending(false);
    }
  };

  const togglePush = async () => {
    if (pushBusy) return;
    setPushBusy(true);
    try {
      if (permission === "granted") {
        await unsubscribe();
      } else {
        const ok = await subscribe();
        if (!ok) toast.info(t("settings.pushUnconfigured"));
      }
    } catch (error) {
      handleError(t, "settings.pushError", error);
    } finally {
      setPushBusy(false);
    }
  };

  const handleExport = async () => {
    if (!user || exporting) return;
    setExporting(true);
    try {
      const [profileData, tasks, sessions, intentions, consents, privacy, checkins, patterns] =
        await Promise.all([
          getProfile(user.id),
          listTasks(user.id),
          listSessions(user.id),
          listIntentions(user.id),
          listConsents(user.id),
          getPrivacySettings(user.id),
          listFocusSessions(user.id),
          listBehaviorPatterns(user.id),
        ]);
      const blob = new Blob(
        [
          JSON.stringify(
            {
              exportedAt: new Date().toISOString(),
              profile: profileData,
              tasks,
              sessions,
              intentions,
              consents,
              privacy,
              checkins,
              behaviorPatterns: patterns,
            },
            null,
            2,
          ),
        ],
        { type: "application/json" },
      );
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "vira-dados.json";
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      handleError(t, "settings.export", error);
    } finally {
      setExporting(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (confirmText !== "EXCLUIR" || deleteStep !== "confirm") return;
    setDeleteStep("deleting");
    try {
      const { error } = await supabase.functions.invoke("delete-account");
      if (error) throw new Error(error.message ?? "delete-account failed");
      await signOut();
      navigate("/auth", { replace: true });
    } catch (error) {
      handleError(t, "settings.deleteError", error);
      setDeleteStep("idle");
    }
  };

  const tabs: { key: Tab; labelKey: string; icon: typeof User }[] = [
    { key: "profile", labelKey: "settings.tab.profile", icon: User },
    { key: "preferences", labelKey: "settings.tab.preferences", icon: SlidersHorizontal },
    { key: "notifications", labelKey: "settings.tab.notifications", icon: Bell },
    { key: "privacy", labelKey: "settings.tab.privacy", icon: Lock },
  ];

  const pushEnabled = permission === "granted";

  return (
    <div className="animate-fade-in-up space-y-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t("settings.title")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("settings.subtitle")}</p>
      </div>

      <div className="grid grid-cols-2 gap-1 rounded-lg bg-muted p-1">
        {tabs.map(({ key, labelKey, icon: Icon }) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={cn(
              "flex flex-col items-center gap-1 rounded-md py-2 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              tab === key
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Icon className="h-4 w-4" />
            {t(labelKey)}
          </button>
        ))}
      </div>

      {profileLoading || (tab === "notifications" && privacyLoading) ? (
        <div className="space-y-3">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      ) : (
        <>
          {tab === "profile" && (
            <div className="space-y-4">
              <Card className="border-border/60 bg-card/80">
                <CardHeader>
                  <CardTitle className="text-lg">{t("settings.profileTitle")}</CardTitle>
                  <CardDescription>{t("settings.profileHint")}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="settings-name">{t("settings.nameLabel")}</Label>
                    <Input
                      id="settings-name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder={t("auth.namePlaceholder")}
                      maxLength={80}
                    />
                    {name.trim().length > 80 && (
                      <p className="text-xs text-destructive">{t("settings.nameTooLong")}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="settings-goal">{t("settings.goalLabel")}</Label>
                    <Select value={mainGoal} onValueChange={setMainGoal}>
                      <SelectTrigger id="settings-goal" className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {GOALS.map((goal) => (
                          <SelectItem key={goal} value={goal}>
                            {t(`settings.goal.${goal}`)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <Button
                    className="w-full"
                    onClick={saveProfile}
                    disabled={!nameValid || savingProfile}
                  >
                    {savingProfile && <Loader2 className="h-4 w-4 animate-spin" />}
                    {savingProfile ? t("settings.saving") : t("settings.save")}
                  </Button>
                </CardContent>
              </Card>

              {dominant && (
                <Card className="border-border/60 bg-card/80">
                  <CardHeader>
                    <CardTitle className="text-lg">{t("settings.procrastinationTitle")}</CardTitle>
                    <CardDescription>{t("settings.procrastinationHint")}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <p className="font-semibold">{dominant.label}</p>
                    <p className="mt-1 text-sm text-muted-foreground">{dominant.description}</p>
                  </CardContent>
                </Card>
              )}
            </div>
          )}

          {tab === "preferences" && (
            <div className="space-y-4">
              <Card className="border-border/60 bg-card/80">
                <CardHeader>
                  <CardTitle className="text-lg">{t("settings.preferencesTitle")}</CardTitle>
                  <CardDescription>{t("settings.preferencesHint")}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium">{t("settings.languageLabel")}</p>
                      <p className="text-xs text-muted-foreground">{t("settings.languageHint")}</p>
                    </div>
                    <LanguageSwitcher />
                  </div>
                  <Separator />
                  <div className="space-y-2">
                    <Label htmlFor="settings-focus">{t("settings.focusLabel")}</Label>
                    <Input
                      id="settings-focus"
                      type="number"
                      min={5}
                      max={120}
                      value={focusMin}
                      onChange={(e) => setFocusMin(e.target.value)}
                    />
                    <p className="text-xs text-muted-foreground">{t("settings.focusHint")}</p>
                    {(!Number.isFinite(Number(focusMin)) || Number(focusMin) < 5 || Number(focusMin) > 120) && (
                      <p className="text-xs text-destructive">{t("settings.focusInvalid")}</p>
                    )}
                  </div>
                  <Button
                    className="w-full"
                    onClick={savePreferences}
                    disabled={
                      savingPrefs ||
                      !Number.isFinite(Number(focusMin)) ||
                      Number(focusMin) < 5 ||
                      Number(focusMin) > 120
                    }
                  >
                    {savingPrefs && <Loader2 className="h-4 w-4 animate-spin" />}
                    {savingPrefs ? t("settings.saving") : t("settings.save")}
                  </Button>
                </CardContent>
              </Card>
            </div>
          )}

          {tab === "notifications" && (
            <div className="space-y-4">
              <Card className="border-border/60 bg-card/80">
                <CardHeader>
                  <CardTitle className="text-lg">{t("settings.notificationsTitle")}</CardTitle>
                  <CardDescription>{t("settings.notificationsHint")}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium">{t("settings.inAppLabel")}</p>
                      <p className="text-xs text-muted-foreground">{t("settings.inAppHint")}</p>
                    </div>
                    <Switch
                      checked={settings?.notifications_enabled ?? true}
                      disabled={privacyPending}
                      onCheckedChange={(checked) =>
                        setPrivacy({ notifications_enabled: checked })
                      }
                    />
                  </div>
                  <Separator />
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium">{t("settings.pushLabel")}</p>
                      <p className="text-xs text-muted-foreground">
                        {supported
                          ? pushEnabled
                            ? t("settings.pushEnabled")
                            : t("settings.pushDisabled")
                          : t("settings.pushUnsupported")}
                      </p>
                    </div>
                    {supported && (
                      <Button
                        variant={pushEnabled ? "outline" : "secondary"}
                        size="sm"
                        disabled={pushBusy}
                        onClick={togglePush}
                      >
                        {pushBusy && <Loader2 className="h-4 w-4 animate-spin" />}
                        {pushEnabled ? t("settings.pushDisable") : t("settings.pushEnable")}
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {tab === "privacy" && (
            <div className="space-y-4">
              <Card className="border-border/60 bg-card/80">
                <CardHeader>
                  <CardTitle className="text-lg">{t("settings.dataTitle")}</CardTitle>
                  <CardDescription>{t("settings.dataHint")}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium">{t("settings.behavioralLabel")}</p>
                      <p className="text-xs text-muted-foreground">{t("settings.behavioralHint")}</p>
                    </div>
                    <Switch
                      checked={settings?.behavioral_data_for_product ?? true}
                      disabled={privacyPending}
                      onCheckedChange={(checked) =>
                        setPrivacy({ behavioral_data_for_product: checked })
                      }
                    />
                  </div>
                  <Separator />
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium">{t("settings.researchLabel")}</p>
                      <p className="text-xs text-muted-foreground">{t("settings.researchHint")}</p>
                    </div>
                    <Switch
                      checked={settings?.research_consent ?? false}
                      disabled={privacyPending}
                      onCheckedChange={(checked) => setPrivacy({ research_consent: checked })}
                    />
                  </div>
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={handleExport}
                    disabled={exporting}
                  >
                    {exporting ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Download className="h-4 w-4" />
                    )}
                    {t("settings.export")}
                  </Button>
                </CardContent>
              </Card>

              <div className="rounded-lg border border-border bg-card p-4">
                <p className="text-sm font-medium">{t("settings.accountTitle")}</p>
                <div className="mt-3 space-y-3">
                  <Button variant="outline" className="w-full" onClick={() => void signOut()}>
                    <LogOut className="h-4 w-4" />
                    {t("settings.signOut")}
                  </Button>

                  {deleteStep === "idle" && (
                    <Button variant="danger" className="w-full" onClick={() => setDeleteStep("confirm")}>
                      <Trash2 className="h-4 w-4" />
                      {t("settings.deleteAccount")}
                    </Button>
                  )}

                  {deleteStep === "confirm" && (
                    <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-4">
                      <p className="text-sm font-medium text-destructive">{t("settings.deleteWarning")}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{t("settings.deleteHint")}</p>
                      <div className="mt-3 space-y-2">
                        <Label htmlFor="delete-confirm">{t("settings.deleteType")}</Label>
                        <Input
                          id="delete-confirm"
                          value={confirmText}
                          onChange={(e) => setConfirmText(e.target.value)}
                          placeholder="EXCLUIR"
                          autoComplete="off"
                        />
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            className="flex-1"
                            disabled={deleteStep === "deleting"}
                            onClick={() => {
                              setDeleteStep("idle");
                              setConfirmText("");
                            }}
                          >
                            {t("settings.cancel")}
                          </Button>
                          <Button
                            variant="danger"
                            className="flex-1"
                            disabled={confirmText !== "EXCLUIR" || deleteStep === "deleting"}
                            onClick={handleDeleteAccount}
                          >
                            {deleteStep === "deleting" && (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            )}
                            {deleteStep === "deleting"
                              ? t("settings.deleting")
                              : t("settings.deleteConfirm")}
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function defaultFocus(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.min(120, Math.max(5, Math.round(value)));
  }
  return 25;
}
