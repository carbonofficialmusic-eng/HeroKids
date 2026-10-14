import { and, eq, gt, isNotNull, sql } from "drizzle-orm";
import { families } from "@workspace/db";
import { db } from "./db";

/**
 * Give active trials started under the old seven-day rule their full 14 days.
 * Only the exact legacy duration qualifies; expired trials must not reopen.
 * The selection lock, if confirmed for that trial, must end on the same day.
 */
export async function extendActiveLegacyFamilyTrials(familyName?: string): Promise<number> {
  const extended = await db.update(families).set({
    trialEndsAt: sql`${families.trialStartedAt} + interval '14 days'`,
    memberSelectionLockedUntil: sql`CASE
      WHEN ${families.memberSelectionScope} = 'trial'
        AND ${families.memberSelectionLockedUntil} = ${families.trialEndsAt}
      THEN ${families.trialStartedAt} + interval '14 days'
      ELSE ${families.memberSelectionLockedUntil}
    END`,
    updatedAt: new Date(),
  }).where(and(
    eq(families.subscriptionTier, "free"),
    isNotNull(families.trialStartedAt),
    gt(families.trialEndsAt, new Date()),
    sql`${families.trialEndsAt} = ${families.trialStartedAt} + interval '7 days'`,
    familyName ? eq(families.familyName, familyName) : undefined,
  )).returning({ familyName: families.familyName });
  return extended.length;
}