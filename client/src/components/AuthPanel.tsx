import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, Mail, Lock, UserPlus, Eye, EyeOff } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient, storeDevToken } from "@/lib/queryClient";
import { isNativePlatform } from "@/lib/platform";

// ─── Native Google Login (module-level, survives component unmount) ───────────
let _nativeGooglePollInterval: ReturnType<typeof setInterval> | null = null;
let _nativeGoogleSafetyTimer: ReturnType<typeof setTimeout> | null = null;

function _clearNativeGoogleTimers() {
  if (_nativeGooglePollInterval) { clearInterval(_nativeGooglePollInterval); _nativeGooglePollInterval = null; }
  if (_nativeGoogleSafetyTimer) { clearTimeout(_nativeGoogleSafetyTimer); _nativeGoogleSafetyTimer = null; }
}

// ─── iOS PWA Google Login ─────────────────────────────────────────────────────
let _pwaPollInterval: ReturnType<typeof setInterval> | null = null;
let _pwaSafetyTimer: ReturnType<typeof setTimeout> | null = null;
let _pwaAuthWindow: Window | null = null;

function _clearPwaGoogleTimers() {
  if (_pwaPollInterval) { clearInterval(_pwaPollInterval); _pwaPollInterval = null; }
  if (_pwaSafetyTimer) { clearTimeout(_pwaSafetyTimer); _pwaSafetyTimer = null; }
}

function startPwaGoogleLogin() {
  _clearPwaGoogleTimers();
  _pwaAuthWindow?.close();

  _pwaAuthWindow = window.open("/api/auth/google?pwa=1", "_blank");

  _pwaPollInterval = setInterval(async () => {
    try {
      const res = await fetch("/api/auth/user", { credentials: "include" });
      if (res.ok) {
        _clearPwaGoogleTimers();
        _pwaAuthWindow?.close();
        _pwaAuthWindow = null;
        queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      }
    } catch { /* ignore network errors during polling */ }
  }, 1500);

  _pwaSafetyTimer = setTimeout(() => {
    _clearPwaGoogleTimers();
    _pwaAuthWindow = null;
  }, 300_000);
}

async function startNativeGoogleLogin() {
  const { Browser } = await import("@capacitor/browser");

  _clearNativeGoogleTimers();

  const pollKey = crypto.randomUUID();

  const listener = await Browser.addListener("browserFinished", () => {
    _clearNativeGoogleTimers();
    listener.remove();
    queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
  });

  _nativeGooglePollInterval = setInterval(async () => {
    try {
      const checkRes = await fetch(
        `/api/auth/native-check?pollKey=${encodeURIComponent(pollKey)}`,
        { credentials: "include" },
      );
      if (!checkRes.ok) return;
      const data = await checkRes.json();
      if (!data.ready || !data.token) return;

      _clearNativeGoogleTimers();
      listener.remove();
      await fetch("/api/auth/native-exchange", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: data.token }),
      });
      await Browser.close();
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
    } catch { /* ignore network errors */ }
  }, 1500);

  _nativeGoogleSafetyTimer = setTimeout(() => {
    _clearNativeGoogleTimers();
    listener.remove();
  }, 300_000);

  await Browser.open({
    url: `https://herokids.app/api/auth/google?native=1&pollKey=${encodeURIComponent(pollKey)}`,
  });
}

// ─── Password input with show/hide toggle ─────────────────────────────────────
function PasswordInput({ field, testId, autoComplete }: {
  field: any;
  testId: string;
  autoComplete?: string;
}) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <Input
        type={show ? "text" : "password"}
        autoComplete={autoComplete}
        data-testid={testId}
        className="pr-10"
        {...field}
      />
      <button
        type="button"
        tabIndex={-1}
        aria-label={show ? "Hide password" : "Show password"}
        onClick={() => setShow((s) => !s)}
        style={{
          position: "absolute",
          right: "0.625rem",
          top: "50%",
          transform: "translateY(-50%)",
          background: "none",
          border: "none",
          padding: 0,
          cursor: "pointer",
          color: "var(--muted-foreground)",
          display: "flex",
          alignItems: "center",
        }}
      >
        {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  );
}

