import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, Eye, EyeOff, Smartphone } from "lucide-react";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient, storeDevToken } from "@/lib/queryClient";
import { isNativePlatform } from "@/lib/platform";
import logoUrl from "@assets/herokids_logo_neu.png";

// ─── module-level timers (survive component unmount) ─────────────────────────
let _pollInterval: ReturnType<typeof setInterval> | null = null;
let _safetyTimer: ReturnType<typeof setTimeout> | null = null;
function _clearTimers() {
  if (_pollInterval) { clearInterval(_pollInterval); _pollInterval = null; }
  if (_safetyTimer) { clearTimeout(_safetyTimer); _safetyTimer = null; }
}

async function startNativeGoogleLogin() {
  const { Browser } = await import("@capacitor/browser");
  _clearTimers();
  const pollKey = crypto.randomUUID();

  const listener = await Browser.addListener("browserFinished", () => {
    _clearTimers();
    listener.remove();
    queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
  });

  _pollInterval = setInterval(async () => {
    try {
      const res = await fetch(
        `/api/auth/native-check?pollKey=${encodeURIComponent(pollKey)}`,
        { credentials: "include" },
      );
      if (!res.ok) return;
      const data = await res.json();
      if (!data.ready || !data.token) return;
      _clearTimers();
      listener.remove();
      await fetch("/api/auth/native-exchange", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: data.token }),
      });
      await Browser.close();
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
    } catch { /* ignore */ }
  }, 1500);

  _safetyTimer = setTimeout(() => { _clearTimers(); listener.remove(); }, 300_000);

  await Browser.open({
    url: `https://herokids.app/api/auth/google?native=1&pollKey=${encodeURIComponent(pollKey)}`,
  });
}

// ─── PasswordInput ────────────────────────────────────────────────────────────
function PasswordInput({ field, testId, autoComplete }: {
  field: any; testId: string; autoComplete?: string;
}) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <Input
        type={show ? "text" : "password"}
        autoComplete={autoComplete}
        data-testid={testId}
        style={{ paddingRight: "2.5rem", background: "rgba(0,0,0,0.04)", border: "1px solid rgb(236,217,198)", color: "rgb(31,36,46)" }}
        {...field}
      />
      <button
        type="button"
        tabIndex={-1}
        aria-label={show ? "Hide password" : "Show password"}
        onClick={() => setShow(s => !s)}
        style={{ position: "absolute", right: "0.625rem", top: "50%", transform: "translateY(-50%)", background: "none", border: "none", padding: 0, cursor: "pointer", color: "rgba(255,255,255,0.45)", display: "flex", alignItems: "center" }}
      >
        {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  );
}

// ─── colours — Warm & Energetic ──────────────────────────────────────────────
const C = {
  bg:         "rgb(255, 252, 245)",   // warm cream
  card:       "rgba(255,255,255,0.85)",
  cardBorder: "rgb(236, 217, 198)",   // warm border
  fg:         "rgb(31, 36, 46)",      // dark charcoal
  fgMuted:    "rgb(87, 97, 117)",     // slate
  orange:     "rgb(255, 93, 0)",      // vibrant orange
  blue:       "rgb(13, 170, 229)",    // playful blue
  pill:       "rgba(0,0,0,0.06)",
  pillActive: "rgba(0,0,0,0.12)",
} as const;

const inputStyle: React.CSSProperties = {
  background: "rgba(0,0,0,0.04)",
  border: "1px solid rgb(236, 217, 198)",
  color: C.fg,
  borderRadius: 10,
};

const labelStyle: React.CSSProperties = {
  color: C.fgMuted,
  fontSize: "0.8rem",
  fontWeight: 500,
  marginBottom: "0.3rem",
  display: "block",
};

