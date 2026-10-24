// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { BackgroundLayerContext } from "@/components/background-layer";
import { ParentStartBackdrop } from "@/components/parent-start-screen";

afterEach(() => { cleanup(); document.body.innerHTML = ""; });

it("paints the welcome artwork in the existing skin background, outside clipped page content", () => {
  const background = document.createElement("div");
  background.style.position = "fixed";
  background.dataset.backgroundLayer = "";
  document.body.appendChild(background);
  const { container, rerender } = render(
    <BackgroundLayerContext.Provider value={background}>
      <div className="lc-dashboard overflow-x-clip"><ParentStartBackdrop /></div>
    </BackgroundLayerContext.Provider>,
  );
  const image = screen.getByTestId("img-parent-start-background");
  expect(background.contains(image)).toBe(true);
  expect(container.contains(image)).toBe(false);
  expect(image.style.backgroundImage).toContain("/images/welcome-start.webp");
  expect(image.tagName).toBe("DIV");
  rerender(<BackgroundLayerContext.Provider value={background}><div /></BackgroundLayerContext.Provider>);
  expect(background.childElementCount).toBe(0);
});

it("attaches the image after the shared background ref becomes available", () => {
  const { rerender } = render(
    <BackgroundLayerContext.Provider value={null}><ParentStartBackdrop /></BackgroundLayerContext.Provider>,
  );
  expect(screen.queryByTestId("img-parent-start-background")).toBeNull();
  const background = document.createElement("div");
  document.body.appendChild(background);
  rerender(
    <BackgroundLayerContext.Provider value={background}><ParentStartBackdrop /></BackgroundLayerContext.Provider>,
  );
  expect(background.contains(screen.getByTestId("img-parent-start-background"))).toBe(true);
});
