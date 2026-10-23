import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { createWebServer, NO_STORE } from "./web-server.mjs";

let directory;
let server;
let origin;
before(async () => {
  directory = await mkdtemp(path.join(tmpdir(), "lc-web-delivery-"));
  await mkdir(path.join(directory, "assets"));
  await mkdir(path.join(directory, "skins", "avatars"), { recursive: true });
  await writeFile(path.join(directory, "index.html"), "<!doctype html><title>Current app</title>");
  await writeFile(path.join(directory, "build-info.json"), '{"id":"current"}');
  await writeFile(path.join(directory, "deploy-fallback-sw.js"), "// worker");
  await writeFile(path.join(directory, "assets", "index-abcdefgh.js"), "// current bundle");
  await writeFile(path.join(directory, "skins", "avatars", "hero.png"), "fake image fixture");
  server = createWebServer(directory).listen(0, "127.0.0.1");
  await new Promise(resolve => server.once("listening", resolve));
  origin = `http://127.0.0.1:${server.address().port}`;
});
after(async () => {
  await new Promise(resolve => server.close(resolve));
  await rm(directory, { recursive: true, force: true });
});

for (const route of ["/", "/index.html", "/settings", "/kid-dashboard", "/?_lc_web=current", "/build-info.json", "/deploy-fallback-sw.js"]) {
  test(`${route} cannot be reused from the HTTP cache`, async () => {
    const response = await fetch(origin + route, {
      headers: { "If-Modified-Since": "Fri, 01 Jan 2100 00:00:00 GMT" },
    });
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("cache-control"), NO_STORE);
    assert.equal(response.headers.get("last-modified"), null);
    assert.equal(response.headers.get("etag"), null);
  });
}
test("content-hashed bundles remain immutable and have a valid JavaScript MIME type", async () => {
  const response = await fetch(origin + "/assets/index-abcdefgh.js");
  assert.equal(response.status, 200);
  assert.match(response.headers.get("cache-control"), /immutable/);
  assert.match(response.headers.get("content-type"), /javascript/);
});
test("versioned skin downloads still use the persistent HTTP image cache", async () => {
  const response = await fetch(origin + "/skins/avatars/hero.png?v=10");
  assert.equal(response.status, 200);
  assert.match(response.headers.get("cache-control"), /immutable/);
});
test("missing assets and misrouted API calls do not receive the SPA HTML", async () => {
  for (const route of ["/assets/missing.js", "/missing.json", "/api/unknown", "/objects/unknown"]) {
    const response = await fetch(origin + route);
    assert.equal(response.status, 404);
  }
});
test("HEAD serves the same no-cache headers without a document body", async () => {
  const response = await fetch(origin + "/settings", { method: "HEAD" });
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), NO_STORE);
  assert.equal(await response.text(), "");
});
