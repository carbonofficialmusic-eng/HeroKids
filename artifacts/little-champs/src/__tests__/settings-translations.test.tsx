// @vitest-environment jsdom
import { act, cleanup, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, expect, it } from "vitest";
import i18n from "@/i18n";
import { TvApproveDialog } from "@/components/tv-approve-dialog";

const languages = ["de", "en", "es", "fr", "pt", "sv", "ja", "zh", "ko"];
const namespaces = ["googleCalendar", "feedback", "familyTv"];
const placeholders = (text: string) => [...text.matchAll(/{{\s*([^}]+)\s*}}/g)]
  .map(match => match[1].trim()).sort();
const clients: QueryClient[] = [];

afterEach(async () => {
  cleanup();
  clients.splice(0).forEach(client => client.clear());
  await i18n.changeLanguage("en");
});

it.each(languages)("%s has every settings translation and preserves interpolation variables", language => {
  const english = i18n.getResourceBundle("en", "translation");
  const translated = i18n.getResourceBundle(language, "translation");
  for (const namespace of namespaces) {
    for (const [key, source] of Object.entries(english[namespace])) {
      const value = translated[namespace]?.[key];
      expect(typeof value, `${language}.${namespace}.${key}`).toBe("string");
      expect(value.trim(), `${language}.${namespace}.${key}`).not.toBe("");
      expect(placeholders(value)).toEqual(placeholders(source as string));
      // French uses "Points" too; all other texts must be genuinely localized,
      // rather than copies of the English fallback as in the reported bug.
      if (language !== "en" && `${namespace}.${key}` !== "googleCalendar.points") {
        expect(value, `${language}.${namespace}.${key}`).not.toBe(source);
      }
    }
  }
  for (const key of ["title_star-collector", "desc_star-collector"]) {
    expect(typeof translated.achievements[key]).toBe("string");
    expect(translated.achievements[key].trim()).not.toBe("");
    if (language !== "en") {
      expect(translated.achievements[key]).not.toBe(english.achievements[key]);
    }
  }
});

it("renders the TV instructions and controls in all nine languages without remounting", async () => {
  const client = new QueryClient({ defaultOptions: { queries: { staleTime: Infinity, retry: false } } });
  clients.push(client);
  client.setQueryData(["/api/tv/devices"], { devices: [] });
  render(
    <QueryClientProvider client={client}>
      <TvApproveDialog open onOpenChange={() => {}} />
    </QueryClientProvider>,
  );
  for (const language of languages) {
    await act(async () => { await i18n.changeLanguage(language); });
    const text = i18n.getResourceBundle(language, "translation").familyTv;
    expect(screen.getByRole("heading", { name: text.title })).toBeTruthy();
    expect(screen.getByText(text.description)).toBeTruthy();
    expect(screen.getByText(text.pinHint)).toBeTruthy();
    expect(screen.getByText(text.none)).toBeTruthy();
    expect(screen.getByLabelText(text.code)).toBeTruthy();
    expect(screen.getByLabelText(text.pin)).toBeTruthy();
    expect(screen.getByTestId("button-tv-approve").textContent).toBe(text.confirm);
  }
});
