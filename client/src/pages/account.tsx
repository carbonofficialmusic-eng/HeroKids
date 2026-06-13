import { useState, useEffect } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useLocation, Link } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest, queryClient, ApiError } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ArrowLeft, Home, Key, Mail, MailCheck, Loader2 } from "lucide-react";
import type { FamilyMember } from "@shared/schema";

export default function AccountPage() {
  const { t } = useTranslation();
  const { user, isAuthenticated, isLoading } = useAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  const [cpCurrentPw, setCpCurrentPw] = useState("");
  const [cpNewPw, setCpNewPw] = useState("");
  const [cpConfirmPw, setCpConfirmPw] = useState("");
  const [cpError, setCpError] = useState("");

  const [ceCurrentPw, setCeCurrentPw] = useState("");
  const [ceNewEmail, setCeNewEmail] = useState("");
  const [ceError, setCeError] = useState("");

  const { data: member } = useQuery<FamilyMember>({
    queryKey: ["/api/family-members/real"],
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
  });

  useEffect(() => {
    if (!isLoading && (!isAuthenticated || (user && !user.email))) {
      setLocation("/");
    }
  }, [isLoading, isAuthenticated, user, setLocation]);

  const changePasswordMutation = useMutation({
    mutationFn: async (data: { currentPassword: string; newPassword: string }) => {
      return await apiRequest("POST", "/api/auth/change-password", data);
    },
    onSuccess: () => {
      setCpCurrentPw("");
      setCpNewPw("");
      setCpConfirmPw("");
      setCpError("");
      toast({ title: t("settings.passwordChanged"), description: t("settings.passwordChangedDesc") });
    },
    onError: (error: any) => {
      const msg = error instanceof ApiError && error.data?.message
        ? error.data.message
        : t("errors.somethingWrong");
      setCpError(msg);
    },
  });

  const changeEmailMutation = useMutation({
    mutationFn: async (data: { currentPassword: string; newEmail: string }) => {
      return await apiRequest("POST", "/api/auth/change-email", data);
    },
    onSuccess: () => {
      setCeCurrentPw("");
      setCeNewEmail("");
      setCeError("");
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      toast({ title: t("settings.emailChangeSent"), description: t("settings.emailChangeSentDesc") });
    },
    onError: (error: any) => {
      const msg = error instanceof ApiError && error.data?.message
        ? error.data.message
        : t("errors.somethingWrong");
      setCeError(msg);
    },
  });

  const resendVerificationMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/auth/resend-verification");
      return response.json() as Promise<{ message?: string }>;
    },
    onSuccess: (data) => {
      toast({
        title: t("auth.verificationEmailSent"),
        description: data.message || t("auth.checkInboxAndSpam"),
      });
    },
    onError: (error: unknown) => {
      const msg = error instanceof Error ? error.message : t("auth.tryAgainLater");
      toast({ title: t("auth.verificationEmailFailed"), description: msg, variant: "destructive" });
    },
  });

  const resendPendingEmailMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/auth/resend-pending-email-change");
      return response.json() as Promise<{ message?: string }>;
    },
    onSuccess: (data) => {
      toast({
        title: t("auth.verificationEmailSent"),
        description: data.message || t("auth.checkInboxAndSpam"),
      });
    },
    onError: (error: unknown) => {
      const msg = error instanceof Error ? error.message : t("auth.tryAgainLater");
      toast({ title: t("auth.verificationEmailFailed"), description: msg, variant: "destructive" });
    },
  });

  if (isLoading || !user?.email) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const isParent = member?.role === "parent";
  const backHref = isParent ? "/dashboard" : "/kid-dashboard";

  return (
    <div className="min-h-screen p-6" style={{ paddingTop: "calc(1.5rem + env(safe-area-inset-top))", paddingLeft: 'max(1.5rem, env(safe-area-inset-left))', paddingRight: 'max(1.5rem, env(safe-area-inset-right))' }}>
      <div className="max-w-lg mx-auto">
        {/* Back button — pill style matching other sub-pages */}
        <Link href={backHref}>
          <Button
            variant="outline"
            size="sm"
            className="mb-4 gap-2 bg-background/30 backdrop-blur-sm border-border/40 hover:bg-background/60"
            data-testid="button-back-account"
          >
            <Home className="h-4 w-4" />
            {t("rewardsBoard.backToDashboard")}
          </Button>
        </Link>

        {/* Page title */}
        <div className="flex items-center gap-3 mb-6">
          <Key className="h-8 w-8 text-primary" />
          <div>
            <h1
              className="text-3xl font-bold font-accent"
              style={{ fontFamily: "Fredoka, sans-serif" }}
            >
              {t("settings.accountSettings")}
            </h1>
            <p className="text-muted-foreground">{user.email}</p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Key className="h-5 w-5 text-primary" />
              <CardTitle>{t("settings.accountSettings")}</CardTitle>
            </div>
            <CardDescription>{t("settings.accountSettingsDesc")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Pending email-change confirmation banner */}
            {user.pendingEmail && (
              <Alert data-testid="alert-pending-email-change">
                <MailCheck className="h-4 w-4" />
                <AlertTitle>{t("settings.pendingEmailBannerTitle")}</AlertTitle>
                <AlertDescription className="space-y-3">
                  <p>{t("settings.pendingEmailBannerDesc", { email: user.pendingEmail })}</p>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => resendPendingEmailMutation.mutate()}
                    disabled={resendPendingEmailMutation.isPending}
                    data-testid="button-resend-pending-email-account"
                  >
                    {resendPendingEmailMutation.isPending ? (
                      <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                    ) : (
                      <MailCheck className="mr-2 h-3 w-3" />
                    )}
                    {resendPendingEmailMutation.isPending
                      ? t("auth.resendingVerification")
                      : t("auth.resendVerification")}
                  </Button>
                </AlertDescription>
              </Alert>
            )}

            {/* Initial email verification banner (new registration, not yet verified) */}
            {user.email && !user.isEmailVerified && !user.pendingEmail && (
              <Alert data-testid="alert-email-unverified">
                <MailCheck className="h-4 w-4" />
                <AlertTitle>{t("settings.verifyEmailBannerTitle")}</AlertTitle>
                <AlertDescription className="space-y-3">
                  <p>{t("settings.verifyEmailBannerDesc", { email: user.email })}</p>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => resendVerificationMutation.mutate()}
                    disabled={resendVerificationMutation.isPending}
                    data-testid="button-resend-verification-account"
                  >
                    {resendVerificationMutation.isPending ? (
                      <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                    ) : (
                      <MailCheck className="mr-2 h-3 w-3" />
                    )}
                    {resendVerificationMutation.isPending
                      ? t("auth.resendingVerification")
                      : t("auth.resendVerification")}
                  </Button>
                </AlertDescription>
              </Alert>
            )}

            {/* Change Password */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Key className="h-4 w-4 text-muted-foreground" />
                <h3 className="font-medium text-sm">{t("settings.changePassword")}</h3>
              </div>
              <p className="text-xs text-muted-foreground">{t("settings.changePasswordDesc")}</p>
              <div className="space-y-2">
                <Input
                  type="password"
                  placeholder={t("settings.currentPassword")}
                  value={cpCurrentPw}
                  onChange={(e) => { setCpCurrentPw(e.target.value); setCpError(""); }}
                  data-testid="input-current-password"
                  autoComplete="current-password"
                />
                <Input
                  type="password"
                  placeholder={t("settings.newPassword")}
                  value={cpNewPw}
                  onChange={(e) => { setCpNewPw(e.target.value); setCpError(""); }}
                  data-testid="input-new-password"
                  autoComplete="new-password"
                />
                <Input
                  type="password"
                  placeholder={t("settings.confirmNewPassword")}
                  value={cpConfirmPw}
                  onChange={(e) => { setCpConfirmPw(e.target.value); setCpError(""); }}
                  data-testid="input-confirm-new-password"
                  autoComplete="new-password"
                />
                {cpError && (
                  <p className="text-sm text-destructive" data-testid="text-cp-error">{cpError}</p>
                )}
                <Button
                  onClick={() => {
                    if (cpNewPw !== cpConfirmPw) {
                      setCpError(t("settings.passwordsDoNotMatch"));
                      return;
                    }
                    setCpError("");
                    changePasswordMutation.mutate({ currentPassword: cpCurrentPw, newPassword: cpNewPw });
                  }}
                  disabled={changePasswordMutation.isPending || !cpCurrentPw || !cpNewPw || !cpConfirmPw}
                  data-testid="button-change-password"
                >
                  {changePasswordMutation.isPending ? t("common.loading") : t("settings.changePassword")}
                </Button>
              </div>
            </div>

            <div className="border-t" />

            {/* Change Email */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <h3 className="font-medium text-sm">{t("settings.changeEmail")}</h3>
              </div>
              <p className="text-xs text-muted-foreground">{t("settings.changeEmailDesc")}</p>
              <div className="space-y-2">
                <Input
                  type="email"
                  placeholder={t("settings.newEmail")}
                  value={ceNewEmail}
                  onChange={(e) => { setCeNewEmail(e.target.value); setCeError(""); }}
                  data-testid="input-new-email"
                  autoComplete="email"
                />
                <Input
                  type="password"
                  placeholder={t("settings.currentPassword")}
                  value={ceCurrentPw}
                  onChange={(e) => { setCeCurrentPw(e.target.value); setCeError(""); }}
                  data-testid="input-email-current-password"
                  autoComplete="current-password"
                />
                {ceError && (
                  <p className="text-sm text-destructive" data-testid="text-ce-error">{ceError}</p>
                )}
                <Button
                  onClick={() => {
                    setCeError("");
                    changeEmailMutation.mutate({ currentPassword: ceCurrentPw, newEmail: ceNewEmail });
                  }}
                  disabled={changeEmailMutation.isPending || !ceCurrentPw || !ceNewEmail}
                  data-testid="button-change-email"
                >
                  {changeEmailMutation.isPending ? t("common.loading") : t("settings.changeEmail")}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
