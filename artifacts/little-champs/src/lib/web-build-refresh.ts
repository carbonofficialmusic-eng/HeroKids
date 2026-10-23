import { parseServerBuild } from "./layout-diagnostics";

const RELOAD_KEY = "lc-web-refresh-attempt";
const RELOAD_PARAM = "_lc_web";

function hasNativeUpdater(): boolean {
  return "__LC_NATIVE_WEB_UPDATE__" in window;
}

/** Called before rendering, or when resuming without an open editor. Never clears user data. */
export async function refreshStaleWebBuild(
  loadedBuild: string,
  canReload: () => boolean = () => true,
): Promise<boolean> {
  // The new iOS binary owns refresh safety independently of downloaded JS.
  if (hasNativeUpdater()) return false;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 3000);
  try {
    const response = await fetch(`${import.meta.env.BASE_URL}build-info.json`, {
      cache: "no-store",
      credentials: "omit",
      signal: controller.signal,
    });
    if (!response.ok) return false;
    const serverBuild = parseServerBuild(await response.json());
    const url = new URL(window.location.href);
    if (serverBuild === loadedBuild) {
      if (url.searchParams.has(RELOAD_PARAM)) {
        url.searchParams.delete(RELOAD_PARAM);
        window.history.replaceState(window.history.state, "", url);
      }
      return false;
    }
    if (!canReload()) return false;
    // One attempt per published build, including when storage is unavailable.
    // A proxy serving an old deployment must never trap the app in a reload loop.
    if (url.searchParams.get(RELOAD_PARAM) === serverBuild) return false;
    try {
      if (sessionStorage.getItem(RELOAD_KEY) === serverBuild) return false;
      sessionStorage.setItem(RELOAD_KEY, serverBuild);
    } catch {
      // The URL marker remains the loop guard in storage-restricted WebViews.
    }
    url.searchParams.set(RELOAD_PARAM, serverBuild);
    window.location.replace(url.href);
    return true;
  } catch {
    // Offline, an incomplete deploy, or a failed version check must not block startup.
    return false;
  } finally {
    clearTimeout(timeout);
  }
}

export function installWebBuildResumeCheck(loadedBuild: string): () => void {
  if (hasNativeUpdater()) return () => {};
  let hiddenAt: number | null = null;
  let pending = false;
  let editing = false;
  const onInput = () => { editing = true; };
  const onReset = () => { editing = false; };
  const canReload = () => document.visibilityState === "visible"
    && !editing
    && !document.querySelector('[role="dialog"], [role="alertdialog"], input:focus, textarea:focus, [contenteditable="true"]:focus');
  const onVisibility = async () => {
    if (document.visibilityState === "hidden") {
      hiddenAt = Date.now();
      return;
    }
    const awayFor = hiddenAt === null ? 0 : Date.now() - hiddenAt;
    hiddenAt = null;
    // Camera/picker returns and active drafts must not trigger a destructive reload.
    if (awayFor < 30_000 || pending || !canReload()) return;
    pending = true;
    try {
      await refreshStaleWebBuild(loadedBuild, canReload);
    } finally {
      pending = false;
    }
  };
  document.addEventListener("input", onInput, true);
  document.addEventListener("reset", onReset, true);
  document.addEventListener("visibilitychange", onVisibility);
  return () => {
    document.removeEventListener("input", onInput, true);
    document.removeEventListener("reset", onReset, true);
    document.removeEventListener("visibilitychange", onVisibility);
  };
}
