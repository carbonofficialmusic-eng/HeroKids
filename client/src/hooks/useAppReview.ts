import { useEffect } from 'react';
import { registerPlugin } from '@capacitor/core';
import { isNativePlatform } from '@/lib/platform';

interface AppReviewPluginInterface {
  requestReview(): Promise<void>;
}

const AppReviewPlugin = registerPlugin<AppReviewPluginInterface>('AppReviewPlugin');

const PAID_SINCE_KEY = 'herokids_paid_since';
const REVIEW_REQUESTED_KEY = 'herokids_review_requested';
const DAYS_THRESHOLD = 30;

/**
 * Records the date when a user first enters a paid tier.
 * Call this immediately after a successful iOS purchase.
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
 * has been on a paid tier (family or family_hero) for ≥30 days.
 *
 * Rules:
 * - Only fires on native iOS
 * - Only for parents
 * - Only for paid tiers
 * - Only once per device (localStorage flag)
 * - iOS itself throttles the dialog to max 3× per year regardless
 */
export function useAppReview({
  subscriptionTier,
  isParent,
}: {
  subscriptionTier: string | undefined;
  isParent: boolean;
}) {
  useEffect(() => {
    if (!isNativePlatform()) return;
    if (!isParent) return;
    if (!subscriptionTier || subscriptionTier === 'free') return;

    try {
      // Already requested once — never show again on this device
      if (localStorage.getItem(REVIEW_REQUESTED_KEY)) return;

      const rawDate = localStorage.getItem(PAID_SINCE_KEY);
      if (!rawDate) {
        // First time we see a paid user: start the 30-day timer.
        // Use recordPaidSince() so we don't overwrite an existing value.
        localStorage.setItem(PAID_SINCE_KEY, new Date().toISOString());
        return;
      }

      const paidSince = new Date(rawDate);
      if (isNaN(paidSince.getTime())) return;

      const daysPaid = (Date.now() - paidSince.getTime()) / (1000 * 60 * 60 * 24);
      if (daysPaid < DAYS_THRESHOLD) return;

      // All conditions met — request the review and mark as done
      localStorage.setItem(REVIEW_REQUESTED_KEY, '1');
      AppReviewPlugin.requestReview().catch((err) => {
        console.warn('[AppReview] requestReview failed:', err);
      });
    } catch {
      // Silently ignore localStorage or plugin errors
    }
  }, [subscriptionTier, isParent]);
}
