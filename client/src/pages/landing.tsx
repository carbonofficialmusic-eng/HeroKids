import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Star, Trophy, Users, CheckCircle, Zap, Smartphone, Loader2, Mail, Lock, UserPlus } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import { useTranslation } from "react-i18next";
import { Link, useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import logoUrl from "@assets/ChatGPT Image 7. Nov. 2025, 19_19_07_1762539654932.png";

const loginSchema = z.object({
  email: z.string().email("Bitte gib eine gültige E-Mail ein."),
  password: z.string().min(1, "Bitte gib dein Passwort ein."),
});

const registerSchema = z.object({
  firstName: z.string().min(1, "Bitte gib deinen Namen ein."),
  lastName: z.string().optional(),
  email: z.string().email("Bitte gib eine gültige E-Mail ein."),
  password: z.string().min(8, "Das Passwort braucht mindestens 8 Zeichen."),
});

const forgotSchema = z.object({
  email: z.string().email("Bitte gib eine gültige E-Mail ein."),
});

const resetSchema = z.object({
  password: z.string().min(8, "Das Passwort braucht mindestens 8 Zeichen."),
});

type LoginForm = z.infer<typeof loginSchema>;
type RegisterForm = z.infer<typeof registerSchema>;
type ForgotForm = z.infer<typeof forgotSchema>;
type ResetForm = z.infer<typeof resetSchema>;

function AuthPanel() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [authTab, setAuthTab] = useState("login");
  const [formMessage, setFormMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const searchParams = useMemo(() => new URLSearchParams(window.location.search), []);
  const resetToken = searchParams.get("reset_token");

  const loginForm = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  const registerForm = useForm<RegisterForm>({
    resolver: zodResolver(registerSchema),
    defaultValues: { firstName: "", lastName: "", email: "", password: "" },
  });

  const forgotForm = useForm<ForgotForm>({
    resolver: zodResolver(forgotSchema),
    defaultValues: { email: "" },
  });

  const resetForm = useForm<ResetForm>({
    resolver: zodResolver(resetSchema),
    defaultValues: { password: "" },
  });

  useEffect(() => {
    if (resetToken) {
      setAuthTab("reset");
    }
  }, [resetToken]);

  const finishAuth = async (user: unknown) => {
    queryClient.setQueryData(["/api/auth/user"], user);
    await queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
    setLocation("/");
  };

  const onLogin = async (data: LoginForm) => {
    setFormMessage(null);
    setIsSubmitting(true);
    try {
      const response = await apiRequest("POST", "/api/auth/login", data);
      const result = await response.json();
      await finishAuth(result.user);
    } catch (error: any) {
      setFormMessage(error.message || "Login fehlgeschlagen.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const onRegister = async (data: RegisterForm) => {
    setFormMessage(null);
    setIsSubmitting(true);
    try {
      const response = await apiRequest("POST", "/api/auth/register", data);
      const result = await response.json();
      if (result.emailStatus?.status === "not_configured") {
        toast({
          title: "Konto erstellt",
          description: result.emailStatus.message,
        });
      } else if (result.emailStatus?.status === "failed") {
        toast({
          title: "Konto erstellt",
          description: result.emailStatus.message,
          variant: "destructive",
        });
      } else {
        toast({
          title: "Konto erstellt",
          description: "Wir haben dir eine Bestätigungsmail gesendet.",
        });
      }
      sessionStorage.setItem("herokids_registration_complete", "true");
      await finishAuth(result.user);
    } catch (error: any) {
      setFormMessage(error.message || "Registrierung fehlgeschlagen.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const onForgot = async (data: ForgotForm) => {
    setFormMessage(null);
    setIsSubmitting(true);
    try {
      const response = await apiRequest("POST", "/api/auth/forgot-password", data);
      const result = await response.json();
      setFormMessage(result.message || "Wenn ein Konto existiert, erhältst du eine E-Mail.");
    } catch (error: any) {
      setFormMessage(error.message || "Passwort-Reset ist noch nicht verfügbar.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const onReset = async (data: ResetForm) => {
    if (!resetToken) return;
    setFormMessage(null);
    setIsSubmitting(true);
    try {
      const response = await apiRequest("POST", "/api/auth/reset-password", { token: resetToken, password: data.password });
      const result = await response.json();
      setFormMessage(result.message || "Passwort wurde aktualisiert.");
      setAuthTab("login");
      window.history.replaceState({}, "", "/");
      resetForm.reset();
    } catch (error: any) {
      setFormMessage(error.message || "Passwort konnte nicht aktualisiert werden.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card className="w-full max-w-md text-left" data-testid="card-auth-panel">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-2xl font-accent">
          <Lock className="h-5 w-5" />
          HeroKids Konto
        </CardTitle>
        <CardDescription>Direkt anmelden, ohne Browser-Weiterleitung.</CardDescription>
      </CardHeader>
      <CardContent>
        {formMessage && (
          <Alert className="mb-4" data-testid="status-auth-message">
            <Mail className="h-4 w-4" />
            <AlertTitle>Hinweis</AlertTitle>
            <AlertDescription>{formMessage}</AlertDescription>
          </Alert>
        )}

        <Tabs value={authTab} onValueChange={(value) => { setAuthTab(value); setFormMessage(null); }}>
          <TabsList className="grid w-full grid-cols-3 mb-6">
            <TabsTrigger value="login" data-testid="tab-login">Login</TabsTrigger>
            <TabsTrigger value="register" data-testid="tab-register">Registrieren</TabsTrigger>
            <TabsTrigger value="forgot" data-testid="tab-forgot">Passwort</TabsTrigger>
          </TabsList>

          <TabsContent value="login">
            <Form {...loginForm}>
              <form onSubmit={loginForm.handleSubmit(onLogin)} className="space-y-4">
                <FormField
                  control={loginForm.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>E-Mail</FormLabel>
                      <FormControl>
                        <Input type="email" autoComplete="email" data-testid="input-login-email" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={loginForm.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Passwort</FormLabel>
                      <FormControl>
                        <Input type="password" autoComplete="current-password" data-testid="input-login-password" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button type="submit" className="w-full" disabled={isSubmitting} data-testid="button-submit-login">
                  {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Einloggen"}
                </Button>
              </form>
            </Form>
          </TabsContent>

          <TabsContent value="register">
            <Form {...registerForm}>
              <form onSubmit={registerForm.handleSubmit(onRegister)} className="space-y-4">
                <FormField
                  control={registerForm.control}
                  name="firstName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Vorname</FormLabel>
                      <FormControl>
                        <Input autoComplete="given-name" data-testid="input-register-first-name" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={registerForm.control}
                  name="lastName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nachname optional</FormLabel>
                      <FormControl>
                        <Input autoComplete="family-name" data-testid="input-register-last-name" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={registerForm.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>E-Mail</FormLabel>
                      <FormControl>
                        <Input type="email" autoComplete="email" data-testid="input-register-email" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={registerForm.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Passwort</FormLabel>
                      <FormControl>
                        <Input type="password" autoComplete="new-password" data-testid="input-register-password" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button type="submit" className="w-full" disabled={isSubmitting} data-testid="button-submit-register">
                  {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <><UserPlus className="h-4 w-4" /> Konto erstellen</>}
                </Button>
              </form>
            </Form>
          </TabsContent>

          <TabsContent value="forgot">
            <Form {...forgotForm}>
              <form onSubmit={forgotForm.handleSubmit(onForgot)} className="space-y-4">
                <FormField
                  control={forgotForm.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>E-Mail</FormLabel>
                      <FormControl>
                        <Input type="email" autoComplete="email" data-testid="input-forgot-email" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button type="submit" className="w-full" disabled={isSubmitting} data-testid="button-submit-forgot">
                  {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Reset-Link senden"}
                </Button>
              </form>
            </Form>
          </TabsContent>

          <TabsContent value="reset">
            <Form {...resetForm}>
              <form onSubmit={resetForm.handleSubmit(onReset)} className="space-y-4">
                <FormField
                  control={resetForm.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Neues Passwort</FormLabel>
                      <FormControl>
                        <Input type="password" autoComplete="new-password" data-testid="input-reset-password" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button type="submit" className="w-full" disabled={isSubmitting || !resetToken} data-testid="button-submit-reset">
                  {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Passwort speichern"}
                </Button>
              </form>
            </Form>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}

export default function Landing() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [verifyingPayment, setVerifyingPayment] = useState(false);

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const sessionId = urlParams.get("session_id");
    const subscriptionSuccess = urlParams.get("subscription");
    const verified = urlParams.get("verified");

    if (verified === "success") {
      toast({ title: "E-Mail bestätigt", description: "Dein HeroKids-Konto ist jetzt bestätigt." });
      window.history.replaceState({}, "", "/");
    } else if (verified === "invalid") {
      toast({ title: "Bestätigung fehlgeschlagen", description: "Der Link ist ungültig oder abgelaufen.", variant: "destructive" });
      window.history.replaceState({}, "", "/");
    }
    
    if (sessionId && subscriptionSuccess === "success") {
      setVerifyingPayment(true);
      fetch("/api/verify-checkout-public", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId }),
      })
        .then(res => res.json())
        .then(data => {
          if (data.success) {
            toast({
              title: t("pricing.subscriptionActivated") || "Subscription activated!",
              description: `${data.tier} tier activated for ${data.familyName}`,
            });
          }
          window.location.href = "/";
        })
        .catch(err => {
          console.error("Error verifying checkout:", err);
          window.location.href = "/";
        });
    }
  }, [toast, t]);

  if (verifyingPayment) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin mx-auto mb-4 text-primary" />
          <p className="text-lg text-muted-foreground">{t("pricing.verifyingPayment") || "Verifying payment..."}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <header className="border-b sticky top-0 backdrop-blur-md z-50">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <img 
              src={logoUrl} 
              alt="HeroKids Logo" 
              className="h-12 w-12 rounded-lg"
              data-testid="img-logo"
            />
            <span className="text-2xl font-black font-accent" data-testid="text-app-name">
              HeroKids
            </span>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
          </div>
        </div>
      </header>

      <section className="py-16 px-4">
        <div className="container mx-auto max-w-6xl grid lg:grid-cols-[1fr_28rem] gap-10 items-center">
          <div className="text-center lg:text-left">
            <h1 className="text-5xl md:text-7xl font-black font-accent mb-6 gradient-text-celebration" data-testid="text-hero-title">
              {t('landing.heroTitle')}
            </h1>
            <p className="text-xl md:text-2xl text-muted-foreground mb-8 max-w-3xl mx-auto lg:mx-0" data-testid="text-hero-subtitle">
              {t('landing.heroSubtitle')}
            </p>
            <div className="flex flex-wrap gap-4 justify-center lg:justify-start">
              <Link href="/link-device">
                <Button
                  size="lg"
                  variant="outline"
                  data-testid="button-link-device-landing"
                >
                  <Smartphone className="h-5 w-5 mr-2" />
                  {t('landing.linkDevice')}
                </Button>
              </Link>
            </div>
          </div>
          <AuthPanel />
        </div>
      </section>

      <section className="py-16 px-4 bg-muted/30">
        <div className="container mx-auto max-w-6xl">
          <h2 className="text-4xl font-bold font-accent text-center mb-12" data-testid="text-features-title">
            {t('landing.howItWorks')}
          </h2>
          <div className="grid md:grid-cols-3 gap-8">
            <Card className="p-8 text-center hover-elevate transition-all" data-testid="card-feature-tasks">
              <div className="h-16 w-16 rounded-full gradient-achievement mx-auto mb-4 flex items-center justify-center">
                <CheckCircle className="h-8 w-8 text-white" />
              </div>
              <h3 className="text-2xl font-bold font-accent mb-3">{t('landing.createTasks')}</h3>
              <p className="text-muted-foreground">
                {t('landing.createTasksDesc')}
              </p>
            </Card>

            <Card className="p-8 text-center hover-elevate transition-all" data-testid="card-feature-points">
              <div className="h-16 w-16 rounded-full gradient-celebration mx-auto mb-4 flex items-center justify-center">
                <Star className="h-8 w-8 text-white" />
              </div>
              <h3 className="text-2xl font-bold font-accent mb-3">{t('landing.earnPoints')}</h3>
              <p className="text-muted-foreground">
                {t('landing.earnPointsDesc')}
              </p>
            </Card>

            <Card className="p-8 text-center hover-elevate transition-all" data-testid="card-feature-compete">
              <div className="h-16 w-16 rounded-full gradient-winner mx-auto mb-4 flex items-center justify-center">
                <Trophy className="h-8 w-8 text-white" />
              </div>
              <h3 className="text-2xl font-bold font-accent mb-3">{t('landing.winRewards')}</h3>
              <p className="text-muted-foreground">
                {t('landing.winRewardsDesc')}
              </p>
            </Card>
          </div>
        </div>
      </section>

      <section className="py-16 px-4">
        <div className="container mx-auto max-w-6xl">
          <h2 className="text-4xl font-bold font-accent text-center mb-12" data-testid="text-benefits-title">
            {t('landing.whyFamiliesLove')}
          </h2>
          <div className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto">
            {[
              { icon: Users, text: t('landing.getEveryoneInvolved') },
              { icon: Zap, text: t('landing.motivateWithPoints') },
              { icon: Trophy, text: t('landing.friendlyCompetition') },
              { icon: CheckCircle, text: t('landing.trackWithProof') },
            ].map((benefit, i) => (
              <div key={i} className="flex items-center gap-4 p-4" data-testid={`item-benefit-${i}`}>
                <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <benefit.icon className="h-6 w-6 text-primary" />
                </div>
                <p className="text-lg font-semibold">{benefit.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-20 px-4 bg-muted/30">
        <div className="container mx-auto max-w-4xl text-center">
          <h2 className="text-4xl md:text-5xl font-black font-accent mb-6" data-testid="text-cta-title">
            {t('landing.readyToMakeFun')}
          </h2>
          <p className="text-xl text-muted-foreground mb-8" data-testid="text-cta-subtitle">
            {t('landing.joinThousands')}
          </p>
        </div>
      </section>

      <footer className="border-t py-8 px-4">
        <div className="container mx-auto max-w-6xl text-center text-sm text-muted-foreground">
          <p>{t('landing.copyrightNotice')}</p>
        </div>
      </footer>
    </div>
  );
}
