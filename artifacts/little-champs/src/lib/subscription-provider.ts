import { apiRequest } from "@/lib/queryClient";

export async function assertSubscriptionPurchaseAllowed(provider: "apple" | "stripe"): Promise<void> {
  const response = await apiRequest("GET", `/api/subscription/purchase-eligibility?provider=${provider}`);
  const result = await response.json() as { allowed?: boolean; message?: string };
  if (!result.allowed) {
    throw new Error(result.message || "Dieses Abonnement muss beim bisherigen Anbieter verwaltet werden.");
  }
}

export async function openStripeSubscriptionManagement(): Promise<void> {
  const response = await apiRequest("POST", "/api/create-portal-session", {});
  const result = await response.json() as { url?: string };
  if (!result.url) throw new Error("Die Stripe-Aboverwaltung konnte nicht geöffnet werden.");
  window.location.href = result.url;
}