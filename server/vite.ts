import express, { type Express } from "express";
import fs from "fs";
import path from "path";
import { createServer as createViteServer, createLogger } from "vite";
import { type Server } from "http";
import viteConfig from "../vite.config";
import { nanoid } from "nanoid";

const viteLogger = createLogger();

const SPA_ROUTES = new Set([
  "/",
  "/setup",
  "/link-device",
  "/kid-dashboard",
  "/kid-dashboard-old",
  "/pricing",
  "/auth/close",
  "/privacy",
  "/impressum",
  "/terms",
  "/admin",
  "/dashboard",
  "/my-rewards",
  "/active-rewards",
  "/my-achievements",
  "/tasks",
  "/rewards",
  "/leaderboard",
  "/skins",
  "/skins-gallery",
  "/analytics",
  "/chat",
  "/approvals",
  "/rewards-board",
  "/settings",
  "/achievements",
  "/account",
  "/family-goals",
  "/ios-test",
]);

// Matches /ios-test/<single-segment> for the `:variant` route param only.
const IOS_TEST_VARIANT_RE = /^\/ios-test\/[^/]+$/;

function isSpaRoute(url: string): boolean {
  // Strip query string, hash, and normalize a trailing slash to the bare path.
  let pathname = url.split("?")[0].split("#")[0];
  if (pathname !== "/" && pathname.endsWith("/")) {
    pathname = pathname.slice(0, -1);
  }
  if (SPA_ROUTES.has(pathname)) return true;
  // Allow the single parameterised route: /ios-test/:variant
  if (IOS_TEST_VARIANT_RE.test(pathname)) return true;
  return false;
}

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

export async function setupVite(app: Express, server: Server) {
  const serverOptions = {
    middlewareMode: true,
    hmr: { server },
    allowedHosts: true as const,
  };

  const vite = await createViteServer({
    ...viteConfig,
    configFile: false,
    customLogger: {
      ...viteLogger,
      error: (msg, options) => {
        viteLogger.error(msg, options);
        process.exit(1);
      },
    },
    server: serverOptions,
    appType: "custom",
  });

  app.use(vite.middlewares);
  app.use("*", async (req, res, next) => {
    const url = req.originalUrl;

    if (!isSpaRoute(url)) {
      res.status(404).set({ "Content-Type": "text/plain" }).end("Not Found");
      return;
    }

    try {
      const clientTemplate = path.resolve(
        import.meta.dirname,
        "..",
        "client",
        "index.html",
      );

      // always reload the index.html file from disk incase it changes
      let template = await fs.promises.readFile(clientTemplate, "utf-8");
      template = template.replace(
        `src="/src/main.tsx"`,
        `src="/src/main.tsx?v=${nanoid()}"`,
      );
      const page = await vite.transformIndexHtml(url, template);
      res.status(200).set({ "Content-Type": "text/html" }).end(page);
    } catch (e) {
      vite.ssrFixStacktrace(e as Error);
      next(e);
    }
  });
}

export function serveStatic(app: Express) {
  const distPath = path.resolve(import.meta.dirname, "public");

  if (!fs.existsSync(distPath)) {
    throw new Error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`,
    );
  }

  app.use(express.static(distPath));

  // fall through to index.html for known SPA routes; return 404 for everything else
  app.use("*", (req, res) => {
    if (!isSpaRoute(req.originalUrl)) {
      res.status(404).set({ "Content-Type": "text/plain" }).end("Not Found");
      return;
    }
    res.sendFile(path.resolve(distPath, "index.html"));
  });
}
