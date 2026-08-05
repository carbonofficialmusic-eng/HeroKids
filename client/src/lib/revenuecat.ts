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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (Purchases as any).configure({
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

// Known product IDs — getProducts() fetches these directly from StoreKit,
// bypassing RC's server-side getOfferings() which hangs in WKWebView/Capacitor.
const KNOWN_PRODUCT_IDS = [
  'com.herokids.family.monthly',
  'com.herokids.family.yearly',
  'com.herokids.familypro.monthly',
  'com.herokids.familypro.yearly',
];

export async function getRCProducts(): Promise<Record<string, any> | null> {
  if (!Capacitor.isNativePlatform() || !isInitialized) return null;
  try {
    const result = await Purchases.getProducts({ productIdentifiers: KNOWN_PRODUCT_IDS });
    const map: Record<string, any> = {};
    for (const product of result.products ?? []) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const id = (product as any).identifier ?? (product as any).productIdentifier;
      if (id) map[id] = product;
    }
    console.log('[RevenueCat] getProducts OK:', Object.keys(map).join(', '));
    return Object.keys(map).length > 0 ? map : null;
  } catch (err) {
    console.error('[RevenueCat] getProducts failed:', err);
    return null;
  }
}

export async function purchaseRCStoreProduct(product: any): Promise<any> {
  if (!isInitialized) {
    console.error('[RevenueCat] purchaseRCStoreProduct called but SDK not initialized');
    throw new Error('RevenueCat not initialized');
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const id = (product as any)?.identifier ?? '?';
  console.log('[RevenueCat] purchaseStoreProduct start — product:', id);

  let timedOut = false;
  const timerPromise = new Promise<never>((_, reject) =>
    setTimeout(() => { timedOut = true; reject(new Error('Kauf-Zeitüberschreitung. Bitte versuche es erneut.')); }, 60_000)
  );
  const result = await Promise.race([
    Purchases.purchaseStoreProduct({ product }),
    timerPromise,
  ]);
  if (timedOut) throw new Error('Kauf-Zeitüberschreitung. Bitte versuche es erneut.');
  console.log('[RevenueCat] purchaseStoreProduct success');
  return (result as any).customerInfo;
}

/** @deprecated Use purchaseRCStoreProduct instead */
export async function purchaseRCPackage(pkg: any) {
  // Fallback: try to extract the store product and use purchaseStoreProduct
  const product = pkg?.storeProduct ?? pkg?.product;
  if (product) return purchaseRCStoreProduct(product);
  throw new Error('purchaseRCPackage: no storeProduct found on package');
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

/**
 * Returns the free-trial intro offer for a StoreKit product, or null if none.
 * Only returns an offer when price === 0 (true free trial, not discounted intro).
 */
export function getIntroductoryOffer(product: any): { periodDays: number } | null {
  const intro = product?.introductoryPrice;
  if (!intro) return null;
  if (intro.price !== 0 && intro.price !== '0' && intro.price !== 0.0) return null;
  let days: number = intro.periodNumberOfUnits ?? 7;
  const unit: string = (intro.periodUnit ?? '').toUpperCase();
  if (unit === 'WEEK') days = days * 7;
  else if (unit === 'MONTH') days = days * 30;
  else if (unit === 'YEAR') days = days * 365;
  return { periodDays: days };
}
