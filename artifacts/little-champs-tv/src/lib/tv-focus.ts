export const remoteSelector = 'button:not(:disabled),a[href],input:not(:disabled),textarea:not(:disabled),select:not(:disabled),.tv-task[tabindex="0"],.tv-scroll-stop[tabindex="0"]';

export type FocusLocation = {
  element: HTMLElement;
  testId: string | null;
  card: HTMLElement | null;
  cardId: string | null;
  parent: HTMLElement | null;
  cardIndex: number;
  contentIndex: number;
};

function cards(parent: HTMLElement): HTMLElement[] {
  return Array.from(parent.children).filter((el): el is HTMLElement =>
    el instanceof HTMLElement && el.matches('article,[data-testid^="card-"]'));
}

export function rememberFocus(element: HTMLElement, root: HTMLElement): FocusLocation {
  const card = element.closest<HTMLElement>('article,[data-testid^="card-"]');
  const parent = card?.parentElement ?? null;
  const main = root.querySelector('main');
  return {
    element,
    testId: element.getAttribute('data-testid'),
    card,
    cardId: card?.getAttribute('data-testid') ?? null,
    parent,
    cardIndex: card && parent ? cards(parent).indexOf(card) : -1,
    contentIndex: main ? Array.from(main.querySelectorAll(remoteSelector)).indexOf(element) : -1,
  };
}

function usable(element: HTMLElement | null | undefined, root: HTMLElement): element is HTMLElement {
  return !!element && root.contains(element) && !element.closest('[role="dialog"]') &&
    !element.matches(':disabled') && !element.closest('[hidden]') &&
    getComputedStyle(element).display !== 'none' && getComputedStyle(element).visibility !== 'hidden';
}

function byId(root: HTMLElement, id: string | null): HTMLElement | undefined {
  return id ? Array.from(root.querySelectorAll<HTMLElement>('[data-testid]'))
    .find(el => el.getAttribute('data-testid') === id) : undefined;
}

function cardTarget(card: HTMLElement | undefined | null, root: HTMLElement): HTMLElement | undefined {
  if (!usable(card, root)) return;
  const action = Array.from(card.querySelectorAll<HTMLElement>(remoteSelector)).find(el => usable(el, root));
  if (action) return action;
  // A bought/approved card can remain visible without an enabled action.
  // Keep it selected without adding another stop to normal remote navigation.
  if (!card.hasAttribute('tabindex')) card.tabIndex = -1;
  return card;
}

export function resolveFocus(location: FocusLocation | undefined, root: HTMLElement): HTMLElement | undefined {
  if (location) {
    const exact = byId(root, location.testId) ?? location.element;
    if (usable(exact, root)) {
      if (exact.matches('article,[data-testid^="card-"]')) return cardTarget(exact, root);
      if (exact.matches(remoteSelector) || exact.hasAttribute('tabindex')) return exact;
    }
    const sameCard = cardTarget(byId(root, location.cardId) ?? location.card, root);
    if (sameCard) return sameCard;
    if (location.parent && root.contains(location.parent) && location.cardIndex >= 0) {
      const remaining = cards(location.parent);
      const nearby = cardTarget(remaining[Math.min(location.cardIndex, remaining.length - 1)], root);
      if (nearby) return nearby;
    }
  }
  const main = root.querySelector<HTMLElement>('main');
  const content = main ? Array.from(main.querySelectorAll<HTMLElement>(remoteSelector)).filter(el => usable(el, root)) : [];
  if (content.length) return content[Math.min(Math.max(location?.contentIndex ?? 0, 0), content.length - 1)];
  if (main && location) {
    const empty = main.querySelector<HTMLElement>('.empty');
    if (empty) {
      if (!empty.hasAttribute('tabindex')) empty.tabIndex = -1;
      return empty;
    }
  }
  return undefined;
}