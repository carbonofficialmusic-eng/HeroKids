import { isCompactPhoneLandscape } from "./phone-landscape";

export const WEB_BUILD_ID = import.meta.env.VITE_LC_WEB_BUILD || "unbekannt";

export function parseServerBuild(value: unknown): string {
  if (!value || typeof value !== "object" || !("id" in value)
    || typeof value.id !== "string"
    || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value.id)
    || !Number.isFinite(Date.parse(value.id))) {
    throw new Error("Keine gültige Webstand-Datei");
  }
  return value.id;
}

/** Only technical state: never read query strings, storage, identity or family data. */
export function readLayoutDiagnostics(native: boolean): Record<string, string> {
  const legacyAngle = (window as Window & { orientation?: number }).orientation;
  const screenAngle = window.screen.orientation?.angle;
  const orientationAngle = typeof legacyAngle === "number" ? legacyAngle : screenAngle;
  const metrics = {
    width: window.innerWidth,
    height: window.innerHeight,
    screenWidth: window.screen.width,
    screenHeight: window.screen.height,
    native,
    orientationAngle,
  };
  const active = document.documentElement.classList.contains("lc-phone-landscape");
  const cssVersion = getComputedStyle(document.documentElement)
    .getPropertyValue("--lc-layout-diagnostic-version").trim();
  return {
    "Geladener Webstand": WEB_BUILD_ID,
    "Ladeadresse (ohne persönliche URL-Daten)": window.location.origin,
    "Ladeart": /^https?:$/.test(window.location.protocol) ? "Online-Adresse" : "Lokale App-Adresse",
    "Fenstergröße": `${metrics.width} × ${metrics.height} CSS-Pixel`,
    "Sichtbarer Bereich": window.visualViewport
      ? `${Math.round(window.visualViewport.width)} × ${Math.round(window.visualViewport.height)} CSS-Pixel`
      : "Nicht verfügbar",
    "Bildschirmgröße": `${metrics.screenWidth} × ${metrics.screenHeight} CSS-Pixel`,
    "iOS-Ausrichtungswinkel": typeof legacyAngle === "number" ? `${legacyAngle}°` : "Nicht verfügbar",
    "Screen-Ausrichtungswinkel": typeof screenAngle === "number" ? `${screenAngle}°` : "Nicht verfügbar",
    "CSS meldet Querformat": window.matchMedia("(orientation: landscape)").matches ? "Ja" : "Nein",
    "Bisherige Größenabfrage erfüllt": window.matchMedia(
      "(orientation: landscape) and (max-width: 1200px) and (max-height: 600px)",
    ).matches ? "Ja" : "Nein",
    "Kompaktansicht laut Erkennung": isCompactPhoneLandscape(metrics) ? "Aktiv" : "Inaktiv",
    "Kompaktansicht tatsächlich aktiviert": active ? "Ja" : "Nein",
    "CSS-Kennung": cssVersion || "Nicht vorhanden",
  };
}
