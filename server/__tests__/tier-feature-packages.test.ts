import { describe, expect, it } from "vitest";
import { hasFeature } from "../../shared/tier-config";

describe("Family task features", () => {
  it("keeps team assignment and multiple daily completions out of Free", () => {
    expect(hasFeature("free", "multiTask")).toBe(false);
    expect(hasFeature("family", "multiTask")).toBe(true);
    expect(hasFeature("family_plus", "multiTask")).toBe(true);
    expect(hasFeature("family_hero", "multiTask")).toBe(true);
  });
});