// ─── AuthPanel ────────────────────────────────────────────────────────────────
export function AuthPanel() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [authTab, setAuthTab] = useState("login");
  const [formMessage, setFormMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const searchParams = useMemo(() => new URLSearchParams(window.location.search), []);
  const resetToken = searchParams.get("reset_token");

  const loginSchema = useMemo(() => z.object({
    email: z.string().email(t('landing.auth.emailInvalid')),
    password: z.string().min(1, t('landing.auth.passwordRequired')),
  }), [t]);

  const registerSchema = useMemo(() => z.object({
    firstName: z.string().min(1, t('landing.auth.nameRequired')),
    lastName: z.string().optional(),
    email: z.string().email(t('landing.auth.emailInvalid')),
    password: z.string().min(8, t('landing.auth.passwordMin')),
    acceptTerms: z.literal(true, { errorMap: () => ({ message: t('landing.auth.termsRequired') }) }),
  }), [t]);

  const forgotSchema = useMemo(() => z.object({
    email: z.string().email(t('landing.auth.emailInvalid')),
  }), [t]);

  const resetSchema = useMemo(() => z.object({
    password: z.string().min(8, t('landing.auth.passwordMin')),
  }), [t]);

  type LoginForm = z.infer<typeof loginSchema>;
  type RegisterForm = z.infer<typeof registerSchema>;
  type ForgotForm = z.infer<typeof forgotSchema>;
  type ResetForm = z.infer<typeof resetSchema>;

  const loginForm = useForm<LoginForm>({ resolver: zodResolver(loginSchema), defaultValues: { email: "", password: "" } });
  const registerForm = useForm<RegisterForm>({ resolver: zodResolver(registerSchema), defaultValues: { firstName: "", lastName: "", email: "", password: "", acceptTerms: undefined as unknown as true } });
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
    } catch (e: any) { setFormMessage(e.message || t('landing.auth.loginFailed')); }
    finally { setIsSubmitting(false); }
  };

  const onRegister = async (data: RegisterForm) => {
    setFormMessage(null); setIsSubmitting(true);
    try {
      const res = await apiRequest("POST", "/api/auth/register", data);
      const result = await res.json();
      if (result.emailStatus?.status === "not_configured") {
        toast({ title: t('landing.auth.accountCreated'), description: result.emailStatus.message });
      } else if (result.emailStatus?.status === "failed") {
        toast({ title: t('landing.auth.accountCreated'), description: result.emailStatus.message, variant: "destructive" });
      } else {
        toast({ title: t('landing.auth.accountCreated'), description: t('landing.auth.verificationSent') });
      }
      sessionStorage.setItem("herokids_registration_complete", "true");
      await finishAuth(result.user, "/setup");
    } catch (e: any) { setFormMessage(e.message || t('landing.auth.registerFailed')); }
    finally { setIsSubmitting(false); }
  };

  const onForgot = async (data: ForgotForm) => {
    setFormMessage(null); setIsSubmitting(true);
    try {
      const res = await apiRequest("POST", "/api/auth/forgot-password", data);
      const result = await res.json();
      setFormMessage(result.message || t('landing.auth.resetIfExists'));
    } catch (e: any) { setFormMessage(e.message || t('landing.auth.forgotFailed')); }
    finally { setIsSubmitting(false); }
  };

  const onReset = async (data: ResetForm) => {
    if (!resetToken) return;
    setFormMessage(null); setIsSubmitting(true);
    try {
      const res = await apiRequest("POST", "/api/auth/reset-password", { token: resetToken, password: data.password });
      const result = await res.json();
      setFormMessage(result.message || t('landing.auth.passwordSaved'));
      setAuthTab("login");
      window.history.replaceState({}, "", "/");
      resetForm.reset();
    } catch (e: any) { setFormMessage(e.message || t('landing.auth.passwordFailed')); }
    finally { setIsSubmitting(false); }
  };

  const handleGoogleLogin = () => {
    if (isNativePlatform()) {
      startNativeGoogleLogin();
      return;
    }

    const isIosPwa = (window.navigator as any).standalone === true;
    if (isIosPwa) {
      startPwaGoogleLogin();
      return;
    }

    window.location.href = "/api/auth/google";
  };

  return (
    <Card className="w-full max-w-md text-left" data-testid="card-auth-panel">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-2xl font-accent">
          <Lock className="h-5 w-5" />
          {t('landing.auth.title')}
        </CardTitle>
        <CardDescription>{t('landing.auth.description')}</CardDescription>
      </CardHeader>
      <CardContent>
        {/* Google Sign-In */}
        <div className="mb-4">
          <Button
            type="button"
            variant="outline"
            className="w-full flex items-center gap-3"
            onClick={handleGoogleLogin}
            data-testid="button-google-login"
          >
            <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            {t('landing.auth.googleButton')}
          </Button>
        </div>
        <div className="relative mb-4">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t border-border" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-card px-2 text-muted-foreground">{t('landing.auth.orSeparator')}</span>
          </div>
        </div>

        {formMessage && (
          <Alert className="mb-4" data-testid="status-auth-message">
            <Mail className="h-4 w-4" />
            <AlertDescription>{formMessage}</AlertDescription>
          </Alert>
        )}
        <Tabs value={authTab} onValueChange={(v) => { setAuthTab(v); setFormMessage(null); }}>
          <TabsList className="grid w-full grid-cols-3 mb-6">
            <TabsTrigger value="login" data-testid="tab-login" className="text-xs sm:text-sm">{t('landing.auth.tabLogin')}</TabsTrigger>
            <TabsTrigger value="register" data-testid="tab-register" className="text-xs sm:text-sm">{t('landing.auth.tabRegister')}</TabsTrigger>
            <TabsTrigger value="forgot" data-testid="tab-forgot" className="text-xs sm:text-sm">{t('landing.auth.tabPassword')}</TabsTrigger>
          </TabsList>

          <TabsContent value="login">
            <Form {...loginForm}>
              <form onSubmit={loginForm.handleSubmit(onLogin)} className="space-y-4">
                <FormField control={loginForm.control} name="email" render={({ field }) => (
                  <FormItem><FormLabel>{t('landing.auth.labelEmail')}</FormLabel><FormControl>
                    <Input type="email" autoComplete="email" data-testid="input-login-email" {...field} />
                  </FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={loginForm.control} name="password" render={({ field }) => (
                  <FormItem><FormLabel>{t('landing.auth.labelPassword')}</FormLabel><FormControl>
                    <PasswordInput field={field} testId="input-login-password" autoComplete="current-password" />
                  </FormControl><FormMessage /></FormItem>
                )} />
                <Button type="submit" className="w-full" disabled={isSubmitting} data-testid="button-submit-login">
                  {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : t('landing.auth.loginButton')}
                </Button>
              </form>
            </Form>
          </TabsContent>

          <TabsContent value="register">
            <Form {...registerForm}>
              <form onSubmit={registerForm.handleSubmit(onRegister)} className="space-y-4">
                <FormField control={registerForm.control} name="firstName" render={({ field }) => (
                  <FormItem><FormLabel>{t('landing.auth.labelFirstName')}</FormLabel><FormControl>
                    <Input autoComplete="given-name" data-testid="input-register-first-name" {...field} />
                  </FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={registerForm.control} name="lastName" render={({ field }) => (
                  <FormItem><FormLabel>{t('landing.auth.labelLastName')}</FormLabel><FormControl>
                    <Input autoComplete="family-name" data-testid="input-register-last-name" {...field} />
                  </FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={registerForm.control} name="email" render={({ field }) => (
                  <FormItem><FormLabel>{t('landing.auth.labelEmail')}</FormLabel><FormControl>
                    <Input type="email" autoComplete="email" data-testid="input-register-email" {...field} />
                  </FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={registerForm.control} name="password" render={({ field }) => (
                  <FormItem><FormLabel>{t('landing.auth.labelPassword')}</FormLabel><FormControl>
                    <PasswordInput field={field} testId="input-register-password" autoComplete="new-password" />
                  </FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={registerForm.control} name="acceptTerms" render={({ field }) => (
                  <FormItem>
                    <div className="flex items-start gap-3">
                      <input
                        type="checkbox"
                        id="accept-terms-checkbox"
                        data-testid="checkbox-accept-terms"
                        checked={!!field.value}
                        onChange={(e) => field.onChange(e.target.checked || undefined)}
                        className="mt-1 h-4 w-4 shrink-0 rounded border border-input accent-primary cursor-pointer"
                      />
                      <label htmlFor="accept-terms-checkbox" className="text-sm text-muted-foreground leading-snug cursor-pointer">
                        {t('landing.auth.termsPrefix')}
                        <a href="/terms" target="_blank" rel="noopener noreferrer" className="text-foreground underline font-medium hover:text-primary">{t('landing.auth.termsLink')}</a>
                        {t('landing.auth.termsMiddle')}
                        <a href="/privacy" target="_blank" rel="noopener noreferrer" className="text-foreground underline font-medium hover:text-primary">{t('landing.auth.privacyLink')}</a>
                        {t('landing.auth.termsSuffix')}
                      </label>
                    </div>
                    <FormMessage />
                  </FormItem>
                )} />
                <Button type="submit" className="w-full" disabled={isSubmitting} data-testid="button-submit-register">
                  {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <><UserPlus className="h-4 w-4 mr-1" />{t('landing.auth.createAccountButton')}</>}
                </Button>
              </form>
            </Form>
          </TabsContent>

          <TabsContent value="forgot">
            <Form {...forgotForm}>
              <form onSubmit={forgotForm.handleSubmit(onForgot)} className="space-y-4">
                <FormField control={forgotForm.control} name="email" render={({ field }) => (
                  <FormItem><FormLabel>{t('landing.auth.labelEmail')}</FormLabel><FormControl>
                    <Input type="email" autoComplete="email" data-testid="input-forgot-email" {...field} />
                  </FormControl><FormMessage /></FormItem>
                )} />
                <Button type="submit" className="w-full" disabled={isSubmitting} data-testid="button-submit-forgot">
                  {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : t('landing.auth.resetLinkButton')}
                </Button>
              </form>
            </Form>
          </TabsContent>

          <TabsContent value="reset">
            <Form {...resetForm}>
              <form onSubmit={resetForm.handleSubmit(onReset)} className="space-y-4">
                <FormField control={resetForm.control} name="password" render={({ field }) => (
                  <FormItem><FormLabel>{t('landing.auth.newPassword')}</FormLabel><FormControl>
                    <PasswordInput field={field} testId="input-reset-password" autoComplete="new-password" />
                  </FormControl><FormMessage /></FormItem>
                )} />
                <Button type="submit" className="w-full" disabled={isSubmitting || !resetToken} data-testid="button-submit-reset">
                  {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : t('landing.auth.savePassword')}
                </Button>
              </form>
            </Form>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
