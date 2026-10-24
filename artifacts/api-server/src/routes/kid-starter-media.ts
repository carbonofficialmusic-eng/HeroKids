import { Router } from "express";
import type { File } from "@google-cloud/storage";
import { ObjectStorageService } from "../objectStorage";
import { MIXED_SKIN_ORDER } from "../shared/skin-config";
import { logger } from "../lib/logger";

// Only these public illustration assets can be read. Never accept an object path.
const publicFiles = new Set([
  ...MIXED_SKIN_ORDER.map(id => `${id}.webp`),
  "banner.webp",
  "intro-scene.webp",
  "card-background.webp",
]);
const storage = new ObjectStorageService();
const knownFiles = new Map<string, File>();
const router = Router();

router.get("/:file", async (req, res) => {
  const name = req.params.file;
  if (!publicFiles.has(name)) {
    res.status(404).end();
    return;
  }
  try {
    const file = knownFiles.get(name) ??
      await storage.searchPublicObject(`kid-starter/v1/${name}`);
    if (!file) {
      res.status(404).end();
      return;
    }
    knownFiles.set(name, file);
    res.set({
      "Content-Type": "image/webp",
      "Cache-Control": "public, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
    });
    file.createReadStream().on("error", error => {
      knownFiles.delete(name);
      logger.error({ err: error, asset: name }, "Starter hero media stream failed");
      if (!res.headersSent) res.status(502).end();
      else res.destroy();
    }).pipe(res);
  } catch (error) {
    logger.error({ err: error, asset: name }, "Starter hero media unavailable");
    res.status(503).end();
  }
});

export default router;
