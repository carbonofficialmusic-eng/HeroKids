import { describe, expect, it, vi } from "vitest";
import { verifyTvParentPin } from "./tvParentPin";

describe("TV parent profile PIN", () => {
  it("accepts only 0000 when no PIN has been configured", async () => {
    const validateConfiguredPin = vi.fn(async () => false);
    expect(await verifyTvParentPin(null, "0000", validateConfiguredPin)).toBe(true);
    expect(await verifyTvParentPin(undefined, "1234", validateConfiguredPin)).toBe(false);
    expect(await verifyTvParentPin("", "1111", validateConfiguredPin)).toBe(false);
    expect(validateConfiguredPin).not.toHaveBeenCalled();
  });

  it("requires validation of configured PINs, including when 0000 is entered", async () => {
    const validateConfiguredPin = vi.fn(async () => false);
    expect(await verifyTvParentPin("stored-hash", "0000", validateConfiguredPin)).toBe(false);
    expect(validateConfiguredPin).toHaveBeenCalledOnce();

    validateConfiguredPin.mockResolvedValue(true);
    expect(await verifyTvParentPin("stored-hash", "1234", validateConfiguredPin)).toBe(true);
    expect(validateConfiguredPin).toHaveBeenCalledTimes(2);
  });
});