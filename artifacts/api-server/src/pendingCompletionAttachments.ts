export interface PendingProofAttachmentSource {
  id: string;
  memberName: string;
  proofPhotoUrl: string | null;
}

export interface PendingProofAttachment {
  completionId: string;
  memberName: string;
}

export function getPendingProofAttachments(
  completions: readonly PendingProofAttachmentSource[],
): PendingProofAttachment[] {
  return completions
    .filter((completion) => !!completion.proofPhotoUrl)
    .map((completion) => ({
      completionId: completion.id,
      memberName: completion.memberName,
    }));
}