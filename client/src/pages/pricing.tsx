import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { isNativePlatform } from "@/lib/platform";
import { useAuth } from "@/hooks/useAuth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, Trophy, Users, Crown, Loader2, Infinity } from "lucide-react";
import { Link } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { FamilyMember } from "@shared/schema";
import { useTranslation } from "react-i18next";

type BillingCycle = "monthly" | "yearly";

export default function Pricing() {
  const { user } = useAuth();
  const { toast } = useToast();
  const { t } = useTranslation();
  const [billingCycle, setBillingCycle] = useState<BillingCycle>("monthly");
  const [processingTier, setProcessingTier] = useState<string | null>(null);

  const { data: member } = useQuery<FamilyMember>({
    queryKey: ["/api/family-members/current"],
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
  });

  const { data: familyData } = useQuery<{
    familyName: string;
    subscriptionTier: string;
    memberCount: number;
  }>({
    queryKey: ["/api/families/current"],
    enabled: !!member,
    staleTime: 5 * 60 * 1000,
  });

  const checkoutMutation = useMutation({
    mutationFn: async ({ tier, cycle }: { tier: string; cycle: string }) => {
      const res = await apiRequest("POST", "/api/create-checkout-session", { tier, billingCycle: cycle });
      return await res.json();
    },
    onSuccess: (data: { sessionId: string; url: string }) => {
      if (!data.url) {
        setProcessingTier(null);
        toast({
          title: t("pricing.toastCheckoutError"),
          description: t("pricing.toastNoCheckoutUrl"),
          variant: "destructive",
        });
        return;
      }
      window.location.href = data.url;
    },
    onError: (error: any) => {
      setProcessingTier(null);
      toast({
        title: t("pricing.toastCheckoutError"),
        description: error.message || t("pricing.toastCheckoutFailed"),
        variant: "destructive",
      });
    },
  });

  const handleUpgrade = (tierId: string, cycle: string) => {
    if (!member || member.role !== "parent") {
      toast({
        title: t("pricing.toastPermissionDenied"),
        description: t("pricing.toastOnlyParents"),
        variant: "destructive",
      });
      return;
    }
    setProcessingTier(`${tierId}-${cycle}`);
    checkoutMutation.mutate({ tier: tierId, cycle });
  };

  const isParent = member?.role === "parent";
  const currentTier = familyData?.subscriptionTier;

  const tiers = [
    {
      id: "free",
      name: "Free",
      icon: Users,
      memberLimit: 3,
      price: "€0",
      period: t("pricing.forever"),
      description: t("pricing.tierFreeDesc"),
      features: t("pricing.tierFreeFeatures", { returnObjects: true }) as string[],
      popular: false,
      lifetimePrice: null,
    },
    {
      id: "family",
      name: "Family",
      icon: Trophy,
      memberLimit: 6,
      price: billingCycle === "monthly" ? "€3,99" : "€29,99",
      period: billingCycle === "monthly" ? t("pricing.perMonth") : t("pricing.perYear"),
      description: t("pricing.tierFamilyDesc"),
      features: t("pricing.tierFamilyFeatures", { returnObjects: true }) as string[],
      popular: true,
      lifetimePrice: null,
    },
    {
      id: "family_hero",
      name: "Enterprise",
      icon: Crown,
      memberLimit: 999,
      price: billingCycle === "monthly" ? "€9,99" : "€69,99",
      period: billingCycle === "monthly" ? t("pricing.perMonth") : t("pricing.perYear"),
      description: t("pricing.tierFamilyHeroDesc"),
      features: t("pricing.tierFamilyHeroFeatures", { returnObjects: true }) as string[],
      popular: false,
      lifetimePrice: "€149",
    },
  ];

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="sticky top-0 z-40 w-full bg-background/95" style={{ paddingTop: "env(safe-area-inset-top)" }}>
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <Link href="/">
            <Button
              variant="outline"
              className="bg-background/30 backdrop-blur-sm border-border/40 hover:bg-background/60"
              data-testid="button-back-home"
            >
              {t("pricing.backToDashboard")}
            </Button>
          </Link>
        </div>
      </header>

      <div className="container mx-auto px-4 pt-8 pb-16">
        <h1 className="text-4xl md:text-5xl font-black font-accent text-center mb-4" data-testid="heading-pricing">
          {t("pricing.title")}
        </h1>
        <p className="text-center text-muted-foreground mb-8 max-w-xl mx-auto">
          {t("pricing.subtitle")}
        </p>

        {/* Billing toggle */}
        <div className="flex items-center justify-center gap-2 mb-10" data-testid="billing-toggle">
          <Button
            variant={billingCycle === "monthly" ? "default" : "outline"}
            size="sm"
            onClick={() => setBillingCycle("monthly")}
            data-testid="button-billing-monthly"
          >
            {t("pricing.billingMonthly")}
          </Button>
          <div className="relative">
            <Button
              variant={billingCycle === "yearly" ? "default" : "outline"}
              size="sm"
              onClick={() => setBillingCycle("yearly")}
              data-testid="button-billing-yearly"
            >
              {t("pricing.billingYearly")}
            </Button>
            {billingCycle === "yearly" && (
              <Badge className="absolute -top-3 -right-2 text-xs px-1.5 py-0" data-testid="badge-yearly-discount">
                {t("pricing.yearlyDiscount")}
              </Badge>
            )}
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
          {tiers.map((tier) => {
            const Icon = tier.icon;
            const isCurrentTier = currentTier === tier.id;
            const cycleKey = billingCycle;
            const processingKey = `${tier.id}-${cycleKey}`;
            const lifetimeProcessingKey = `${tier.id}-lifetime`;
            const isProcessing = processingTier === processingKey;
            const isProcessingLifetime = processingTier === lifetimeProcessingKey;

            return (
              <Card
                key={tier.id}
                className={`relative p-6 flex flex-col ${
                  tier.popular ? "ring-2 ring-primary shadow-lg" : ""
                }`}
                data-testid={`card-tier-${tier.id}`}
              >
                {tier.popular && (
                  <Badge
                    className="absolute -top-3 left-1/2 -translate-x-1/2"
                    data-testid="badge-most-popular"
                  >
                    {t("pricing.mostPopular")}
                  </Badge>
                )}

                <div className="flex items-center gap-3 mb-4">
                  <div
                    className={`h-12 w-12 rounded-full ${
                      tier.popular ? "gradient-winner" : "bg-primary/10"
                    } flex items-center justify-center`}
                  >
                    <Icon className={`h-6 w-6 ${tier.popular ? "text-white" : "text-primary"}`} />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold font-accent">{tier.name}</h2>
                    <p className="text-xs text-muted-foreground">{tier.description}</p>
                  </div>
                </div>

                <div className="mb-6">
                  <div className="flex items-baseline gap-1">
                    <span className="text-4xl font-black">{tier.price}</span>
                    <span className="text-sm text-muted-foreground">/{tier.period}</span>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">
                    {tier.memberLimit === 999
                      ? t("pricing.unlimitedMembers")
                      : t("pricing.upToMembers", { count: tier.memberLimit })}
                  </p>
                </div>

                <ul className="space-y-3 mb-6 flex-1">
                  {tier.features.map((feature, idx) => (
                    <li key={idx} className="flex items-start gap-2 text-sm">
                      <Check className="h-5 w-5 text-green-600 shrink-0 mt-0.5" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>

                {isNativePlatform() ? (
                  <p className="text-xs text-muted-foreground text-center py-2">
                    {t("pricing.manageOnWeb")}
                  </p>
                ) : (
                  <div className="flex flex-col gap-2">
                    <Button
                      className="w-full"
                      variant={tier.popular ? "default" : "outline"}
                      disabled={tier.id === "free" || isCurrentTier || !isParent || isProcessing || isProcessingLifetime}
                      onClick={() => handleUpgrade(tier.id, cycleKey)}
                      data-testid={`button-select-${tier.id}`}
                    >
                      {isProcessing ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          {t("pricing.processing")}
                        </>
                      ) : tier.id === "free" ? (
                        t("pricing.currentPlan")
                      ) : isCurrentTier ? (
                        t("pricing.currentPlan")
                      ) : (
                        t("pricing.choosePlan", { name: tier.name })
                      )}
                    </Button>

                    {/* Lifetime option — only for Enterprise */}
                    {tier.lifetimePrice && !isCurrentTier && (
                      <Button
                        className="w-full"
                        variant="outline"
                        disabled={!isParent || isProcessing || isProcessingLifetime}
                        onClick={() => handleUpgrade(tier.id, "lifetime")}
                        data-testid={`button-select-${tier.id}-lifetime`}
                      >
                        {isProcessingLifetime ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            {t("pricing.processing")}
                          </>
                        ) : (
                          <>
                            <Infinity className="w-4 h-4 mr-2" />
                            {t("pricing.lifetimeOption", { price: tier.lifetimePrice })}
                          </>
                        )}
                      </Button>
                    )}

                    {isCurrentTier && tier.id !== "free" && isParent && (
                      <Link href="/settings" data-testid={`link-cancel-${tier.id}`}>
                        <span className="text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer">
                          {t("pricing.cancelToSettings")}
                        </span>
                      </Link>
                    )}
                  </div>
                )}
              </Card>
            );
          })}
        </div>

        <div className="mt-16 text-center max-w-2xl mx-auto">
          <h2 className="text-2xl font-bold font-accent mb-4">{t("pricing.questionsTitle")}</h2>
          <p className="text-muted-foreground mb-6">{t("pricing.questionsDesc")}</p>
          <p className="text-sm text-muted-foreground">
            {billingCycle === "yearly"
              ? t("pricing.paymentInfoYearly")
              : t("pricing.paymentInfo")}
          </p>
        </div>
      </div>
    </div>
  );
}
