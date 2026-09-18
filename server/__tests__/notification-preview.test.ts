import { describe, expect, it } from "vitest";
import { createNotificationPreview } from "../notification-preview";

describe("createNotificationPreview", () => {
  it("shows short messages in full", () => {
    expect(createNotificationPreview("Morgen um 8 Uhr zum Zahnarzt")).toBe(
      "Morgen um 8 Uhr zum Zahnarzt",
    );
  });

  it("normalizes line breaks and repeated whitespace", () => {
    expect(createNotificationPreview("  Einkauf:\nMilch   und Brot  ")).toBe(
      "Einkauf: Milch und Brot",
    );
  });

  it("shortens long messages with an ellipsis", () => {
    expect(createNotificationPreview("1234567890", 7)).toBe("123456…");
  });
});