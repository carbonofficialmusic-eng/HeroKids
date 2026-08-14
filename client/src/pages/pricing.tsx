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
  getRCProducts,
  getRCCustomerInfo,
  purchaseRCStoreProduct,
  restoreRCPurchases,
  getEntitlementTier,
  isLifetimeEntitlement,
  getIntroductoryOffer,
} from "@/lib/revenuecat";

type BillingCycle = "monthly" | "yearly";

export default function Pricing() {
  const { user } = useAuth();
  const { toast } = useToast();
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [billingCycle, setBillingCycle] = useState<BillingCycle>("monthly");
  const [processingTier, setProcessingTier] = useState<string | null>(null);
  const [processingStep, setProcessingStep] = useState<string>("");

  // RevenueCat state (iOS only) — keyed by product identifier
  const [rcProducts, setRcProducts] = useState<Record<string, any> | null>(null);
  const [rcLoading, setRcLoading] = useState(false);
  const [rcLoadFailed, setRcLoadFailed] = useState(false);
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
        // Small pause so the native SDK finishes internal setup after fire-and-forget configure()
        await new Promise(r => setTimeout(r, 300));

        // Avoid Promise.race() — Capacitor native promises don't interop reliably
        // with standard JS timeout promises in WKWebView. Instead: kick off the
        // fetch in the background and poll every 500ms for up to 15 seconds.
        let productsResult: Record<string, any> | null = undefined as any;
        let productsDone = false;
        getRCProducts().then(r => { productsResult = r; productsDone = true; });

        const MAX_POLLS = 30; // 30 × 500ms = 15 seconds
        for (let i = 0; i < MAX_POLLS; i++) {
          await new Promise(r => setTimeout(r, 500));
          if (productsDone || cancelled) break;
        }

        if (!productsDone) {
          throw new Error('RC_TIMEOUT: getProducts nach 15s');
        }
        if (!cancelled) {
          setRcProducts(productsResult);
          if (!productsResult) {
            setRcLoadFailed(true);
          }
        }

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

        // Auto-downgrade: if the server still shows a paid tier, always ask the
        // server to check RC (handles both fully-expired AND cancelled-but-not-yet-
        // expired subscriptions via unsubscribe_detected_at). The server returns
        // action:"skipped" when the subscription is still genuinely active.
        if (!familyData.isLifetimePurchase && familyData.subscriptionTier !== "free") {
          try {
            console.log("[RevenueCat] Checking cancellation status…");
            const res = await apiRequest("POST", "/api/revenuecat-cancel-sync", {});
            const result = await res.json().catch(() => ({}));
            if (!cancelled && result?.action === "downgraded") {
              await qc.invalidateQueries({ queryKey: ["/api/families/current"] });
              console.log("[RevenueCat] Cancel-sync: downgraded to free.");
            } else {
              console.log("[RevenueCat] Cancel-sync result:", result?.action ?? "ok");
            }
          } catch (cancelSyncErr) {
            console.warn("[RevenueCat] Cancel-sync failed (will retry next launch):", cancelSyncErr);
          }
        }
      } catch (err: any) {
        console.error("[RevenueCat] Failed to load offerings:", err);
        if (!cancelled) {
          setRcLoadFailed(true);
          setRcDebugMsg(`RC Fehler: ${err?.message ?? String(err)}`);
        }
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

    // Look up the StoreKit product directly from our product map
    const productIdMap: Record<string, Record<string, string>> = {
      family: { monthly: 'com.herokids.family.monthly', yearly: 'com.herokids.family.yearly' },
      family_pro: { monthly: 'com.herokids.familypro.monthly', yearly: 'com.herokids.familypro.yearly' },
    };
    const productId = productIdMap[offeringKey]?.[cycle];
    let product = productId ? rcProducts?.[productId] : null;

    // If products haven't loaded yet, try a quick reload
    if (!product && familyData?.familyName) {
      setProcessingTier(`${tierId}-${cycle}`);
      setProcessingStep("Produkte laden…");
      try {
        await initRevenueCat(familyData.familyName);
        const reloaded = await getRCProducts();
        if (reloaded) {
          setRcProducts(reloaded);
          setRcLoadFailed(false);
          product = productId ? reloaded[productId] : null;
        }
      } catch (_) {}
      setProcessingTier(null);
      setProcessingStep("");
    }

    if (!product) {
      toast({ title: t("pricing.toastCheckoutError"), description: "Produkt nicht verfügbar. Bitte versuche es später.", variant: "destructive" });
      return;
    }

    setProcessingTier(`${tierId}-${cycle}`);
    setProcessingStep("Apple Store öffnen…");
    try {
      console.log('[Pricing] purchaseRCStoreProduct for tier:', tierId, 'cycle:', cycle, 'productId:', productId);
      const customerInfo = await purchaseRCStoreProduct(product);
      const grantedTier = getEntitlementTier(customerInfo);
      const isLifetimePurchase = cycle === "lifetime";

      // Pass RC SDK's own verification to the server as Fallback C evidence.
      // purchaseStoreProduct() talks directly to RC's servers, so customerInfo
      // is already RC-verified — even if RC's REST API lags behind.
      const activeEnt = customerInfo?.entitlements?.active?.[entitlementKey];
      const rcClientConfirmed = activeEnt?.isActive === true;
      const rcExpiresMs = activeEnt?.expirationDate
        ? new Date(activeEnt.expirationDate).getTime()
        : null; // null = lifetime

      // Sync to backend
      await apiRequest("POST", "/api/revenuecat-sync", {
        entitlementId: entitlementKey,
        ...(isLifetimePurchase ? { isLifetime: true } : {}),
        ...(rcClientConfirmed ? { rcClientConfirmed: true, rcExpiresMs } : {}),
      });

      // Refresh family data — use refetchQueries (not invalidate) so the header
      // reflects the new tier immediately before the success toast fires.
      await qc.refetchQueries({ queryKey: ["/api/families/current"] });

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
      setProcessingStep("");
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
        await qc.refetchQueries({ queryKey: ["/api/families/current"] });
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

  // Helper: get a price string directly from the StoreKit product map
  const PRODUCT_ID_MAP: Record<string, Record<string, string>> = {
    family: {
      monthly: 'com.herokids.family.monthly',
      yearly: 'com.herokids.family.yearly',
    },
    family_pro: {
      monthly: 'com.herokids.familypro.monthly',
      yearly: 'com.herokids.familypro.yearly',
    },
  };
  const getRcPrice = (offeringKey: string | null, cycle: string): string | null => {
    if (!offeringKey || !rcProducts) return null;
    const productId = PRODUCT_ID_MAP[offeringKey]?.[cycle];
    if (!productId) return null;
    const product = rcProducts[productId];
    return product?.priceString ?? product?.price?.toString() ?? null;
  };

  // Derive the currency symbol from any loaded RC priceString so the free tier
  // shows the same currency as the paid tiers (e.g. "$0" in US sandbox, "€0" in DE prod).
  const rcCurrencyPrefix = (() => {
    if (!rcProducts) return null;
    for (const product of Object.values(rcProducts)) {
      const ps: string | undefined = (product as any)?.priceString;
      if (ps) {
        const match = ps.match(/^([^0-9]+)/);
        if (match) return match[1];
      }
    }
    return null;
  })();

  const tiers = [
    {
      id: "free",
      name: "Free",
      icon: Users,
      memberLimit: 3,
      price: isNativePlatform() && rcCurrencyPrefix ? `${rcCurrencyPrefix}0` : "€0",
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

            // RevenueCat prices (iOS) — look up from StoreKit product map
            const rcMonthlyPrice = getRcPrice(tier.rcOfferingKey, "monthly");
            const rcYearlyPrice = getRcPrice(tier.rcOfferingKey, "yearly");
            const rcLifetimePrice: string | null = null; // lifetime removed
            const displayPrice = isNativePlatform()
              ? (billingCycle === "monthly" ? (rcMonthlyPrice ?? tier.price) : (rcYearlyPrice ?? tier.price))
              : tier.price;

            // Free trial intro offer (iOS only)
            const tierProductId = tier.rcOfferingKey
              ? PRODUCT_ID_MAP[tier.rcOfferingKey]?.[cycleKey]
              : null;
            const introOffer = isNativePlatform() && tierProductId
              ? getIntroductoryOffer(rcProducts?.[tierProductId])
              : null;

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
                  {introOffer ? (
                    <>
                      <div className="flex items-baseline gap-1">
                        <span className="text-4xl font-black text-green-600">
                          {t("pricing.freeTrial", { days: introOffer.periodDays })}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">
                        {t("pricing.freeTrialThen", { price: `${displayPrice}/${tier.period}` })}
                      </p>
                    </>
                  ) : (
                    <>
                      <div className="flex items-baseline gap-1">
                        <span className="text-4xl font-black">{displayPrice}</span>
                        <span className="text-sm text-muted-foreground">/{tier.period}</span>
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">
                        {tier.memberLimit === 999
                          ? t("pricing.unlimitedMembers")
                          : t("pricing.upToMembers", { count: tier.memberLimit })}
                      </p>
                    </>
                  )}
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
                          <>
                            {rcLoadFailed ? (
                              <p className="text-center text-sm text-muted-foreground py-2">
                                {t("pricing.rcUnavailable", "In-App Purchases temporarily unavailable. Please try again later.")}
                              </p>
                            ) : (
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
                                    {processingStep || t("pricing.processing")}
                                  </>
                                ) : rcLoading ? (
                                  <>
                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                    {t("pricing.processing")}
                                  </>
                                ) : isCurrentTier ? (
                                  t("pricing.currentPlan")
                                ) : introOffer ? (
                                  t("pricing.freeTrialButton", { days: introOffer.periodDays })
                                ) : (
                                  t("pricing.choosePlan", { name: tier.name })
                                )}
                              </Button>
                            )}
                          </>
                        )}

                        {/* Lifetime button — only for family_hero tier, only if RC has the product */}
                        {tier.lifetimePrice && !familyData?.isLifetimePurchase && (!rcLoading && rcLifetimePrice) && (
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
                                {processingStep || t("pricing.processing")}
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

                    {/* Cancel subscription — opens Apple subscription management */}
                    {isCurrentTier && tier.id !== "free" && isParent && !familyData?.isLifetimePurchase && (
                      <button
                        onClick={async () => {
                          try {
                            const { App: CapApp } = await import("@capacitor/app");
                            await CapApp.openUrl({ url: "itms-apps://apps.apple.com/account/subscriptions" });
                          } catch {
                            // fallback for older Capacitor versions
                            window.location.href = "itms-apps://apps.apple.com/account/subscriptions";
                          }
                        }}
                        className="w-full mt-1 py-2 text-sm text-muted-foreground hover:text-destructive border border-dashed border-muted-foreground/30 hover:border-destructive/50 rounded-lg transition-colors"
                        data-testid={`button-cancel-${tier.id}`}
                      >
                        {t("pricing.cancelSubscription")}
                        <span className="block text-xs opacity-60 mt-0.5">
                          {t("pricing.cancelSubscriptionHint")}
                        </span>
                      </button>
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
                      <button
                        onClick={() => {
                          if (isNativePlatform()) {
                            window.open("itms-apps://apps.apple.com/account/subscriptions", "_system");
                          } else {
                            window.location.href = "/settings";
                          }
                        }}
                        className="w-full mt-1 py-2 text-sm text-muted-foreground hover:text-destructive border border-dashed border-muted-foreground/30 hover:border-destructive/50 rounded-lg transition-colors"
                        data-testid={`button-cancel-${tier.id}`}
                      >
                        {t("pricing.cancelSubscription")}
                        {isNativePlatform() && (
                          <span className="block text-xs opacity-60 mt-0.5">
                            {t("pricing.cancelSubscriptionHint")}
                          </span>
                        )}
                      </button>
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
          {/* Required by Apple Guideline 3.1.2(c): functional links to Privacy Policy and EULA */}
          <div className="mt-6 flex items-center justify-center gap-4 text-xs text-muted-foreground">
            <Link href="/privacy" className="underline hover:text-foreground transition-colors">
              {t("landing.footer.privacy", "Privacy Policy")}
            </Link>
            <span>·</span>
            <Link href="/terms" className="underline hover:text-foreground transition-colors">
              {t("landing.footer.terms", "Terms of Use")}
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
