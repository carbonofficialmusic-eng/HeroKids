// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { ChildStarterCelebration } from "@/components/child-starter-celebration";

const { celebrate } = vi.hoisted(() => ({ celebrate: vi.fn() }));
vi.mock("@/lib/confetti", () => ({ celebrateTaskCompletion: celebrate }));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, options?: string | { defaultValue?: string; name?: string }) => {
      if (key === "skinNames.triceratops") return "Triceratops";
      return (typeof options === "string" ? options : options?.defaultValue || key)
        .replace("{{name}}", typeof options === "object" ? options.name || "" : "");
    },
  }),
}));
afterEach(() => { cleanup(); vi.clearAllMocks(); });

const member = {
  id: "child-1", role: "child" as const, startCompletedAt: new Date(), freeStarterSkinId: "triceratops",
};
const selection = { memberId: member.id, skinId: "triceratops" };

it("waits for confirmed equipment and the completed board transition before opening", () => {
  const onClose = vi.fn();
  const { rerender } = render(<ChildStarterCelebration member={{ ...member, startCompletedAt: null }}
    selection={selection} ready={false} onClose={onClose} />);
  expect(screen.queryByRole("dialog")).toBeNull();
  expect(celebrate).not.toHaveBeenCalled();
  rerender(<ChildStarterCelebration member={member} selection={selection} ready={false} onClose={onClose} />);
  expect(screen.queryByRole("dialog")).toBeNull();
  rerender(<ChildStarterCelebration member={member} selection={selection} ready onClose={onClose} />);
  expect(screen.getByRole("dialog", { name: "Du hast dich für „Triceratops“ entschieden." })).toBeTruthy();
  expect(screen.getByText("Lass deine nächste Mission nicht zu lange warten und entdecke mehr neue Helden und Welten.")).toBeTruthy();
  expect(celebrate).toHaveBeenCalledTimes(1);
  fireEvent.click(screen.getByRole("button", { name: "Los geht’s!" }));
  expect(onClose).toHaveBeenCalledTimes(1);
  rerender(<ChildStarterCelebration member={member} selection={null} ready onClose={onClose} />);
  expect(screen.queryByRole("dialog")).toBeNull();
});

it("does not reopen for an already completed profile on a later dashboard visit", () => {
  render(<ChildStarterCelebration member={member} selection={null} ready onClose={vi.fn()} />);
  expect(screen.queryByRole("dialog")).toBeNull();
  expect(celebrate).not.toHaveBeenCalled();
});

it("never announces another profile, an unconfirmed choice, or a parent selection", () => {
  const { rerender } = render(<ChildStarterCelebration selection={selection} ready onClose={vi.fn()} />);
  for (const other of [
    { ...member, id: "other-child" },
    { ...member, freeStarterSkinId: "tech-ninja" },
    { ...member, startCompletedAt: null },
    { ...member, role: "parent" as const },
  ]) {
    rerender(<ChildStarterCelebration member={other} selection={selection} ready onClose={vi.fn()} />);
    expect(screen.queryByRole("dialog")).toBeNull();
  }
  expect(celebrate).not.toHaveBeenCalled();
});
