import { describe, expect, it } from "vitest";
import { parseServerBuild } from "../lib/layout-diagnostics";

describe("server build diagnostics", () => {
  it("accepts the generated build timestamp", () => {
    expect(parseServerBuild({ id: "2026-10-14T15:00:00.123Z", diagnostics: "phone-layout-1" }))
      .toBe("2026-10-14T15:00:00.123Z");
  });

  it.each([null, {}, "SPA fallback HTML", { id: 123 }, { id: "unbekannt" }, { id: "2026-99-14T15:00:00.123Z" }])(
    "explicitly rejects an invalid build response: %j", (value) => {
      expect(() => parseServerBuild(value)).toThrow();
    },
  );
});
