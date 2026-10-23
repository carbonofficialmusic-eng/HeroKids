import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const nativeDirectory = new URL("../ios/App/App/", import.meta.url);
const source = fs.readFileSync(new URL("NativeWebUpdateGuard.js", nativeDirectory), "utf8");
const build = "2026-10-23T11:11:19.569Z";

function fixture(origin = "https://littlechamps.net") {
  let now = 10000;
  let dialog = null;
  let readyState = "complete";
  let fetchResult = () => Promise.resolve({ ok: true });
  class Element extends EventTarget {
    isConnected = true;
    contains(element) { return element === this; }
  }
  class XHR extends EventTarget {
    open() {}
    send() { if (this.fail) throw new Error("send failed"); }
  }
  const document = Object.assign(new EventTarget(), {
    visibilityState: "visible",
    get readyState() { return readyState; },
    getElementById: () => ({ childElementCount: 1 }),
    querySelector: (selector) => selector.startsWith("meta") ? { content: build } : dialog,
  });
  // Object.assign evaluates getters, so use a real readyState property.
  Object.defineProperty(document, "readyState", { get: () => readyState, configurable: true });
  const location = new URL(`${origin}/kid-dashboard?keep=yes&_lc_native_web=nonce#tasks`);
  const history = { state: null, replaceState(_state, _unused, href) { this.href = href; } };
  const window = { fetch: (...args) => fetchResult(...args) };
  const context = vm.createContext({
    window, document, location, history, Element, XMLHttpRequest: XHR, URL, setTimeout,
    Date: class extends Date { static now() { return now; } },
  });
  vm.runInContext(source, context);
  return {
    window, document, location, history, Element, XHR, context,
    state: () => window.__LC_NATIVE_WEB_UPDATE__.readState(),
    advance: () => { now += 6000; },
    setDialog: (value) => { dialog = value; },
    setReady: (value) => { readyState = value; },
    setFetch: (value) => { fetchResult = value; },
    event(type, target, cancel = false) {
      const event = new Event(type, { cancelable: true });
      Object.defineProperty(event, "target", { value: target });
      if (cancel) event.preventDefault();
      document.dispatchEvent(event);
    },
  };
}

test("bundled guard reads the actual document build, not the native bundle build", () => {
  const f = fixture();
  assert.equal(f.state().build, build);
  assert.equal(f.state().safe, false, "startup grace period");
  f.advance();
  assert.equal(f.state().safe, true);
});

test("never attaches to an unrelated host or local fallback", () => {
  for (const url of ["https://example.com", "http://littlechamps.net", "capacitor://localhost"]) {
    assert.equal(fixture(url).window.__LC_NATIVE_WEB_UPDATE__, undefined);
  }
});

test("duplicate injection leaves the installed guard and request tracking intact", () => {
  const f = fixture();
  const guard = f.window.__LC_NATIVE_WEB_UPDATE__;
  const fetch = f.window.fetch;
  vm.runInContext(source, f.context);
  assert.equal(f.window.__LC_NATIVE_WEB_UPDATE__, guard);
  assert.equal(f.window.fetch, fetch);
});

test("protects hidden documents, unmounted React roots and incomplete documents", () => {
  const f = fixture();
  f.advance();
  f.document.visibilityState = "hidden";
  assert.equal(f.state().safe, false);
  f.document.visibilityState = "visible";
  f.setReady("loading");
  assert.equal(f.state().safe, false);
  f.setReady("complete");
  f.document.getElementById = () => null;
  assert.equal(f.state().safe, false);
});

test("protects dialogs, focused controls and recent interactions", () => {
  const f = fixture();
  f.advance();
  f.setDialog({});
  assert.equal(f.state().safe, false);
  f.setDialog(null);
  f.event("pointerdown", new f.Element());
  assert.equal(f.state().safe, false);
  f.advance();
  assert.equal(f.state().safe, true);
});

test("protects drafts until their editor is unmounted, not merely blurred or submitted", () => {
  const f = fixture();
  const input = new f.Element();
  f.event("input", input);
  f.event("submit", input);
  f.advance();
  assert.equal(f.state().safe, false);
  input.isConnected = false;
  assert.equal(f.state().safe, true);
});

test("also protects select/change events and respects prevented form resets", async () => {
  const f = fixture();
  const input = new f.Element();
  f.event("change", input);
  f.event("reset", input, true);
  await new Promise(resolve => setTimeout(resolve, 0));
  f.advance();
  assert.equal(f.state().safe, false);
  f.event("reset", input);
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.equal(f.state().safe, true);
});

