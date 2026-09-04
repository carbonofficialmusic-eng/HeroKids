import { describe, expect, it } from "vitest";
import {
  FACTORY_RESET_CONFIRMATION_MAX_LENGTH,
  isValidFactoryResetConfirmation,
} from "@shared/factory-reset";

describe("factory reset confirmation", () => {
  const familyName = "Petersen";

  it("accepts only the exact family name", () => {
    expect(isValidFactoryResetConfirmation("Petersen", familyName)).toBe(true);
    expect(isValidFactoryResetConfirmation("  Petersen  ", familyName)).toBe(true);
  });

  it("rejects missing, generic, and case-mismatched confirmations", () => {
    expect(isValidFactoryResetConfirmation(undefined, familyName)).toBe(false);
    expect(isValidFactoryResetConfirmation("", familyName)).toBe(false);
    expect(isValidFactoryResetConfirmation("RESET", familyName)).toBe(false);
    expect(isValidFactoryResetConfirmation("petersen", familyName)).toBe(false);
  });

  it("rejects oversized input", () => {
    expect(
      isValidFactoryResetConfirmation(
        "x".repeat(FACTORY_RESET_CONFIRMATION_MAX_LENGTH + 1),
        familyName,
      ),
    ).toBe(false);
  });
});