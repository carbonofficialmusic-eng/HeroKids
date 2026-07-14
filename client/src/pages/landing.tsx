import { useEffect, useState } from "react";
import { Star, CheckCircle2, Shield, Heart, ArrowRight, Play, Gamepad2, Gift, Sparkles, Loader2, Smartphone, Check, Trophy, Users, Crown } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { AuthPanel } from "@/components/AuthPanel";
import logoUrl from "@assets/herokids_logo_neu.png";

// ─── Design tokens — Warm & Energetic ──────────────────────────────────────────
const C = {
  bg:        "rgb(255, 252, 245)",   // warm cream  hsl(40 100% 98%)
  bgCard:    "rgb(255, 255, 255)",   // white
  bgSection: "rgb(255, 255, 255)",   // white
  border:    "rgb(236, 217, 198)",   // warm light  hsl(30 50% 85%)
  fg:        "rgb(31, 36, 46)",      // dark charcoal  hsl(220 20% 15%)
  fgMuted:   "rgb(87, 97, 117)",     // slate  hsl(220 15% 40%)
  orange:    "rgb(255, 93, 0)",      // vibrant orange  hsl(22 100% 50%)
  orangeD:   "rgb(210, 69, 0)",      // deep orange
  yellow:    "rgb(255, 185, 5)",     // warm yellow  hsl(45 100% 51%)
  blue:      "rgb(13, 170, 229)",    // playful blue  hsl(199 89% 48%)
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
  const [billingCycle, setBillingCycle] = useState<"monthly" | "yearly">("monthly");

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

  const steps = [
    { icon: <Gamepad2 style={{ width: 28, height: 28, color: C.blue }} />, glow: C.blue, title: t('landing.features.step1Title'), desc: t('landing.features.step1Desc') },
    { icon: <CheckCircle2 style={{ width: 28, height: 28, color: C.orange }} />, glow: C.orange, title: t('landing.features.step2Title'), desc: t('landing.features.step2Desc') },
    { icon: <Gift style={{ width: 28, height: 28, color: C.yellow }} />, glow: C.yellow, title: t('landing.features.step3Title'), desc: t('landing.features.step3Desc') },
  ];

  const testimonials = [
    { text: t('landing.testimonials.text1'), name: t('landing.testimonials.name1'), role: t('landing.testimonials.role1'), seed: "sarah" },
    { text: t('landing.testimonials.text2'), name: t('landing.testimonials.name2'), role: t('landing.testimonials.role2'), seed: "mike" },
  ];

  const kidsFeatures = [
    t('landing.kids.feature1'),
    t('landing.kids.feature2'),
    t('landing.kids.feature3'),
  ];

  return (
    <div style={{ background: C.bg, color: C.fg, fontFamily: "'Nunito', sans-serif" }}>
      <style>{floatKeyframes}</style>

      {/* Ambient blobs */}
      <div style={{ position: "fixed", top: "-15%", left: "-10%", width: "50%", height: "50%", background: `radial-gradient(circle, ${C.yellow}30 0%, transparent 70%)`, pointerEvents: "none", zIndex: 0 }} />
      <div style={{ position: "fixed", bottom: "5%", right: "-10%", width: "40%", height: "40%", background: `radial-gradient(circle, ${C.orange}20 0%, transparent 70%)`, pointerEvents: "none", zIndex: 0 }} />

      {/* ── Navigation ── */}
      <nav style={{ position: "sticky", top: 0, zIndex: 50, background: `${C.bg}dd`, backdropFilter: "blur(12px)", borderBottom: `1px solid ${C.border}`, paddingTop: "env(safe-area-inset-top)" }}>
        <div style={{ maxWidth: 1152, margin: "0 auto", padding: "0 1rem", height: 64, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <img src={logoUrl} alt="HeroKids" style={{ width: 40, height: 40, borderRadius: 10 }} data-testid="img-logo" />
            <span className="hk-display" style={{ fontWeight: 800, fontSize: "1.35rem", color: C.fg }} data-testid="text-app-name">HeroKids</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <Button
              variant="ghost"
              size="sm"
              style={{ color: C.fgMuted }}
              onClick={() => document.getElementById("pricing")?.scrollIntoView({ behavior: "smooth" })}
            >
              {t('landing.nav.pricing') || 'Pricing'}
            </Button>
            <Link href="/link-device">
              <Button variant="ghost" size="sm" style={{ color: C.fgMuted }}>
                <Smartphone className="h-4 w-4 mr-1" />
                {t('landing.nav.connectDevice')}
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
              {t('landing.hero.badge')}
            </div>
            <h1 className="hk-display" data-testid="text-hero-title" style={{ fontSize: "clamp(2.8rem, 6vw, 4.75rem)", fontWeight: 800, lineHeight: 1.08, marginBottom: "1.5rem" }}>
              <span style={{ color: C.fg }}>{t('landing.hero.title1')}</span>
              <br />
              <span style={{ color: C.orange }}>{t('landing.hero.title2')}</span>
            </h1>
            <p style={{ fontSize: "1.1rem", color: C.fgMuted, marginBottom: "2rem", maxWidth: 460, lineHeight: 1.7, margin: "0 auto 2rem" }} className="lg:mx-0" data-testid="text-hero-subtitle">
              {t('landing.heroSubtitle')}
            </p>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap", justifyContent: "center" }} className="lg:justify-start">
              <button
                onClick={() => document.getElementById("auth-panel")?.scrollIntoView({ behavior: "smooth" })}
                style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "0 2rem", height: 52, borderRadius: 999, background: C.orange, color: "#fff", fontWeight: 800, fontSize: "1rem", border: "none", cursor: "pointer", boxShadow: `0 8px 24px -8px ${C.orange}88` }}
              >
                {t('landing.hero.ctaPrimary')} <ArrowRight style={{ width: 18, height: 18 }} />
              </button>
              <button
                onClick={() => document.getElementById("how-it-works")?.scrollIntoView({ behavior: "smooth" })}
                style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "0 1.5rem", height: 52, borderRadius: 999, background: "transparent", color: C.fg, fontWeight: 700, fontSize: "1rem", border: `1px solid ${C.border}`, cursor: "pointer" }}
              >
                <Play style={{ width: 14, height: 14, fill: C.fg }} /> {t('landing.hero.ctaSecondary')}
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
            </div>
          </div>

          {/* Right: floating image with badges */}
          <div className="hk-float" style={{ position: "relative", display: "flex", justifyContent: "center" }}>
            <div style={{ position: "absolute", inset: "10%", background: `radial-gradient(circle, ${C.orange}30 0%, transparent 70%)`, borderRadius: "2rem", filter: "blur(32px)" }} />
            <div style={{ position: "relative", width: "100%", maxWidth: "500px" }}>
              <img
                src="/images/herokids-hero.png"
                alt={t('landing.hero.title1')}
                style={{ width: "100%", borderRadius: "1.5rem", display: "block", boxShadow: `0 24px 60px -16px rgba(0,0,0,0.5)` }}
              />
              {/* Badge: Completed task */}
              <div className="hk-float2" style={{ position: "absolute", top: "10%", left: "-8%", display: "flex", alignItems: "center", gap: 10, padding: "10px 16px", borderRadius: 999, background: "rgba(20,30,50,0.92)", backdropFilter: "blur(10px)", border: `1px solid ${C.border}`, boxShadow: "0 8px 24px rgba(0,0,0,0.4)", whiteSpace: "nowrap" }}>
                <div style={{ width: 32, height: 32, borderRadius: "50%", background: "rgb(34,197,94)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <CheckCircle2 style={{ width: 18, height: 18, color: "#fff" }} />
                </div>
                <div>
                  <div style={{ fontSize: "0.65rem", fontWeight: 700, color: "rgb(34,197,94)", textTransform: "uppercase", letterSpacing: "0.05em" }}>{t('landing.hero.done')}</div>
                  <div style={{ fontSize: "0.85rem", fontWeight: 700, color: "#fff" }}>{t('landing.hero.roomCleaned')}</div>
                </div>
              </div>
              {/* Badge: Points earned */}
              <div style={{ position: "absolute", bottom: "10%", right: "-6%", display: "flex", alignItems: "center", gap: 10, padding: "10px 16px", borderRadius: 999, background: "rgba(20,30,50,0.92)", backdropFilter: "blur(10px)", border: `1px solid ${C.border}`, boxShadow: "0 8px 24px rgba(0,0,0,0.4)", whiteSpace: "nowrap" }}>
                <div style={{ width: 36, height: 36, borderRadius: "50%", background: C.yellow, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <Star style={{ width: 20, height: 20, color: "#fff", fill: "#fff" }} />
                </div>
                <div>
                  <div style={{ fontSize: "1.1rem", fontWeight: 800, color: "#fff", fontFamily: "Fredoka, sans-serif" }}>+50</div>
                  <div style={{ fontSize: "0.65rem", fontWeight: 700, color: "rgba(255,255,255,0.65)", textTransform: "uppercase", letterSpacing: "0.05em" }}>{t('landing.hero.pointsEarned')}</div>
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
            <p style={{ color: C.fgMuted, fontSize: "1.1rem" }}>{t('landing.features.subtitle')}</p>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "1.5rem" }}>
            {steps.map((step, i) => (
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
            <img src="/images/herokids-rewards.png" alt={t('landing.kids.title')} className="hk-float2" style={{ position: "relative", width: "100%", borderRadius: "1.75rem", border: `2px solid ${C.border}`, boxShadow: `0 24px 60px -16px ${C.yellow}30` }} />
          </div>
          <div>
            <div style={{ width: 52, height: 52, borderRadius: 14, background: `${C.yellow}20`, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: "1.25rem" }}>
              <Star style={{ width: 28, height: 28, color: C.yellow, fill: C.yellow }} />
            </div>
            <h2 className="hk-display" style={{ fontSize: "clamp(1.75rem, 3.5vw, 2.5rem)", fontWeight: 800, marginBottom: "1rem", lineHeight: 1.2 }}>
              {t('landing.kids.title')}
            </h2>
            <p style={{ color: C.fgMuted, fontSize: "1.1rem", marginBottom: "1.5rem", lineHeight: 1.65 }}>
              {t('landing.kids.desc')}
            </p>
            <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 12 }}>
              {kidsFeatures.map((item, i) => (
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
      <section style={{ margin: "0 1rem 3rem", borderRadius: "2rem", padding: "4rem 2rem", position: "relative", overflow: "hidden", background: `linear-gradient(135deg, ${C.bgCard} 0%, rgb(255, 235, 210) 100%)`, border: `1px solid ${C.border}`, zIndex: 1 }}>
        <div style={{ position: "absolute", top: 0, right: 0, width: 500, height: 500, background: `radial-gradient(circle, ${C.orange}12 0%, transparent 65%)`, pointerEvents: "none", transform: "translate(30%, -30%)" }} />
        <div style={{ maxWidth: 1100, margin: "0 auto", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "4rem", alignItems: "center", position: "relative" }}>
          <div>
            <div style={{ width: 52, height: 52, borderRadius: 14, background: "rgba(0,0,0,0.06)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: "1.25rem" }}>
              <Shield style={{ width: 28, height: 28, color: C.fg }} />
            </div>
            <h2 className="hk-display" style={{ fontSize: "clamp(1.75rem, 3.5vw, 2.5rem)", fontWeight: 800, marginBottom: "1rem", lineHeight: 1.2 }}>
              {t('landing.parents.title')}
            </h2>
            <p style={{ color: C.fgMuted, fontSize: "1.1rem", marginBottom: "1.75rem", lineHeight: 1.65 }}>
              {t('landing.parents.desc')}
            </p>
            <button
              onClick={() => document.getElementById("auth-panel")?.scrollIntoView({ behavior: "smooth" })}
              style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "0 1.75rem", height: 48, borderRadius: 999, background: C.bg, color: C.fg, fontWeight: 700, border: `1px solid ${C.border}`, cursor: "pointer", fontSize: "1rem" }}
            >
              {t('landing.parents.cta')} <ArrowRight style={{ width: 16, height: 16 }} />
            </button>
          </div>
          <div style={{ position: "relative" }}>
            <div style={{ position: "absolute", inset: 0, background: `${C.orange}08`, borderRadius: "2.5rem", transform: "rotate(2deg)" }} />
            <img src="/images/herokids-mascot.png" alt={t('landing.parents.title')} className="hk-float" style={{ position: "relative", width: "100%", borderRadius: "1.75rem", border: `2px solid ${C.border}22`, boxShadow: `0 32px 80px -24px ${C.orange}28` }} />
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
            {testimonials.map((item, i) => (
              <div key={i} style={{ background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: 20, padding: "2rem" }}>
                <div style={{ display: "flex", marginBottom: "1rem" }}>
                  {[1,2,3,4,5].map(s => <Star key={s} style={{ width: 18, height: 18, color: C.yellow, fill: C.yellow }} />)}
                </div>
                <p style={{ color: C.fg, fontSize: "1.05rem", fontStyle: "italic", lineHeight: 1.65, marginBottom: "1.25rem" }}>{item.text}</p>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{ width: 44, height: 44, borderRadius: "50%", overflow: "hidden", background: C.bgSection }}>
                    <img src={`https://api.dicebear.com/7.x/notionists/svg?seed=${item.seed}&backgroundColor=b6e3f4`} alt={item.name} style={{ width: "100%", height: "100%" }} />
                  </div>
                  <div>
                    <p style={{ fontWeight: 700, fontSize: "0.95rem" }}>{item.name}</p>
                    <p style={{ color: C.fgMuted, fontSize: "0.85rem" }}>{item.role}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Pricing ── */}
      <section id="pricing" style={{ padding: "5rem 1rem", background: C.bgSection, position: "relative", zIndex: 1 }}>
        <div style={{ maxWidth: 1152, margin: "0 auto" }}>

          {/* Header */}
          <div style={{ textAlign: "center", marginBottom: "2.5rem" }}>
            <h2 className="hk-display" style={{ fontSize: "clamp(1.8rem, 4vw, 2.75rem)", fontWeight: 800, marginBottom: "0.75rem" }} data-testid="heading-pricing-landing">
              {t("pricing.title")}
            </h2>
            <p style={{ color: C.fgMuted, fontSize: "1.1rem", maxWidth: 480, margin: "0 auto" }}>
              {t("pricing.subtitle")}
            </p>
          </div>

          {/* Billing toggle */}
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12, marginBottom: 40 }}>
            <div style={{ display: "flex", alignItems: "center", background: "rgba(0,0,0,0.06)", borderRadius: 999, padding: 4, gap: 4 }}>
              {(["monthly", "yearly"] as const).map(cycle => (
                <button
                  key={cycle}
                  onClick={() => setBillingCycle(cycle)}
                  data-testid={`button-billing-${cycle}-landing`}
                  style={{
                    padding: "8px 20px", borderRadius: 999, fontSize: "0.875rem", fontWeight: 700,
                    border: "none", cursor: "pointer", transition: "all 0.2s",
                    background: billingCycle === cycle ? C.bgCard : "transparent",
                    color: billingCycle === cycle ? C.fg : C.fgMuted,
                    boxShadow: billingCycle === cycle ? "0 1px 6px rgba(0,0,0,0.12)" : "none",
                  }}
                >
                  {cycle === "monthly" ? t("pricing.billingMonthly") : t("pricing.billingYearly")}
                </button>
              ))}
            </div>
            {billingCycle === "monthly" ? (
              <button
                onClick={() => setBillingCycle("yearly")}
                style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "8px 20px", borderRadius: 999, fontSize: "0.875rem", fontWeight: 700, color: "#fff", border: "none", cursor: "pointer", background: `linear-gradient(135deg, ${C.orange}, ${C.yellow})`, boxShadow: `0 4px 16px -4px ${C.orange}60` }}
              >
                <span>🎁</span> {t("pricing.yearlyDiscountTeaser")}
              </button>
            ) : (
              <span style={{ fontSize: "0.85rem", fontWeight: 700, color: C.orange, background: `${C.orange}15`, padding: "6px 16px", borderRadius: 999 }}>
                ✓ {t("pricing.yearlyDiscount")}
              </span>
            )}
          </div>

          {/* Tier cards */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "1.5rem", maxWidth: 960, margin: "0 auto" }}>
            {[
              {
                id: "free", name: "Free", Icon: Users,
                price: "€0", period: t("pricing.forever"),
                description: t("pricing.tierFreeDesc"),
                features: t("pricing.tierFreeFeatures", { returnObjects: true }) as string[],
                popular: false, memberLimit: 3,
                cta: t("landing.hero.ctaPrimary"),
                accent: C.blue,
              },
              {
                id: "family", name: "Family", Icon: Trophy,
                price: billingCycle === "monthly" ? "€3,99" : "€29,99",
                period: billingCycle === "monthly" ? t("pricing.perMonth") : t("pricing.perYear"),
                description: t("pricing.tierFamilyDesc"),
                features: t("pricing.tierFamilyFeatures", { returnObjects: true }) as string[],
                popular: true, memberLimit: 6,
                cta: t("pricing.choosePlan", { name: "Family" }),
                accent: C.orange,
              },
              {
                id: "family_hero", name: "FamilyPro", Icon: Crown,
                price: billingCycle === "monthly" ? "€9,99" : "€69,99",
                period: billingCycle === "monthly" ? t("pricing.perMonth") : t("pricing.perYear"),
                description: t("pricing.tierFamilyHeroDesc"),
                features: t("pricing.tierFamilyHeroFeatures", { returnObjects: true }) as string[],
                popular: false, memberLimit: 999,
                cta: t("pricing.choosePlan", { name: "FamilyPro" }),
                accent: C.yellow,
              },
            ].map(tier => (
              <div
                key={tier.id}
                data-testid={`card-tier-${tier.id}-landing`}
                style={{
                  position: "relative",
                  background: C.bgCard,
                  border: tier.popular ? `2px solid ${C.orange}` : `1px solid ${C.border}`,
                  borderRadius: 20,
                  padding: "2rem",
                  display: "flex",
                  flexDirection: "column",
                  boxShadow: tier.popular ? `0 8px 32px -8px ${C.orange}40` : "0 2px 8px rgba(0,0,0,0.06)",
                }}
              >
                {tier.popular && (
                  <div style={{ position: "absolute", top: -14, left: "50%", transform: "translateX(-50%)", background: C.orange, color: "#fff", fontSize: "0.75rem", fontWeight: 800, padding: "4px 16px", borderRadius: 999, whiteSpace: "nowrap" }}>
                    {t("pricing.mostPopular")}
                  </div>
                )}

                {/* Icon + name */}
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
                  <div style={{ width: 48, height: 48, borderRadius: "50%", background: `${tier.accent}20`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <tier.Icon style={{ width: 24, height: 24, color: tier.accent }} />
                  </div>
                  <div>
                    <div className="hk-display" style={{ fontWeight: 800, fontSize: "1.15rem" }}>{tier.name}</div>
                    <div style={{ fontSize: "0.8rem", color: C.fgMuted }}>{tier.description}</div>
                  </div>
                </div>

                {/* Price */}
                <div style={{ marginBottom: 20 }}>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
                    <span className="hk-display" style={{ fontSize: "2.5rem", fontWeight: 800 }}>{tier.price}</span>
                    <span style={{ color: C.fgMuted, fontSize: "0.875rem" }}>/{tier.period}</span>
                  </div>
                  <div style={{ fontSize: "0.85rem", color: C.fgMuted, marginTop: 2 }}>
                    {tier.memberLimit === 999 ? t("pricing.unlimitedMembers") : t("pricing.upToMembers", { count: tier.memberLimit })}
                  </div>
                </div>

                {/* Features */}
                <ul style={{ listStyle: "none", padding: 0, margin: "0 0 auto", display: "flex", flexDirection: "column", gap: 10 }}>
                  {tier.features.map((f, i) => (
                    <li key={i} style={{ display: "flex", alignItems: "flex-start", gap: 8, fontSize: "0.9rem" }}>
                      <Check style={{ width: 16, height: 16, color: "rgb(34,197,94)", flexShrink: 0, marginTop: 2 }} />
                      <span style={{ color: C.fg, lineHeight: 1.5 }}>{f}</span>
                    </li>
                  ))}
                </ul>

                {/* CTA */}
                <button
                  data-testid={`button-pricing-cta-${tier.id}`}
                  onClick={() => document.getElementById("auth-panel")?.scrollIntoView({ behavior: "smooth" })}
                  style={{
                    marginTop: 24,
                    width: "100%",
                    padding: "12px 0",
                    borderRadius: 999,
                    fontWeight: 800,
                    fontSize: "0.95rem",
                    border: tier.popular ? "none" : `1.5px solid ${C.border}`,
                    cursor: "pointer",
                    background: tier.popular ? C.orange : "transparent",
                    color: tier.popular ? "#fff" : C.fg,
                    boxShadow: tier.popular ? `0 6px 20px -6px ${C.orange}70` : "none",
                    transition: "opacity 0.15s",
                  }}
                  onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.opacity = "0.85"; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.opacity = "1"; }}
                >
                  {tier.id === "free" ? t("landing.hero.ctaPrimary") : tier.cta}
                </button>
              </div>
            ))}
          </div>

          {/* Fine print */}
          <p style={{ textAlign: "center", marginTop: "2.5rem", fontSize: "0.85rem", color: C.fgMuted }}>
            {billingCycle === "yearly" ? t("pricing.paymentInfoYearly") : t("pricing.paymentInfo")}
          </p>
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
            {t('landing.cta.button')}
          </button>
          <p style={{ color: "rgba(255,255,255,0.55)", marginTop: "0.75rem", fontSize: "0.875rem" }}>{t('landing.cta.noCreditCard')}</p>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer style={{ borderTop: `1px solid ${C.border}`, padding: "2.5rem 1rem", zIndex: 1, position: "relative" }}>
        <div style={{ maxWidth: 1152, margin: "0 auto", display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: "1rem", color: C.fgMuted, fontSize: "0.875rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <img src={logoUrl} alt="HeroKids" style={{ width: 28, height: 28, borderRadius: 6 }} />
            <span className="hk-display" style={{ fontWeight: 700, color: C.fg }}>HeroKids</span>
          </div>
          <p>© {new Date().getFullYear()} HeroKids Inc. {t('landing.footer.rights')}</p>
          <div style={{ display: "flex", gap: "1.5rem" }}>
            <button onClick={() => document.getElementById("pricing")?.scrollIntoView({ behavior: "smooth" })} style={{ background: "none", border: "none", color: C.fgMuted, cursor: "pointer", fontSize: "0.875rem", padding: 0 }}>{t('landing.nav.pricing') || 'Pricing'}</button>
            <Link href="/privacy" style={{ color: C.fgMuted, textDecoration: "none" }}>{t('landing.footer.privacy')}</Link>
            <Link href="/impressum" style={{ color: C.fgMuted, textDecoration: "none" }}>{t('landing.footer.imprint')}</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
