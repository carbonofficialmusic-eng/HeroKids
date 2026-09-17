import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import "./i18n";

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

createRoot(document.getElementById("root")!).render(<App />);
