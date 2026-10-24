// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { AppErrorBoundary } from "@/components/app-error-boundary";

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

it("shows a recovery screen instead of an empty app on a render error", () => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  const BrokenView = (): never => { throw new Error("Test render failure"); };
  render(<AppErrorBoundary><BrokenView /></AppErrorBoundary>);
  expect(screen.getByRole("alert").textContent).toContain("Deine Daten bleiben erhalten");
  expect(screen.getByRole("button", { name: "Erneut laden" })).toBeTruthy();
});

it("renders healthy app contents normally", () => {
  render(<AppErrorBoundary><p>Dashboard ready</p></AppErrorBoundary>);
  expect(screen.getByText("Dashboard ready")).toBeTruthy();
  expect(screen.queryByRole("alert")).toBeNull();
});

it("does not block initial painting on Google Fonts and includes a pre-React recovery path", () => {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
  const html = readFileSync(path.join(root, "index.html"), "utf8");
  const css = readFileSync(path.join(root, "src/index.css"), "utf8");
  expect(css).not.toMatch(/@import\s+url\(['"]https:\/\/fonts\.googleapis/);
  expect(html).toMatch(/media="print"[^>]+href="https:\/\/fonts\.googleapis\.com\/css2\?family=Nunito/);
  expect(html).toContain('id="lc-bootstrap"');
  expect(html).toContain("15000");
  expect(html).toContain("lc_reload");
});
