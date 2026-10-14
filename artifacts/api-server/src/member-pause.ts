import { and, eq, inArray } from "drizzle-orm";
import { families, familyMembers } from "@workspace/db";
import { getMaxMembersForFamily } from "@shared/tier-config";
import { getLockedSelection, getSelectionLockEnd, getSelectionScope } from "@shared/member-selection";
import { db } from "./db";

/**
 * Pause or reactivate an existing member. Lock the family row so concurrent
 * reactivations cannot both claim the final available active-member slot.
 * Authorization (parent and family membership) is checked by the route.
 */
export async function setMemberPausedWithinLimit(familyName: string, targetId: string, isPaused: boolean) {
  return db.transaction(async (tx) => {
    const [family] = await tx.select().from(families)
      .where(eq(families.familyName, familyName)).for("update");
    if (!family) return { kind: "missing" } as const;

    const [target] = await tx.select().from(familyMembers)
      .where(eq(familyMembers.id, targetId));
    if (!target || target.familyName !== familyName) return { kind: "missing" } as const;

    const lockedIds = getLockedSelection(family);
    if (!lockedIds && getSelectionScope(family)) {
      const existing = await tx.select({ id: familyMembers.id }).from(familyMembers)
        .where(eq(familyMembers.familyName, familyName));
      if (existing.length > getMaxMembersForFamily(family)) {
        return { kind: "selection_required" } as const;
      }
    }
    if (!isPaused && target.isPaused && lockedIds && !lockedIds.includes(targetId)) {
      return { kind: "locked", until: family.memberSelectionLockedUntil! } as const;
    }

    if (!isPaused && target.isPaused) {
      const activeMembers = await tx.select({ id: familyMembers.id })
        .from(familyMembers)
        .where(and(eq(familyMembers.familyName, familyName), eq(familyMembers.isPaused, false)));
      const limit = getMaxMembersForFamily(family);
      if (activeMembers.length >= limit) return { kind: "limit", limit } as const;
    }

    const [updated] = await tx.update(familyMembers)
      .set({ isPaused, updatedAt: new Date() })
      .where(eq(familyMembers.id, targetId))
      .returning();
    return { kind: "updated", member: updated } as const;
  });
}

/** Commit the family's active seats in one transaction after the parent has reviewed the choice. */
export async function confirmMemberSelection(familyName: string, parentId: string, selectedIds: string[]) {
  return db.transaction(async (tx) => {
    const [family] = await tx.select().from(families)
      .where(eq(families.familyName, familyName)).for("update");
    if (!family) return { kind: "missing" } as const;
    const members = await tx.select().from(familyMembers).where(eq(familyMembers.familyName, familyName));
    const limit = getMaxMembersForFamily(family);
    const scope = getSelectionScope(family);
    if (!scope || members.length <= limit) return { kind: "not_needed" } as const;
    if (getLockedSelection(family)) {
      return { kind: "locked", until: family.memberSelectionLockedUntil! } as const;
    }
    const unique = new Set(selectedIds);
    if (unique.size !== limit || selectedIds.length !== limit ||
        !unique.has(parentId) || selectedIds.some(id => !members.some(m => m.id === id))) {
      return { kind: "invalid", limit } as const;
    }

    await tx.update(familyMembers).set({ isPaused: true, updatedAt: new Date() })
      .where(eq(familyMembers.familyName, familyName));
    await tx.update(familyMembers).set({ isPaused: false, updatedAt: new Date() })
      .where(and(eq(familyMembers.familyName, familyName), inArray(familyMembers.id, selectedIds)));
    const until = getSelectionLockEnd(family);
    await tx.update(families).set({
      memberSelectionIds: selectedIds,
      memberSelectionScope: scope,
      memberSelectionLockedUntil: until,
      updatedAt: new Date(),
    }).where(eq(families.familyName, familyName));
    return { kind: "confirmed", until } as const;
  });
}

/** When the final seat is filled, reserve the identities without making parents confirm an obvious choice. */
export async function reserveFullMemberSelection(familyName: string, beforeDeletion = false) {
  return db.transaction(async (tx) => {
    const [family] = await tx.select().from(families)
      .where(eq(families.familyName, familyName)).for("update");
    if (!family) return;
    const scope = getSelectionScope(family);
    if (!scope || getLockedSelection(family)) return;
    // An expired lock intentionally permits a replacement. The new set is
    // reserved when the replacement is created, not before the old one is deleted.
    if (beforeDeletion && family.memberSelectionScope === scope) return;
    const limit = getMaxMembersForFamily(family);
    const members = await tx.select({ id: familyMembers.id }).from(familyMembers)
      .where(eq(familyMembers.familyName, familyName));
    if (members.length !== limit) return; // Overflow requires an explicit parental choice.
    await tx.update(families).set({
      memberSelectionIds: members.map(m => m.id),
      memberSelectionScope: scope,
      memberSelectionLockedUntil: getSelectionLockEnd(family),
      updatedAt: new Date(),
    }).where(eq(families.familyName, familyName));
  });
}