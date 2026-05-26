import { useState, useEffect, useLayoutEffect, useRef } from "react";
import { Link } from "wouter";

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

function getSat(): string {
  return (
    getComputedStyle(document.documentElement)
      .getPropertyValue("--sat")
      .trim() || "unset"
  );
}

// ── debug bar ──────────────────────────────────────────────────────────────

function DebugBar({ label }: { label: string }) {
  const [vals, setVals] = useState("...");
  useEffect(() => {
    const update = () => {
      const env = measureEnv();
      const sat = getSat();
      const root = document.getElementById("root");
      setVals(
        `env=${env}px | --sat=${sat} | ih=${window.innerHeight} | rootST=${root?.scrollTop ?? "?"}`
      );
    };
    update();
    const t = setInterval(update, 1000);
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
        background: "rgba(0,0,0,0.85)",
        color: "lime",
        fontSize: 10,
        padding: "3px 6px",
        fontFamily: "monospace",
        pointerEvents: "none",
        lineHeight: 1.4,
      }}
    >
      <div style={{ color: "#facc15" }}>{label}</div>
      <div>{vals}</div>
    </div>
  );
}

// ── VARIANTE A: position:fixed outer + flex-shrink-0 header (aktueller Code) ─

function VariantA() {
  useLayoutEffect(() => {
    const root = document.getElementById("root");
    if (root) root.style.overflowY = "hidden";
    return () => {
      if (root) root.style.overflowY = "auto";
    };
  }, []);

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        zIndex: 1,
        background: "#1e1b4b",
      }}
    >
      <header
        style={{
          flexShrink: 0,
          background: "#4f46e5",
          paddingTop: "var(--sat, env(safe-area-inset-top))",
          height: "calc(4rem + var(--sat, env(safe-area-inset-top)))",
        }}
      >
        <div
          style={{
            height: "4rem",
            display: "flex",
            alignItems: "center",
            padding: "0 1rem",
            color: "white",
            fontWeight: "bold",
          }}
        >
          A — fixed+flex-shrink-0
        </div>
      </header>
      <div style={{ flex: 1, overflowY: "auto", padding: "1rem", color: "white" }}>
        <NavButtons variant="A" />
      </div>
      <DebugBar label="Variante A: position:fixed + flex-shrink-0" />
    </div>
  );
}

// ── VARIANTE B: sticky top-0 header in normalem flow ──────────────────────

function VariantB() {
  useLayoutEffect(() => {
    const root = document.getElementById("root");
    if (root) {
      root.scrollTop = 0;
      root.style.overflowY = "auto";
    }
  }, []);

  return (
    <div style={{ minHeight: "100%", background: "#1a2e1a" }}>
      <header
        style={{
          position: "sticky",
          top: 0,
          zIndex: 40,
          background: "#16a34a",
          paddingTop: "var(--sat, env(safe-area-inset-top))",
          height: "calc(4rem + var(--sat, env(safe-area-inset-top)))",
        }}
      >
        <div
          style={{
            height: "4rem",
            display: "flex",
            alignItems: "center",
            padding: "0 1rem",
            color: "white",
            fontWeight: "bold",
          }}
        >
          B — sticky top:0 (wie Parent)
        </div>
      </header>
      <div style={{ padding: "1rem", color: "white" }}>
        <NavButtons variant="B" />
      </div>
      <DebugBar label="Variante B: sticky top:0 (wie Parent-Dashboard)" />
    </div>
  );
}

// ── VARIANTE C: paddingTop direkt auf #root (body-level) ──────────────────

function VariantC() {
  useLayoutEffect(() => {
    const root = document.getElementById("root");
    if (root) {
      root.scrollTop = 0;
      root.style.overflowY = "auto";
      root.style.paddingTop = "var(--sat, env(safe-area-inset-top))";
    }
    return () => {
      const root = document.getElementById("root");
      if (root) root.style.paddingTop = "";
    };
  }, []);

  return (
    <div style={{ minHeight: "100%", background: "#1a1a2e" }}>
      <header
        style={{
          background: "#7c3aed",
          height: "4rem",
          display: "flex",
          alignItems: "center",
          padding: "0 1rem",
          color: "white",
          fontWeight: "bold",
          position: "sticky",
          top: 0,
          zIndex: 40,
        }}
      >
        C — paddingTop auf #root
      </header>
      <div style={{ padding: "1rem", color: "white" }}>
        <NavButtons variant="C" />
      </div>
      <DebugBar label="Variante C: paddingTop direkt auf #root" />
    </div>
  );
}

// ── VARIANTE D: position:fixed + paddingTop auf dem CONTAINER selbst ───────

function VariantD() {
  useLayoutEffect(() => {
    const root = document.getElementById("root");
    if (root) root.style.overflowY = "hidden";
    return () => {
      const root = document.getElementById("root");
      if (root) root.style.overflowY = "auto";
    };
  }, []);

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        display: "flex",
        flexDirection: "column",
        background: "#2d1515",
        paddingTop: "var(--sat, env(safe-area-inset-top))",
      }}
    >
      <header
        style={{
          flexShrink: 0,
          height: "4rem",
          background: "#dc2626",
          display: "flex",
          alignItems: "center",
          padding: "0 1rem",
          color: "white",
          fontWeight: "bold",
        }}
      >
        D — fixed container + paddingTop
      </header>
      <div style={{ flex: 1, overflowY: "auto", padding: "1rem", color: "white" }}>
        <NavButtons variant="D" />
      </div>
      <DebugBar label="Variante D: fixed container mit paddingTop (kein header-padding)" />
    </div>
  );
}

