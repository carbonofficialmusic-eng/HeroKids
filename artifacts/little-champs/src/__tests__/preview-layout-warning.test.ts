// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { installPreviewLayoutWarningFilter } from "../lib/preview-layout-warning";

describe("preview ResizeObserver notification filter", () => {
  let dispose: (() => void) | undefined;
  afterEach(() => {
    dispose?.();
    dispose = undefined;
    vi.restoreAllMocks();
  });

  for (const message of [
    "ResizeObserver loop completed with undelivered notifications.",
    "ResizeObserver loop limit exceeded",
  ]) {
    it(`keeps ${message} out of the blocking overlay`, () => {
      const warning = vi.spyOn(console, "warn").mockImplementation(() => {});
      dispose = installPreviewLayoutWarningFilter(window);
      const overlay = vi.fn();
      window.addEventListener("error", overlay);
      try {
        for (let index = 0; index < 2; index++) {
          const event = new ErrorEvent("error", { message, cancelable: true });
          window.dispatchEvent(event);
          expect(event.defaultPrevented).toBe(true);
        }
        expect(overlay).not.toHaveBeenCalled();
        expect(warning).toHaveBeenCalledTimes(1);
      } finally {
        window.removeEventListener("error", overlay);
      }
    });
  }

  it.each([
    { message: "ResizeObserver loop completed with undelivered notifications.", error: new Error("Actual exception") },
    { message: "Script error.", error: null },
    { message: "ReferenceError: member is not defined", error: new ReferenceError("member is not defined") },
  ])("preserves real and unknown errors: $message", ({ message, error }) => {
    dispose = installPreviewLayoutWarningFilter(window);
    const overlay = vi.fn();
    window.addEventListener("error", overlay);
    try {
      const event = new ErrorEvent("error", { message, error, cancelable: true });
      window.dispatchEvent(event);
      expect(overlay).toHaveBeenCalledWith(event);
      expect(event.defaultPrevented).toBe(false);
    } finally {
      window.removeEventListener("error", overlay);
    }
  });

  it("can remove the development-only listener", () => {
    dispose = installPreviewLayoutWarningFilter(window);
    dispose();
    const event = new ErrorEvent("error", {
      message: "ResizeObserver loop limit exceeded",
      cancelable: true,
    });
    window.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(false);
  });
});
