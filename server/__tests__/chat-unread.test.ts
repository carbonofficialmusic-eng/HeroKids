import { describe, expect, it } from "vitest";
import { calculateConversationUnreadCounts } from "../chat-unread";

describe("calculateConversationUnreadCounts", () => {
  it("keeps unread counts separate for broadcasts and direct conversations", () => {
    const counts = calculateConversationUnreadCounts(
      [
        { createdAt: new Date("2026-09-18T10:01:00Z"), memberId: "sender-a", isTargeted: false },
        { createdAt: new Date("2026-09-18T10:02:00Z"), memberId: "sender-a", isTargeted: true },
        { createdAt: new Date("2026-09-18T10:03:00Z"), memberId: "sender-b", isTargeted: true },
      ],
      new Date("2026-09-18T10:00:00Z"),
      new Map(),
    );

    expect(counts).toEqual({ all: 1, "sender-a": 1, "sender-b": 1 });
  });

  it("only clears the conversation that was read", () => {
    const counts = calculateConversationUnreadCounts(
      [
        { createdAt: new Date("2026-09-18T10:02:00Z"), memberId: "sender-a", isTargeted: true },
        { createdAt: new Date("2026-09-18T10:03:00Z"), memberId: "sender-b", isTargeted: true },
      ],
      new Date("2026-09-18T10:00:00Z"),
      new Map([["sender-a", new Date("2026-09-18T10:04:00Z")]]),
    );

    expect(counts).toEqual({ "sender-b": 1 });
  });
});