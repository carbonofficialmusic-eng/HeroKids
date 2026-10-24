// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { ChildStarterHeroes, ChildStarterBackdrop } from "@/components/child-starter-heroes";
import { BackgroundLayerContext } from "@/components/background-layer";
import { getKidStarterHeroUrl, getKidStarterBannerUrl } from "@/lib/kid-starter-media";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    i18n: { language: "de", resolvedLanguage: "de" },
    t: (_key: string, options?: string | { defaultValue?: string; name?: string; count?: number }) =>
      typeof options === "string" ? options : (options?.defaultValue || _key)
        .replace("{{name}}", options?.name || "").replace("{{count}}", String(options?.count ?? 0)),
  }),
}));
afterEach(cleanup);
const options = [
  { id: "t-rex", name: "T-Rex" },
  { id: "princess-tiara", name: "Prinzessin" },
  { id: "junior-champion", name: "Junior Champ" },
];
const props = { options, starsFound: 0, selecting: false, error: null, onChoose: vi.fn() };
function loadAll(container: HTMLElement) {
  container.querySelectorAll(".lc-kh-card img").forEach(image => fireEvent.load(image));
}

it("selects one original normal hero locally and confirms only with the CTA", () => {
  const onChoose = vi.fn();
  const { container } = render(<ChildStarterHeroes {...props} onChoose={onChoose} />);
  const confirm = screen.getByTestId("button-confirm-starter") as HTMLButtonElement;
  expect(confirm.disabled).toBe(true);
  loadAll(container);
  fireEvent.click(screen.getByTestId("button-select-starter-t-rex"));
  expect(onChoose).not.toHaveBeenCalled();
  expect(screen.getByTestId("button-select-starter-t-rex").getAttribute("aria-pressed")).toBe("true");
  fireEvent.click(screen.getByTestId("button-select-starter-princess-tiara"));
  expect(screen.getByTestId("button-select-starter-t-rex").getAttribute("aria-pressed")).toBe("false");
  expect(confirm.disabled).toBe(false);
  expect(screen.getByTestId("text-starter-stars").textContent).toContain("0 Sterne gesammelt");
  expect(screen.getByText("Erster Held kostenlos")).toBeTruthy();
  fireEvent.click(confirm);
  expect(onChoose).toHaveBeenCalledExactlyOnceWith("princess-tiara");
  expect(container.querySelector(".lc-kh-card__hero")?.getAttribute("src")).toContain("/kid-starter-media/v1/t-rex.webp");
});

it("never offers legacy heroes and does not change the established skin mapping", () => {
  render(<ChildStarterHeroes {...props} options={[{ id: "shield-blaze", name: "Legacy" }, ...options]} />);
  expect(screen.queryByTestId("button-select-starter-shield-blaze")).toBeNull();
  expect(screen.getAllByTestId(/^button-select-starter-/)).toHaveLength(3);
  expect(() => getKidStarterHeroUrl("shield-blaze")).toThrow();
});

it("enables confirmation when cached background and hero loads share one React batch", () => {
  const onChoose = vi.fn();
  const { container } = render(<ChildStarterHeroes {...props} onChoose={onChoose} />);
  act(() => {
    container.querySelectorAll(".lc-kh-card img").forEach(image => fireEvent.load(image));
  });
  fireEvent.click(screen.getByTestId("button-select-starter-t-rex"));
  expect((screen.getByTestId("button-confirm-starter") as HTMLButtonElement).disabled).toBe(false);
  fireEvent.click(screen.getByTestId("button-confirm-starter"));
  expect(onChoose).toHaveBeenCalledExactlyOnceWith("t-rex");
});

it("disables confirming and card changes while saving or transitioning", () => {
  const onChoose = vi.fn();
  const { container, rerender } = render(<ChildStarterHeroes {...props} onChoose={onChoose} />);
  loadAll(container);
  fireEvent.click(screen.getByTestId("button-select-starter-t-rex"));
  for (const state of [{ selecting: true }, { transitioning: true }]) {
    rerender(<ChildStarterHeroes {...props} {...state} onChoose={onChoose} />);
    expect((screen.getByTestId("button-confirm-starter") as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByTestId("button-select-starter-t-rex") as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByTestId("button-confirm-starter"));
  }
  expect(onChoose).not.toHaveBeenCalled();
});

it("recovers failed card images explicitly and shows selection errors", () => {
  const { container } = render(<ChildStarterHeroes {...props} error="Bitte erneut versuchen" />);
  const hero = container.querySelector(".lc-kh-card__hero")!;
  fireEvent.error(hero);
  expect(screen.getByTestId("button-retry-starter-t-rex")).toBeTruthy();
  expect(screen.getByTestId("text-starter-error").textContent).toBe("Bitte erneut versuchen");
  fireEvent.click(screen.getByTestId("button-retry-starter-t-rex"));
  expect(container.querySelector(".lc-kh-card__hero")?.getAttribute("src")).toContain("?r=1");
  loadAll(container);
  fireEvent.click(screen.getByTestId("button-select-starter-t-rex"));
  expect((screen.getByTestId("button-confirm-starter") as HTMLButtonElement).disabled).toBe(false);
});

it("links the three real progress counts to skins and the existing treasure chest", () => {
  render(<ChildStarterHeroes {...props} legacyCount={2} starsFound={8} rewardCount={3} />);
  const legacy = screen.getByTestId("link-starter-legacy");
  const stars = screen.getByTestId("link-starter-stars");
  const rewards = screen.getByTestId("link-starter-rewards");
  expect(legacy.getAttribute("href")).toBe("/skins");
  expect(legacy.textContent).toContain("2/12 Little Champs Legacy");
  expect(stars.getAttribute("href")).toBe("/skins");
  expect(stars.textContent).toContain("8/48 Sterne");
  expect(rewards.getAttribute("href")).toBe("/my-rewards");
  expect(rewards.textContent).toContain("3 Belohnungen in der Schatzkiste");
});

it("puts the exact supplied artwork in the shared background layer, not a second scroll surface", () => {
  const layer = document.createElement("div");
  document.body.append(layer);
  const { unmount } = render(
    <BackgroundLayerContext.Provider value={layer}><ChildStarterBackdrop /></BackgroundLayerContext.Provider>,
  );
  const artwork = screen.getByTestId("img-starter-banner");
  expect(layer.contains(artwork)).toBe(true);
  expect(artwork.getAttribute("src")).toBe(getKidStarterBannerUrl("de"));
  expect(getKidStarterBannerUrl("de")).toContain("/images/welcome-kid-start.webp");
  unmount();
  expect(layer.children).toHaveLength(0);
  layer.remove();
});
