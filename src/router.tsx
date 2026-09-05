import { AppShell } from "./components/app-shell";
import { GuardedRoute } from "./components/guarded-route";
import AssistantPage from "./pages/assistant";
import AuthPage from "./pages/auth";
import DashboardPage from "./pages/dashboard";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import OnboardingPage from "./pages/onboarding";
import PlansPage from "./pages/plans";
import ProfilePage from "./pages/profile";
import SessionPage from "./pages/session";
import StuckPage from "./pages/stuck";
import TasksPage from "./pages/tasks";
import NewTaskPage from "./pages/tasks/new";
import NotificationsPage from "./pages/notifications";

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
        element: <Index />,
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
