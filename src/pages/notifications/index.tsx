import { Bell, BellOff } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useNotifications } from "@/hooks/use-notifications";
import { usePush } from "@/hooks/use-push";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default function NotificationsPage() {
  const { t } = useTranslation();
  const { notifications, isLoading, markRead } = useNotifications();
  const { supported, permission, subscribe, unsubscribe } = usePush();

  const unread = notifications.filter((n) => !n.read).length;
  const pushEnabled = permission === "granted";
  const pushAvailable = supported && !!permission && permission !== "unsupported";

  return (
    <div className="animate-fade-in-up space-y-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t("notifications.title")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {t("notifications.subtitle")}
        </p>
      </div>

      <div className="rounded-lg border border-border bg-card p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm font-medium">
            {pushEnabled ? (
              <Bell className="h-4 w-4 text-primary" />
            ) : (
              <BellOff className="h-4 w-4 text-muted-foreground" />
            )}
            <span>{t("notifications.pushTitle")}</span>
          </div>
          {pushAvailable && !pushEnabled && (
            <Button size="sm" onClick={() => void subscribe()}>
              {t("notifications.enable")}
            </Button>
          )}
          {pushEnabled && (
            <Button size="sm" variant="outline" onClick={() => void unsubscribe()}>
              {t("notifications.disable")}
            </Button>
          )}
        </div>
        {!supported && (
          <p className="mt-2 text-xs text-muted-foreground">
            {t("notifications.pushUnsupported")}
          </p>
        )}
        {pushAvailable && !pushEnabled && (
          <p className="mt-2 text-xs text-muted-foreground">
            {t("notifications.pushHint")}
          </p>
        )}
        {!pushAvailable && !pushEnabled && (
          <p className="mt-2 text-xs text-muted-foreground">
            {t("notifications.pushUnconfigured")}
          </p>
        )}
      </div>

      <div className="space-y-2">
        {isLoading && (
          <div className="space-y-2">
            {[0, 1].map((i) => (
              <div key={i} className="h-20 animate-pulse rounded-lg bg-muted" />
            ))}
          </div>
        )}

        {!isLoading && notifications.length === 0 && (
          <p className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
            {t("notifications.empty")}
          </p>
        )}

        {notifications.map((notification) => (
          <button
            key={notification.id}
            type="button"
            onClick={() => {
              if (!notification.read) markRead.mutate(notification.id);
            }}
            className={cn(
              "block w-full rounded-lg border border-border bg-card p-4 text-left transition-colors",
              !notification.read && "border-primary/40 bg-primary/5",
            )}
          >
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-medium">{notification.title}</p>
              {!notification.read && (
                <span className="h-2 w-2 shrink-0 rounded-full bg-primary" />
              )}
            </div>
            {notification.body && (
              <p className="mt-1 text-sm text-muted-foreground">{notification.body}</p>
            )}
            {notification.scheduled_for && (
              <p className="mt-1 text-xs text-muted-foreground">
                {new Date(notification.scheduled_for).toLocaleString("pt-BR")}
              </p>
            )}
          </button>
        ))}
      </div>

      {unread > 0 && (
        <p className="text-center text-xs text-muted-foreground">
          {t("notifications.unread", { count: unread })}
        </p>
      )}
    </div>
  );
}
