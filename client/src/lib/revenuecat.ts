import { Capacitor } from '@capacitor/core';

let isInitialized = false;

async function getPurchases() {
  const { Purchases } = await import('@revenuecat/purchases-capacitor');
  return Purchases;
}

export async function initRevenueCat(familyName: string): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  if (isInitialized) return;

  const apiKey = import.meta.env.VITE_REVENUECAT_IOS_KEY as string | undefined;
  if (!apiKey) {
    console.warn('[RevenueCat] VITE_REVENUECAT_IOS_KEY not set — skipping init');
    return;
  }

  try {
    const Purchases = await getPurchases();
    await Purchases.configure({ apiKey, appUserID: familyName });
    isInitialized = true;
    console.log('[RevenueCat] Initialized for family:', familyName);
  } catch (err) {
    console.error('[RevenueCat] Init failed:', err);
  }
}

export async function getRCOfferings() {
  if (!Capacitor.isNativePlatform() || !isInitialized) return null;
  const Purchases = await getPurchases();
  const result = await Purchases.getOfferings();
  return result.offerings;
}

export async function purchaseRCPackage(pkg: any) {
  const Purchases = await getPurchases();
  const result = await Purchases.purchasePackage({ aPackage: pkg });
  return result.customerInfo;
}

export async function restoreRCPurchases() {
  const Purchases = await getPurchases();
  const result = await Purchases.restorePurchases();
  return result.customerInfo;
}

export async function getRCCustomerInfo() {
  if (!Capacitor.isNativePlatform() || !isInitialized) return null;
  const Purchases = await getPurchases();
  const result = await Purchases.getCustomerInfo();
  return result.customerInfo;
}

export function getEntitlementTier(customerInfo: any): string | null {
  const active = customerInfo?.entitlements?.active;
  if (!active) return null;
  if (active['family_pro']?.isActive) return 'family_hero';
  if (active['family']?.isActive) return 'family';
  return null;
}

export function getPackagePrice(pkg: any): string {
  return pkg?.storeProduct?.priceString ?? pkg?.product?.priceString ?? '';
}
