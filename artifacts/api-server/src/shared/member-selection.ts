import { getMaxMembersForFamily } from "./tier-config";
import type { Family, FamilyMember } from "./schema";

type SelectionFamily = Pick<Family,
  "subscriptionTier" | "trialEndsAt" | "memberSelectionIds" | "memberSelectionScope" | "memberSelectionLockedUntil"
>;

export function getSelectionScope(family: SelectionFamily, now: Date = new Date()): string | null {
  if (getMaxMembersForFamily(family, now) >= 999) return null;
  if (family.subscriptionTier === "free" && family.trialEndsAt && new Date(family.trialEndsAt) > now) {
    return "trial";
  }
  return family.subscriptionTier;
}

export function getLockedSelection(family: SelectionFamily, now: Date = new Date()): string[] | null {
  const scope = getSelectionScope(family, now);
  if (!scope || family.memberSelectionScope !== scope ||
      !family.memberSelectionLockedUntil || new Date(family.memberSelectionLockedUntil) <= now) return null;
  return family.memberSelectionIds ?? null;
}

export function getSelectionLockEnd(family: SelectionFamily, now: Date = new Date()): Date {
  return getSelectionScope(family, now) === "trial"
    ? new Date(family.trialEndsAt!)
    : new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
}

/** Use the same effective access rule for linked child devices and member lists. */
export function canMemberAct(family: SelectionFamily, members: FamilyMember[], memberId: string): boolean {
  const member = members.find(m => m.id === memberId);
  if (!member || member.isPaused) return false;
  const selected = getLockedSelection(family);
  if (selected && !selected.includes(memberId)) return false;
  const limit = getMaxMembersForFamily(family);
  return [...members]
    .filter(m => !m.isPaused && (!selected || selected.includes(m.id)))
    .sort((a, b) => new Date(a.createdAt ?? 0).getTime() - new Date(b.createdAt ?? 0).getTime())
    .slice(0, limit)
    .some(m => m.id === memberId);
}