// ─── Main screen ──────────────────────────────────────────────────────────────
export default function NativeLoginScreen() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const scrollRef = useRef<HTMLDivElement>(null);

  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [formMessage, setFormMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showForgot, setShowForgot] = useState(false);
  const [keyboardInset, setKeyboardInset] = useState(0);

  // ── keyboard awareness ──
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const update = () => {
      const kb = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
      setKeyboardInset(kb);
    };
    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
    return () => { vv.removeEventListener("resize", update); vv.removeEventListener("scroll", update); };
  }, []);

  useEffect(() => {
    if (keyboardInset > 10) {
      setTimeout(() => {
        (document.activeElement as HTMLElement | null)?.scrollIntoView?.({ behavior: "smooth", block: "center" });
      }, 100);
    }
  }, [keyboardInset]);

  const keyboardOpen = keyboardInset > 10;

  // reset state when switching mode
  const switchMode = (m: "signin" | "signup") => {
    setMode(m);
    setFormMessage(null);
    setShowForgot(false);
    loginForm.reset();
    registerForm.reset();
    forgotForm.reset();
  };

  // ── schemas ──
  const loginSchema = useMemo(() => z.object({
    email: z.string().email(t("landing.auth.emailInvalid")),
    password: z.string().min(1, t("landing.auth.passwordRequired")),
  }), [t]);

  const registerSchema = useMemo(() => z.object({
    firstName: z.string().min(1, t("landing.auth.nameRequired")),
    lastName: z.string().optional(),
    email: z.string().email(t("landing.auth.emailInvalid")),
    password: z.string().min(8, t("landing.auth.passwordMin")),
    acceptTerms: z.literal(true, { errorMap: () => ({ message: t("landing.auth.termsRequired") }) }),
  }), [t]);

  const forgotSchema = useMemo(() => z.object({
    email: z.string().email(t("landing.auth.emailInvalid")),
  }), [t]);

  type LoginForm    = z.infer<typeof loginSchema>;
  type RegisterForm = z.infer<typeof registerSchema>;
  type ForgotForm   = z.infer<typeof forgotSchema>;

  const loginForm    = useForm<LoginForm>({ resolver: zodResolver(loginSchema), defaultValues: { email: "", password: "" } });
  const registerForm = useForm<RegisterForm>({ resolver: zodResolver(registerSchema), defaultValues: { firstName: "", lastName: "", email: "", password: "", acceptTerms: undefined as unknown as true } });
  const forgotForm   = useForm<ForgotForm>({ resolver: zodResolver(forgotSchema), defaultValues: { email: "" } });

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
    } catch (e: any) { setFormMessage(e.message || t("landing.auth.loginFailed")); }
    finally { setIsSubmitting(false); }
  };

  const onRegister = async (data: RegisterForm) => {
    setFormMessage(null); setIsSubmitting(true);
    try {
      const res = await apiRequest("POST", "/api/auth/register", data);
      const result = await res.json();
      if (result.emailStatus?.status === "not_configured") {
        toast({ title: t("landing.auth.accountCreated"), description: result.emailStatus.message });
      } else {
        toast({ title: t("landing.auth.accountCreated"), description: t("landing.auth.verificationSent") });
      }
      sessionStorage.setItem("herokids_registration_complete", "true");
      await finishAuth(result.user, "/setup");
    } catch (e: any) { setFormMessage(e.message || t("landing.auth.registerFailed")); }
    finally { setIsSubmitting(false); }
  };

  const onForgot = async (data: ForgotForm) => {
    setFormMessage(null); setIsSubmitting(true);
    try {
      const res = await apiRequest("POST", "/api/auth/forgot-password", data);
      const result = await res.json();
      setFormMessage(result.message || t("landing.auth.resetIfExists"));
    } catch (e: any) { setFormMessage(e.message || t("landing.auth.forgotFailed")); }
    finally { setIsSubmitting(false); }
  };

  const handleGoogle = () => {
    if (isNativePlatform()) { startNativeGoogleLogin(); return; }
    const isIosPwa = (window.navigator as any).standalone === true;
    if (isIosPwa) {
      const win = window.open("/api/auth/google?pwa=1", "_blank");
      const poll = setInterval(async () => {
        try {
          const r = await fetch("/api/auth/user", { credentials: "include" });
          if (r.ok) { clearInterval(poll); win?.close(); queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] }); }
        } catch { /**/ }
      }, 1500);
      return;
    }
    window.location.href = "/api/auth/google";
  };

  return (
    <div
      data-testid="screen-native-login"
      style={{
        position: "fixed", inset: 0, overflow: "hidden",
        background: C.bg, color: C.fg,
        fontFamily: "'Nunito', sans-serif",
        display: "flex", flexDirection: "column",
        paddingTop: "env(safe-area-inset-top)",
        paddingBottom: keyboardInset > 0 ? `${keyboardInset}px` : "env(safe-area-inset-bottom)",
        transition: "padding-bottom 0.28s ease",
      }}
    >
      {/* ambient glows */}
      <div style={{ position: "absolute", top: "-15%", left: "-10%", width: "55%", height: "55%", background: `radial-gradient(circle, rgb(255,185,5,0.3) 0%, transparent 70%)`, pointerEvents: "none", zIndex: 0 }} />
      <div style={{ position: "absolute", bottom: "5%", right: "-10%", width: "45%", height: "45%", background: `radial-gradient(circle, ${C.orange}20 0%, transparent 70%)`, pointerEvents: "none", zIndex: 0 }} />

      {/* scrollable body */}
      <div
        ref={scrollRef}
        style={{
          flex: "1 1 0", overflowY: "auto", WebkitOverflowScrolling: "touch" as any,
          display: "flex", flexDirection: "column", alignItems: "center",
          justifyContent: keyboardOpen ? "flex-start" : "center",
          paddingInline: "1.25rem",
          paddingTop: keyboardOpen ? "1rem" : "2rem",
          paddingBottom: "1.5rem",
          zIndex: 1, position: "relative",
          gap: "1.5rem",
        }}
      >
        {/* ── Logo ── */}
        {!keyboardOpen && (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "0.6rem" }}>
            <img
              src={logoUrl}
              alt="HeroKids"
              data-testid="img-native-logo"
              style={{ width: 72, height: 72, borderRadius: 18, boxShadow: `0 8px 32px -8px ${C.orange}66` }}
            />
            <h1
              data-testid="text-native-app-name"
              style={{ fontFamily: "'Fredoka', 'Nunito', sans-serif", fontSize: "1.9rem", fontWeight: 700, color: C.fg, margin: 0, letterSpacing: "-0.01em" }}
            >
              HeroKids
            </h1>
            <p style={{ fontSize: "0.85rem", color: C.fgMuted, margin: 0, textAlign: "center" }}>
              {t("landing.heroSubtitle", "Make chores fun for the whole family")}
            </p>
          </div>
        )}

        {/* ── Card ── */}
        <div style={{ width: "100%", maxWidth: 400, background: C.card, backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)", borderRadius: 24, border: `1px solid ${C.cardBorder}`, padding: "1.5rem", display: "flex", flexDirection: "column", gap: "1.25rem" }}>

          {/* pill toggle */}
          <div style={{ display: "flex", background: C.pill, borderRadius: 50, padding: "4px", gap: "4px" }}>
            {(["signin", "signup"] as const).map(m => (
              <button
                key={m}
                type="button"
                data-testid={`tab-${m}`}
                onClick={() => switchMode(m)}
                style={{
                  flex: 1, border: "none", cursor: "pointer",
                  padding: "0.55rem 0", borderRadius: 50,
                  fontFamily: "'Nunito', sans-serif", fontWeight: 700, fontSize: "0.9rem",
                  transition: "background 0.2s, color 0.2s",
                  background: mode === m ? C.pillActive : "transparent",
                  color: mode === m ? C.fg : C.fgMuted,
                }}
              >
                {m === "signin" ? t("landing.auth.tabLogin", "Sign In") : t("landing.auth.tabRegister", "Sign Up")}
              </button>
            ))}
          </div>

          {/* Google button — hidden on native iOS (Guideline 4.8: no Sign in with Apple equivalent) */}
          {!isNativePlatform() && (
            <>
              <button
                type="button"
                data-testid="button-google-login"
                onClick={handleGoogle}
                style={{
                  display: "flex", alignItems: "center", justifyContent: "center", gap: "0.6rem",
                  width: "100%", padding: "0.7rem 1rem", borderRadius: 12, cursor: "pointer",
                  background: "rgba(0,0,0,0.04)", border: "1px solid rgb(236,217,198)",
                  color: C.fg, fontFamily: "'Nunito', sans-serif", fontWeight: 600, fontSize: "0.9rem",
                }}
              >
                <svg viewBox="0 0 24 24" style={{ width: 18, height: 18, flexShrink: 0 }}>
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                </svg>
                {t("landing.auth.googleButton", "Continue with Google")}
              </button>

              {/* divider */}
              <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                <div style={{ flex: 1, height: 1, background: "rgb(236,217,198)" }} />
                <span style={{ fontSize: "0.75rem", color: C.fgMuted, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  {t("landing.auth.orSeparator", "or")}
                </span>
                <div style={{ flex: 1, height: 1, background: "rgb(236,217,198)" }} />
              </div>
            </>
          )}

          {/* form message */}
          {formMessage && (
            <Alert data-testid="status-auth-message" style={{ background: "rgba(248,107,28,0.12)", border: "1px solid rgba(248,107,28,0.3)", borderRadius: 10 }}>
              <AlertDescription style={{ color: C.fg, fontSize: "0.85rem" }}>{formMessage}</AlertDescription>
            </Alert>
          )}

          {/* ── Sign In form ── */}
          {mode === "signin" && !showForgot && (
            <Form {...loginForm}>
              <form onSubmit={loginForm.handleSubmit(onLogin)} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                <FormField control={loginForm.control} name="email" render={({ field }) => (
                  <FormItem>
                    <FormLabel style={labelStyle}>{t("landing.auth.labelEmail", "Email")}</FormLabel>
                    <FormControl>
                      <Input type="email" autoComplete="email" data-testid="input-login-email" style={inputStyle} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={loginForm.control} name="password" render={({ field }) => (
                  <FormItem>
                    <FormLabel style={labelStyle}>{t("landing.auth.labelPassword", "Password")}</FormLabel>
                    <FormControl>
                      <PasswordInput field={field} testId="input-login-password" autoComplete="current-password" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <button
                  type="button"
                  onClick={() => { setShowForgot(true); setFormMessage(null); }}
                  data-testid="link-forgot-password"
                  style={{ alignSelf: "flex-end", background: "none", border: "none", padding: 0, cursor: "pointer", color: C.fgMuted, fontSize: "0.8rem", textDecoration: "underline", marginTop: "-0.25rem" }}
                >
                  {t("landing.auth.tabPassword", "Forgot password?")}
                </button>
                <button
                  type="submit"
                  data-testid="button-submit-login"
                  disabled={isSubmitting}
                  style={{
                    width: "100%", padding: "0.75rem", borderRadius: 12, border: "none", cursor: isSubmitting ? "not-allowed" : "pointer",
                    background: `linear-gradient(135deg, ${C.orange}, rgb(220,80,10))`,
                    color: "#fff", fontFamily: "'Nunito', sans-serif", fontWeight: 700, fontSize: "1rem",
                    opacity: isSubmitting ? 0.7 : 1, display: "flex", alignItems: "center", justifyContent: "center", gap: "0.5rem",
                  }}
                >
                  {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : t("landing.auth.loginButton", "Sign In")}
                </button>
              </form>
            </Form>
          )}

          {/* ── Forgot password form ── */}
          {mode === "signin" && showForgot && (
            <Form {...forgotForm}>
              <form onSubmit={forgotForm.handleSubmit(onForgot)} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                <p style={{ color: C.fgMuted, fontSize: "0.85rem", margin: 0 }}>
                  {t("landing.auth.forgotHint", "Enter your email and we'll send a reset link.")}
                </p>
                <FormField control={forgotForm.control} name="email" render={({ field }) => (
                  <FormItem>
                    <FormLabel style={labelStyle}>{t("landing.auth.labelEmail", "Email")}</FormLabel>
                    <FormControl>
                      <Input type="email" autoComplete="email" data-testid="input-forgot-email" style={inputStyle} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <button
                  type="submit"
                  data-testid="button-submit-forgot"
                  disabled={isSubmitting}
                  style={{
                    width: "100%", padding: "0.75rem", borderRadius: 12, border: "none", cursor: isSubmitting ? "not-allowed" : "pointer",
                    background: `linear-gradient(135deg, ${C.orange}, rgb(220,80,10))`,
                    color: "#fff", fontFamily: "'Nunito', sans-serif", fontWeight: 700, fontSize: "1rem",
                    opacity: isSubmitting ? 0.7 : 1, display: "flex", alignItems: "center", justifyContent: "center",
                  }}
                >
                  {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : t("landing.auth.resetLinkButton", "Send Reset Link")}
                </button>
                <button
                  type="button"
                  onClick={() => { setShowForgot(false); setFormMessage(null); }}
                  style={{ alignSelf: "center", background: "none", border: "none", padding: 0, cursor: "pointer", color: C.fgMuted, fontSize: "0.85rem" }}
                >
                  ← {t("landing.auth.backToLogin", "Back to Sign In")}
                </button>
              </form>
            </Form>
          )}

          {/* ── Sign Up form ── */}
          {mode === "signup" && (
            <Form {...registerForm}>
              <form onSubmit={registerForm.handleSubmit(onRegister)} style={{ display: "flex", flexDirection: "column", gap: "0.9rem" }}>
                <div style={{ display: "flex", gap: "0.75rem" }}>
                  <FormField control={registerForm.control} name="firstName" render={({ field }) => (
                    <FormItem style={{ flex: 1 }}>
                      <FormLabel style={labelStyle}>{t("landing.auth.labelFirstName", "First name")}</FormLabel>
                      <FormControl>
                        <Input autoComplete="given-name" data-testid="input-register-first-name" style={inputStyle} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={registerForm.control} name="lastName" render={({ field }) => (
                    <FormItem style={{ flex: 1 }}>
                      <FormLabel style={labelStyle}>{t("landing.auth.labelLastName", "Last name")}</FormLabel>
                      <FormControl>
                        <Input autoComplete="family-name" data-testid="input-register-last-name" style={inputStyle} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>
                <FormField control={registerForm.control} name="email" render={({ field }) => (
                  <FormItem>
                    <FormLabel style={labelStyle}>{t("landing.auth.labelEmail", "Email")}</FormLabel>
                    <FormControl>
                      <Input type="email" autoComplete="email" data-testid="input-register-email" style={inputStyle} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={registerForm.control} name="password" render={({ field }) => (
                  <FormItem>
                    <FormLabel style={labelStyle}>{t("landing.auth.labelPassword", "Password")}</FormLabel>
                    <FormControl>
                      <PasswordInput field={field} testId="input-register-password" autoComplete="new-password" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={registerForm.control} name="acceptTerms" render={({ field }) => (
                  <FormItem>
                    <div className="flex items-start gap-3">
                      <input
                        type="checkbox"
                        id="native-accept-terms"
                        data-testid="checkbox-accept-terms"
                        checked={!!field.value}
                        onChange={e => field.onChange(e.target.checked || undefined)}
                        style={{ marginTop: 3, width: 16, height: 16, flexShrink: 0, accentColor: C.orange, cursor: "pointer" }}
                      />
                      <label htmlFor="native-accept-terms" style={{ fontSize: "0.78rem", color: C.fgMuted, lineHeight: 1.4, cursor: "pointer" }}>
                        {t("landing.auth.termsPrefix")}
                        <a href="/terms" target="_blank" rel="noopener noreferrer" style={{ color: C.fg, textDecoration: "underline" }}>{t("landing.auth.termsLink")}</a>
                        {t("landing.auth.termsMiddle")}
                        <a href="/privacy" target="_blank" rel="noopener noreferrer" style={{ color: C.fg, textDecoration: "underline" }}>{t("landing.auth.privacyLink")}</a>
                        {t("landing.auth.termsSuffix")}
                      </label>
                    </div>
                    <FormMessage />
                  </FormItem>
                )} />
                <button
                  type="submit"
                  data-testid="button-submit-register"
                  disabled={isSubmitting}
                  style={{
                    width: "100%", padding: "0.75rem", borderRadius: 12, border: "none", cursor: isSubmitting ? "not-allowed" : "pointer",
                    background: `linear-gradient(135deg, ${C.blue}, rgb(30,140,190))`,
                    color: "#fff", fontFamily: "'Nunito', sans-serif", fontWeight: 700, fontSize: "1rem",
                    opacity: isSubmitting ? 0.7 : 1, display: "flex", alignItems: "center", justifyContent: "center", gap: "0.5rem",
                  }}
                >
                  {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : t("landing.auth.createAccountButton", "Create Account")}
                </button>
              </form>
            </Form>
          )}
        </div>

        {/* Device Link — for children joining without their own account */}
        {!keyboardOpen && (
          <button
            type="button"
            data-testid="link-device-link"
            onClick={() => setLocation("/link-device")}
            style={{
              display: "flex", alignItems: "center", justifyContent: "center", gap: "0.5rem",
              width: "100%", maxWidth: 400,
              background: "rgba(0,0,0,0.04)", border: "1px solid rgb(236,217,198)",
              borderRadius: 14, padding: "0.65rem 1rem",
              color: C.fgMuted, fontFamily: "'Nunito', sans-serif", fontWeight: 600, fontSize: "0.88rem",
              cursor: "pointer",
            }}
          >
            <Smartphone style={{ width: 16, height: 16, flexShrink: 0 }} />
            {t("landing.linkDevice", "Link Child Device")}
          </button>
        )}

        {/* footer links */}
        {!keyboardOpen && (
          <div style={{ display: "flex", gap: "1.5rem", justifyContent: "center" }}>
            <a href="/privacy" style={{ color: C.fgMuted, textDecoration: "none", fontSize: "0.78rem" }} data-testid="link-native-privacy">
              {t("landing.footer.privacy", "Privacy")}
            </a>
            <a href="/impressum" style={{ color: C.fgMuted, textDecoration: "none", fontSize: "0.78rem" }} data-testid="link-native-impressum">
              {t("landing.footer.imprint", "Imprint")}
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
