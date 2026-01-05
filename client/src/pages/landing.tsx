import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Star, Trophy, Users, CheckCircle, Zap, Smartphone, Loader2 } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import { useTranslation } from "react-i18next";
import { Link, useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import logoUrl from "@assets/ChatGPT Image 7. Nov. 2025, 19_19_07_1762539654932.png";

export default function Landing() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [verifyingPayment, setVerifyingPayment] = useState(false);

  // Check for Stripe redirect with session_id
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const sessionId = urlParams.get("session_id");
    const subscriptionSuccess = urlParams.get("subscription");
    
    if (sessionId && subscriptionSuccess === "success") {
      setVerifyingPayment(true);
      
      // Verify the checkout session and activate subscription
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
          // Redirect to login after verification
          window.location.href = "/api/login";
        })
        .catch(err => {
          console.error("Error verifying checkout:", err);
          // Still redirect to login
          window.location.href = "/api/login";
        });
    }
  }, [toast, t]);

  // Show loading state while verifying payment
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
      {/* Header */}
      <header className="border-b sticky top-0 backdrop-blur-md z-50">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
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
            <Button
              onClick={() => (window.location.href = "/api/login")}
              data-testid="button-login"
            >
              {t('landing.getStarted')}
            </Button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="py-20 px-4">
        <div className="container mx-auto max-w-6xl text-center">
          <h1 className="text-5xl md:text-7xl font-black font-accent mb-6 gradient-text-celebration" data-testid="text-hero-title">
            {t('landing.heroTitle')}
          </h1>
          <p className="text-xl md:text-2xl text-muted-foreground mb-8 max-w-3xl mx-auto" data-testid="text-hero-subtitle">
            {t('landing.heroSubtitle')}
          </p>
          <div className="flex flex-wrap gap-4 justify-center">
            <Button
              size="lg"
              className="text-lg h-14 px-8"
              onClick={() => (window.location.href = "/api/login")}
              data-testid="button-hero-cta"
            >
              <Star className="h-5 w-5 mr-2" />
              {t('landing.startYourAdventure')}
            </Button>
            <Link href="/link-device">
              <Button
                size="lg"
                variant="outline"
                className="text-lg h-14 px-8"
                data-testid="button-link-device-landing"
              >
                <Smartphone className="h-5 w-5 mr-2" />
                {t('landing.linkDevice')}
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Features */}
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

      {/* Benefits */}
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

      {/* CTA Section */}
      <section className="py-20 px-4 bg-muted/30">
        <div className="container mx-auto max-w-4xl text-center">
          <h2 className="text-4xl md:text-5xl font-black font-accent mb-6" data-testid="text-cta-title">
            {t('landing.readyToMakeFun')}
          </h2>
          <p className="text-xl text-muted-foreground mb-8" data-testid="text-cta-subtitle">
            {t('landing.joinThousands')}
          </p>
          <Button
            size="lg"
            className="text-lg h-14 px-8"
            onClick={() => (window.location.href = "/api/login")}
            data-testid="button-cta-signup"
          >
            {t('landing.getStartedFree')}
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t py-8 px-4">
        <div className="container mx-auto max-w-6xl text-center text-sm text-muted-foreground">
          <p>{t('landing.copyrightNotice')}</p>
        </div>
      </footer>
    </div>
  );
}
