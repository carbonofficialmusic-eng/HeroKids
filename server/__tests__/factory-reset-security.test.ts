import { describe, expect, it } from "vitest";
import {
  FACTORY_RESET_CONFIRMATION_MAX_LENGTH,
  isValidFactoryResetConfirmation,
} from "@shared/factory-reset";
import {
  getProfilePhotoObjectPaths,
  shouldKeepCustomPhotoWhenSelectingSkin,
} from "@shared/avatar-preferences";

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

describe("factory reset profile photos", () => {
  it("collects current and historical uploaded photos without duplicates", () => {
    expect(
      getProfilePhotoObjectPaths([
        {
          avatarUrl: "/objects/avatars/current",
          avatarHistory: ["/objects/avatars/old", "/objects/avatars/current", "default:fox"],
        },
        {
          avatarUrl: "default:bear",
          avatarHistory: ["/objects/avatars/other"],
        },
      ]),
    ).toEqual([
      "/objects/avatars/current",
      "/objects/avatars/old",
      "/objects/avatars/other",
    ]);
  });
});

describe("skin avatar preference", () => {
  it("keeps an explicitly enabled uploaded photo when selecting a skin", () => {
    expect(
      shouldKeepCustomPhotoWhenSelectingSkin(
        "junior-champion",
        true,
        "/objects/avatars/profile",
      ),
    ).toBe(true);
  });

  it("switches default avatars and disabled custom photos to the selected skin", () => {
    expect(
      shouldKeepCustomPhotoWhenSelectingSkin("junior-champion", true, "default:fox"),
    ).toBe(false);
    expect(
      shouldKeepCustomPhotoWhenSelectingSkin(
        "junior-champion",
        false,
        "/objects/avatars/profile",
      ),
    ).toBe(false);
  });
});