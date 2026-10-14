/**
 * Tests for useAppReview hook helpers:
 * - recordPaidSince: always writes the paid-since timestamp (flag-independent)
 * - isReviewEligible: pure eligibility check covering all gate conditions
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  recordPaidSince,
  isReviewEligible,
  PAID_SINCE_KEY,
  REVIEW_REQUESTED_KEY,
  DAYS_THRESHOLD,
} from "../hooks/useAppReview";

// ---------------------------------------------------------------------------
// localStorage mock
// ---------------------------------------------------------------------------

const store: Record<string, string> = {};
const localStorageMock = {
  getItem: (k: string) => store[k] ?? null,
  setItem: (k: string, v: string) => { store[k] = v; },
  removeItem: (k: string) => { delete store[k]; },
  clear: () => { for (const k of Object.keys(store)) delete store[k]; },
};

beforeEach(() => {
  localStorageMock.clear();
  Object.defineProperty(global, "localStorage", {
    value: localStorageMock,
    writable: true,
    configurable: true,
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// recordPaidSince — must always write regardless of feature flag state
// ---------------------------------------------------------------------------

describe("recordPaidSince", () => {
  it("writes PAID_SINCE_KEY on first call", () => {
    recordPaidSince();
    expect(localStorage.getItem(PAID_SINCE_KEY)).not.toBeNull();
  });

  it("does not overwrite an existing date on subsequent calls", () => {
    const existing = "2026-01-01T00:00:00.000Z";
    localStorage.setItem(PAID_SINCE_KEY, existing);
    recordPaidSince();
    expect(localStorage.getItem(PAID_SINCE_KEY)).toBe(existing);
  });

  it("writes even when the feature flag cache would be false (unconditional)", () => {
    // Simulate the scenario: user buys while feature flag is disabled.
    // recordPaidSince must still write so the clock starts.
    // (No cachedFlagEnabled guard in the implementation)
    recordPaidSince();
    const written = localStorage.getItem(PAID_SINCE_KEY);
    expect(written).not.toBeNull();
    expect(() => new Date(written!)).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// isReviewEligible — pure function, covers all gate conditions
// ---------------------------------------------------------------------------

const THIRTY_ONE_DAYS_MS = (DAYS_THRESHOLD + 1) * 24 * 60 * 60 * 1000;
const TWENTY_NINE_DAYS_MS = (DAYS_THRESHOLD - 1) * 24 * 60 * 60 * 1000;

const nowMs = Date.now();
const paidLongAgo = new Date(nowMs - THIRTY_ONE_DAYS_MS).toISOString();
const paidRecently = new Date(nowMs - TWENTY_NINE_DAYS_MS).toISOString();

const base = {
  flagEnabled: true,
  isParent: true,
  subscriptionTier: "family_hero",
  reviewRequested: false,
  paidSinceIso: paidLongAgo,
  nowMs,
};

describe("isReviewEligible — feature flag gate", () => {
  it("returns ineligible when flag is disabled", () => {
    expect(isReviewEligible({ ...base, flagEnabled: false }).eligible).toBe(false);
  });

  it("returns eligible when flag is enabled and all conditions met", () => {
    expect(isReviewEligible(base).eligible).toBe(true);
  });
});

describe("isReviewEligible — role and tier gate", () => {
  it("returns ineligible for non-parents", () => {
    expect(isReviewEligible({ ...base, isParent: false }).eligible).toBe(false);
  });

  it("returns ineligible for free tier", () => {
    expect(isReviewEligible({ ...base, subscriptionTier: "free" }).eligible).toBe(false);
  });

  it("returns ineligible when subscriptionTier is undefined", () => {
    expect(isReviewEligible({ ...base, subscriptionTier: undefined }).eligible).toBe(false);
  });

  it("is eligible for 'family' tier", () => {
    expect(isReviewEligible({ ...base, subscriptionTier: "family" }).eligible).toBe(true);
  });
});

describe("isReviewEligible — already-reviewed gate", () => {
  it("returns ineligible when review was already requested on this device", () => {
    expect(isReviewEligible({ ...base, reviewRequested: true }).eligible).toBe(false);
  });
});

describe("isReviewEligible — 30-day timer logic", () => {
  it("starts timer (startTimer=true) when paidSinceIso is null", () => {
    const result = isReviewEligible({ ...base, paidSinceIso: null });
    expect(result.eligible).toBe(false);
    expect(result.startTimer).toBe(true);
  });

  it("returns ineligible when user has been paid for fewer than 30 days", () => {
    const result = isReviewEligible({ ...base, paidSinceIso: paidRecently });
    expect(result.eligible).toBe(false);
    expect(result.startTimer).toBeFalsy();
  });

  it("returns eligible exactly at 31 days paid", () => {
    expect(isReviewEligible({ ...base, paidSinceIso: paidLongAgo }).eligible).toBe(true);
  });

  it("returns ineligible when paidSinceIso is an invalid date string", () => {
    expect(isReviewEligible({ ...base, paidSinceIso: "not-a-date" }).eligible).toBe(false);
  });
});

describe("isReviewEligible — enabling flag after user was already paid 30+ days", () => {
  it("is immediately eligible because recordPaidSince ran when disabled", () => {
    // Simulate: user paid 31 days ago while flag was off (recordPaidSince ran unconditionally),
    // admin enables flag today — should be immediately eligible.
    const result = isReviewEligible({
      flagEnabled: true,       // admin just enabled
      isParent: true,
      subscriptionTier: "family_hero",
      reviewRequested: false,
      paidSinceIso: paidLongAgo,  // date was written 31 days ago despite flag being off
      nowMs,
    });
    expect(result.eligible).toBe(true);
  });
});
