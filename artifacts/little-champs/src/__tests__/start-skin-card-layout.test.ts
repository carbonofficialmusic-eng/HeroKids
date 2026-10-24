import { expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const startCss = readFileSync(path.resolve(
  path.dirname(fileURLToPath(import.meta.url)), "../components/parent-start-screen.css",
), "utf8");

it("gives cards with absolutely positioned contents a full grid-column width", () => {
  // An auto-width button with only absolute children collapses to its border
  // width (2px on the tested devices), even when it has an aspect-ratio.
  // Inspect the production CSS rule rather than jsdom's non-layout CSS engine.
  const rule = startCss.match(/\.lc-card\s*\{([^}]+)\}/)?.[1];
  expect(rule).toMatch(/(?:^|;)\s*width:\s*100%/);
  expect(rule).toMatch(/(?:^|;)\s*display:\s*block/);
  expect(rule).toMatch(/aspect-ratio:\s*4\/3\.4/);
});

it("uses the shared fixed background layer beneath normally scrolling controls", () => {
  const rule = startCss.match(/\.lc-start__hero\s*\{([^}]+)\}/)?.[1];
  expect(rule).toMatch(/position:\s*absolute/);
  expect(rule).toContain("60px + var(--header-h)");
  expect(rule).toMatch(/pointer-events:\s*none/);
  expect(rule).not.toMatch(/transform:/);
  const body = startCss.match(/\.lc-start__body\s*\{([^}]+)\}/)?.[1];
  expect(body).toMatch(/position:\s*relative/);
  expect(body).toMatch(/z-index:\s*1/);
  expect(body).not.toMatch(/position:\s*(?:fixed|sticky)/);
});

it("preserves readable artwork proportions on phone and tablet", () => {
  expect(startCss).toMatch(/\.lc-start__artwork\s*\{[^}]*aspect-ratio:\s*1024\/559/);
  expect(startCss).toMatch(/@media\s*\(max-width:640px\)\s*\{\.lc-start__artwork\s*\{[^}]*aspect-ratio:\s*640\/559/);
});

it("paints the artwork directly without percentage-height or transformed image descendants", () => {
  expect(startCss).toContain("height:54.58984375vw");
  expect(startCss).toContain("height:87.34375vw");
  const artwork = startCss.match(/\.lc-start__artwork\s*\{([^}]+)\}/)?.[1];
  expect(artwork).toContain("background-size:cover");
  expect(artwork).toContain("background-position:center top");
  expect(artwork).not.toContain("transform:");
});

it("places the cards just beneath the embedded subtitle without the yellow hint", () => {
  expect(startCss).toContain("height:36.42578125vw");
  expect(startCss).toContain("height:58.28125vw");
  const source = readFileSync(path.resolve(
    path.dirname(fileURLToPath(import.meta.url)), "../components/parent-start-screen.tsx",
  ), "utf8");
  expect(source).not.toContain("lc-start-hint");
  expect(source).not.toContain("parentStart.hintLocked");
  expect(source.indexOf('className="lc-start__cards"')).toBeLessThan(source.indexOf('data-testid="button-first-task"'));
});

it("centers unlocked cards using the space previously occupied by the create button", () => {
  const rule = startCss.match(/\.lc-start--unlocked \.lc-start__body\s*\{([^}]+)\}/)?.[1];
  expect(rule).toContain("padding-top:calc(.75rem + (58px + .85rem)/2)");
  expect(rule).toContain("padding-bottom:calc(1rem + (58px + .85rem)/2)");
});
