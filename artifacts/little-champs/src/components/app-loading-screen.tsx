import { APP_LOGO_URL } from "@/lib/brand-assets";

/** Match the HTML bootstrap so every startup stage shows the same loader. */
export function AppLoadingScreen() {
  return (
    <div
      role="status"
      aria-label="Little Champs"
      data-testid="app-loading-screen"
      style={{ position: "fixed", inset: 0, zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center", background: "#000" }}
    >
      <img src={APP_LOGO_URL} width={96} height={96} className="lc-bootstrap-logo" alt="Little Champs" />
    </div>
  );
}
