import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "wouter";
import { AuthPanel } from "@/components/AuthPanel";
import logoUrl from "@assets/ChatGPT Image 7. Nov. 2025, 19_19_07_1762539654932.png";

const C = {
  bg:     "rgb(16, 20, 34)",
  bgCard: "rgba(22, 28, 46, 0.85)",
  fg:     "rgb(225, 232, 248)",
  fgMuted:"rgb(130, 148, 185)",
  orange: "rgb(248, 107, 28)",
  blue:   "rgb(52, 178, 220)",
  border: "rgb(42, 52, 80)",
} as const;

export default function NativeLoginScreen() {
  const { t } = useTranslation();
  const scrollRef = useRef<HTMLDivElement>(null);

  // ── Keyboard-aware layout ────────────────────────────────────────────────
  // On iOS, visualViewport.height shrinks when the keyboard appears.
  // We track how much of the screen is covered and apply paddingBottom so
  // all content stays above the keyboard.
  const [keyboardInset, setKeyboardInset] = useState(0);

  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;

    const update = () => {
      // keyboard height = full window height minus the visible viewport height
      // (also subtract any top offset the viewport may have)
      const kb = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
      setKeyboardInset(kb);
    };

    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
    return () => {
      vv.removeEventListener("resize", update);
      vv.removeEventListener("scroll", update);
    };
  }, []);

  // When the keyboard opens, scroll the focussed input into view.
  useEffect(() => {
    if (keyboardInset > 0) {
      setTimeout(() => {
        const active = document.activeElement as HTMLElement | null;
        active?.scrollIntoView?.({ behavior: "smooth", block: "center" });
      }, 100);
    }
  }, [keyboardInset]);

  const keyboardOpen = keyboardInset > 10;

  return (
    <div
      data-testid="screen-native-login"
      style={{
        position: "fixed",
        inset: 0,
        overflow: "hidden",
        background: C.bg,
        color: C.fg,
        fontFamily: "'Nunito', sans-serif",
        display: "flex",
        flexDirection: "column",
        paddingTop: "env(safe-area-inset-top)",
        // Push all content above the software keyboard
        paddingBottom: keyboardInset > 0
          ? `${keyboardInset}px`
          : "env(safe-area-inset-bottom)",
        transition: "padding-bottom 0.28s ease",
      }}
    >
      {/* Ambient gradient glows */}
      <div style={{
        position: "absolute",
        top: "-15%",
        left: "-10%",
        width: "55%",
        height: "55%",
        background: `radial-gradient(circle, ${C.orange}22 0%, transparent 70%)`,
        pointerEvents: "none",
        zIndex: 0,
      }} />
      <div style={{
        position: "absolute",
        bottom: "5%",
        right: "-10%",
        width: "45%",
        height: "45%",
        background: `radial-gradient(circle, ${C.blue}18 0%, transparent 70%)`,
        pointerEvents: "none",
        zIndex: 0,
      }} />

      {/* ── Logo section — shrinks/hides when keyboard is open ── */}
      <div
        style={{
          flex: "0 0 auto",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          paddingTop: keyboardOpen ? "0.5rem" : "2rem",
          paddingBottom: keyboardOpen ? "0.5rem" : "1.25rem",
          zIndex: 1,
          position: "relative",
          overflow: "hidden",
          maxHeight: keyboardOpen ? "3.5rem" : "200px",
          transition: "max-height 0.28s ease, padding 0.28s ease",
        }}
      >
        {/* Hide logo image when keyboard is open, keep only text */}
        {!keyboardOpen && (
          <img
            src={logoUrl}
            alt="HeroKids"
            data-testid="img-native-logo"
            style={{
              width: 80,
              height: 80,
              borderRadius: 20,
              marginBottom: "0.75rem",
              boxShadow: `0 8px 32px -8px ${C.orange}66`,
            }}
          />
        )}
        <h1
          style={{
            fontFamily: "'Fredoka', 'Nunito', sans-serif",
            fontSize: keyboardOpen ? "1.2rem" : "2rem",
            fontWeight: 700,
            color: C.fg,
            margin: 0,
            letterSpacing: "-0.01em",
            transition: "font-size 0.28s ease",
          }}
          data-testid="text-native-app-name"
        >
          HeroKids
        </h1>
        {!keyboardOpen && (
          <p
            style={{
              fontSize: "0.9rem",
              color: C.fgMuted,
              margin: "0.35rem 0 0",
              textAlign: "center",
              paddingInline: "2rem",
            }}
            data-testid="text-native-slogan"
          >
            {t('landing.heroSubtitle', 'Make chores fun for the whole family')}
          </p>
        )}
      </div>

      {/* ── Auth form — scrollable so keyboard never hides a field ── */}
      <div
        ref={scrollRef}
        style={{
          flex: "1 1 0",
          overflowY: "auto",
          WebkitOverflowScrolling: "touch" as any,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: keyboardOpen ? "flex-start" : "center",
          paddingInline: "1rem",
          paddingBottom: "0.5rem",
          paddingTop: keyboardOpen ? "0.5rem" : "0",
          zIndex: 1,
          position: "relative",
          transition: "justify-content 0.28s ease",
        }}
      >
        <div
          style={{
            width: "100%",
            maxWidth: 420,
            background: C.bgCard,
            backdropFilter: "blur(16px)",
            WebkitBackdropFilter: "blur(16px)",
            borderRadius: 20,
            border: `1px solid ${C.border}`,
            overflow: "hidden",
          }}
        >
          <AuthPanel />
        </div>
      </div>

      {/* ── Footer links — hidden when keyboard is open ── */}
      {!keyboardOpen && (
        <div
          style={{
            flex: "0 0 auto",
            display: "flex",
            justifyContent: "center",
            gap: "1.5rem",
            paddingBlock: "0.875rem",
            zIndex: 1,
            position: "relative",
          }}
        >
          <Link
            href="/privacy"
            style={{ color: C.fgMuted, textDecoration: "none", fontSize: "0.8rem" }}
            data-testid="link-native-privacy"
          >
            {t('landing.footer.privacy', 'Privacy')}
          </Link>
          <Link
            href="/impressum"
            style={{ color: C.fgMuted, textDecoration: "none", fontSize: "0.8rem" }}
            data-testid="link-native-impressum"
          >
            {t('landing.footer.imprint', 'Imprint')}
          </Link>
        </div>
      )}
    </div>
  );
}
