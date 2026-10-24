// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { StartSkinChoice } from "@/components/start-skin-choice";
import type { FamilyMember } from "@shared/schema";

const state = vi.hoisted(() => ({ pending: true, taskCreated: false, options: [], selecting: false, error: null, choose: vi.fn() }));
vi.mock("@/hooks/useStartSkin", () => ({ useStartSkin: () => state }));
vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (_key: string, fallback: string) => fallback }) }));
afterEach(() => { cleanup(); state.taskCreated = false; });

it("shows a compact button linking to new-task creation on the dashboard", () => {
  render(<StartSkinChoice member={{ role: "parent" } as FamilyMember} />);
  const button = screen.getByTestId("button-gallery-first-task");
  expect(button.tagName).toBe("A");
  expect(button.getAttribute("href")).toBe("/dashboard?createTask=1");
  expect(button.className).toContain("min-h-10");
  expect(button.textContent).toContain("Erste Aufgabe erstellen");
  expect(button.className).not.toContain("underline");
});

it("hides the task button once the first task exists or for a child", () => {
  state.taskCreated = true;
  const { rerender } = render(<StartSkinChoice member={{ role: "parent" } as FamilyMember} />);
  expect(screen.queryByTestId("button-gallery-first-task")).toBeNull();
  state.taskCreated = false;
  rerender(<StartSkinChoice member={{ role: "child" } as FamilyMember} />);
  expect(screen.queryByTestId("button-gallery-first-task")).toBeNull();
});
