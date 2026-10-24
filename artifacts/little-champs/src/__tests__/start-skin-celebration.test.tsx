// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { StartSkinCelebration } from "@/components/start-skin-celebration";

const { celebrate } = vi.hoisted(() => ({ celebrate: vi.fn() }));
vi.mock("@/lib/confetti", () => ({ celebrateTaskCompletion: celebrate }));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => ({
    "parentStart.cardEarned": "Du hast dir deine erste Skin-Karte verdient!",
    "parentStart.chooseUnlockedCard": "Die drei Karten sind jetzt freigeschaltet.",
    "parentStart.chooseSkin": "Karte aussuchen",
  }[key] || key) }),
}));
afterEach(() => { cleanup(); vi.clearAllMocks(); vi.unstubAllGlobals(); });

it("shows a centered accessible celebration and lets the member continue to the cards", () => {
  const onClose = vi.fn();
  const { rerender } = render(<StartSkinCelebration open={false} onClose={onClose} />);
  expect(screen.queryByRole("dialog")).toBeNull();
  expect(celebrate).not.toHaveBeenCalled();
  rerender(<StartSkinCelebration open onClose={onClose} />);
  const dialog = screen.getByRole("dialog", { name: "Du hast dir deine erste Skin-Karte verdient!" });
  expect(dialog.style.top).toBe(`${window.innerHeight / 2}px`);
  expect(dialog.style.transform).toBe("translateX(-50%) translateY(-50%)");
  expect(screen.getByText("Die drei Karten sind jetzt freigeschaltet.")).toBeTruthy();
  expect(celebrate).toHaveBeenCalledTimes(1);
  rerender(<StartSkinCelebration open onClose={onClose} />);
  expect(celebrate).toHaveBeenCalledTimes(1);
  fireEvent.click(screen.getByRole("button", { name: "Karte aussuchen" }));
  expect(onClose).toHaveBeenCalledTimes(1);
  rerender(<StartSkinCelebration open={false} onClose={onClose} />);
  expect(screen.queryByRole("dialog")).toBeNull();
});

it("honors reduced motion while still showing the reward message", () => {
  vi.stubGlobal("matchMedia", () => ({ matches: true }));
  render(<StartSkinCelebration open onClose={() => {}} />);
  expect(screen.getByRole("dialog")).toBeTruthy();
  expect(celebrate).not.toHaveBeenCalled();
});
