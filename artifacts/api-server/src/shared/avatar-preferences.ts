type MemberAvatarState = {
  avatarUrl?: string | null;
  avatarHistory?: unknown;
};

export function isUploadedProfilePhoto(value: unknown): value is string {
  return typeof value === "string" && value.startsWith("/objects/");
}

export function getProfilePhotoObjectPaths(members: MemberAvatarState[]): string[] {
  const paths = new Set<string>();

  for (const member of members) {
    if (isUploadedProfilePhoto(member.avatarUrl)) {
      paths.add(member.avatarUrl);
    }

    if (Array.isArray(member.avatarHistory)) {
      for (const historyEntry of member.avatarHistory) {
        if (isUploadedProfilePhoto(historyEntry)) {
          paths.add(historyEntry);
        }
      }
    }
  }

  return [...paths];
}

export function shouldKeepCustomPhotoWhenSelectingSkin(
  skinId: unknown,
  useCustomAvatar: boolean,
  avatarUrl: unknown,
): boolean {
  return (
    typeof skinId === "string" &&
    skinId.length > 0 &&
    useCustomAvatar &&
    isUploadedProfilePhoto(avatarUrl)
  );
}