import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createInstance } from "i18next";
import { describe, expect, it } from "vitest";

const languages = ["de", "en", "fr", "es", "pt", "sv", "ja", "ko", "zh"];
const resetKeys = [
  "resetTask", "resetTaskDesc", "resetTaskConfirmTitle", "resetTaskConfirmDesc",
  "resetting", "resetConfirm", "resetSuccess", "resetSuccessDesc",
  "resetError", "resetErrorDesc",
];
const locales = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../locales");

describe.each(languages)("task-reset translations in %s", language => {
  const translation = JSON.parse(readFileSync(path.join(locales, language, "translation.json"), "utf8"));

  it.each(resetKeys)("resolves tasks.%s without fallback or a raw translation key", async key => {
    const instance = createInstance();
    await instance.init({
      lng: language, fallbackLng: false, resources: { [language]: { translation } },
    });
    expect(typeof translation.tasks[key]).toBe("string");
    expect(translation.tasks[key].trim().length).toBeGreaterThan(0);
    const value = instance.t(`tasks.${key}`);
    expect(value).toBe(translation.tasks[key]);
    expect(value).not.toContain("tasks.");
  });
});
