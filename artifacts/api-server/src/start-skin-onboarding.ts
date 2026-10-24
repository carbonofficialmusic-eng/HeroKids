import { and, eq } from "drizzle-orm";
import { familyMembers, starPlacements, tasks, taskAssignments, shoppingListItems, type InsertTask } from "@workspace/db";
import { db } from "./db";
import { assertStartChoice, createStartStarPositions } from "./start-skin-policy";
import { LEGACY_SKIN_ORDER, STARS_PER_LEGACY_AVATAR } from "./shared/skin-config";

/** Lock the profile, not the session: the free choice is shared by all devices. */
export async function chooseStartSkin(memberId: string, familyName: string, skinId: string) {
  return db.transaction(async tx => {
    const [member] = await tx.select().from(familyMembers)
      .where(and(eq(familyMembers.id, memberId), eq(familyMembers.familyName, familyName)))
      .for("update");
    if (!member || member.isPaused) throw new Error("MEMBER_UNAVAILABLE");
    assertStartChoice(member, skinId);
    // A retry must not re-equip after the user subsequently changed appearance.
    if (member.startCompletedAt) return { member, starFound: false, legacySkinAwarded: null };
    const existing = await tx.select().from(starPlacements).where(eq(starPlacements.memberId, memberId));
    // Older pending profiles may not have a board yet. Never reroll an
    // existing board or remove stars from the two unchosen preview cards.
    if (!existing.length) {
      await tx.insert(starPlacements).values(createStartStarPositions()
        .map(id => ({ memberId, skinId: id, found: false })));
    }
    const now = new Date();
    const found = await tx.update(starPlacements).set({ found: true, foundAt: now })
      .where(and(eq(starPlacements.memberId, memberId), eq(starPlacements.skinId, skinId), eq(starPlacements.found, false)))
      .returning();
    const starsFound = member.starsFound + (found.length ? 1 : 0);
    const earnedLegacySkinIds = [...(member.earnedLegacySkinIds || [])];
    let legacySkinAwarded: string | null = null;
    if (found.length && starsFound % STARS_PER_LEGACY_AVATAR === 0) {
      const legacyId = LEGACY_SKIN_ORDER[Math.floor(starsFound / STARS_PER_LEGACY_AVATAR) - 1];
      if (legacyId && !earnedLegacySkinIds.includes(legacyId)) {
        earnedLegacySkinIds.push(legacyId);
        legacySkinAwarded = legacyId;
      }
    }
    const [updated] = await tx.update(familyMembers).set({
      freeStarterSkinId: skinId,
      discoveredSkinIds: [...new Set([...(member.discoveredSkinIds || []), skinId])],
      activeSkinId: skinId,
      starsFound,
      earnedLegacySkinIds,
      useThemeBackground: true,
      useCustomAvatar: false,
      startCompletedAt: now,
      updatedAt: now,
    }).where(eq(familyMembers.id, memberId)).returning();
    return { member: updated, starFound: found.length > 0, legacySkinAwarded };
  });
}

/** Persist the first task and unlock together. A parallel/retried request returns
 * the already-created task rather than creating another onboarding task. */
export async function createFirstStartTask(
  memberId: string, taskData: InsertTask, assignedIds: string[], shoppingItems: unknown,
) {
  return db.transaction(async tx => {
    const [member] = await tx.select().from(familyMembers)
      .where(eq(familyMembers.id, memberId)).for("update");
    if (!member || member.role !== "parent" || member.familyName !== taskData.familyName || member.isPaused) {
      throw new Error("MEMBER_UNAVAILABLE");
    }
    if (member.firstTaskCreatedAt) {
      const [existing] = await tx.select().from(tasks)
        .where(and(eq(tasks.createdBy, memberId), eq(tasks.familyName, member.familyName)))
        .orderBy(tasks.createdAt).limit(1);
      if (existing) return existing;
      throw new Error("FIRST_TASK_ALREADY_CREATED");
    }
    const [task] = await tx.insert(tasks).values(taskData).returning();
    if (assignedIds.length) await tx.insert(taskAssignments)
      .values(assignedIds.map(id => ({ taskId: task.id, memberId: id })));
    if (taskData.isShoppingList && Array.isArray(shoppingItems)) {
      const items = shoppingItems
        .filter(item => item && typeof item.text === "string" && item.text.trim())
        .map((item, index) => ({
          taskId: task.id, text: item.text.trim(), sortOrder: index,
          completedByMemberId: null, completedAt: null,
        }));
      if (items.length) await tx.insert(shoppingListItems).values(items);
    }
    await tx.update(familyMembers).set({ firstTaskCreatedAt: new Date() })
      .where(eq(familyMembers.id, memberId));
    return task;
  });
}
