import { Component, type ErrorInfo, type ReactNode } from "react";

/** Keep render errors from leaving the whole WebView blank. Never clear user data. */
export class AppErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[Little Champs] App render failed", error, info.componentStack);
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div
        role="alert"
        data-testid="app-render-error"
        style={{ position: "fixed", inset: 0, zIndex: 10000, display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center", gap: 16, padding: 24,
          background: "#101d35", color: "#fff", font: "16px/1.5 system-ui,sans-serif", textAlign: "center" }}
      >
        <strong style={{ fontSize: 24, color: "#ffd264" }}>Little Champs</strong>
        <p>Die Ansicht konnte nicht geladen werden. Deine Daten bleiben erhalten.</p>
        <button
          type="button"
          data-testid="button-reload-app"
          style={{ border: 0, borderRadius: 12, padding: "12px 24px", background: "#ffd264",
            color: "#342300", font: "700 16px system-ui,sans-serif" }}
          onClick={() => {
            const url = new URL(window.location.href);
            url.searchParams.set("lc_reload", String(Date.now()));
            window.location.replace(url.href);
          }}
        >
          Erneut laden
        </button>
      </div>
    );
  }
}
