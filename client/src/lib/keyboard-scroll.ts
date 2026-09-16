const KEYBOARD_HEIGHT = 350;

function findScrollableAncestor(el: HTMLElement): HTMLElement | null {
  let parent = el.parentElement;
  while (parent && parent !== document.body) {
    const style = getComputedStyle(parent);
    if (style.overflowY === "auto" || style.overflowY === "scroll") return parent;
    parent = parent.parentElement;
  }
  return null;
}

export function scrollFieldIntoView(el: HTMLElement) {
  if (typeof window === "undefined") return;

  // Mouse/trackpad browsers do not open a software keyboard. Adding the
  // mobile keyboard reserve there creates a large empty area in dialogs.
  const mayUseSoftwareKeyboard =
    window.matchMedia?.("(pointer: coarse)").matches === true;
  if (!mayUseSoftwareKeyboard) return;

  const scrollable = findScrollableAncestor(el);
  const visualViewport = window.visualViewport;
  const handleViewportResize = () => {
    if (visualViewport && visualViewport.height >= window.innerHeight - 50) {
      if (scrollable) scrollable.style.paddingBottom = "";
    }
  };
  const clearKeyboardSpace = () => {
    if (scrollable) scrollable.style.paddingBottom = "";
    visualViewport?.removeEventListener("resize", handleViewportResize);
  };
  visualViewport?.addEventListener("resize", handleViewportResize);
  el.addEventListener("blur", clearKeyboardSpace, { once: true });

  setTimeout(() => {
    if (typeof window === "undefined" || typeof document === "undefined") return;
    if (!el.isConnected || document.activeElement !== el) {
      clearKeyboardSpace();
      return;
    }

    const elRect = el.getBoundingClientRect();
    const vvHeight = window.visualViewport?.height ?? window.innerHeight;
    const viewportShrank = vvHeight < window.innerHeight - 50;
    const visibleBottom = viewportShrank
      ? vvHeight
      : window.innerHeight - KEYBOARD_HEIGHT;
    if (scrollable) {
      const keyboardReserve = viewportShrank
        ? Math.max(0, window.innerHeight - vvHeight + 20)
        : KEYBOARD_HEIGHT;
      scrollable.style.paddingBottom = `${keyboardReserve}px`;
    }
    if (elRect.bottom < visibleBottom - 20) return;
    if (scrollable) {
      scrollable.scrollBy({ top: elRect.bottom - visibleBottom + 20, behavior: "smooth" });
    } else {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, 400);
}
