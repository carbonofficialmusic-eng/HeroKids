interface ParentMember {
  id: string;
  role: string;
  isPaused?: boolean | null;
}

interface TvManagementRequest {
  user?: {
    claims?: { sub?: string };
    authMethod?: string;
    tvSession?: unknown;
  };
  session?: { actingAsMemberId?: string };
}

/**
 * A profile switch back to the account's own parent is not impersonation.
 * Never grant TV management merely because a PIN-selected member is a parent.
 */
export async function resolveTvManagementParent<T extends ParentMember>(
  req: TvManagementRequest,
  getMemberByUserId: (userId: string) => Promise<T | undefined | null>,
): Promise<T | null> {
  const userId = req.user?.claims?.sub;
  if (
    !userId ||
    req.user?.authMethod === "mobile" ||
    req.user?.authMethod === "device" ||
    req.user?.tvSession ||
    /^(tv|mobile|device):/.test(userId)
  ) return null;

  const parent = await getMemberByUserId(userId);
  if (!parent || parent.role !== "parent" || parent.isPaused) return null;
  const selectedMemberId = req.session?.actingAsMemberId;
  return selectedMemberId && selectedMemberId !== parent.id ? null : parent;
}
