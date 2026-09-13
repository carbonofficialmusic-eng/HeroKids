import { describe, expect, it } from "vitest";
import { getDueDateWindow } from "../../shared/due-date-policy";

describe("fixed appointment grace period", () => {
  it("keeps future appointments locked", () => {
    expect(getDueDateWindow("2026-10-08", "2026-10-07")).toMatchObject({
      notYet: true,
      expired: false,
      isGraceDay: false,
    });
  });

  it("allows completion on the appointment date without forced approval", () => {
    expect(getDueDateWindow("2026-10-08", "2026-10-08")).toMatchObject({
      notYet: false,
      expired: false,
      isGraceDay: false,
    });
  });

  it("allows one late day and marks it for forced approval", () => {
    expect(getDueDateWindow("2026-10-08", "2026-10-09")).toMatchObject({
      notYet: false,
      expired: false,
      isGraceDay: true,
    });
  });

  it("expires the appointment on the second late day", () => {
    expect(getDueDateWindow("2026-10-08", "2026-10-10")).toMatchObject({
      notYet: false,
      expired: true,
      isGraceDay: false,
    });
  });
});