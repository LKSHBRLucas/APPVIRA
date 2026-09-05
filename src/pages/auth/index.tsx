import { useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

type AuthMode = "signin" | "signup";

export default function AuthPage() {
  const { t } = useTranslation();
  const { user, loading, signIn, signUp } = useAuth();
  const [mode, setMode] = useState<AuthMode>("signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string; name?: string }>({});
  const [submitting, setSubmitting] = useState(false);

  if (!loading && user) {
    return <Navigate to="/" replace />;
  }

  const switchMode = (next: AuthMode) => {
    setMode(next);
    setError(null);
    setFieldErrors({});
  };

  const validate = (): boolean => {
    const errors: { email?: string; password?: string; name?: string } = {};
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      errors.email = t("auth.emailInvalid");
    }
    if (password.length < 8) {
      errors.password = t("auth.passwordShort");
    }
    if (mode === "signup" && !name.trim()) {
      errors.name = t("auth.nameRequired");
    }
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    if (submitting || !validate()) return;
    setSubmitting(true);

    const result =
      mode === "signin"
        ? await signIn(email.trim(), password)
        : await signUp(email.trim(), password, name.trim());

    setSubmitting(false);
    if (result.error) {
      setError(result.error);
    }
  };

  return (
    <div className="flex min-h-full items-center justify-center bg-gradient-subtle p-4">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold tracking-tight">
            {t("common.appName")}
          </h1>
          <p className="mt-2 text-muted-foreground">{t("auth.tagline")}</p>
        </div>

        <Card className="border-border/60 bg-card/80 shadow-elegant backdrop-blur">
          <CardHeader>
            <CardTitle className="text-xl">
              {mode === "signin" ? t("auth.signinTitle") : t("auth.signupTitle")}
            </CardTitle>
            <CardDescription>{t("auth.subtitle")}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="mb-5 grid grid-cols-2 gap-1 rounded-lg bg-muted p-1">
              <button
                type="button"
                onClick={() => switchMode("signin")}
                className={cn(
                  "rounded-md py-2 text-sm font-medium transition-colors",
                  mode === "signin"
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground"
                )}
              >
                {t("auth.signin")}
              </button>
              <button
                type="button"
                onClick={() => switchMode("signup")}
                className={cn(
                  "rounded-md py-2 text-sm font-medium transition-colors",
                  mode === "signup"
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground"
                )}
              >
                {t("auth.signup")}
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {mode === "signup" && (
                <div className="space-y-2">
                  <Label htmlFor="auth-name">{t("auth.name")}</Label>
                  <Input
                    id="auth-name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder={t("auth.namePlaceholder")}
                    autoComplete="name"
                    required
                    aria-invalid={!!fieldErrors.name}
                  />
                  {fieldErrors.name && (
                    <p className="text-xs text-destructive">{fieldErrors.name}</p>
                  )}
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="auth-email">{t("auth.email")}</Label>
                <Input
                  id="auth-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="voce@exemplo.com"
                  autoComplete="email"
                  required
                  aria-invalid={!!fieldErrors.email}
                />
                {fieldErrors.email && (
                  <p className="text-xs text-destructive">{fieldErrors.email}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="auth-password">{t("auth.password")}</Label>
                <Input
                  id="auth-password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete={mode === "signin" ? "current-password" : "new-password"}
                  required
                  aria-invalid={!!fieldErrors.password}
                />
                {fieldErrors.password && (
                  <p className="text-xs text-destructive">{fieldErrors.password}</p>
                )}
              </div>

              {error && (
                <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  {error}
                </p>
              )}

              <Button type="submit" className="w-full" size="lg" disabled={submitting || loading}>
                {submitting
                  ? t("auth.submitting")
                  : mode === "signin"
                    ? t("auth.signinCta")
                    : t("auth.signupCta")}
              </Button>
            </form>
          </CardContent>
        </Card>

        <p className="mt-6 text-center text-xs leading-relaxed text-muted-foreground">
          {t("auth.privacyNote")}
        </p>
      </div>
    </div>
  );
}
