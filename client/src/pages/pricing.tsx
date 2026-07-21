import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { isNativePlatform } from "@/lib/platform";
import { useAuth } from "@/hooks/useAuth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, Trophy, Users, Crown, Loader2, Infinity, RefreshCw } from "lucide-react";
import { Link } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { FamilyMember } from "@shared/schema";
import { useTranslation } from "react-i18next";
import {
  initRevenueCat,
  getRCOfferings,
  getRCCustomerInfo,
  purchaseRCPackage,
  restoreRCPurchases,
  getEntitlementTier,
  isLifetimeEntitlement,
  getPackagePrice,
} from "@/lib/revenuecat";

type BillingCycle = "monthly" | "yearly";

export default function Pricing() {
  const { user } = useAuth();
  const { toast } = useToast();
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [billingCycle, setBillingCycle] = useState<BillingCycle>("monthly");
  const [processingTier, setProcessingTier] = useState<string | null>(null);

  // RevenueCat state (iOS only)
  const [rcOfferings, setRcOfferings] = useState<any>(null);
  const [rcLoading, setRcLoading] = useState(false);
  const [rcRestoring, setRcRestoring] = useState(false);

  const { data: member } = useQuery<FamilyMember>({
    queryKey: ["/api/family-members/current"],
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
  });

  const { data: familyData } = useQuery<{
    familyName: string;
    subscriptionTier: string;
    memberCount: number;
    isLifetimePurchase?: boolean;
  }>({
    queryKey: ["/api/families/current"],
    enabled: !!member,
    staleTime: 5 * 60 * 1000,
  });

  // Initialize RevenueCat and load offerings on iOS
  useEffect(() => {
    if (!isNativePlatform() || !familyData?.familyName) return;
    let cancelled = false;
    setRcLoading(true);

    // Safety timeout: never show spinner longer than 8 seconds
    const safetyTimer = setTimeout(() => {
      if (!cancelled) setRcLoading(false);
    }, 8000);

    (async () => {
      try {
        await initRevenueCat(familyData.familyName);
        const offerings = await getRCOfferings();
        if (!cancelled) setRcOfferings(offerings);

        // Auto-recover mid-transaction loss: if RC already granted a lifetime
        // entitlement but the server hasn't been notified yet (e.g. the app
        // crashed between the StoreKit confirmation and the /api/revenuecat-sync
        // call), silently re-sync on every launch until the server agrees.
        if (!familyData.isLifetimePurchase) {
          try {
            const customerInfo = await getRCCustomerInfo();
            if (customerInfo && isLifetimeEntitlement(customerInfo, "family_pro")) {
              console.log("[RevenueCat] Detected unsynced lifetime purchase — auto-syncing...");
              await apiRequest("POST", "/api/revenuecat-sync", {
                entitlementId: "family_pro",
                isLifetime: true,
              });
              if (!cancelled) {
                await qc.invalidateQueries({ queryKey: ["/api/families/current"] });
                console.log("[RevenueCat] Auto-sync complete: lifetime activated on server.");
              }
            }
          } catch (autoSyncErr) {
            // Non-fatal: user can still use Restore Purchases manually
            console.warn("[RevenueCat] Auto-sync failed (will retry next launch):", autoSyncErr);
          }
        }
      } catch (err) {
        console.error("[RevenueCat] Failed to load offerings:", err);
      } finally {
        clearTimeout(safetyTimer);
        if (!cancelled) setRcLoading(false);
      }
    })();
    return () => { cancelled = true; clearTimeout(safetyTimer); };
  }, [familyData?.familyName]);

  // Stripe checkout (web only)
  const checkoutMutation = useMutation({
    mutationFn: async ({ tier, cycle }: { tier: string; cycle: string }) => {
      const res = await apiRequest("POST", "/api/create-checkout-session", { tier, billingCycle: cycle });
      return await res.json();
    },
    onSuccess: (data: { sessionId: string; url: string }) => {
      if (!data.url) {
        setProcessingTier(null);
        toast({ title: t("pricing.toastCheckoutError"), description: t("pricing.toastNoCheckoutUrl"), variant: "destructive" });
        return;
      }
      window.location.href = data.url;
    },
    onError: (error: any) => {
      setProcessingTier(null);
      toast({ title: t("pricing.toastCheckoutError"), description: error.message || t("pricing.toastCheckoutFailed"), variant: "destructive" });
    },
  });

  const handleUpgrade = (tierId: string, cycle: string) => {
    if (!member || member.role !== "parent") {
      toast({ title: t("pricing.toastPermissionDenied"), description: t("pricing.toastOnlyParents"), variant: "destructive" });
      return;
    }
    setProcessingTier(`${tierId}-${cycle}`);
    checkoutMutation.mutate({ tier: tierId, cycle });
  };

  // iOS native purchase via RevenueCat
  const handleIOSPurchase = async (tierId: string, cycle: "monthly" | "yearly" | "lifetime") => {
    if (!member || member.role !== "parent") {
      toast({ title: t("pricing.toastPermissionDenied"), description: t("pricing.toastOnlyParents"), variant: "destructive" });
      return;
    }

    const offeringKey = tierId === "family_hero" ? "family_pro" : "family";
    const entitlementKey = tierId === "family_hero" ? "family_pro" : "family";
    const offering = rcOfferings?.all?.[offeringKey];
    if (!offering) {
      toast({ title: t("pricing.toastCheckoutError"), description: "Angebote nicht verfügbar. Bitte versuche es später.", variant: "destructive" });
      return;
    }

    const identifierMap: Record<string, string> = {
      monthly: "$rc_monthly",
      yearly: "$rc_annual",
      lifetime: "$rc_lifetime",
    };
    const pkgIdentifier = identifierMap[cycle];
    const pkg = offering.availablePackages?.find((p: any) => p.identifier === pkgIdentifier);
    if (!pkg) {
      toast({ title: t("pricing.toastCheckoutError"), description: "Paket nicht gefunden.", variant: "destructive" });
      return;
    }

    setProcessingTier(`${tierId}-${cycle}`);
    try {
      const customerInfo = await purchaseRCPackage(pkg);
      const grantedTier = getEntitlementTier(customerInfo);
      const isLifetimePurchase = cycle === "lifetime";

      // Sync to backend
      await apiRequest("POST", "/api/revenuecat-sync", {
        entitlementId: entitlementKey,
        ...(isLifetimePurchase ? { isLifetime: true } : {}),
      });

      // Refresh family data
      await qc.invalidateQueries({ queryKey: ["/api/families/current"] });

      toast({
        title: isLifetimePurchase ? "Lifetime-Zugang aktiviert!" : "Abonnement aktiviert!",
        description: isLifetimePurchase
          ? "Du hast FamilyPro Lifetime erfolgreich freigeschaltet."
          : `Du hast ${grantedTier === "family_hero" ? "FamilyPro" : "Family"} erfolgreich abonniert.`,
      });
    } catch (err: any) {
      if (err?.code === "1" || err?.message?.includes("cancel")) {
        // User cancelled — no toast needed
      } else {
        toast({ title: t("pricing.toastCheckoutError"), description: err?.message || "Kauf fehlgeschlagen.", variant: "destructive" });
      }
    } finally {
      setProcessingTier(null);
    }
  };

  const handleRestorePurchases = async () => {
    setRcRestoring(true);
    try {
      const customerInfo = await restoreRCPurchases();
      const tier = getEntitlementTier(customerInfo);
      if (tier) {
        const entitlementKey = tier === "family_hero" ? "family_pro" : "family";
        const isLifetime = isLifetimeEntitlement(customerInfo, entitlementKey);
        await apiRequest("POST", "/api/revenuecat-sync", {
          entitlementId: entitlementKey,
          ...(isLifetime ? { isLifetime: true } : {}),
        });
        await qc.invalidateQueries({ queryKey: ["/api/families/current"] });
        toast({
          title: "Käufe wiederhergestellt!",
          description: isLifetime
            ? "Dein Lifetime-Zugang wurde erfolgreich wiederhergestellt."
            : "Dein Abonnement wurde erfolgreich wiederhergestellt.",
        });
      } else {
        toast({ title: "Keine Käufe gefunden", description: "Es wurden keine früheren Käufe gefunden.", variant: "destructive" });
      }
    } catch (err: any) {
      toast({ title: "Fehler", description: err?.message || "Wiederherstellung fehlgeschlagen.", variant: "destructive" });
    } finally {
      setRcRestoring(false);
    }
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
      rcOfferingKey: null,
      rcEntitlementKey: null,
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
      rcOfferingKey: "family",
      rcEntitlementKey: "family",
    },
    {
      id: "family_hero",
      name: "FamilyPro",
      icon: Crown,
      memberLimit: 999,
      price: billingCycle === "monthly" ? "€9,99" : "€69,99",
      period: billingCycle === "monthly" ? t("pricing.perMonth") : t("pricing.perYear"),
      description: t("pricing.tierFamilyHeroDesc"),
      features: t("pricing.tierFamilyHeroFeatures", { returnObjects: true }) as string[],
      popular: false,
      lifetimePrice: "€149",
      rcOfferingKey: "family_pro",
      rcEntitlementKey: "family_pro",
    },
  ];

  // Helper: get a package price string from RevenueCat offerings
  const getRcPrice = (offeringKey: string | null, packageId: string): string | null => {
    if (!offeringKey || !rcOfferings?.all?.[offeringKey]) return null;
    const pkg = rcOfferings.all[offeringKey]?.availablePackages?.find(
      (p: any) => p.identifier === packageId,
    );
    return pkg ? getPackagePrice(pkg) : null;
  };

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

        {/* Billing toggle (web only or iOS with RevenueCat) */}
        <div className="flex flex-col items-center gap-3 mb-10" data-testid="billing-toggle">
          <div className="flex items-center bg-muted rounded-full p-1 gap-1">
            <button
              onClick={() => setBillingCycle("monthly")}
              data-testid="button-billing-monthly"
              className={`px-5 py-2 rounded-full text-sm font-semibold transition-all duration-200 ${
                billingCycle === "monthly"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {t("pricing.billingMonthly")}
            </button>
            <button
              onClick={() => setBillingCycle("yearly")}
              data-testid="button-billing-yearly"
              className={`px-5 py-2 rounded-full text-sm font-semibold transition-all duration-200 ${
                billingCycle === "yearly"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {t("pricing.billingYearly")}
            </button>
          </div>

          {billingCycle === "monthly" ? (
            <button
              onClick={() => setBillingCycle("yearly")}
              data-testid="badge-yearly-discount"
              className="flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-bold text-white shadow-lg transition-transform active:scale-95"
              style={{ background: "linear-gradient(135deg, #f97316, #eab308)" }}
            >
              <span>🎁</span>
              <span>{t("pricing.yearlyDiscountTeaser")}</span>
              <span>→</span>
            </button>
          ) : (
            <Badge variant="default" className="text-xs px-3 py-1" data-testid="badge-yearly-discount">
              ✓ {t("pricing.yearlyDiscount")}
            </Badge>
          )}
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

            // RevenueCat prices (iOS) — fall back to hardcoded if not available
            const rcMonthlyPrice = getRcPrice(tier.rcOfferingKey, "$rc_monthly");
            const rcYearlyPrice = getRcPrice(tier.rcOfferingKey, "$rc_annual");
            const rcLifetimePrice = getRcPrice(tier.rcOfferingKey, "$rc_lifetime");
            const displayPrice = isNativePlatform()
              ? (billingCycle === "monthly" ? (rcMonthlyPrice ?? tier.price) : (rcYearlyPrice ?? tier.price))
              : tier.price;

            return (
              <Card
                key={tier.id}
                className={`relative p-6 flex flex-col ${tier.popular ? "ring-2 ring-primary shadow-lg" : ""}`}
                data-testid={`card-tier-${tier.id}`}
              >
                {tier.popular && (
                  <Badge className="absolute -top-3 left-1/2 -translate-x-1/2" data-testid="badge-most-popular">
                    {t("pricing.mostPopular")}
                  </Badge>
                )}

                <div className="flex items-center gap-3 mb-4">
                  <div className={`h-12 w-12 rounded-full ${tier.popular ? "gradient-winner" : "bg-primary/10"} flex items-center justify-center`}>
                    <Icon className={`h-6 w-6 ${tier.popular ? "text-white" : "text-primary"}`} />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold font-accent">{tier.name}</h2>
                    <p className="text-xs text-muted-foreground">{tier.description}</p>
                  </div>
                </div>

                <div className="mb-6">
                  <div className="flex items-baseline gap-1">
                    <span className="text-4xl font-black">{displayPrice}</span>
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
                  /* ── iOS: RevenueCat in-app purchase ── */
                  <div className="flex flex-col gap-2">
                    {tier.id === "free" || (isCurrentTier && !tier.lifetimePrice) ? (
                      <Button className="w-full" variant="outline" disabled data-testid={`button-select-${tier.id}`}>
                        {t("pricing.currentPlan")}
                      </Button>
                    ) : tier.rcOfferingKey === null ? null : (
                      <>
                        {/* Subscription button — hidden if already on this tier with lifetime */}
                        {!(isCurrentTier && familyData?.isLifetimePurchase) && (
                          <Button
                            className="w-full"
                            variant={tier.popular ? "default" : "outline"}
                            disabled={!isParent || isProcessing || isProcessingLifetime || rcLoading || isCurrentTier}
                            onClick={() => handleIOSPurchase(tier.id, cycleKey as "monthly" | "yearly")}
                            data-testid={`button-select-${tier.id}`}
                          >
                            {isProcessing ? (
                              <>
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                {t("pricing.processing")}
                              </>
                            ) : rcLoading ? (
                              <>
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                {t("pricing.processing")}
                              </>
                            ) : isCurrentTier ? (
                              t("pricing.currentPlan")
                            ) : (
                              t("pricing.choosePlan", { name: tier.name })
                            )}
                          </Button>
                        )}

                        {/* Lifetime button — only for family_hero tier */}
                        {tier.lifetimePrice && !familyData?.isLifetimePurchase && (
                          <Button
                            className="w-full"
                            variant="outline"
                            disabled={!isParent || isProcessing || isProcessingLifetime || rcLoading}
                            onClick={() => handleIOSPurchase(tier.id, "lifetime")}
                            data-testid={`button-select-${tier.id}-lifetime`}
                          >
                            {isProcessingLifetime ? (
                              <>
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                {t("pricing.processing")}
                              </>
                            ) : rcLoading ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <>
                                <Infinity className="w-4 h-4 mr-2" />
                                {t("pricing.lifetimeOption", { price: rcLifetimePrice })}
                              </>
                            )}
                          </Button>
                        )}

                        {/* Lifetime active indicator */}
                        {tier.lifetimePrice && isCurrentTier && familyData?.isLifetimePurchase && (
                          <div className="flex items-center justify-center gap-2 py-1.5 text-sm text-muted-foreground">
                            <Infinity className="w-4 h-4 text-primary" />
                            <span className="font-medium text-primary">{t("pricing.lifetimeActive")}</span>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                ) : (
                  /* ── Web: Stripe checkout buttons ── */
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
                      ) : tier.id === "free" || isCurrentTier ? (
                        t("pricing.currentPlan")
                      ) : (
                        t("pricing.choosePlan", { name: tier.name })
                      )}
                    </Button>

                    {tier.lifetimePrice && !familyData?.isLifetimePurchase && (
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

                    {tier.lifetimePrice && isCurrentTier && familyData?.isLifetimePurchase && (
                      <div className="flex items-center justify-center gap-2 py-1.5 text-sm text-muted-foreground">
                        <Infinity className="w-4 h-4 text-primary" />
                        <span className="font-medium text-primary">{t("pricing.lifetimeActive")}</span>
                      </div>
                    )}

                    {isCurrentTier && tier.id !== "free" && isParent && !familyData?.isLifetimePurchase && (
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


        {/* iOS: Restore Purchases */}
        {isNativePlatform() && (
          <div className="mt-8 text-center">
            <button
              onClick={handleRestorePurchases}
              disabled={rcRestoring}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors inline-flex items-center gap-1.5"
              data-testid="button-restore-purchases"
            >
              {rcRestoring ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Wiederherstellen…
                </>
              ) : (
                <>
                  <RefreshCw className="w-3.5 h-3.5" />
                  Käufe wiederherstellen
                </>
              )}
            </button>
          </div>
        )}

        <div className="mt-16 text-center max-w-2xl mx-auto">
          <h2 className="text-2xl font-bold font-accent mb-4">{t("pricing.questionsTitle")}</h2>
          <p className="text-muted-foreground mb-6">{t("pricing.questionsDesc")}</p>
          <p className="text-sm text-muted-foreground">
            {billingCycle === "yearly" ? t("pricing.paymentInfoYearly") : t("pricing.paymentInfo")}
          </p>
        </div>
      </div>
    </div>
  );
}
