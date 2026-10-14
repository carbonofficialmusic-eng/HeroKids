// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { KidAvailabilityBadge } from "../components/kid-availability-badge";
import { formatKidAvailabilityDate, getKidRecurringAvailabilityDate, type KidAvailabilityTask } from "../lib/task-filters";

const approved = {
  recurrence: "weekly", memberCompletionStatus: "approved" as const,
  assignedMemberCompletions: [{}],
  memberNextAvailableDate: "2026-05-29T00:00:00Z",
  nextAvailableDate: "2026-06-20T00:00:00Z",
};

describe("kid availability badge in grid and list", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-27T12:00:00Z"));
  });
  afterEach(() => { cleanup(); vi.useRealTimers(); });

  for (const compact of [true, false]) {
    it(`${compact ? "grid" : "list"} shows the child's date after approval and hides it while pending or available`, () => {
      const renderBadge = (task: KidAvailabilityTask) => {
        const date = getKidRecurringAvailabilityDate(task);
        return createElement(KidAvailabilityBadge, {
          taskId: "repeat-1", compact,
          text: date ? `Wieder verfügbar: ${formatKidAvailabilityDate(date, "de")}` : null,
        });
      };
      const { rerender } = render(renderBadge(approved));
      expect(screen.getByTestId("badge-available-again-repeat-1").textContent).toBe("Wieder verfügbar: Übermorgen");
      rerender(renderBadge({ ...approved, memberCompletionStatus: "pending" as const }));
      expect(screen.queryByTestId("badge-available-again-repeat-1")).toBeNull();
      vi.setSystemTime(new Date("2026-05-29T00:00:00Z"));
      rerender(renderBadge(approved));
      expect(screen.queryByTestId("badge-available-again-repeat-1")).toBeNull();
    });
  }
});