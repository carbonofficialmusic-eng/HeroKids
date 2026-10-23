import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const NO_STORE = "no-store, no-cache, must-revalidate";

/** Production SPA delivery: HTML is always fresh, content-hashed assets stay cached. */
export function createWebServer(publicDir) {
  const app = express();
  app.disable("x-powered-by");
  app.disable("etag");
  app.use((_request, response, next) => {
    response.setHeader("Cache-Control", NO_STORE);
    response.setHeader("X-Content-Type-Options", "nosniff");
    next();
  });
  app.use(express.static(publicDir, {
    index: false,
    etag: false,
    lastModified: false,
    setHeaders(response, filePath) {
      const relative = path.relative(publicDir, filePath).split(path.sep).join("/");
      const versionedSkin = /^skins\/(?:avatars|backgrounds)\/.+\.(?:png|webp|jpe?g)$/.test(relative)
        && typeof response.req.query.v === "string";
      if (versionedSkin || /^assets\/.+-[\w-]{8,}\.(?:js|css|woff2?|png|jpe?g|webp|svg)$/.test(relative)) {
        response.setHeader("Cache-Control", "public, max-age=31536000, immutable");
      }
    },
  }));
  app.get("*", (request, response, next) => {
    // Missing JS, images, JSON, or unknown API URLs must not become HTML/200.
    if (path.extname(request.path) || !request.accepts("html")
      || /^\/(?:api|ws|objects)(?:\/|$)/.test(request.path)) return next();
    response.sendFile(path.join(publicDir, "index.html"), {
      etag: false,
      lastModified: false,
      cacheControl: false,
    });
  });
  app.use((_request, response) => response.status(404).end());
  return app;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.PORT);
  if (!Number.isInteger(port) || port < 1) throw new Error("PORT must be a positive integer");
  const publicDir = fileURLToPath(new URL("../dist/public/", import.meta.url));
  createWebServer(publicDir).listen(port, "0.0.0.0", () => {
    console.log(`Little Champs web server listening on ${port}`);
  });
}
