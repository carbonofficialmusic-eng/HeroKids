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
  const scrollable = findScrollableAncestor(el);
  if (scrollable) {
    scrollable.style.paddingBottom = `${KEYBOARD_HEIGHT}px`;
    el.addEventListener("blur", () => { scrollable.style.paddingBottom = ""; }, { once: true });
  }
  setTimeout(() => {
    const elRect = el.getBoundingClientRect();
    const vvHeight = window.visualViewport?.height ?? window.innerHeight;
    const visibleBottom = vvHeight < window.innerHeight - 50
      ? vvHeight
      : window.innerHeight - KEYBOARD_HEIGHT;
    if (elRect.bottom < visibleBottom - 20) return;
    if (scrollable) {
      scrollable.scrollBy({ top: elRect.bottom - visibleBottom + 20, behavior: "smooth" });
    } else {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, 400);
}
