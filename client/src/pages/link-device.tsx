import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Smartphone, Link2, Loader2, CheckCircle, ArrowLeft } from "lucide-react";
import confetti from "canvas-confetti";

interface DeviceSession {
  authenticated: boolean;
  memberId?: string;
  memberName?: string;
  familyName?: string;
  role?: string;
  avatarUrl?: string;
  color?: string;
  activeSkinId?: string;
  totalPoints?: number;
  totalEarned?: number;
}

export default function LinkDevice() {
  const { t, i18n } = useTranslation();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [code, setCode] = useState("");
  const [deviceLabel, setDeviceLabel] = useState("");
  const [linkSuccess, setLinkSuccess] = useState(false);
  const [linkedMemberName, setLinkedMemberName] = useState("");

  const { data: existingSession, isLoading: checkingSession } = useQuery<DeviceSession>({
    queryKey: ["/api/device-link/session"],
    retry: false,
    staleTime: 5 * 60 * 1000,
  });

  const verifyCodeMutation = useMutation({
    mutationFn: async (data: { code: string; deviceLabel?: string }) => {
      const res = await apiRequest("POST", "/api/device-link/verify-code", data);
      return res.json();
    },
    onSuccess: (data) => {
      setLinkSuccess(true);
      setLinkedMemberName(data.memberName);
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 },
      });
      toast({
        title: t("linkDevice.success"),
        description: t("linkDevice.successDesc", { name: data.memberName }),
      });
    },
    onError: (error: any) => {
      let errorMessage = t("linkDevice.invalidCode");
      if (error.message?.includes("expired")) {
        errorMessage = t("linkDevice.codeExpired");
      } else if (error.message?.includes("already been used")) {
        errorMessage = t("linkDevice.codeUsed");
      }
      toast({
        title: t("common.error"),
        description: errorMessage,
        variant: "destructive",
      });
    },
  });

  const logoutMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/device-link/logout");
    },
    onSuccess: () => {
      window.location.reload();
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (code.length !== 6) {
      toast({
        title: t("common.error"),
        description: t("linkDevice.enterCode"),
        variant: "destructive",
      });
      return;
    }
    verifyCodeMutation.mutate({
      code: code.toUpperCase(),
      deviceLabel: deviceLabel || undefined,
    });
  };

  const goToKidDashboard = () => {
    setLocation("/kid-dashboard");
  };

  if (checkingSession) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (existingSession?.authenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-b from-primary/5 to-background">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mb-4">
              <CheckCircle className="h-8 w-8 text-green-600 dark:text-green-400" />
            </div>
            <CardTitle className="text-2xl">{t("linkDevice.alreadyLinked")}</CardTitle>
            <CardDescription>
              {t("linkDevice.alreadyLinkedDesc", { name: existingSession.memberName })}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button 
              onClick={goToKidDashboard} 
              className="w-full"
              data-testid="button-go-to-dashboard"
            >
              {t("linkDevice.goToDashboard")}
            </Button>
            <Button 
              variant="outline" 
              onClick={() => logoutMutation.mutate()}
              disabled={logoutMutation.isPending}
              className="w-full"
              data-testid="button-unlink-device"
            >
              {logoutMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : null}
              {t("linkDevice.unlinkDevice")}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (linkSuccess) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-b from-primary/5 to-background">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mb-4">
              <CheckCircle className="h-8 w-8 text-green-600 dark:text-green-400" />
            </div>
            <CardTitle className="text-2xl">{t("linkDevice.linked")}</CardTitle>
            <CardDescription>
              {t("linkDevice.linkedDesc", { name: linkedMemberName })}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button 
              onClick={goToKidDashboard} 
              className="w-full"
              data-testid="button-go-to-dashboard-success"
            >
              {t("linkDevice.goToDashboard")}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-b from-primary/5 to-background">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-4">
            <Smartphone className="h-8 w-8 text-primary" />
          </div>
          <CardTitle className="text-2xl">{t("linkDevice.title")}</CardTitle>
          <CardDescription>
            {t("linkDevice.subtitle")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="code">{t("linkDevice.codeLabel")}</Label>
              <Input
                id="code"
                type="text"
                placeholder="ABC123"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase().slice(0, 6))}
                className="text-center text-2xl font-mono tracking-widest"
                maxLength={6}
                autoComplete="off"
                autoFocus
                data-testid="input-link-code"
              />
              <p className="text-xs text-muted-foreground text-center">
                {t("linkDevice.codeHint")}
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="deviceLabel">{t("linkDevice.deviceLabelLabel")}</Label>
              <Input
                id="deviceLabel"
                type="text"
                placeholder={t("linkDevice.deviceLabelPlaceholder")}
                value={deviceLabel}
                onChange={(e) => setDeviceLabel(e.target.value)}
                data-testid="input-device-label"
              />
              <p className="text-xs text-muted-foreground">
                {t("linkDevice.deviceLabelHint")}
              </p>
            </div>

            <Button
              type="submit"
              className="w-full"
              disabled={code.length !== 6 || verifyCodeMutation.isPending}
              data-testid="button-verify-code"
            >
              {verifyCodeMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Link2 className="h-4 w-4 mr-2" />
              )}
              {t("linkDevice.verifyButton")}
            </Button>
          </form>

          <div className="mt-6 pt-4 border-t">
            <Button
              variant="ghost"
              className="w-full"
              onClick={() => setLocation("/")}
              data-testid="button-back-to-login"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              {t("linkDevice.backToLogin")}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
