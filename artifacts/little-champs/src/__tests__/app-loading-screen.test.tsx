// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { AppLoadingScreen } from "@/components/app-loading-screen";

afterEach(cleanup);

it("matches the bootstrap logo size, pulse and black background without a spinner", () => {
  render(<AppLoadingScreen />);
  const loader = screen.getByTestId("app-loading-screen");
  const logo = screen.getByAltText("Little Champs");
  expect(loader.style.background).toBe("rgb(0, 0, 0)");
  expect(logo.className).toBe("lc-bootstrap-logo");
  expect(logo.getAttribute("width")).toBe("96");
  expect(logo.getAttribute("height")).toBe("96");
  expect(logo.getAttribute("src")).toContain("/images/little-champs-logo.webp");
  expect(loader.textContent).toBe("");
  expect(loader.querySelector(".animate-spin")).toBeNull();
});

it("uses the same loading screen across authentication, redirects and both dashboards", () => {
  for (const file of [
    "../App.tsx", "../components/ProtectedRoute.tsx",
    "../pages/auto-redirect.tsx", "../pages/dashboard.tsx", "../pages/kid-dashboard.tsx",
  ]) {
    const source = readFileSync(new URL(file, import.meta.url), "utf8");
    expect(source).toContain("return <AppLoadingScreen />;");
  }
});
