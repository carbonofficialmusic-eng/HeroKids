import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Star, CheckCircle2, Shield, Heart, ArrowRight, Play, Gamepad2, Gift, Sparkles, Loader2, Mail, Lock, UserPlus, Smartphone } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link, useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient, storeDevToken } from "@/lib/queryClient";
import logoUrl from "@assets/ChatGPT Image 7. Nov. 2025, 19_19_07_1762539654932.png";

// ─── Auth schemas ─────────────────────────────────────────────────────────────
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

// ─── AuthPanel — unchanged logic, unchanged JSX ───────────────────────────────
function AuthPanel() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [authTab, setAuthTab] = useState("login");
  const [formMessage, setFormMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const searchParams = useMemo(() => new URLSearchParams(window.location.search), []);
  const resetToken = searchParams.get("reset_token");

  const loginForm = useForm<LoginForm>({ resolver: zodResolver(loginSchema), defaultValues: { email: "", password: "" } });
  const registerForm = useForm<RegisterForm>({ resolver: zodResolver(registerSchema), defaultValues: { firstName: "", lastName: "", email: "", password: "" } });
  const forgotForm = useForm<ForgotForm>({ resolver: zodResolver(forgotSchema), defaultValues: { email: "" } });
  const resetForm = useForm<ResetForm>({ resolver: zodResolver(resetSchema), defaultValues: { password: "" } });

  useEffect(() => {
    if (resetToken) {
      setAuthTab("reset");
      setTimeout(() => {
        document.getElementById("auth-panel")?.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 150);
    }
  }, [resetToken]);

  const finishAuth = async (user: unknown, redirectPath = "/") => {
    queryClient.setQueryData(["/api/auth/user"], user);
    await queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
    setLocation(redirectPath);
  };

  const onLogin = async (data: LoginForm) => {
    setFormMessage(null); setIsSubmitting(true);
    try {
      const res = await apiRequest("POST", "/api/auth/login", data);
      const result = await res.json();
      if (result.devToken) storeDevToken(result.devToken);
      await finishAuth(result.user);
    } catch (e: any) { setFormMessage(e.message || "Login fehlgeschlagen."); }
    finally { setIsSubmitting(false); }
  };

  const onRegister = async (data: RegisterForm) => {
    setFormMessage(null); setIsSubmitting(true);
    try {
      const res = await apiRequest("POST", "/api/auth/register", data);
      const result = await res.json();
      if (result.emailStatus?.status === "not_configured") {
        toast({ title: "Konto erstellt", description: result.emailStatus.message });
      } else if (result.emailStatus?.status === "failed") {
        toast({ title: "Konto erstellt", description: result.emailStatus.message, variant: "destructive" });
      } else {
        toast({ title: "Konto erstellt", description: "Wir haben dir eine Bestätigungsmail gesendet." });
      }
      sessionStorage.setItem("herokids_registration_complete", "true");
      await finishAuth(result.user, "/setup");
    } catch (e: any) { setFormMessage(e.message || "Registrierung fehlgeschlagen."); }
    finally { setIsSubmitting(false); }
  };

  const onForgot = async (data: ForgotForm) => {
    setFormMessage(null); setIsSubmitting(true);
    try {
      const res = await apiRequest("POST", "/api/auth/forgot-password", data);
      const result = await res.json();
      setFormMessage(result.message || "Wenn ein Konto existiert, erhältst du eine E-Mail.");
    } catch (e: any) { setFormMessage(e.message || "Passwort-Reset ist noch nicht verfügbar."); }
    finally { setIsSubmitting(false); }
  };

  const onReset = async (data: ResetForm) => {
    if (!resetToken) return;
    setFormMessage(null); setIsSubmitting(true);
    try {
      const res = await apiRequest("POST", "/api/auth/reset-password", { token: resetToken, password: data.password });
      const result = await res.json();
      setFormMessage(result.message || "Passwort wurde aktualisiert.");
      setAuthTab("login");
      window.history.replaceState({}, "", "/");
      resetForm.reset();
    } catch (e: any) { setFormMessage(e.message || "Passwort konnte nicht aktualisiert werden."); }
    finally { setIsSubmitting(false); }
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
            <AlertDescription>{formMessage}</AlertDescription>
          </Alert>
        )}
        <Tabs value={authTab} onValueChange={(v) => { setAuthTab(v); setFormMessage(null); }}>
          <TabsList className="grid w-full grid-cols-3 mb-6">
            <TabsTrigger value="login" data-testid="tab-login">Login</TabsTrigger>
            <TabsTrigger value="register" data-testid="tab-register">Registrieren</TabsTrigger>
            <TabsTrigger value="forgot" data-testid="tab-forgot">Passwort</TabsTrigger>
          </TabsList>

          <TabsContent value="login">
            <Form {...loginForm}>
              <form onSubmit={loginForm.handleSubmit(onLogin)} className="space-y-4">
                <FormField control={loginForm.control} name="email" render={({ field }) => (
                  <FormItem><FormLabel>E-Mail</FormLabel><FormControl>
                    <Input type="email" autoComplete="email" data-testid="input-login-email" {...field} />
                  </FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={loginForm.control} name="password" render={({ field }) => (
                  <FormItem><FormLabel>Passwort</FormLabel><FormControl>
                    <Input type="password" autoComplete="current-password" data-testid="input-login-password" {...field} />
                  </FormControl><FormMessage /></FormItem>
                )} />
                <Button type="submit" className="w-full" disabled={isSubmitting} data-testid="button-submit-login">
                  {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Einloggen"}
                </Button>
              </form>
            </Form>
          </TabsContent>

          <TabsContent value="register">
            <Form {...registerForm}>
              <form onSubmit={registerForm.handleSubmit(onRegister)} className="space-y-4">
                <FormField control={registerForm.control} name="firstName" render={({ field }) => (
                  <FormItem><FormLabel>Vorname</FormLabel><FormControl>
                    <Input autoComplete="given-name" data-testid="input-register-first-name" {...field} />
                  </FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={registerForm.control} name="lastName" render={({ field }) => (
                  <FormItem><FormLabel>Nachname optional</FormLabel><FormControl>
                    <Input autoComplete="family-name" data-testid="input-register-last-name" {...field} />
                  </FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={registerForm.control} name="email" render={({ field }) => (
                  <FormItem><FormLabel>E-Mail</FormLabel><FormControl>
                    <Input type="email" autoComplete="email" data-testid="input-register-email" {...field} />
                  </FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={registerForm.control} name="password" render={({ field }) => (
                  <FormItem><FormLabel>Passwort</FormLabel><FormControl>
                    <Input type="password" autoComplete="new-password" data-testid="input-register-password" {...field} />
                  </FormControl><FormMessage /></FormItem>
                )} />
                <Button type="submit" className="w-full" disabled={isSubmitting} data-testid="button-submit-register">
                  {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <><UserPlus className="h-4 w-4 mr-1" />Konto erstellen</>}
                </Button>
              </form>
            </Form>
          </TabsContent>

          <TabsContent value="forgot">
            <Form {...forgotForm}>
              <form onSubmit={forgotForm.handleSubmit(onForgot)} className="space-y-4">
                <FormField control={forgotForm.control} name="email" render={({ field }) => (
                  <FormItem><FormLabel>E-Mail</FormLabel><FormControl>
                    <Input type="email" autoComplete="email" data-testid="input-forgot-email" {...field} />
                  </FormControl><FormMessage /></FormItem>
                )} />
                <Button type="submit" className="w-full" disabled={isSubmitting} data-testid="button-submit-forgot">
                  {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Reset-Link senden"}
                </Button>
              </form>
            </Form>
          </TabsContent>

          <TabsContent value="reset">
            <Form {...resetForm}>
              <form onSubmit={resetForm.handleSubmit(onReset)} className="space-y-4">
                <FormField control={resetForm.control} name="password" render={({ field }) => (
                  <FormItem><FormLabel>Neues Passwort</FormLabel><FormControl>
                    <Input type="password" autoComplete="new-password" data-testid="input-reset-password" {...field} />
                  </FormControl><FormMessage /></FormItem>
                )} />
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

// ─── Design tokens (scoped — do not bleed into the rest of the app) ───────────
const C = {
  bg:        "rgb(16, 20, 34)",
  bgCard:    "rgb(22, 28, 46)",
  bgSection: "rgb(19, 24, 40)",
  border:    "rgb(42, 52, 80)",
  fg:        "rgb(225, 232, 248)",
  fgMuted:   "rgb(130, 148, 185)",
  orange:    "rgb(248, 107, 28)",
  orangeD:   "rgb(200, 82, 16)",
  yellow:    "rgb(250, 185, 40)",
  blue:      "rgb(52, 178, 220)",
} as const;

const floatKeyframes = `
@keyframes hk-float {
  0%, 100% { transform: translateY(0); }
  50%       { transform: translateY(-12px); }
}
@keyframes hk-float2 {
  0%, 100% { transform: translateY(0); }
  50%       { transform: translateY(-8px); }
}
.hk-float  { animation: hk-float  6s ease-in-out infinite; }
.hk-float2 { animation: hk-float2 7s ease-in-out infinite 1s; }
.hk-display { font-family: 'Bricolage Grotesque', 'Nunito', sans-serif; letter-spacing: -0.02em; }
`;

// ─── Landing page ─────────────────────────────────────────────────────────────
export default function Landing() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [verifyingPayment, setVerifyingPayment] = useState(false);

  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    const sessionId = p.get("session_id");
    const verified  = p.get("verified");

    if (verified === "success") {
      toast({ title: t("auth.emailVerifiedTitle"), description: t("auth.emailVerifiedDescription") });
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      window.history.replaceState({}, "", "/");
    } else if (verified === "invalid") {
      toast({ title: t("auth.verificationFailedTitle"), description: t("auth.verificationFailedDescription"), variant: "destructive" });
      window.history.replaceState({}, "", "/");
    }

    if (sessionId && p.get("subscription") === "success") {
      setVerifyingPayment(true);
      fetch("/api/verify-checkout-public", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId }),
      })
        .then(r => r.json())
        .then(data => {
          if (data.success) toast({ title: t("pricing.subscriptionActivated") || "Subscription activated!", description: `${data.tier} tier activated for ${data.familyName}` });
          window.location.href = "/";
        })
        .catch(() => { window.location.href = "/"; });
    }
  }, [toast, t]);

  if (verifyingPayment) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: C.bg }}>
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin mx-auto mb-4" style={{ color: C.orange }} />
          <p className="text-lg" style={{ color: C.fgMuted }}>{t("pricing.verifyingPayment") || "Verifying payment..."}</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ background: C.bg, color: C.fg, fontFamily: "'Nunito', sans-serif" }}>
      <style>{floatKeyframes}</style>

      {/* Ambient blobs */}
      <div style={{ position: "fixed", top: "-15%", left: "-10%", width: "50%", height: "50%", background: `radial-gradient(circle, ${C.orange}22 0%, transparent 70%)`, pointerEvents: "none", zIndex: 0 }} />
      <div style={{ position: "fixed", bottom: "5%", right: "-10%", width: "40%", height: "40%", background: `radial-gradient(circle, ${C.blue}18 0%, transparent 70%)`, pointerEvents: "none", zIndex: 0 }} />

      {/* ── Navigation ── */}
      <nav style={{ position: "sticky", top: 0, zIndex: 50, background: `${C.bg}dd`, backdropFilter: "blur(12px)", borderBottom: `1px solid ${C.border}`, paddingTop: "env(safe-area-inset-top)" }}>
        <div style={{ maxWidth: 1152, margin: "0 auto", padding: "0 1rem", height: 64, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <img src={logoUrl} alt="HeroKids" style={{ width: 40, height: 40, borderRadius: 10 }} data-testid="img-logo" />
            <span className="hk-display" style={{ fontWeight: 800, fontSize: "1.35rem", color: C.fg }} data-testid="text-app-name">HeroKids</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <Link href="/link-device">
              <Button variant="ghost" size="sm" style={{ color: C.fgMuted }}>
                <Smartphone className="h-4 w-4 mr-1" />
                Gerät verbinden
              </Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section style={{ position: "relative", padding: "4rem 1rem 5rem", overflow: "hidden", zIndex: 1 }}>
        <div style={{ maxWidth: 1152, margin: "0 auto", display: "grid", gap: "3rem", alignItems: "center", gridTemplateColumns: "1fr" }} className="lg:grid-cols-2">

          {/* Left: copy */}
          <div style={{ textAlign: "center" }} className="lg:text-left">
            <div style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "6px 16px", borderRadius: 999, background: C.bgCard, border: `1px solid ${C.border}`, marginBottom: 28, color: C.fgMuted, fontSize: "0.875rem", fontWeight: 700 }}>
              <Sparkles style={{ width: 14, height: 14, color: C.yellow }} />
              Haushalt-Chaos? Nicht mehr.
            </div>
            <h1 className="hk-display" data-testid="text-hero-title" style={{ fontSize: "clamp(2.8rem, 6vw, 4.75rem)", fontWeight: 800, lineHeight: 1.08, marginBottom: "1.5rem" }}>
              <span style={{ color: C.fg }}>Starke Kinder<br />erziehen.</span>
              <br />
              <span style={{ color: C.orange }}>Ohne das ewige Nörgeln.</span>
            </h1>
            <p style={{ fontSize: "1.1rem", color: C.fgMuted, marginBottom: "2rem", maxWidth: 460, lineHeight: 1.7 }} data-testid="text-hero-subtitle">
              {t('landing.heroSubtitle')}
            </p>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap", justifyContent: "center" }} className="lg:justify-start">
              <button
                onClick={() => document.getElementById("auth-panel")?.scrollIntoView({ behavior: "smooth" })}
                style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "0 2rem", height: 52, borderRadius: 999, background: C.orange, color: "#fff", fontWeight: 800, fontSize: "1rem", border: "none", cursor: "pointer", boxShadow: `0 8px 24px -8px ${C.orange}88` }}
              >
                Kostenlos starten <ArrowRight style={{ width: 18, height: 18 }} />
              </button>
              <button
                onClick={() => document.getElementById("how-it-works")?.scrollIntoView({ behavior: "smooth" })}
                style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "0 1.5rem", height: 52, borderRadius: 999, background: "transparent", color: C.fg, fontWeight: 700, fontSize: "1rem", border: `1px solid ${C.border}`, cursor: "pointer" }}
              >
                <Play style={{ width: 14, height: 14, fill: C.fg }} /> So funktionierts
              </button>
            </div>
            <div style={{ marginTop: "1.75rem", display: "flex", alignItems: "center", gap: 10, justifyContent: "center", fontSize: "0.875rem", color: C.fgMuted, fontWeight: 600 }} className="lg:justify-start">
              <div style={{ display: "flex" }}>
                {[1,2,3,4].map(i => (
                  <div key={i} style={{ width: 30, height: 30, borderRadius: "50%", border: `2px solid ${C.bg}`, background: C.bgCard, marginLeft: i > 1 ? -8 : 0, overflow: "hidden" }}>
                    <img src={`https://api.dicebear.com/7.x/notionists/svg?seed=${i}&backgroundColor=b6e3f4`} alt="" style={{ width: "100%", height: "100%" }} />
                  </div>
                ))}
              </div>
              Bereits von 10.000+ Familien geliebt
            </div>
          </div>

          {/* Right: floating image with badges */}
          <div className="hk-float" style={{ position: "relative", display: "flex", justifyContent: "center" }}>
            {/* glow behind image */}
            <div style={{ position: "absolute", inset: "10%", background: `radial-gradient(circle, ${C.orange}30 0%, transparent 70%)`, borderRadius: "2rem", filter: "blur(32px)" }} />
            <div style={{ position: "relative", width: "100%", maxWidth: "500px" }}>
              <img
                src="/images/herokids-hero.png"
                alt="Glückliche Familie beim High-Five"
                style={{ width: "100%", borderRadius: "1.5rem", display: "block", boxShadow: `0 24px 60px -16px rgba(0,0,0,0.5)` }}
              />
              {/* Badge: Completed task */}
              <div className="hk-float2" style={{ position: "absolute", top: "10%", left: "-8%", display: "flex", alignItems: "center", gap: 10, padding: "10px 16px", borderRadius: 999, background: "rgba(20,30,50,0.92)", backdropFilter: "blur(10px)", border: `1px solid ${C.border}`, boxShadow: "0 8px 24px rgba(0,0,0,0.4)", whiteSpace: "nowrap" }}>
                <div style={{ width: 32, height: 32, borderRadius: "50%", background: "rgb(34,197,94)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <CheckCircle2 style={{ width: 18, height: 18, color: "#fff" }} />
                </div>
                <div>
                  <div style={{ fontSize: "0.65rem", fontWeight: 700, color: "rgb(34,197,94)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Erledigt</div>
                  <div style={{ fontSize: "0.85rem", fontWeight: 700, color: C.fg }}>Zimmer aufgeräumt!</div>
                </div>
              </div>
              {/* Badge: Points earned */}
              <div style={{ position: "absolute", bottom: "10%", right: "-6%", display: "flex", alignItems: "center", gap: 10, padding: "10px 16px", borderRadius: 999, background: "rgba(20,30,50,0.92)", backdropFilter: "blur(10px)", border: `1px solid ${C.border}`, boxShadow: "0 8px 24px rgba(0,0,0,0.4)", whiteSpace: "nowrap" }}>
                <div style={{ width: 36, height: 36, borderRadius: "50%", background: C.yellow, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <Star style={{ width: 20, height: 20, color: "#fff", fill: "#fff" }} />
                </div>
                <div>
                  <div style={{ fontSize: "1.1rem", fontWeight: 800, color: C.fg, fontFamily: "Fredoka, sans-serif" }}>+50</div>
                  <div style={{ fontSize: "0.65rem", fontWeight: 700, color: C.fgMuted, textTransform: "uppercase", letterSpacing: "0.05em" }}>Punkte verdient</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Auth Panel ── */}
      <section id="auth-panel" style={{ padding: "2rem 1rem 5rem", zIndex: 1, position: "relative" }}>
        <div style={{ maxWidth: 480, margin: "0 auto" }}>
          <AuthPanel />
        </div>
      </section>

      {/* ── How it Works ── */}
      <section id="how-it-works" style={{ padding: "5rem 1rem", background: C.bgSection, position: "relative", zIndex: 1 }}>
        <div style={{ maxWidth: 1152, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: "3.5rem" }}>
            <h2 className="hk-display" style={{ fontSize: "clamp(1.8rem, 4vw, 2.75rem)", fontWeight: 800, marginBottom: "0.75rem" }} data-testid="text-features-title">
              {t('landing.howItWorks')}
            </h2>
            <p style={{ color: C.fgMuted, fontSize: "1.1rem" }}>In wenigen Minuten eingerichtet. Die Magie passiert sofort.</p>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "1.5rem" }}>
            {[
              { icon: <Gamepad2 style={{ width: 28, height: 28, color: C.blue }} />, glow: C.blue, title: "1. Aufgaben festlegen", desc: "Haushaltsaufgaben, Routinen oder Sonderaktionen — mit individuellen Punkten je nach Schwierigkeit." },
              { icon: <CheckCircle2 style={{ width: 28, height: 28, color: C.orange }} />, glow: C.orange, title: "2. Kinder legen los", desc: "Die Kinder erledigen Aufgaben in ihrer eigenen, spielerischen App-Oberfläche." },
              { icon: <Gift style={{ width: 28, height: 28, color: C.yellow }} />, glow: C.yellow, title: "3. Belohnungen freischalten", desc: "Punkte werden zu echten Belohnungen: Bildschirmzeit, Taschengeld oder Familien-Kinoabend." },
            ].map((step, i) => (
              <div key={i} style={{ background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: 20, padding: "2rem", transition: "transform 0.2s" }}
                onMouseEnter={e => (e.currentTarget.style.transform = "scale(1.02)")}
                onMouseLeave={e => (e.currentTarget.style.transform = "scale(1)")}
              >
                <div style={{ width: 56, height: 56, borderRadius: 14, background: `${step.glow}20`, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: "1.25rem" }}>
                  {step.icon}
                </div>
                <h3 className="hk-display" style={{ fontWeight: 800, fontSize: "1.2rem", marginBottom: "0.5rem" }}>{step.title}</h3>
                <p style={{ color: C.fgMuted, lineHeight: 1.6 }}>{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Kids Feature ── */}
      <section style={{ padding: "5rem 1rem", position: "relative", zIndex: 1 }}>
        <div style={{ maxWidth: 1152, margin: "0 auto", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "4rem", alignItems: "center" }}>
          <div style={{ position: "relative" }}>
            <div style={{ position: "absolute", inset: 0, background: `${C.yellow}10`, borderRadius: "3rem", transform: "rotate(-2deg)" }} />
            <img src="/images/herokids-rewards.png" alt="App Vorschau" className="hk-float2" style={{ position: "relative", width: "100%", borderRadius: "1.75rem", border: `2px solid ${C.border}`, boxShadow: `0 24px 60px -16px ${C.yellow}30` }} />
          </div>
          <div>
            <div style={{ width: 52, height: 52, borderRadius: 14, background: `${C.yellow}20`, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: "1.25rem" }}>
              <Star style={{ width: 28, height: 28, color: C.yellow, fill: C.yellow }} />
            </div>
            <h2 className="hk-display" style={{ fontSize: "clamp(1.75rem, 3.5vw, 2.5rem)", fontWeight: 800, marginBottom: "1rem", lineHeight: 1.2 }}>
              Gebaut für kleine Hände und große Fantasie.
            </h2>
            <p style={{ color: C.fgMuted, fontSize: "1.1rem", marginBottom: "1.5rem", lineHeight: 1.65 }}>
              Die Kinder-Oberfläche fühlt sich nicht wie eine Aufgabenliste an — sondern wie ein Spiel. Mit Animationen, Fortschrittsbalken und Belohnungen werden die Kinder von selbst aktiv.
            </p>
            <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 12 }}>
              {["Visuelles Fortschritts-Tracking", "Coole Achievement-Abzeichen", "Anpassbare Avatare & Skins"].map((item, i) => (
                <li key={i} style={{ display: "flex", alignItems: "center", gap: 10, fontWeight: 700, fontSize: "1.05rem" }}>
                  <CheckCircle2 style={{ width: 22, height: 22, color: C.orange, flexShrink: 0 }} />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* ── Parents Feature ── */}
      <section style={{ margin: "0 1rem 3rem", borderRadius: "2rem", padding: "4rem 2rem", position: "relative", overflow: "hidden", background: `linear-gradient(135deg, ${C.bgCard} 0%, rgb(28, 20, 18) 100%)`, border: `1px solid ${C.border}`, zIndex: 1 }}>
        <div style={{ position: "absolute", top: 0, right: 0, width: 500, height: 500, background: `radial-gradient(circle, ${C.orange}12 0%, transparent 65%)`, pointerEvents: "none", transform: "translate(30%, -30%)" }} />
        <div style={{ maxWidth: 1100, margin: "0 auto", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "4rem", alignItems: "center", position: "relative" }}>
          <div>
            <div style={{ width: 52, height: 52, borderRadius: 14, background: "rgba(255,255,255,0.08)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: "1.25rem" }}>
              <Shield style={{ width: 28, height: 28, color: C.fg }} />
            </div>
            <h2 className="hk-display" style={{ fontSize: "clamp(1.75rem, 3.5vw, 2.5rem)", fontWeight: 800, marginBottom: "1rem", lineHeight: 1.2 }}>
              Deine Familien-Kommandozentrale.
            </h2>
            <p style={{ color: C.fgMuted, fontSize: "1.1rem", marginBottom: "1.75rem", lineHeight: 1.65 }}>
              Aufgaben genehmigen, Belohnungen festlegen und den Fortschritt aller Familienmitglieder im Blick behalten — alles in deinem eigenen Eltern-Dashboard. Volle Kontrolle, null Stress.
            </p>
            <button
              onClick={() => document.getElementById("auth-panel")?.scrollIntoView({ behavior: "smooth" })}
              style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "0 1.75rem", height: 48, borderRadius: 999, background: C.bg, color: C.fg, fontWeight: 700, border: `1px solid ${C.border}`, cursor: "pointer", fontSize: "1rem" }}
            >
              Eltern-Features entdecken <ArrowRight style={{ width: 16, height: 16 }} />
            </button>
          </div>
          <div style={{ position: "relative" }}>
            <div style={{ position: "absolute", inset: 0, background: `${C.orange}08`, borderRadius: "2.5rem", transform: "rotate(2deg)" }} />
            <img src="/images/herokids-mascot.png" alt="Eltern Dashboard" className="hk-float" style={{ position: "relative", width: "100%", borderRadius: "1.75rem", border: `2px solid ${C.border}22`, boxShadow: `0 32px 80px -24px ${C.orange}28` }} />
          </div>
        </div>
      </section>

      {/* ── Testimonials ── */}
      <section style={{ padding: "5rem 1rem", position: "relative", zIndex: 1 }}>
        <div style={{ maxWidth: 1152, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: "3rem" }}>
            <Heart style={{ width: 44, height: 44, color: C.orange, fill: C.orange, margin: "0 auto 1rem" }} />
            <h2 className="hk-display" style={{ fontSize: "clamp(1.75rem, 3.5vw, 2.5rem)", fontWeight: 800 }} data-testid="text-benefits-title">
              {t('landing.whyFamiliesLove')}
            </h2>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "1.5rem" }}>
            {[
              { text: '"Mein 8-Jähriger hat mich gefragt, ob er noch mehr Aufgaben machen kann. Diese App ist echte Magie."', name: "Sarah J.", role: "Mama von 2 Kindern", seed: "sarah" },
              { text: '"Wir haben uns jeden Abend wegen Aufräumen gestritten. Jetzt wetteifern sie, wer die Filmauswahl fürs Wochenende bekommt."', name: "Mike R.", role: "Papa von 3 Kindern", seed: "mike" },
            ].map((t, i) => (
              <div key={i} style={{ background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: 20, padding: "2rem" }}>
                <div style={{ display: "flex", marginBottom: "1rem" }}>
                  {[1,2,3,4,5].map(s => <Star key={s} style={{ width: 18, height: 18, color: C.yellow, fill: C.yellow }} />)}
                </div>
                <p style={{ color: "rgb(200, 210, 235)", fontSize: "1.05rem", fontStyle: "italic", lineHeight: 1.65, marginBottom: "1.25rem" }}>{t.text}</p>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{ width: 44, height: 44, borderRadius: "50%", overflow: "hidden", background: C.bgSection }}>
                    <img src={`https://api.dicebear.com/7.x/notionists/svg?seed=${t.seed}&backgroundColor=b6e3f4`} alt={t.name} style={{ width: "100%", height: "100%" }} />
                  </div>
                  <div>
                    <p style={{ fontWeight: 700, fontSize: "0.95rem" }}>{t.name}</p>
                    <p style={{ color: C.fgMuted, fontSize: "0.85rem" }}>{t.role}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section style={{ margin: "0 1rem 3rem", borderRadius: "2rem", padding: "5rem 2rem", textAlign: "center", background: `linear-gradient(135deg, ${C.orangeD} 0%, ${C.orange} 55%, ${C.yellow} 100%)`, position: "relative", overflow: "hidden", zIndex: 1 }} data-testid="text-cta-title">
        <div style={{ position: "absolute", inset: 0, backgroundImage: "url('https://www.transparenttextures.com/patterns/cubes.png')", opacity: 0.07, borderRadius: "2rem" }} />
        <div style={{ position: "relative", maxWidth: 680, margin: "0 auto" }}>
          <h2 className="hk-display" style={{ fontSize: "clamp(2rem, 5vw, 3.25rem)", fontWeight: 800, color: "#fff", marginBottom: "1rem", lineHeight: 1.15 }} data-testid="text-cta-title">
            {t('landing.readyToMakeFun')}
          </h2>
          <p style={{ color: "rgba(255,255,255,0.8)", fontSize: "1.15rem", marginBottom: "2rem" }} data-testid="text-cta-subtitle">
            {t('landing.joinThousands')}
          </p>
          <button
            onClick={() => document.getElementById("auth-panel")?.scrollIntoView({ behavior: "smooth" })}
            style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "0 2.5rem", height: 56, borderRadius: 999, background: C.bg, color: C.fg, fontWeight: 800, fontSize: "1.1rem", border: "none", cursor: "pointer", boxShadow: "0 12px 32px -8px rgba(0,0,0,0.5)" }}
          >
            Kostenlos 14 Tage testen
          </button>
          <p style={{ color: "rgba(255,255,255,0.55)", marginTop: "0.75rem", fontSize: "0.875rem" }}>Keine Kreditkarte nötig</p>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer style={{ borderTop: `1px solid ${C.border}`, padding: "2.5rem 1rem", zIndex: 1, position: "relative" }}>
        <div style={{ maxWidth: 1152, margin: "0 auto", display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: "1rem", color: C.fgMuted, fontSize: "0.875rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <img src={logoUrl} alt="HeroKids" style={{ width: 28, height: 28, borderRadius: 6 }} />
            <span className="hk-display" style={{ fontWeight: 700, color: C.fg }}>HeroKids</span>
          </div>
          <p>© {new Date().getFullYear()} HeroKids Inc. Alle Rechte vorbehalten.</p>
          <div style={{ display: "flex", gap: "1.5rem" }}>
            <Link href="/privacy" style={{ color: C.fgMuted, textDecoration: "none" }}>Datenschutz</Link>
            <Link href="/impressum" style={{ color: C.fgMuted, textDecoration: "none" }}>Impressum</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
