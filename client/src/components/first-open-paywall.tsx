import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, Trophy, Users, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { isNativePlatform } from "@/lib/platform";
import { apiRequest } from "@/lib/queryClient";
import {
  initRevenueCat,
  getRCProducts,
  purchaseRCStoreProduct,
  getEntitlementTier,
} from "@/lib/revenuecat";

interface FirstOpenPaywallProps {
  open: boolean;
  onClose: () => void;
  familyName?: string;
}

type BillingCycle = "monthly" | "yearly";

export function FirstOpenPaywall({ open, onClose, familyName }: FirstOpenPaywallProps) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [billingCycle, setBillingCycle] = useState<BillingCycle>("yearly");
  const [processing, setProcessing] = useState(false);
  const [rcProducts, setRcProducts] = useState<Record<string, any> | null>(null);
  const [rcLoading, setRcLoading] = useState(false);

  // Load RevenueCat products on iOS when modal opens (uses getProducts, not getOfferings)
  useEffect(() => {
    if (!open || !isNativePlatform() || !familyName) return;
    let cancelled = false;
    (async () => {
      setRcLoading(true);
      const safetyTimer = setTimeout(() => {
        if (!cancelled) setRcLoading(false);
      }, 8000);
      try {
        await initRevenueCat(familyName);
        let result: Record<string, any> | null = null;
        let done = false;
        getRCProducts().then(r => { result = r; done = true; });
        for (let i = 0; i < 30 && !done && !cancelled; i++) {
          await new Promise(r => setTimeout(r, 500));
        }
        if (!cancelled && done) setRcProducts(result);
      } catch (err) {
        console.error("[RevenueCat] Failed to load products in paywall:", err);
      } finally {
        clearTimeout(safetyTimer);
        if (!cancelled) setRcLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [open, familyName]);

  const familyFeatures = t("paywall.familyHighlights", { returnObjects: true }) as string[];
  const freeFeatures = t("paywall.freeHighlights", { returnObjects: true }) as string[];

  // Prices shown in the paywall
  const familyPriceMonthly = "€3,99";
  const familyPriceYearly = "€29,99";

  // Get localized RC price directly from StoreKit product map
  const getRcPrice = (cycle: "monthly" | "yearly"): string | null => {
    const productId = cycle === "monthly"
      ? "com.herokids.family.monthly"
      : "com.herokids.family.yearly";
    const product = rcProducts?.[productId];
    return product?.priceString ?? null;
  };

  const displayPrice = isNativePlatform()
    ? (getRcPrice(billingCycle) ?? (billingCycle === "monthly" ? familyPriceMonthly : familyPriceYearly))
    : (billingCycle === "monthly" ? familyPriceMonthly : familyPriceYearly);

  const handleStartFree = () => {
    try { localStorage.setItem("herokids_seen_paywall", "true"); } catch {}
    onClose();
  };

  const handleUpgrade = async () => {
    setProcessing(true);
    try {
      localStorage.setItem("herokids_seen_paywall", "true");

      if (isNativePlatform()) {
        // iOS: purchase via RevenueCat using StoreKit product directly
        const productId = billingCycle === "monthly"
          ? "com.herokids.family.monthly"
          : "com.herokids.family.yearly";
        let product = rcProducts?.[productId];

        // If products didn't load yet, try a quick reload
        if (!product && familyName) {
          try {
            await initRevenueCat(familyName);
            const reloaded = await getRCProducts();
            if (reloaded) {
              setRcProducts(reloaded);
              product = reloaded[productId];
            }
          } catch (_) {}
        }

        if (!product) {
          toast({
            title: t("pricing.toastCheckoutError"),
            description: "Produkt nicht verfügbar. Bitte versuche es später.",
            variant: "destructive",
          });
          setProcessing(false);
          return;
        }
        const customerInfo = await purchaseRCStoreProduct(product);
        const grantedTier = getEntitlementTier(customerInfo);
        await apiRequest("POST", "/api/revenuecat-sync", { entitlementId: "family" });
        await qc.invalidateQueries({ queryKey: ["/api/families/current"] });
        toast({
          title: t("pricing.toastCheckoutError").replace("Fehler", "Erfolg").replace("Error", "Success"),
          description: `Family ${grantedTier ? "aktiviert" : "abonniert"}!`,
        });
        onClose();
      } else {
        // Web: redirect to Stripe checkout
        const res = await apiRequest("POST", "/api/create-checkout-session", {
          tier: "family",
          billingCycle,
        });
        const data = await res.json();
        if (data.url) {
          window.location.href = data.url;
        } else {
          throw new Error("No checkout URL");
        }
      }
    } catch (err: any) {
      if (err?.code === "1" || err?.message?.includes("cancel")) {
        // User cancelled purchase — no toast
      } else {
        toast({
          title: t("pricing.toastCheckoutError"),
          description: err?.message || t("pricing.toastCheckoutFailed"),
          variant: "destructive",
        });
      }
    } finally {
      setProcessing(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleStartFree(); }}>
      <DialogContent
        className="max-w-lg mx-auto"
        onOpenAutoFocus={(e) => e.preventDefault()}
        data-testid="dialog-first-open-paywall"
      >
        <DialogHeader className="text-center space-y-1">
          <DialogTitle className="text-2xl font-accent font-black">
            {t("paywall.title")}
          </DialogTitle>
          <DialogDescription className="text-sm">
            {t("paywall.subtitle")}
          </DialogDescription>
        </DialogHeader>

        {/* Billing toggle */}
        <div className="flex justify-center">
          <div className="flex items-center bg-muted rounded-full p-1 gap-1">
            <button
              onClick={() => setBillingCycle("monthly")}
              data-testid="button-paywall-billing-monthly"
              className={`px-4 py-1.5 rounded-full text-sm font-semibold transition-all duration-200 ${
                billingCycle === "monthly"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {t("pricing.billingMonthly")}
            </button>
            <button
              onClick={() => setBillingCycle("yearly")}
              data-testid="button-paywall-billing-yearly"
              className={`flex items-center gap-1.5 px-4 py-1.5 rounded-full text-sm font-semibold transition-all duration-200 ${
                billingCycle === "yearly"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {t("pricing.billingYearly")}
              <Badge className="text-xs px-1.5 py-0 bg-green-500 hover:bg-green-500 text-white border-0 no-default-active-elevate">
                {t("pricing.yearlyDiscount")}
              </Badge>
            </button>
          </div>
        </div>

        {/* Plan cards */}
        <div className="grid grid-cols-2 gap-3">
          {/* Free card */}
          <div
            className="rounded-lg border bg-card p-4 flex flex-col gap-2"
            data-testid="card-paywall-free"
          >
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                <Users className="h-4 w-4 text-primary" />
              </div>
              <span className="font-bold font-accent">{t("paywall.freeTitle")}</span>
            </div>
            <div className="text-2xl font-black">€0</div>
            <ul className="space-y-1.5 flex-1">
              {freeFeatures.map((f, i) => (
                <li key={i} className="flex items-start gap-1.5 text-xs text-muted-foreground">
                  <Check className="h-3.5 w-3.5 text-green-600 shrink-0 mt-0.5" />
                  <span>{f}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Family card */}
          <div
            className="rounded-lg border-2 border-primary bg-card p-4 flex flex-col gap-2 relative"
            data-testid="card-paywall-family"
          >
            <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 whitespace-nowrap text-xs px-2">
              {t("pricing.mostPopular")}
            </Badge>
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-full gradient-winner flex items-center justify-center">
                <Trophy className="h-4 w-4 text-white" />
              </div>
              <span className="font-bold font-accent">{t("paywall.familyTitle")}</span>
            </div>
            <div>
              <span className="text-2xl font-black">{displayPrice}</span>
              <span className="text-xs text-muted-foreground ml-1">
                /{billingCycle === "monthly" ? t("pricing.perMonth") : t("pricing.perYear")}
              </span>
            </div>
            <ul className="space-y-1.5 flex-1">
              {familyFeatures.map((f, i) => (
                <li key={i} className="flex items-start gap-1.5 text-xs">
                  <Check className="h-3.5 w-3.5 text-green-600 shrink-0 mt-0.5" />
                  <span>{f}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* CTAs */}
        <div className="flex flex-col gap-2 pt-1">
          <Button
            className="w-full"
            onClick={handleUpgrade}
            disabled={processing || rcLoading}
            data-testid="button-paywall-upgrade"
          >
            {processing || rcLoading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                {t("pricing.processing")}
              </>
            ) : (
              t("paywall.upgradeFamily")
            )}
          </Button>
          <Button
            variant="outline"
            className="w-full"
            onClick={handleStartFree}
            disabled={processing}
            data-testid="button-paywall-start-free"
          >
            {t("paywall.startFree")}
          </Button>
          <button
            className="text-xs text-muted-foreground hover:text-foreground transition-colors py-1"
            onClick={handleStartFree}
            disabled={processing}
            data-testid="button-paywall-maybe-later"
          >
            {t("paywall.maybeLater")}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
