/**
 * Isolated development-database regression check:
 * pnpm --filter @workspace/scripts exec tsx --tsconfig ../artifacts/api-server/tsconfig.json ../artifacts/api-server/src/start-skin-onboarding.integration.ts
 * Creates only its own temporary family and removes it in finally.
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { families, familyMembers, starPlacements } from "@workspace/db";
import { db, pool } from "./db";
import { storage } from "./storage";
import { chooseStartSkin } from "./start-skin-onboarding";
import { LEGACY_SKIN_ORDER, MIXED_SKIN_ORDER, TOTAL_HIDDEN_STARS } from "./shared/skin-config";

if (process.env.NODE_ENV === "production") throw new Error("Development-only integration check");
const familyName = `StarterStars-${randomUUID()}`;

async function fixture(role: "parent" | "child") {
  const member = await storage.createFamilyMember({ familyName, displayName: `Star check ${role}`, role });
  assert.equal((await storage.getStarPlacementsByMember(member.id)).length, TOTAL_HIDDEN_STARS);
  if (role === "parent") {
    await assert.rejects(chooseStartSkin(member.id, familyName, member.startSkinOptions![0]), /FIRST_TASK_REQUIRED/);
    await db.update(familyMembers).set({ firstTaskCreatedAt: new Date() }).where(eq(familyMembers.id, member.id));
  }
  return member;
}

async function putStarsOnOffers(memberId: string, offers: string[]) {
  for (const skinId of offers) {
    const placements = await storage.getStarPlacementsByMember(memberId);
    if (!placements.some(p => p.skinId === skinId)) {
      const donor = placements.find(p => !offers.includes(p.skinId))!;
      await db.update(starPlacements).set({ skinId }).where(eq(starPlacements.id, donor.id));
    }
  }
}

try {
  await storage.createFamily({ familyName, joinCode: randomUUID().slice(0, 6).toUpperCase(), subscriptionTier: "free" });
  for (const role of ["parent", "child"] as const) {
    for (const hasStar of [true, false]) {
      const member = await fixture(role);
      const offers = member.startSkinOptions!;
      const chosen = offers[0];
      await putStarsOnOffers(member.id, offers);
      if (!hasStar) {
        const placements = await storage.getStarPlacementsByMember(member.id);
        const replacement = MIXED_SKIN_ORDER.find(id => !placements.some(p => p.skinId === id))!;
        await db.update(starPlacements).set({ skinId: replacement })
          .where(and(eq(starPlacements.memberId, member.id), eq(starPlacements.skinId, chosen)));
      }
      const before = await storage.getStarPlacementsByMember(member.id);
      // Two devices may confirm simultaneously: only one can find the star.
      const choices = await Promise.all([
        chooseStartSkin(member.id, familyName, chosen),
        chooseStartSkin(member.id, familyName, chosen),
      ]);
      assert.equal(choices.filter(choice => choice.starFound).length, hasStar ? 1 : 0);
      for (const choice of choices) {
        assert.equal(choice.member.starsFound, hasStar ? 1 : 0);
        assert.equal(choice.member.activeSkinId, chosen);
        assert.deepEqual(choice.member.discoveredSkinIds, [chosen]);
        assert.equal(choice.member.totalPoints, 0);
      }
      const after = await storage.getStarPlacementsByMember(member.id);
      assert.deepEqual(after.map(p => p.skinId).sort(), before.map(p => p.skinId).sort());
      assert.equal(after.filter(p => p.found).length, hasStar ? 1 : 0);
      for (const unchosen of offers.slice(1)) {
        assert.equal(after.find(p => p.skinId === unchosen)?.found, false);
      }
      await storage.initializeStarPlacements(member.id);
      await storage.fixMemberStars(member.id);
      const stats = await storage.getMemberStarStats(member.id);
      assert.equal(stats.starsFound, hasStar ? 1 : 0);
      assert.equal((await storage.getStarPlacementsByMember(member.id)).length, TOTAL_HIDDEN_STARS);
      await assert.rejects(chooseStartSkin(member.id, familyName, offers[1]), /START_ALREADY_COMPLETED/);
      // An unchosen offer still gives its star when discovered normally later.
      await storage.updateFamilyMember(member.id, { discoveredSkinIds: [chosen, offers[1]] });
      const later = await storage.markStarAsFound(member.id, offers[1]);
      assert.equal(later.wasStarFound, true);
      assert.equal(later.totalStarsFound, hasStar ? 2 : 1);
      console.log(`PASS ${role}: ${hasStar ? "starter star credited once" : "no invented starter star"}, board preserved, later offer credited`);
    }
  }
  const threshold = await fixture("child");
  await putStarsOnOffers(threshold.id, threshold.startSkinOptions!);
  const earlier = (await storage.getStarPlacementsByMember(threshold.id))
    .filter(p => !threshold.startSkinOptions!.includes(p.skinId)).slice(0, 3);
  for (const placement of earlier) {
    await db.update(starPlacements).set({ found: true, foundAt: new Date() }).where(eq(starPlacements.id, placement.id));
  }
  await db.update(familyMembers).set({ starsFound: 3 }).where(eq(familyMembers.id, threshold.id));
  const fourth = await chooseStartSkin(threshold.id, familyName, threshold.startSkinOptions![0]);
  assert.equal(fourth.member.starsFound, 4);
  assert.equal(fourth.legacySkinAwarded, LEGACY_SKIN_ORDER[0]);
  assert.deepEqual(fourth.member.earnedLegacySkinIds, [LEGACY_SKIN_ORDER[0]]);
  console.log("PASS fourth star awards Legacy through the same starter transaction");

  const older = await fixture("child");
  await db.delete(starPlacements).where(eq(starPlacements.memberId, older.id));
  const initialized = await chooseStartSkin(older.id, familyName, older.startSkinOptions![0]);
  const board = await storage.getStarPlacementsByMember(older.id);
  assert.equal(board.length, TOTAL_HIDDEN_STARS);
  assert.equal(initialized.member.starsFound, board.some(p => p.skinId === older.startSkinOptions![0]) ? 1 : 0);
  console.log("PASS older pending profile initializes a board without excluding the chosen hero");
} finally {
  const members = await db.select({ id: familyMembers.id }).from(familyMembers)
    .where(eq(familyMembers.familyName, familyName));
  for (const member of members) await db.delete(starPlacements).where(eq(starPlacements.memberId, member.id));
  await db.delete(familyMembers).where(eq(familyMembers.familyName, familyName));
  await db.delete(families).where(eq(families.familyName, familyName));
  await pool.end();
}
