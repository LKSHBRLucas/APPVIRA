import { lazy, Suspense, type ComponentType } from "react";
import { AppShell } from "./components/app-shell";
import { GuardedRoute } from "./components/guarded-route";
import { PageSpinner } from "./components/page-spinner";

/** Code-split a page and wrap it in Suspense with a shared loading spinner. */
function lazyRoute(loader: () => Promise<{ default: ComponentType }>) {
  const Component = lazy(loader);
  return function LazyRoute() {
    return (
      <Suspense fallback={<PageSpinner />}>
        <Component />
      </Suspense>
    );
  };
}

const AuthPage = lazyRoute(() => import("./pages/auth"));
const OnboardingPage = lazyRoute(() => import("./pages/onboarding"));
const HomePage = lazyRoute(() => import("./pages/Index"));
const StuckPage = lazyRoute(() => import("./pages/stuck"));
const SessionPage = lazyRoute(() => import("./pages/session"));
const TasksPage = lazyRoute(() => import("./pages/tasks"));
const NewTaskPage = lazyRoute(() => import("./pages/tasks/new"));
const DashboardPage = lazyRoute(() => import("./pages/dashboard"));
const ProfilePage = lazyRoute(() => import("./pages/profile"));
const SettingsPage = lazyRoute(() => import("./pages/settings"));
const PlansPage = lazyRoute(() => import("./pages/plans"));
const AssistantPage = lazyRoute(() => import("./pages/assistant"));
const NotificationsPage = lazyRoute(() => import("./pages/notifications"));
const NotFound = lazyRoute(() => import("./pages/NotFound"));

export const routers = [
  {
    path: "/auth",
    name: "auth",
    element: <AuthPage />,
  },
  {
    path: "/onboarding",
    name: "onboarding",
    element: (
      <GuardedRoute>
        <OnboardingPage />
      </GuardedRoute>
    ),
  },
  {
    path: "/",
    name: "app",
    element: (
      <GuardedRoute requireOnboarding>
        <AppShell />
      </GuardedRoute>
    ),
    children: [
      {
        path: "",
        name: "home",
        element: <HomePage />,
      },
      {
        path: "stuck",
        name: "stuck",
        element: <StuckPage />,
      },
      {
        path: "session/:id",
        name: "session",
        element: <SessionPage />,
      },
      {
        path: "tasks",
        name: "tasks",
        element: <TasksPage />,
      },
      {
        path: "tasks/new",
        name: "tasks-new",
        element: <NewTaskPage />,
      },
      {
        path: "dashboard",
        name: "dashboard",
        element: <DashboardPage />,
      },
      {
        path: "settings",
        name: "settings",
        element: <SettingsPage />,
      },
      {
        path: "profile",
        name: "profile",
        element: <ProfilePage />,
      },
      {
        path: "plans",
        name: "plans",
        element: <PlansPage />,
      },
      {
        path: "assistant",
        name: "assistant",
        element: <AssistantPage />,
      },
      {
        path: "notifications",
        name: "notifications",
        element: <NotificationsPage />,
      },
    ],
  },
  /* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */
  {
    path: "*",
    name: "404",
    element: <NotFound />,
  },
];

declare global {
  interface Window {
    __routers__: typeof routers;
  }
}

window.__routers__ = routers;
