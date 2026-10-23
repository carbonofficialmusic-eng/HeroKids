// Bundled with iOS, not downloaded with the web app. Runs before page scripts.
(() => {
  if (location.protocol !== "https:" || location.hostname !== "littlechamps.net"
    || window.__LC_NATIVE_WEB_UPDATE__) return;

  const dirtyInputs = new Set();
  let pendingWrites = 0;
  let lastInteraction = Date.now();
  const markInteraction = () => { lastInteraction = Date.now(); };
  const markInput = (event) => {
    markInteraction();
    if (event.target instanceof Element) dirtyInputs.add(event.target);
  };
  document.addEventListener("input", markInput, true);
  document.addEventListener("change", markInput, true);
  document.addEventListener("pointerdown", markInteraction, true);
  document.addEventListener("keydown", markInteraction, true);
  document.addEventListener("submit", markInteraction, true);
  document.addEventListener("reset", (event) => {
    // A reset may be prevented; keep the conservative draft guard in that case.
    setTimeout(() => {
      if (event.defaultPrevented) return;
      for (const element of dirtyInputs) {
        if (event.target.contains(element)) dirtyInputs.delete(element);
      }
    }, 0);
  }, true);

  const isWrite = (method) => !["GET", "HEAD", "OPTIONS"].includes(String(method || "GET").toUpperCase());
  const originalFetch = window.fetch;
  window.fetch = function (...args) {
    const [input, init] = args;
    const write = isWrite(init?.method || input?.method);
    if (write) pendingWrites += 1;
    const finish = () => {
      if (write) {
        pendingWrites -= 1;
        markInteraction();
      }
    };
    try {
      return originalFetch.apply(this, args).then(
        (response) => { finish(); return response; },
        (error) => { finish(); throw error; },
      );
    } catch (error) {
      finish();
      throw error;
    }
  };

  const methods = new WeakMap();
  const originalOpen = XMLHttpRequest.prototype.open;
  const originalSend = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.open = function (method, ...args) {
    const result = originalOpen.call(this, method, ...args);
    methods.set(this, method);
    return result;
  };
  XMLHttpRequest.prototype.send = function (...args) {
    if (!isWrite(methods.get(this))) return originalSend.apply(this, args);
    pendingWrites += 1;
    let finished = false;
    const finish = () => {
      if (finished) return;
      finished = true;
      pendingWrites -= 1;
      markInteraction();
      this.removeEventListener("loadend", finish);
    };
    this.addEventListener("loadend", finish);
    try {
      return originalSend.apply(this, args);
    } catch (error) {
      finish();
      throw error;
    }
  };

  window.__LC_NATIVE_WEB_UPDATE__ = Object.freeze({
    readState() {
      // Unmounted editors no longer contain drafts. Never infer that a submit
      // succeeded just from a click or submit event.
      for (const element of dirtyInputs) {
        if (!element.isConnected) dirtyInputs.delete(element);
      }
      return {
        build: document.querySelector('meta[name="lc-web-build"]')?.content || "",
        safe: document.visibilityState === "visible"
          && document.readyState === "complete"
          && (document.getElementById("root")?.childElementCount || 0) > 0
          && dirtyInputs.size === 0
          && pendingWrites === 0
          && Date.now() - lastInteraction >= 5000
          && !document.querySelector(
            '[role="dialog"], [role="alertdialog"], dialog[open], input:focus, textarea:focus, select:focus, [contenteditable]:focus',
          ),
      };
    },
  });

  document.addEventListener("DOMContentLoaded", () => {
    // Keep the cache buster out of shared links, preserving route/query/hash.
    const url = new URL(location.href);
    if (!url.searchParams.has("_lc_native_web")) return;
    url.searchParams.delete("_lc_native_web");
    history.replaceState(history.state, "", url.href);
  }, { once: true });
})();
