import { randomInt } from "node:crypto";
import { MIXED_SKIN_ORDER, STARTER_SKIN_ID, TOTAL_HIDDEN_STARS } from "./shared/skin-config";

export const DINO_START_SKINS = new Set([
  "t-rex", "triceratops", "stegosaurus", "velociraptor", "brachiosaurus",
  "spinosaurus", "ankylosaurus", "allosaurus", "pteranodon", "quetzalcoatlus",
  "rhamphorhynchus", "pterodactylus", "dimorphodon", "tapejara", "anhanguera",
  "dsungaripterus", "nemicolopterus",
]);

export function shuffled<T>(items: readonly T[], pick = randomInt): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = pick(i + 1);
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

export function createStartSkinOptions(pick = randomInt): string[] {
  const dinos = MIXED_SKIN_ORDER.filter(id => DINO_START_SKINS.has(id));
  const others = MIXED_SKIN_ORDER.filter(id => !DINO_START_SKINS.has(id));
  return shuffled([dinos[pick(dinos.length)], ...shuffled(others, pick).slice(0, 2)], pick);
}

export type StartMember = {
  startSkinOptions?: string[] | null;
  freeStarterSkinId?: string | null;
  startCompletedAt?: Date | string | null;
  firstTaskCreatedAt?: Date | string | null;
  role: string;
};

export function isStartPending(member: StartMember): boolean {
  return !!member.startSkinOptions && !member.startCompletedAt;
}

export function getFreeStarterId(member: StartMember): string | null {
  return member.startSkinOptions ? member.freeStarterSkinId || null : STARTER_SKIN_ID;
}

export function assertStartChoice(member: StartMember, skinId: string) {
  if (!member.startSkinOptions?.includes(skinId) || !MIXED_SKIN_ORDER.includes(skinId)) {
    throw new Error("INVALID_START_SKIN");
  }
  if (member.startCompletedAt) {
    if (member.freeStarterSkinId === skinId) return;
    throw new Error("START_ALREADY_COMPLETED");
  }
  if (member.role === "parent" && !member.firstTaskCreatedAt) {
    throw new Error("FIRST_TASK_REQUIRED");
  }
}

export function createStartStarPositions(pick = randomInt): string[] {
  // The personal board exists independently of which free hero is chosen.
  // Any regular card, including all three starter offers, can hide a star.
  const candidates = MIXED_SKIN_ORDER;
  if (candidates.length < TOTAL_HIDDEN_STARS) throw new Error("Insufficient star positions");
  return shuffled(candidates, pick).slice(0, TOTAL_HIDDEN_STARS);
}
