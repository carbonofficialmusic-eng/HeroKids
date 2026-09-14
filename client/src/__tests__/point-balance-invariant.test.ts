import { describe, expect, it } from "vitest";
import { clampAvailablePoints } from "@shared/point-balance";

describe("point balance invariant", () => {
  it("keeps valid available balances unchanged", () => {
    expect(clampAvailablePoints(475, 315)).toBe(315);
  });

  it("prevents refunds from exceeding lifetime-earned points", () => {
    expect(clampAvailablePoints(475, 515)).toBe(475);
  });

  it("prevents negative available balances", () => {
    expect(clampAvailablePoints(475, -40)).toBe(0);
  });
});