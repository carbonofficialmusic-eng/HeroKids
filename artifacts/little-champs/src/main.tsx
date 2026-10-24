import { createRoot } from "react-dom/client";
import App from "./App";
import { AppErrorBoundary } from "@/components/app-error-boundary";
import "./index.css";
import "./i18n";
import { installPreviewLayoutWarningFilter } from "./lib/preview-layout-warning";
import { installPhoneLandscapeLayout } from "./lib/phone-landscape";
import { isNativePlatform } from "./lib/platform";
import { WEB_BUILD_ID } from "./lib/layout-diagnostics";
import { refreshStaleWebBuild, installWebBuildResumeCheck } from "./lib/web-build-refresh";

const removePhoneLandscapeLayout = installPhoneLandscapeLayout(isNativePlatform());
if (import.meta.hot) {
  import.meta.hot.dispose(removePhoneLandscapeLayout);
}

if (import.meta.env.DEV) {
  installPreviewLayoutWarningFilter(window);
}

// When the app updates, old cached chunk hashes no longer exist on the server.
// Vite fires this event when a dynamic import fails (404). Force a full reload
// so the browser fetches the fresh HTML with the new chunk filenames.
window.addEventListener("vite:preloadError", () => {
  window.location.reload();
});

// Keep a self-contained deploy fallback available for returning web users.
// During a deployment handover the proxy can briefly return a 5xx response
// before React loads, so the in-app ServerStatusGuard cannot render yet.
if (import.meta.env.PROD && "serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/deploy-fallback-sw.js").catch((error) => {
      console.warn("Deploy fallback service worker could not be registered:", error);
    });
  });
}

async function startApp() {
  if (import.meta.env.PROD && await refreshStaleWebBuild(WEB_BUILD_ID)) return;
  createRoot(document.getElementById("root")!).render(<AppErrorBoundary><App /></AppErrorBoundary>);
  if (import.meta.env.PROD) installWebBuildResumeCheck(WEB_BUILD_ID);
}

void startApp();