// ── Navigation ─────────────────────────────────────────────────────────────

function NavButtons({ variant }: { variant: string }) {
  const variants = ["A", "B", "C", "D"];
  return (
    <div>
      <p style={{ marginBottom: "1rem", opacity: 0.7, fontSize: 13 }}>
        Aktuell: <strong>Variante {variant}</strong>
        <br />
        Schau ob der farbige Header direkt unter der Statusleiste sitzt.
        <br />
        Navigiere zu einer anderen Variante und zurück — sitzt er immer noch richtig?
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
        {variants
          .filter((v) => v !== variant)
          .map((v) => (
            <Link key={v} href={`/ios-test/${v.toLowerCase()}`}>
              <div
                style={{
                  background: "rgba(255,255,255,0.15)",
                  padding: "0.75rem 1rem",
                  borderRadius: 8,
                  color: "white",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                → Variante {v} testen
              </div>
            </Link>
          ))}
        <Link href="/ios-test/between">
          <div
            style={{
              background: "rgba(255,255,200,0.2)",
              padding: "0.75rem 1rem",
              borderRadius: 8,
              color: "white",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            → Zwischen-Seite (simuliert Parent→Kid Navigation)
          </div>
        </Link>
        <Link href="/">
          <div
            style={{
              background: "rgba(255,255,255,0.08)",
              padding: "0.75rem 1rem",
              borderRadius: 8,
              color: "white",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            ← Zurück zur App
          </div>
        </Link>
      </div>
    </div>
  );
}

// ── Zwischen-Seite (scrollbarer Inhalt wie Parent-Dashboard) ───────────────

function BetweenPage({ returnTo }: { returnTo: string }) {
  useLayoutEffect(() => {
    const root = document.getElementById("root");
    if (root) root.style.overflowY = "auto";
    return () => {
      const root = document.getElementById("root");
      if (root) root.style.overflowY = "auto";
    };
  }, []);

  return (
    <div style={{ minHeight: "100%", background: "#0f172a" }}>
      <header
        style={{
          position: "sticky",
          top: 0,
          zIndex: 40,
          background: "#0ea5e9",
          paddingTop: "var(--sat, env(safe-area-inset-top))",
          height: "calc(4rem + var(--sat, env(safe-area-inset-top)))",
        }}
      >
        <div
          style={{
            height: "4rem",
            display: "flex",
            alignItems: "center",
            padding: "0 1rem",
            color: "white",
            fontWeight: "bold",
          }}
        >
          Zwischen-Seite (scroll runter, dann zurück)
        </div>
      </header>
      <div style={{ padding: "1rem", color: "white" }}>
        <p style={{ opacity: 0.7, fontSize: 13, marginBottom: "1rem" }}>
          Scrolle diese Seite komplett herunter, dann gehe zurück zur Variante — sitzt der Header noch richtig?
        </p>
        <Link href={`/ios-test/${returnTo}`}>
          <div
            style={{
              background: "#0ea5e9",
              padding: "0.75rem 1rem",
              borderRadius: 8,
              color: "white",
              fontWeight: 600,
              cursor: "pointer",
              marginBottom: "1rem",
            }}
          >
            ← Zurück zu Variante {returnTo.toUpperCase()}
          </div>
        </Link>
        {Array.from({ length: 30 }).map((_, i) => (
          <div
            key={i}
            style={{
              background: "rgba(255,255,255,0.05)",
              padding: "0.75rem",
              borderRadius: 6,
              marginBottom: "0.5rem",
              fontSize: 13,
            }}
          >
            Scroll-Inhalt Zeile {i + 1} — scrolle bis ganz unten
          </div>
        ))}
        <Link href={`/ios-test/${returnTo}`}>
          <div
            style={{
              background: "#0ea5e9",
              padding: "0.75rem 1rem",
              borderRadius: 8,
              color: "white",
              fontWeight: 600,
              cursor: "pointer",
              marginTop: "0.5rem",
            }}
          >
            ← Zurück zu Variante {returnTo.toUpperCase()} (von unten)
          </div>
        </Link>
      </div>
      <DebugBar label="Zwischen-Seite" />
    </div>
  );
}

// ── Router ─────────────────────────────────────────────────────────────────

export default function IosTest({ variant }: { variant?: string }) {
  const v = (variant || "a").toLowerCase();

  if (v === "between") {
    const ref = useRef(
      typeof window !== "undefined"
        ? new URLSearchParams(window.location.search).get("from") || "a"
        : "a"
    );
    return <BetweenPage returnTo={ref.current} />;
  }

  if (v === "b") return <VariantB />;
  if (v === "c") return <VariantC />;
  if (v === "d") return <VariantD />;
  return <VariantA />;
}
