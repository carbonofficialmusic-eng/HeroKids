import { describe, expect, it } from "vitest";
import { getPendingProofAttachments } from "./pendingCompletionAttachments";

describe("pending grouped task proof attachments", () => {
  it("returns an attachment for every pending completion with proof and omits those without proof", () => {
    expect(getPendingProofAttachments([
      { id: "completion-a", memberName: "Alex", proofPhotoUrl: "/objects/task-proofs/a" },
      { id: "completion-b", memberName: "Sam", proofPhotoUrl: null },
      { id: "completion-c", memberName: "Jordan", proofPhotoUrl: "/objects/task-proofs/c" },
    ])).toEqual([
      { completionId: "completion-a", memberName: "Alex" },
      { completionId: "completion-c", memberName: "Jordan" },
    ]);
  });

  it("handles single-completion rows and rows without proof", () => {
    expect(getPendingProofAttachments([
      { id: "single", memberName: "Alex", proofPhotoUrl: "/objects/task-proofs/a" },
    ])).toEqual([{ completionId: "single", memberName: "Alex" }]);
    expect(getPendingProofAttachments([
      { id: "no-proof", memberName: "Sam", proofPhotoUrl: null },
    ])).toEqual([]);
  });
});