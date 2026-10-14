import type Stripe from "stripe";

type BillingFamily = {
  familyName: string;
  billingCustomerId?: string | null;
  billingSubscriptionId?: string | null;
};

export type SubscriptionPurchaseProvider = "apple" | "stripe";

export type SubscriptionPurchaseEligibility =
  | { allowed: true }
  | {
      allowed: false;
      code: "ACTIVE_APPLE_SUBSCRIPTION" | "ACTIVE_STRIPE_SUBSCRIPTION";
      message: string;
      action?: "manage_stripe";
    };

export async function hasActiveAppleSubscription(familyName: string): Promise<boolean> {
  const apiKey = process.env.REVENUECAT_API_KEY;
  if (!apiKey) throw new Error("RevenueCat verification is unavailable");

  const response = await fetch(
    `https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(familyName)}`,
    { headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" } },
  );
  if (response.status === 404) return false;
  if (!response.ok) throw new Error(`RevenueCat verification failed (${response.status})`);

  const data: any = await response.json();
  const entitlements: Record<string, { expires_date?: string | null }> =
    data?.subscriber?.entitlements ?? {};
  return ["family", "family_pro"].some(id => {
    const entitlement = entitlements[id];
    return entitlement !== undefined &&
      (entitlement.expires_date === null ||
        (entitlement.expires_date !== undefined && new Date(entitlement.expires_date) > new Date()));
  });
}

export async function hasActiveStripeSubscription(
  family: BillingFamily,
  stripe: Stripe,
): Promise<boolean> {
  const activeStatuses = new Set(["active", "trialing", "past_due", "unpaid"]);

  if (family.billingSubscriptionId) {
    try {
      const subscription = await stripe.subscriptions.retrieve(family.billingSubscriptionId);
      if (activeStatuses.has(subscription.status)) return true;
    } catch (error: any) {
      if (error?.code === "resource_missing" && !family.billingCustomerId) {
        throw new Error("Stripe subscription linkage is inconsistent");
      }
      if (error?.code !== "resource_missing" && !family.billingCustomerId) throw error;
    }
  }

  if (!family.billingCustomerId) return false;
  const subscriptions = await stripe.subscriptions.list({
    customer: family.billingCustomerId,
    status: "all",
    limit: 100,
  });
  return subscriptions.data.some(subscription => activeStatuses.has(subscription.status));
}

export function resolvePurchaseEligibility(
  requestedProvider: SubscriptionPurchaseProvider,
  active: { apple: boolean; stripe: boolean },
): SubscriptionPurchaseEligibility {
  if (active.apple && requestedProvider === "stripe") {
    return {
      allowed: false,
      code: "ACTIVE_APPLE_SUBSCRIPTION",
      message: "Dein Abonnement wird über den Apple App Store verwaltet. Tarifwechsel sind deshalb nur dort möglich. Kündige das Abonnement zunächst im App Store und warte, bis der bezahlte Zeitraum abgelaufen ist, bevor du ein neues Abonnement über die Web-App abschließt.",
    };
  }
  if (active.stripe && requestedProvider === "apple") {
    return {
      allowed: false,
      code: "ACTIVE_STRIPE_SUBSCRIPTION",
      message: "Dein Abonnement wird über Stripe verwaltet. Tarifwechsel sind deshalb nur in der Web-App möglich. Kündige das Abonnement zunächst über Stripe und warte, bis der bezahlte Zeitraum abgelaufen ist, bevor du ein neues Abonnement über den Apple App Store abschließt.",
    };
  }
  if (active.stripe && requestedProvider === "stripe") {
    return {
      allowed: false,
      code: "ACTIVE_STRIPE_SUBSCRIPTION",
      message: "Dein Abonnement wird bereits über Stripe verwaltet. Führe Upgrades, Downgrades oder Kündigungen über die Abo-Verwaltung durch, damit kein zweites Abonnement entsteht.",
      action: "manage_stripe",
    };
  }
  return { allowed: true };
}