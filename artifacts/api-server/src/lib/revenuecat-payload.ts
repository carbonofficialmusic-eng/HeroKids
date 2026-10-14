export type RevenueCatEntitlement = {
  expires_date?: string | null;
  product_identifier?: string;
};

export type RevenueCatSubscription = {
  expires_date?: string | null;
  purchase_date?: string;
  unsubscribe_detected_at?: string | null;
};

export type VerifiedRevenueCatPayload = Record<string, unknown> & {
  subscriber: Record<string, unknown> & {
    entitlements: Record<string, RevenueCatEntitlement>;
    subscriptions: Record<string, RevenueCatSubscription>;
  };
};

export class RevenueCatVerificationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RevenueCatVerificationError";
  }
}

export function isRevenueCatVerificationError(error: unknown): error is RevenueCatVerificationError {
  return error instanceof RevenueCatVerificationError;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readExpiry(value: unknown, label: string, required: boolean, strict: boolean): string | null | undefined {
  if (value === null) return null;
  if (typeof value === "string") {
    if (Number.isFinite(Date.parse(value)) || !strict) return value;
  }
  if (value === undefined && !required) return undefined;
  if (strict) throw new RevenueCatVerificationError(`RevenueCat ${label} has no verifiable expiration`);
  return undefined;
}

function readEntitlements(payload: unknown, strict: boolean): Record<string, RevenueCatEntitlement> {
  const rawEntitlements = getRevenueCatSubscriber(payload)?.entitlements;
  if (!isRecord(rawEntitlements)) {
    if (strict) throw new RevenueCatVerificationError("RevenueCat entitlements are missing or malformed");
    return {};
  }

  return Object.fromEntries(Object.entries(rawEntitlements).map(([id, value]) => {
    if (!isRecord(value)) {
      if (strict) throw new RevenueCatVerificationError(`RevenueCat entitlement ${id} is malformed`);
      return [id, {}];
    }
    const requireVerifiableExpiry = strict && (id === "family" || id === "family_pro");
    const expires_date = readExpiry(value.expires_date, `entitlement ${id}`, requireVerifiableExpiry, requireVerifiableExpiry);
    const product_identifier = typeof value.product_identifier === "string"
      ? value.product_identifier
      : undefined;
    return [id, { expires_date, product_identifier }];
  }));
}

function readSubscriptions(payload: unknown, strict: boolean): Record<string, RevenueCatSubscription> {
  const rawSubscriptions = getRevenueCatSubscriber(payload)?.subscriptions;
  if (!isRecord(rawSubscriptions)) {
    if (strict) throw new RevenueCatVerificationError("RevenueCat subscriptions are missing or malformed");
    return {};
  }

  return Object.fromEntries(Object.entries(rawSubscriptions).map(([id, value]) => {
    if (!isRecord(value)) {
      if (strict) throw new RevenueCatVerificationError(`RevenueCat subscription ${id} is malformed`);
      return [id, {}];
    }
    const expires_date = readExpiry(value.expires_date, `subscription ${id}`, strict, strict);
    const purchase_date = typeof value.purchase_date === "string" ? value.purchase_date : undefined;
    const unsubscribe_detected_at = value.unsubscribe_detected_at === null ||
      typeof value.unsubscribe_detected_at === "string"
      ? value.unsubscribe_detected_at
      : undefined;
    return [id, { expires_date, purchase_date, unsubscribe_detected_at }];
  }));
}

export function getRevenueCatSubscriber(payload: unknown): Record<string, unknown> | null {
  if (!isRecord(payload) || !isRecord(payload.subscriber)) return null;
  return payload.subscriber;
}

export function getRevenueCatEntitlements(payload: unknown): Record<string, RevenueCatEntitlement> {
  return readEntitlements(payload, false);
}

export function getRevenueCatSubscriptions(payload: unknown): Record<string, RevenueCatSubscription> {
  return readSubscriptions(payload, false);
}

export function getRevenueCatNonSubscriptions(payload: unknown): Record<string, unknown> | null {
  const nonSubscriptions = getRevenueCatSubscriber(payload)?.non_subscriptions;
  return isRecord(nonSubscriptions) ? nonSubscriptions : null;
}

export function requireVerifiedRevenueCatPayload(payload: unknown): VerifiedRevenueCatPayload {
  const subscriber = getRevenueCatSubscriber(payload);
  if (!subscriber) {
    throw new RevenueCatVerificationError("RevenueCat subscriber response is missing or malformed");
  }
  const entitlements = readEntitlements(payload, true);
  const subscriptions = readSubscriptions(payload, true);
  const root = isRecord(payload) ? payload : {};
  return {
    ...root,
    subscriber: {
      ...subscriber,
      entitlements,
      subscriptions,
    },
  };
}

export async function withVerifiedRevenueCatPayload<T>(
  payload: unknown,
  action: (verifiedPayload: VerifiedRevenueCatPayload) => T | Promise<T>,
): Promise<T> {
  return action(requireVerifiedRevenueCatPayload(payload));
}

export function isRevenueCatEntitlementActive(
  entitlement: RevenueCatEntitlement | undefined,
  now: Date = new Date(),
): boolean {
  return entitlement !== undefined &&
    (entitlement.expires_date === null ||
      (typeof entitlement.expires_date === "string" && new Date(entitlement.expires_date) > now));
}

export function resolveRevenueCatSyncVerification(
  activeServerEntitlement: boolean,
  verifiedServerSubscription: boolean,
  clientClaimsConfirmed: boolean,
): "verified" | "retry" | "inactive" {
  if (activeServerEntitlement || verifiedServerSubscription) return "verified";
  return clientClaimsConfirmed ? "retry" : "inactive";
}