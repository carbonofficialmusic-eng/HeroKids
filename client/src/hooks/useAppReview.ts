import { useState, useEffect } from 'react';
import { Capacitor, registerPlugin } from '@capacitor/core';

interface AppReviewPluginInterface {
  requestReview(): Promise<void>;
}

const AppReviewPlugin = registerPlugin<AppReviewPluginInterface>('AppReviewPlugin');

export const PAID_SINCE_KEY = 'herokids_paid_since';
export const REVIEW_REQUESTED_KEY = 'herokids_review_requested';
export const DAYS_THRESHOLD = 30;

/**
 * Pure eligibility check — exported for testing.
 * Returns { eligible: true } when the review dialog should be shown,
 * or { eligible: false, startTimer: true } when the 30-day timer should begin.
 *
 * The flag gates only the prompt and timer start, NOT `recordPaidSince`.
 * `recordPaidSince` runs unconditionally so that enabling the flag later
 * still counts time the user was already on a paid tier.
 */
export function isReviewEligible({
  flagEnabled,
  isParent,
  subscriptionTier,
  reviewRequested,
  paidSinceIso,
  nowMs = Date.now(),
}: {
  flagEnabled: boolean;
  isParent: boolean;
  subscriptionTier: string | undefined;
  reviewRequested: boolean;
  paidSinceIso: string | null;
  nowMs?: number;
}): { eligible: boolean; startTimer?: boolean } {
  if (!flagEnabled) return { eligible: false };
  if (!isParent) return { eligible: false };
  if (!subscriptionTier || subscriptionTier === 'free') return { eligible: false };
  if (reviewRequested) return { eligible: false };
  if (!paidSinceIso) return { eligible: false, startTimer: true };
  const paidSince = new Date(paidSinceIso);
  if (isNaN(paidSince.getTime())) return { eligible: false };
  const daysPaid = (nowMs - paidSince.getTime()) / (1000 * 60 * 60 * 24);
  return { eligible: daysPaid >= DAYS_THRESHOLD };
}

/**
 * Records the date when a user first enters a paid tier.
 * Always runs regardless of the feature flag so the clock starts ticking
 * the moment the user purchases — even if the prompt is currently disabled.
 * Call immediately after a successful iOS purchase.
 */
export function recordPaidSince(): void {
  try {
    if (!localStorage.getItem(PAID_SINCE_KEY)) {
      localStorage.setItem(PAID_SINCE_KEY, new Date().toISOString());
    }
  } catch {
    // localStorage unavailable — silently ignore
  }
}

/**
 * Triggers the native iOS App Store review dialog once the user
 * has been on a paid tier for ≥30 days, and only when the
 * `review_prompt_enabled` feature flag is on in the admin panel.
 *
 * Rules:
 * - Only fires on iOS (not Android or web)
 * - Only for parents on paid tiers
 * - Feature flag is read from /api/feature-flags on every mount
 * - The 30-day timer (recordPaidSince) runs independently of the flag
 * - REVIEW_REQUESTED_KEY is set only after the native call resolves successfully
 * - iOS itself throttles the dialog to max 3× per year regardless
 */
export function useAppReview({
  subscriptionTier,
  isParent,
}: {
  subscriptionTier: string | undefined;
  isParent: boolean;
}) {
  const [flagEnabled, setFlagEnabled] = useState<boolean | null>(null);

  // Step 1: fetch the feature flag — runs once on mount
  useEffect(() => {
    fetch('/api/feature-flags')
      .then((r) => r.json())
      .then((data) => setFlagEnabled(data.review_prompt_enabled === true))
      .catch(() => setFlagEnabled(false));
  }, []);

  // Step 2: once flag is known, run the eligibility check
  useEffect(() => {
    // iOS only — Android has no AppReviewPlugin
    if (Capacitor.getPlatform() !== 'ios') return;
    if (flagEnabled === null) return; // still fetching

    let paidSinceIso: string | null = null;
    let reviewRequested = false;
    try {
      paidSinceIso = localStorage.getItem(PAID_SINCE_KEY);
      reviewRequested = !!localStorage.getItem(REVIEW_REQUESTED_KEY);
    } catch { /* ignore */ }

    const { eligible, startTimer } = isReviewEligible({
      flagEnabled,
      isParent,
      subscriptionTier,
      reviewRequested,
      paidSinceIso,
    });

    if (startTimer) {
      try { localStorage.setItem(PAID_SINCE_KEY, new Date().toISOString()); } catch { /* ignore */ }
      return;
    }

    if (!eligible) return;

    // All conditions met — request the review.
    // Only set the flag AFTER the native call resolves so a plugin error
    // doesn't permanently suppress the prompt without it ever showing.
    AppReviewPlugin.requestReview()
      .then(() => {
        try { localStorage.setItem(REVIEW_REQUESTED_KEY, '1'); } catch { /* ignore */ }
      })
      .catch((err) => {
        console.warn('[AppReview] requestReview failed:', err);
        // Do NOT set REVIEW_REQUESTED_KEY — let it retry on next launch
      });
  }, [flagEnabled, subscriptionTier, isParent]);
}
