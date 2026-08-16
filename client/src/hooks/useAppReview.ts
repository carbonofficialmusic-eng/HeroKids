import { useState, useEffect } from 'react';
import { Capacitor, registerPlugin } from '@capacitor/core';

interface AppReviewPluginInterface {
  requestReview(): Promise<void>;
}

const AppReviewPlugin = registerPlugin<AppReviewPluginInterface>('AppReviewPlugin');

const PAID_SINCE_KEY = 'herokids_paid_since';
const REVIEW_REQUESTED_KEY = 'herokids_review_requested';
const DAYS_THRESHOLD = 30;

/**
 * Module-level cache so recordPaidSince() can check the flag
 * without its own async fetch. Set to `true` only after the
 * hook has confirmed review_prompt_enabled from the server.
 */
let cachedFlagEnabled = false;

/**
 * Records the date when a user first enters a paid tier.
 * No-op when the review prompt feature flag is disabled.
 * Call this immediately after a successful iOS purchase.
 */
export function recordPaidSince(): void {
  if (!cachedFlagEnabled) return;
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
 * has been on a paid tier for ≥30 days, but only when the
 * `review_prompt_enabled` feature flag is on in the admin panel.
 *
 * Rules:
 * - Only fires on iOS (not Android or web)
 * - Only for parents on paid tiers
 * - Feature flag is read from /api/feature-flags on every mount
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

  // Step 1: fetch the feature flag from the server
  useEffect(() => {
    fetch('/api/feature-flags')
      .then((r) => r.json())
      .then((data) => {
        const enabled = data.review_prompt_enabled === true;
        cachedFlagEnabled = enabled;
        setFlagEnabled(enabled);
      })
      .catch(() => {
        cachedFlagEnabled = false;
        setFlagEnabled(false);
      });
  }, []);

  // Step 2: once the flag is known, run the 30-day check
  useEffect(() => {
    // iOS only — Android has no AppReviewPlugin
    if (Capacitor.getPlatform() !== 'ios') return;
    if (flagEnabled === null) return; // still fetching
    if (!flagEnabled) return;        // disabled by admin
    if (!isParent) return;
    if (!subscriptionTier || subscriptionTier === 'free') return;

    try {
      // Already requested once on this device — never show again
      if (localStorage.getItem(REVIEW_REQUESTED_KEY)) return;

      const rawDate = localStorage.getItem(PAID_SINCE_KEY);
      if (!rawDate) {
        // First time we see a paid user: start the 30-day timer.
        localStorage.setItem(PAID_SINCE_KEY, new Date().toISOString());
        return;
      }

      const paidSince = new Date(rawDate);
      if (isNaN(paidSince.getTime())) return;

      const daysPaid = (Date.now() - paidSince.getTime()) / (1000 * 60 * 60 * 24);
      if (daysPaid < DAYS_THRESHOLD) return;

      // All conditions met — request the review.
      // Only set the flag AFTER the native call resolves so a plugin error
      // doesn't permanently suppress the prompt without it ever showing.
      AppReviewPlugin.requestReview()
        .then(() => {
          try {
            localStorage.setItem(REVIEW_REQUESTED_KEY, '1');
          } catch { /* ignore */ }
        })
        .catch((err) => {
          console.warn('[AppReview] requestReview failed:', err);
          // Do NOT set REVIEW_REQUESTED_KEY — let it retry on next launch
        });
    } catch {
      // Silently ignore localStorage errors
    }
  }, [flagEnabled, subscriptionTier, isParent]);
}