test("does not mistake a form submit event for a successful save", () => {
  const f = fixture();
  const input = new f.Element();
  f.event("input", input);
  f.event("submit", input);
  f.advance();
  assert.equal(f.state().safe, false);
});

test("GET requests do not block a refresh or change fetch results", async () => {
  const f = fixture();
  f.advance();
  const result = { ok: true };
  f.setFetch(() => Promise.resolve(result));
  assert.equal(await f.window.fetch("/api/tasks"), result);
  assert.equal(f.state().safe, true);
});

test("protects pending fetch writes and waits after they complete", async () => {
  const f = fixture();
  let finish;
  f.setFetch(() => new Promise(resolve => { finish = resolve; }));
  const response = f.window.fetch("/api/tasks", { method: "POST" });
  f.advance();
  assert.equal(f.state().safe, false);
  finish({ ok: true });
  await response;
  assert.equal(f.state().safe, false, "post-write grace");
  f.advance();
  assert.equal(f.state().safe, true);
});

test("tracks Request.method, preserves rejected fetch errors and releases the guard", async () => {
  const f = fixture();
  const error = new Error("offline");
  f.setFetch(() => Promise.reject(error));
  await assert.rejects(f.window.fetch({ method: "DELETE" }), (value) => value === error);
  f.advance();
  assert.equal(f.state().safe, true);
});

test("preserves synchronously thrown fetch errors without leaking pending counts", () => {
  const f = fixture();
  f.setFetch(() => { throw new Error("invalid request"); });
  assert.throws(() => f.window.fetch("/api/tasks", { method: "POST" }), /invalid request/);
  f.advance();
  assert.equal(f.state().safe, true);
});

test("protects XMLHttpRequest uploads until loadend, including failures", () => {
  const f = fixture();
  const xhr = new f.XHR();
  xhr.open("POST", "/api/upload");
  xhr.send("image");
  f.advance();
  assert.equal(f.state().safe, false);
  xhr.dispatchEvent(new Event("loadend"));
  f.advance();
  assert.equal(f.state().safe, true);
  xhr.open("POST", "/api/upload");
  xhr.fail = true;
  assert.throws(() => xhr.send(), /send failed/);
  f.advance();
  assert.equal(f.state().safe, true);
});

test("removes only the native cache marker without navigating or dropping the route", () => {
  const f = fixture();
  f.document.dispatchEvent(new Event("DOMContentLoaded"));
  const target = new URL(f.history.href);
  assert.equal(target.pathname, "/kid-dashboard");
  assert.equal(target.searchParams.get("keep"), "yes");
  assert.equal(target.searchParams.has("_lc_native_web"), false);
  assert.equal(target.hash, "#tasks");
});

test("Xcode registers the updater source and guard resource outside downloaded web assets", () => {
  const project = fs.readFileSync(new URL("../App.xcodeproj/project.pbxproj", nativeDirectory), "utf8");
  const resources = project.match(/Begin PBXResourcesBuildPhase section[\s\S]*?End PBXResourcesBuildPhase section/)[0];
  const sources = project.match(/Begin PBXSourcesBuildPhase section[\s\S]*?End PBXSourcesBuildPhase section/)[0];
  assert.match(resources, /NativeWebUpdateGuard\.js in Resources/);
  assert.match(sources, /NativeWebUpdater\.swift in Sources/);
  const updater = fs.readFileSync(new URL("NativeWebUpdater.swift", nativeDirectory), "utf8");
  const controller = fs.readFileSync(new URL("ViewController.swift", nativeDirectory), "utf8");
  assert.match(updater, /override func load\(_ request: URLRequest\)/);
  assert.match(updater, /\.reloadIgnoringLocalAndRemoteCacheData/);
  assert.match(updater, /injectionTime: \.atDocumentStart/);
  assert.match(updater, /forMainFrameOnly: true/);
  assert.match(updater, /attemptedBuilds\.contains\(build\.id\)/);
  assert.match(updater, /webView\.url == navigationURL/);
  assert.match(controller, /FreshStartWebView\(frame:/);
  assert.match(controller, /webUpdater\.check\(webView:/);
  assert.match(controller, /presentedViewController == nil/);
  assert.match(controller, /webUpdater\.suspend\(\)/);
  assert.doesNotMatch(updater, /removeData|removeAll|nonPersistent|navigationDelegate\s*=/);
});
