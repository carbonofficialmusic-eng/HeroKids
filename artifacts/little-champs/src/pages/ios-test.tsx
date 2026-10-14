import { useState, useEffect, useLayoutEffect } from "react";
import { useLocation } from "wouter";

// ── helpers ────────────────────────────────────────────────────────────────

function measureEnv(): number {
  const d = document.createElement("div");
  d.style.cssText =
    "position:fixed;top:0;left:0;height:env(safe-area-inset-top,0px);width:1px;visibility:hidden;pointer-events:none";
  document.body.appendChild(d);
  const px = parseFloat(getComputedStyle(d).height) || 0;
  document.body.removeChild(d);
  return px;
}

function btn(label: string, onClick: () => void, color = "#334155") {
  return (
    <button
      onClick={onClick}
      style={{
        display: "block",
        width: "100%",
        padding: "14px 16px",
        marginBottom: "10px",
        background: color,
        color: "white",
        fontWeight: 700,
        fontSize: 15,
        border: "none",
        borderRadius: 10,
        textAlign: "left",
        cursor: "pointer",
        WebkitTapHighlightColor: "transparent",
      }}
    >
      {label}
    </button>
  );
}

// ── debug strip ────────────────────────────────────────────────────────────

function DebugStrip({ label }: { label: string }) {
  const [line, setLine] = useState("...");
  useEffect(() => {
    const tick = () => {
      const env = measureEnv();
      const sat =
        getComputedStyle(document.documentElement)
          .getPropertyValue("--sat")
          .trim() || "unset";
      const root = document.getElementById("root");
      setLine(
        `env=${env}px | --sat=${sat} | ih=${window.innerHeight} | rootST=${root?.scrollTop ?? "?"}`
      );
    };
    tick();
    const t = setInterval(tick, 800);
    return () => clearInterval(t);
  }, []);
  return (
    <div
      style={{
        position: "fixed",
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 99999,
        background: "rgba(0,0,0,0.9)",
        color: "lime",
        fontSize: 10,
        padding: "4px 6px 6px",
        fontFamily: "monospace",
        pointerEvents: "none",
      }}
    >
      <span style={{ color: "#facc15" }}>{label} · </span>
      {line}
    </div>
  );
}

// ── shared content ─────────────────────────────────────────────────────────

function Content({ name, go }: { name: string; go: (path: string) => void }) {
  return (
    <div style={{ padding: "16px 16px 80px" }}>
      <p style={{ color: "rgba(255,255,255,0.6)", fontSize: 13, marginBottom: 20 }}>
        Sitzt der Balken direkt unter der Uhrzeit (Statusleiste)?{"\n"}
        Tippe auf eine andere Variante, dann komm zurück — sitzt er noch?
      </p>
      {["A", "B", "C", "D"]
        .filter((v) => v !== name)
        .map((v) => btn(`→ Variante ${v} (direkt wechseln)`, () => go(`/ios-test/${v.toLowerCase()}`), "#1e293b"))}
      {btn(
        "→ Zwischen-Seite (scrollen) dann zurück",
        () => go(`/ios-test/scroll?back=${name.toLowerCase()}`),
        "#0f4c75"
      )}
      {btn("← Zurück zur echten App", () => go("/"), "#1a1a1a")}
    </div>
  );
}

// ── Variante A: position:fixed + flex-shrink-0 ─────────────────────────────

function VariantA({ go }: { go: (p: string) => void }) {
  useLayoutEffect(() => {
    const root = document.getElementById("root");
    if (root) root.style.overflowY = "hidden";
    return () => { const r = document.getElementById("root"); if (r) r.style.overflowY = "auto"; };
  }, []);
  return (
    <div style={{ position: "fixed", inset: 0, display: "flex", flexDirection: "column", overflow: "hidden", zIndex: 1, background: "#0f0f2d" }}>
      <header style={{
        flexShrink: 0, background: "#4f46e5",
        paddingTop: "var(--sat, env(safe-area-inset-top))",
        height: "calc(4rem + var(--sat, env(safe-area-inset-top)))",
        display: "flex", alignItems: "flex-end",
      }}>
        <div style={{ height: "4rem", display: "flex", alignItems: "center", padding: "0 16px", color: "white", fontWeight: 700, fontSize: 15 }}>
          A — fixed + flex-shrink-0
        </div>
      </header>
      <div style={{ flex: 1, overflowY: "auto" }}>
        <Content name="A" go={go} />
      </div>
      <DebugStrip label="A" />
    </div>
  );
}

// ── Variante B: sticky top:0 (wie Parent-Dashboard) ───────────────────────

function VariantB({ go }: { go: (p: string) => void }) {
  useLayoutEffect(() => {
    const root = document.getElementById("root");
    if (root) { root.scrollTop = 0; root.style.overflowY = "auto"; }
  }, []);
  return (
    <div style={{ minHeight: "100%", background: "#0d1f0d" }}>
      <header style={{
        position: "sticky", top: 0, zIndex: 40, background: "#16a34a",
        paddingTop: "var(--sat, env(safe-area-inset-top))",
        height: "calc(4rem + var(--sat, env(safe-area-inset-top)))",
        display: "flex", alignItems: "flex-end",
      }}>
        <div style={{ height: "4rem", display: "flex", alignItems: "center", padding: "0 16px", color: "white", fontWeight: 700, fontSize: 15 }}>
          B — sticky top:0 (wie Parent)
        </div>
      </header>
      <Content name="B" go={go} />
      <DebugStrip label="B" />
    </div>
  );
}

