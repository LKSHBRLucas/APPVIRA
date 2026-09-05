import { Bell, Home, LayoutDashboard, ListTodo, MessageSquare, Settings } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link, NavLink, Outlet } from "react-router-dom";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { to: "/", labelKey: "nav.home", icon: Home, end: true },
  { to: "/tasks", labelKey: "nav.tasks", icon: ListTodo, end: false },
  { to: "/assistant", labelKey: "nav.assistant", icon: MessageSquare, end: false },
  { to: "/dashboard", labelKey: "nav.dashboard", icon: LayoutDashboard, end: false },
  { to: "/settings", labelKey: "nav.settings", icon: Settings, end: false },
] as const;

export function AppShell() {
  const { t } = useTranslation();

  return (
    <div className="min-h-full bg-gradient-subtle">
      <main className="mx-auto w-full max-w-md px-4 pb-24 pt-4">
        <header className="mb-4 flex items-center justify-between">
          <Link to="/" className="text-lg font-bold tracking-tight">
            {t("common.appName")}
          </Link>
          <Link
            to="/notifications"
            aria-label={t("nav.notifications")}
            className="rounded-md p-2 text-muted-foreground transition-colors hover:text-foreground"
          >
            <Bell className="h-5 w-5" />
          </Link>
        </header>
        <Outlet />
      </main>
      <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-border bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur">
        <div className="mx-auto flex max-w-md items-stretch justify-around">
          {NAV_ITEMS.map(({ to, labelKey, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                cn(
                  "flex flex-1 flex-col items-center gap-1 py-2.5 text-xs font-medium transition-colors",
                  isActive ? "text-primary" : "text-muted-foreground hover:text-foreground"
                )
              }
            >
              <Icon className="h-5 w-5" />
              <span>{t(labelKey)}</span>
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}
