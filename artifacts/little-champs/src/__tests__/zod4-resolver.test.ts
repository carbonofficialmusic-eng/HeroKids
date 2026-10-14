import { describe, expect, it } from "vitest";
import { z } from "zod/v4";
import { insertFamilyGoalSchema } from "@shared/schema";
import { zod4Resolver } from "../lib/zod4-resolver";

const resolverOptions = {
  criteriaMode: "firstError" as const,
  fields: {},
  shouldUseNativeValidation: false,
};

describe("Zod 4 form resolver", () => {
  it("nests auth field errors and returns parsed values on success", async () => {
    const authSchema = z.object({
      account: z.object({
        email: z.string().trim().email("Enter a valid email"),
      }),
      password: z.string().min(8, "Use at least 8 characters"),
    });
    const resolve = zod4Resolver(authSchema);

    const invalid = await resolve(
      { account: { email: "not-an-email" }, password: "short" },
      undefined,
      resolverOptions,
    );
    expect(invalid.errors).toMatchObject({
      account: { email: { message: "Enter a valid email" } },
      password: { message: "Use at least 8 characters" },
    });

    const valid = await resolve(
      { account: { email: " parent@example.com " }, password: "secure-pass" },
      undefined,
      resolverOptions,
    );
    expect(valid).toEqual({
      values: {
        account: { email: "parent@example.com" },
        password: "secure-pass",
      },
      errors: {},
    });
  });

  it("preserves the localized terms-required message supported by Zod 4", () => {
    const termsSchema = z.literal(true, {
      error: () => "Please accept the terms",
    });

    expect(termsSchema.safeParse(false).error?.issues[0]?.message).toBe(
      "Please accept the terms",
    );
  });

  it("validates generated drizzle-zod schemas with the same Zod 4 resolver", async () => {
    const values = {
      familyName: "family-1",
      description: null,
      title: "Family goal",
      iconEmoji: "🎯",
      isActive: true,
      targetPoints: 300,
      contributionAmount: 25,
      contributionPeriod: "weekly" as const,
    };
    const resolve = zod4Resolver(insertFamilyGoalSchema);

    const valid = await resolve(values, undefined, resolverOptions);
    expect(valid.errors).toEqual({});
    expect(valid.values).toMatchObject(values);

    const invalid = await resolve(
      { ...values, contributionPeriod: "yearly" },
      undefined,
      resolverOptions,
    );
    expect(invalid.errors).toHaveProperty("contributionPeriod");
  });
});