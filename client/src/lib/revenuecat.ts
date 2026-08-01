import { Capacitor } from '@capacitor/core';
import { Purchases } from '@revenuecat/purchases-capacitor';

let isInitialized = false;

function getPurchases() {
  return Purchases;
}

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`RC_TIMEOUT: ${label} nach ${ms / 1000}s`)), ms)
    ),
  ]);
}

export async function initRevenueCat(familyName: string): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  if (isInitialized) return;

  const apiKey = import.meta.env.VITE_REVENUECAT_IOS_KEY as string | undefined;
  if (!apiKey) {
    console.warn('[RevenueCat] VITE_REVENUECAT_IOS_KEY not set — skipping init');
    return;
  }

  // configure() is fire-and-forget on iOS — the native SDK initialises
  // synchronously; awaiting the returned promise causes an indefinite hang.
  // usesStoreKit2IfAvailable:false forces StoreKit 1 which avoids known SK2
  // timing hangs in WKWebView / Capacitor environments.
  try {
    Purchases.configure({
      apiKey,
      appUserID: familyName,
      usesStoreKit2IfAvailable: false,
    });
  } catch (err) {
    console.error('[RevenueCat] configure() threw:', err);
  }
  isInitialized = true;
  console.log('[RevenueCat] Initialized (fire-and-forget) for family:', familyName);
}

export async function getRCOfferings() {
  if (!Capacitor.isNativePlatform() || !isInitialized) return null;
  try {
    const Purchases = await getPurchases();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result: any = await withTimeout(Purchases.getOfferings() as any, 5_000, 'getOfferings');
    return result.offerings ?? result ?? null;
  } catch (err) {
    console.error('[RevenueCat] getOfferings failed:', err);
    return null;
  }
}

export async function purchaseRCPackage(pkg: any) {
  if (!isInitialized) {
    console.error('[RevenueCat] purchaseRCPackage called but SDK not initialized');
    throw new Error('RevenueCat not initialized');
  }
  const Purchases = await getPurchases();
  console.log('[RevenueCat] purchasePackage start — product:', pkg?.storeProduct?.productIdentifier ?? pkg?.product?.productIdentifier ?? pkg?.identifier);

  const timeout = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error('Kauf-Zeitüberschreitung. Bitte versuche es erneut.')), 60_000)
  );
  const result = await Promise.race([
    Purchases.purchasePackage({ aPackage: pkg }),
    timeout,
  ]);
  console.log('[RevenueCat] purchasePackage success');
  return (result as Awaited<ReturnType<typeof Purchases.purchasePackage>>).customerInfo;
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

/**
 * Returns true if the given entitlement is active and is a lifetime (non-renewing)
 * purchase — identified by a null expirationDate from RevenueCat.
 */
export function isLifetimeEntitlement(customerInfo: any, entitlementId: string): boolean {
  const ent = customerInfo?.entitlements?.active?.[entitlementId];
  if (!ent?.isActive) return false;
  // RevenueCat sets expirationDate to null for non-renewing (lifetime) products
  return ent.expirationDate === null || ent.expirationDate === undefined;
}

export function getPackagePrice(pkg: any): string {
  return pkg?.storeProduct?.priceString ?? pkg?.product?.priceString ?? '';
}
