import { afterEach, describe, expect, it, vi } from "vitest";
import { isImageWarm, warmImage } from "../lib/image-cache";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("persistent image cache", () => {
  it("deduplicates a URL while it is loading and keeps it warm", async () => {
    let load: (() => void) | undefined;
    class MockImage {
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      set src(_url: string) {
        load = () => this.onload?.();
      }
    }
    vi.stubGlobal("Image", MockImage);

    const first = warmImage("/test-cache-icon.png");
    const second = warmImage("/test-cache-icon.png");
    expect(first).toBe(second);
    expect(isImageWarm("/test-cache-icon.png")).toBe(false);

    load?.();
    await first;

    expect(isImageWarm("/test-cache-icon.png")).toBe(true);
    expect(await warmImage("/test-cache-icon.png")).toBeUndefined();
  });
});