import { useEffect, useState } from "react";
import { AlertCircle } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

const REDIRECT_SECONDS = 5;

export default function NotFound() {
  const { t } = useTranslation();
  const [, setLocation] = useLocation();
  const [countdown, setCountdown] = useState(REDIRECT_SECONDS);

  useEffect(() => {
    if (countdown <= 0) {
      setLocation("/");
      return;
    }
    const timer = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [countdown, setLocation]);

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-sm">
        <CardContent className="pt-8 pb-6 flex flex-col items-center text-center gap-4">
          <AlertCircle className="h-12 w-12 text-destructive" />
          <div>
            <h1 className="text-xl font-bold mb-1">{t("notFound.title")}</h1>
            <p className="text-sm text-muted-foreground">
              {t("notFound.message")}
            </p>
          </div>
          <p className="text-xs text-muted-foreground">
            {t("notFound.redirecting", { seconds: countdown })}
          </p>
          <Button className="w-full" onClick={() => setLocation("/")}>
            {t("notFound.goHome")}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
