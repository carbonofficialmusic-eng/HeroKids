/** Keep the phone layout independent of WKWebView's occasionally stale viewport. */
export interface PhoneLayoutMetrics {
  width: number;
  height: number;
  screenWidth: number;
  screenHeight: number;
  native: boolean;
  orientationAngle?: number;
}

export function isCompactPhoneLandscape(metrics: PhoneLayoutMetrics): boolean {
  const { width, height, screenWidth, screenHeight, native, orientationAngle } = metrics;
  const phoneScreen = Math.min(screenWidth, screenHeight) > 0
    && Math.min(screenWidth, screenHeight) <= 600;

  // On native phones the physical orientation remains usable even if WebKit
  // has not updated its layout viewport yet. Do not infer landscape from the
  // keyboard shrinking a portrait viewport.
  if (native && phoneScreen && orientationAngle !== undefined) {
    return Math.abs(orientationAngle % 180) === 90;
  }

  return width > height && width <= 1200 && height <= 600;
}

export function installPhoneLandscapeLayout(native: boolean): () => void {
  let settledTimer: ReturnType<typeof setTimeout> | undefined;
  const update = () => {
    const legacyAngle = (window as Window & { orientation?: number }).orientation;
    const orientationAngle = typeof legacyAngle === "number"
      ? legacyAngle
      : window.screen.orientation?.angle;
    document.documentElement.classList.toggle(
      "lc-phone-landscape",
      isCompactPhoneLandscape({
        width: window.innerWidth,
        height: window.innerHeight,
        screenWidth: window.screen.width,
        screenHeight: window.screen.height,
        native,
        orientationAngle,
      }),
    );
  };
  const onChange = () => {
    update();
    // iOS can dispatch orientationchange before updating the viewport.
    clearTimeout(settledTimer);
    settledTimer = setTimeout(update, 150);
  };
  const onVisible = () => {
    if (document.visibilityState === "visible") onChange();
  };

  update();
  window.addEventListener("resize", onChange);
  window.addEventListener("orientationchange", onChange);
  window.screen.orientation?.addEventListener("change", onChange);
  document.addEventListener("visibilitychange", onVisible);
  document.addEventListener("resume", onChange);

  return () => {
    clearTimeout(settledTimer);
    window.removeEventListener("resize", onChange);
    window.removeEventListener("orientationchange", onChange);
    window.screen.orientation?.removeEventListener("change", onChange);
    document.removeEventListener("visibilitychange", onVisible);
    document.removeEventListener("resume", onChange);
    document.documentElement.classList.remove("lc-phone-landscape");
  };
}
