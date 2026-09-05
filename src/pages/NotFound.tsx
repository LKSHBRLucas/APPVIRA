import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Link, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { logError } from "@/lib/feedback";

const NotFound = () => {
  const location = useLocation();
  const { t } = useTranslation();

  useEffect(() => {
    logError("404", `Rota não encontrada: ${location.pathname}`);
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4 text-center">
      <p className="font-mono text-5xl font-bold text-primary">404</p>
      <h1 className="mt-3 text-xl font-bold">{t("notFound.title")}</h1>
      <Button asChild className="mt-6">
        <Link to="/">{t("notFound.actions.backHome")}</Link>
      </Button>
    </div>
  );
};

export default NotFound;
