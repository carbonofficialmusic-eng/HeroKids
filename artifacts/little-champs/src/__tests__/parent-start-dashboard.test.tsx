// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { ParentStartScreen } from "@/components/parent-start-screen";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, options?: string | { name?: string; defaultValue?: string }) =>
      typeof options === "string" ? options : (options?.defaultValue || key).replace("{{name}}", options?.name || ""),
  }),
}));
vi.mock("@/lib/skins", () => ({
  getSkinBackgroundUrl: (id: string) => `/background-${id}.jpg`,
  getSkinImageUrl: (id: string) => `/avatar-${id}.jpg`,
}));
afterEach(cleanup);

it("removes the first-task button and unlocks the same three cards after creation", () => {
  const onChoose = vi.fn();
  const onCreateTask = vi.fn();
  const props = {
    options: [{ id: "a", name: "A" }, { id: "b", name: "B" }, { id: "c", name: "C" }],
    taskCreated: false, selecting: false, error: null, onChoose, onCreateTask,
  };
  const { rerender, container } = render(<ParentStartScreen {...props} />);
  container.querySelectorAll("img").forEach(image => fireEvent.load(image));
  const card = screen.getByTestId("button-choose-skin-a") as HTMLButtonElement;
  expect(card.disabled).toBe(true);
  expect(container.querySelectorAll(".lc-card__sub")).toHaveLength(0);
  expect(container.querySelectorAll(".lc-card__foot .lucide-lock")).toHaveLength(3);
  container.querySelectorAll(".lc-card__foot").forEach(footer => {
    expect(footer.children).toHaveLength(2);
    expect(footer.firstElementChild?.className).toBe("lc-card__name");
  });
  fireEvent.click(screen.getByTestId("button-first-task"));
  expect(onCreateTask).toHaveBeenCalledOnce();
  rerender(<ParentStartScreen {...props} taskCreated />);
  expect(screen.queryByTestId("button-first-task")).toBeNull();
  expect(screen.getByTestId("parent-start-screen").className).toContain("lc-start--unlocked");
  expect(screen.getAllByTestId(/^button-choose-skin-/)).toHaveLength(3);
  expect(card.disabled).toBe(false);
  expect(container.querySelectorAll(".lc-card__foot .lucide-lock")).toHaveLength(0);
  expect(container.querySelectorAll(".lc-card__sub")).toHaveLength(0);
  fireEvent.click(card);
  expect(onChoose).toHaveBeenCalledWith("a");
  // Actions and counters are supplied by the actual dashboard, never duplicated.
  expect(screen.queryByTestId("button-start-approvals")).toBeNull();
  expect(screen.queryByTestId("text-start-points")).toBeNull();
});

it("keeps the actual dashboard visible with only the five top elements replaced", () => {
  const dashboard = readFileSync(path.resolve(
    path.dirname(fileURLToPath(import.meta.url)), "../pages/dashboard.tsx",
  ), "utf8");
  expect(dashboard).not.toContain('display: start.visible ? "none"');
  const topStart = dashboard.indexOf("{!start.visible && <div>");
  const topEnd = dashboard.indexOf("</div>}", topStart);
  const replaced = dashboard.slice(topStart, topEnd);
  for (const id of [
    "img-dashboard-logo", "button-avatar-profile-large", "link-stars-to-skins-parent",
    "button-scroll-to-pinboard", "text-parent-total-earned", "text-parent-available",
  ]) expect(replaced).toContain(id);
  expect(dashboard.indexOf('data-testid="button-approvals"')).toBeGreaterThan(topEnd);
  expect(dashboard.indexOf("<TaskCard", topEnd)).toBeGreaterThan(topEnd);
});
