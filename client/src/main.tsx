import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import "./i18n";

// iOS Safari viewport height fix
// Sets --vh CSS variable to actual viewport height (not affected by toolbar)
// This prevents layout jumps when iOS Safari toolbar appears/disappears
const setViewportHeight = () => {
  const vh = window.innerHeight * 0.01;
  document.documentElement.style.setProperty('--vh', `${vh}px`);
};

// Set initial value
setViewportHeight();

// Only update on resize and orientation change, NOT on scroll
// Updating on scroll causes jank/jumping
window.addEventListener('resize', setViewportHeight);
window.addEventListener('orientationchange', () => {
  // Delay to let iOS finish orientation animation
  setTimeout(setViewportHeight, 100);
});

createRoot(document.getElementById("root")!).render(<App />);
