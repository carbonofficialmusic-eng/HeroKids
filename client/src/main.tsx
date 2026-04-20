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

createRoot(document.getElementById("root")!).render(<App />);
