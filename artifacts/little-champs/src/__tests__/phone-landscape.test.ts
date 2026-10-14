import { describe, expect, it } from "vitest";
import { installPhoneLandscapeLayout, isCompactPhoneLandscape } from "../lib/phone-landscape";

const phone = {
  width: 852, height: 393, screenWidth: 393, screenHeight: 852, native: true,
};

describe("compact phone landscape", () => {
  it.each([90, -90, 270])("uses native physical landscape at %s degrees", (orientationAngle) => {
    expect(isCompactPhoneLandscape({ ...phone, orientationAngle })).toBe(true);
    // Stale portrait dimensions must not suppress the landscape layout.
    expect(isCompactPhoneLandscape({
      ...phone, width: 393, height: 852, orientationAngle,
    })).toBe(true);
  });

  it.each([0, 180])("preserves native portrait at %s degrees, even with the keyboard open", (orientationAngle) => {
    expect(isCompactPhoneLandscape({
      ...phone, width: 393, height: 280, orientationAngle,
    })).toBe(false);
  });

  it("falls back to the viewport when physical orientation is unavailable", () => {
    expect(isCompactPhoneLandscape(phone)).toBe(true);
    expect(isCompactPhoneLandscape({ ...phone, width: 393, height: 852 })).toBe(false);
  });

  it.each([[852, 393], [956, 440], [1024, 512], [1136, 568]])(
    "keeps the compact web layout at %s x %s", (width, height) => {
      expect(isCompactPhoneLandscape({ ...phone, native: false, width, height, orientationAngle: 0 })).toBe(true);
    },
  );

  it("does not use a tablet's physical orientation to override its viewport", () => {
    expect(isCompactPhoneLandscape({
      ...phone, width: 1024, height: 768, screenWidth: 768, screenHeight: 1024, orientationAngle: 90,
    })).toBe(false);
  });

  it("preserves desktop and web portrait layouts", () => {
    expect(isCompactPhoneLandscape({ ...phone, native: false, width: 1280, height: 800 })).toBe(false);
    expect(isCompactPhoneLandscape({ ...phone, native: false, width: 432, height: 932 })).toBe(false);
  });

  it("updates after rotation and resume, and removes listeners on disposal", () => {
    const win = Object.assign(new EventTarget(), {
      innerWidth: 393, innerHeight: 852, orientation: 0,
      screen: { width: 393, height: 852, orientation: Object.assign(new EventTarget(), { angle: 0 }) },
    });
    const classes = new Set<string>();
    const doc = Object.assign(new EventTarget(), {
      visibilityState: "visible",
      documentElement: { classList: {
        toggle: (name: string, on: boolean) => on ? classes.add(name) : classes.delete(name),
        remove: (name: string) => classes.delete(name),
      } },
    });
    const oldWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
    const oldDocument = Object.getOwnPropertyDescriptor(globalThis, "document");
    Object.defineProperty(globalThis, "window", { value: win, configurable: true });
    Object.defineProperty(globalThis, "document", { value: doc, configurable: true });
    let dispose: (() => void) | undefined;
    try {
      dispose = installPhoneLandscapeLayout(true);
      expect(classes.has("lc-phone-landscape")).toBe(false);
      win.orientation = 90;
      win.dispatchEvent(new Event("orientationchange"));
      expect(classes.has("lc-phone-landscape")).toBe(true);
      win.orientation = 0;
      doc.dispatchEvent(new Event("resume"));
      expect(classes.has("lc-phone-landscape")).toBe(false);
      dispose();
      win.orientation = 90;
      win.dispatchEvent(new Event("resize"));
      expect(classes.has("lc-phone-landscape")).toBe(false);
    } finally {
      dispose?.();
      if (oldWindow) Object.defineProperty(globalThis, "window", oldWindow);
      else Reflect.deleteProperty(globalThis, "window");
      if (oldDocument) Object.defineProperty(globalThis, "document", oldDocument);
      else Reflect.deleteProperty(globalThis, "document");
    }
  });
});