// ── Variante C: paddingTop auf #root ──────────────────────────────────────

function VariantC({ go }: { go: (p: string) => void }) {
  useLayoutEffect(() => {
    const root = document.getElementById("root");
    if (root) { root.scrollTop = 0; root.style.overflowY = "auto"; root.style.paddingTop = "var(--sat, env(safe-area-inset-top))"; }
    return () => { const r = document.getElementById("root"); if (r) r.style.paddingTop = ""; };
  }, []);
  return (
    <div style={{ minHeight: "100%", background: "#120d1f" }}>
      <header style={{
        position: "sticky", top: 0, zIndex: 40, background: "#7c3aed",
        height: "4rem", display: "flex", alignItems: "center",
        padding: "0 16px", color: "white", fontWeight: 700, fontSize: 15,
      }}>
        C — paddingTop auf #root
      </header>
      <Content name="C" go={go} />
      <DebugStrip label="C" />
    </div>
  );
}

// ── Variante D: fixed container, Padding auf Container ────────────────────

function VariantD({ go }: { go: (p: string) => void }) {
  useLayoutEffect(() => {
    const root = document.getElementById("root");
    if (root) root.style.overflowY = "hidden";
    return () => { const r = document.getElementById("root"); if (r) r.style.overflowY = "auto"; };
  }, []);
  return (
    <div style={{
      position: "fixed", inset: 0, display: "flex", flexDirection: "column",
      background: "#1f0d0d",
      paddingTop: "var(--sat, env(safe-area-inset-top))",
    }}>
      <header style={{
        flexShrink: 0, height: "4rem", background: "#dc2626",
        display: "flex", alignItems: "center",
        padding: "0 16px", color: "white", fontWeight: 700, fontSize: 15,
      }}>
        D — fixed container + paddingTop
      </header>
      <div style={{ flex: 1, overflowY: "auto" }}>
        <Content name="D" go={go} />
      </div>
      <DebugStrip label="D" />
    </div>
  );
}

// ── Zwischen-Seite: scrollbarer Inhalt ────────────────────────────────────

function ScrollPage({ backTo, go }: { backTo: string; go: (p: string) => void }) {
  useLayoutEffect(() => {
    const root = document.getElementById("root");
    if (root) { root.scrollTop = 0; root.style.overflowY = "auto"; }
  }, []);
  const label = backTo.toUpperCase();
  return (
    <div style={{ minHeight: "150vh", background: "#0c1a2e" }}>
      <header style={{
        position: "sticky", top: 0, zIndex: 40, background: "#0ea5e9",
        paddingTop: "var(--sat, env(safe-area-inset-top))",
        height: "calc(4rem + var(--sat, env(safe-area-inset-top)))",
        display: "flex", alignItems: "flex-end",
      }}>
        <div style={{ height: "4rem", display: "flex", alignItems: "center", padding: "0 16px", color: "white", fontWeight: 700, fontSize: 15 }}>
          Scrolle bis ganz unten → dann zurück
        </div>
      </header>
      <div style={{ padding: "16px 16px 80px", color: "white" }}>
        {btn(`← Zurück zu Variante ${label} (von oben)`, () => go(`/ios-test/${backTo}`), "#0369a1")}
        <p style={{ fontSize: 13, opacity: 0.6, margin: "12px 0" }}>
          Scrolle diese Seite jetzt komplett herunter, dann tippe auf den Link unten.
        </p>
        {Array.from({ length: 25 }).map((_, i) => (
          <div key={i} style={{ padding: "10px", marginBottom: 6, background: "rgba(255,255,255,0.05)", borderRadius: 6, fontSize: 13 }}>
            Zeile {i + 1} — scroll weiter runter…
          </div>
        ))}
        {btn(`← Zurück zu Variante ${label} (von unten)`, () => go(`/ios-test/${backTo}`), "#0369a1")}
      </div>
      <DebugStrip label="Scroll-Seite" />
    </div>
  );
}

// ── main export ────────────────────────────────────────────────────────────

export default function IosTest({ variant }: { variant?: string }) {
  const [, navigate] = useLocation();
  const go = (path: string) => navigate(path);

  const v = (variant || "a").toLowerCase();

  // zwischen-seite: /ios-test/scroll?back=a
  if (v === "scroll") {
    const backTo =
      typeof window !== "undefined"
        ? new URLSearchParams(window.location.search).get("back") || "a"
        : "a";
    return <ScrollPage backTo={backTo} go={go} />;
  }

  if (v === "b") return <VariantB go={go} />;
  if (v === "c") return <VariantC go={go} />;
  if (v === "d") return <VariantD go={go} />;
  return <VariantA go={go} />;
}
