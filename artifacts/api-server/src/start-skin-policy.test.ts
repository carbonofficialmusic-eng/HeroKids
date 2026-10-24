import { describe, expect, it } from "vitest";
import {
  assertStartChoice, createStartSkinOptions, createStartStarPositions,
  DINO_START_SKINS, getFreeStarterId, isStartPending,
} from "./start-skin-policy";
import { MIXED_SKIN_ORDER, TOTAL_HIDDEN_STARS } from "./shared/skin-config";

describe("personal start card policy", () => {
  it("always offers exactly one dinosaur/pterosaur and two other distinct regular cards", () => {
    const offers = new Set<string>();
    for (let i = 0; i < 300; i++) {
      const options = createStartSkinOptions();
      expect(options).toHaveLength(3);
      expect(new Set(options).size).toBe(3);
      expect(options.filter(id => DINO_START_SKINS.has(id))).toHaveLength(1);
      expect(options.every(id => MIXED_SKIN_ORDER.includes(id))).toBe(true);
      offers.add(options.join(","));
    }
    expect(offers.size).toBeGreaterThan(1);
  });

  it("places all 48 stars independently of the offered or chosen hero", () => {
    const positions = createStartStarPositions(max => max - 1);
    expect(positions).toHaveLength(TOTAL_HIDDEN_STARS);
    expect(new Set(positions).size).toBe(TOTAL_HIDDEN_STARS);
    expect(positions.every(id => MIXED_SKIN_ORDER.includes(id))).toBe(true);
    expect(positions).toEqual(MIXED_SKIN_ORDER.slice(0, TOTAL_HIDDEN_STARS));
  });

  it("allows a personal free starter, including the old fixed starter, to carry a star", () => {
    const positions = createStartStarPositions(max => max - 1);
    expect(positions).toContain("junior-champion");
  });

  const parent = {
    role: "parent", startSkinOptions: ["t-rex", "art-master", "junior-champion"],
    firstTaskCreatedAt: null, startCompletedAt: null, freeStarterSkinId: null,
  };
  it("requires a successfully saved first task, not a client-side selection", () => {
    expect(() => assertStartChoice(parent, "t-rex")).toThrow("FIRST_TASK_REQUIRED");
    expect(() => assertStartChoice({ ...parent, firstTaskCreatedAt: new Date() }, "t-rex")).not.toThrow();
  });
  it("does not impose the parent task requirement on a child", () => {
    expect(() => assertStartChoice({ ...parent, role: "child" }, "t-rex")).not.toThrow();
  });
  it("rejects any card outside the stable offer, including Legacy", () => {
    for (const id of ["shield-blaze", "unknown", "book-wizard"]) {
      expect(() => assertStartChoice({ ...parent, firstTaskCreatedAt: new Date() }, id)).toThrow("INVALID_START_SKIN");
    }
  });
  it("allows idempotent retries but never a second free selection", () => {
    const completed = { ...parent, startCompletedAt: new Date(), freeStarterSkinId: "t-rex" };
    expect(() => assertStartChoice(completed, "t-rex")).not.toThrow();
    expect(() => assertStartChoice(completed, "art-master")).toThrow("START_ALREADY_COMPLETED");
  });
  it("does not enrol an existing profile with a missing tour completion", () => {
    expect(isStartPending({ role: "parent", startSkinOptions: null })).toBe(false);
    expect(getFreeStarterId({ role: "parent", startSkinOptions: null })).toBe("junior-champion");
    expect(isStartPending(parent)).toBe(true);
    expect(getFreeStarterId(parent)).toBe(null);
    expect(getFreeStarterId({ ...parent, freeStarterSkinId: "t-rex" })).toBe("t-rex");
  });
});
