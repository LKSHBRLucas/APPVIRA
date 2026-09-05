import { AlertTriangle } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";

export function ErrorFallback() {
  const { t } = useTranslation();
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background px-4 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted">
        <AlertTriangle className="h-7 w-7 text-primary" />
      </div>
      <div>
        <h1 className="text-lg font-bold">{t("errors.boundary")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("errors.boundaryHint")}</p>
      </div>
      <Button onClick={() => window.location.reload()}>{t("errors.reload")}</Button>
    </div>
  );
}
