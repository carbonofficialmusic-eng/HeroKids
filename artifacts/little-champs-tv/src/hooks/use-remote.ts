import { useEffect, useRef } from 'react';
import { rememberFocus, resolveFocus, remoteSelector as selector, type FocusLocation } from '../lib/tv-focus';

/** Spatial focus navigation for TV remotes, including read-only task cards as scroll stops. */
export function useRemote(scope: string, dialogOpen: boolean, onBack: () => void, initialDialogFocus?: string, returnFocus?: string) {
  const backRef = useRef(onBack);
  backRef.current = onBack;
  const locations = useRef(new Map<string, FocusLocation>());
  const scopeRef = useRef(scope);
  scopeRef.current = scope;
  const dialogRef = useRef(dialogOpen);
  dialogRef.current = dialogOpen;
  const returnRef = useRef(returnFocus);
  returnRef.current = returnFocus;
  const initialRef = useRef(initialDialogFocus);
  initialRef.current = initialDialogFocus;
  const dialogFocus = useRef<HTMLElement | null>(null);
  const wasDialogOpen = useRef(false);

  useEffect(() => {
    let frame = 0;
    const restore = () => {
      const root = document.querySelector<HTMLElement>('.tv');
      if (!root) return;
      const active = document.activeElement;
      if (dialogRef.current) {
        const modal = root.querySelector<HTMLElement>('[role="dialog"]');
        if (!modal || (active instanceof HTMLElement && modal.contains(active) && !active.matches(':disabled'))) return;
        const id = dialogFocus.current?.getAttribute('data-testid');
        const same = id ? Array.from(modal.querySelectorAll<HTMLElement>('[data-testid]')).find(el => el.getAttribute('data-testid') === id) : null;
        const preferred = initialRef.current ? modal.querySelector<HTMLElement>(initialRef.current) : null;
        const target = same ?? preferred ?? modal.querySelector<HTMLElement>(selector);
        if (target && !target.matches(':disabled')) target.focus({preventScroll:true});
        return;
      }
      if (active instanceof HTMLElement && root.contains(active) && active.matches('article,[data-testid^="card-"]')) {
        const action = active.querySelector<HTMLElement>(selector);
        if (action) {action.focus({preventScroll:true});return;}
      }
      if (active instanceof HTMLElement && root.contains(active) && !active.closest('[role="dialog"]') && !active.matches(':disabled')) return;
      const explicit = returnRef.current && document.querySelector<HTMLElement>(returnRef.current);
      const location = locations.current.get(scopeRef.current);
      const target = location ? resolveFocus(location, root) : explicit && !explicit.matches(':disabled') ? explicit : resolveFocus(undefined, root);
      target?.focus({preventScroll:true});
    };
    const schedule = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(restore);
    };
    const remember = (event: Event) => {
      const root = document.querySelector<HTMLElement>('.tv');
      const element = event.target;
      // Remember the launcher, not an auto-focused confirmation or success button.
      if (root && element instanceof HTMLElement && root.contains(element)) {
        if (element.closest('[role="dialog"]')) dialogFocus.current = element;
        else locations.current.set(scopeRef.current, rememberFocus(element, root));
      }
    };
    document.addEventListener('focusin', remember);
    const observer = new MutationObserver(schedule);
    observer.observe(document.body, {subtree:true,childList:true,attributes:true,attributeFilter:['disabled','tabindex','hidden']});
    schedule();
    return () => {cancelAnimationFrame(frame);observer.disconnect();document.removeEventListener('focusin', remember);};
  }, []);

  useEffect(() => {
    let frame = 0;
    if (dialogOpen && !wasDialogOpen.current) {
       frame = requestAnimationFrame(() => {
         const target = initialDialogFocus && document.querySelector<HTMLElement>(`[role="dialog"] ${initialDialogFocus}`);
         (target && !target.matches(':disabled') ? target : document.querySelector<HTMLElement>(`[role="dialog"] ${selector}`))?.focus();
       });
    } else if (!dialogOpen && wasDialogOpen.current) {
       frame = requestAnimationFrame(() => {
         const target = returnFocus && document.querySelector<HTMLElement>(returnFocus);
         const root = document.querySelector<HTMLElement>('.tv');
         const location = locations.current.get(scope);
         const restored = root && location ? resolveFocus(location, root) : target && !target.matches(':disabled') ? target : root ? resolveFocus(undefined, root) : undefined;
         restored?.focus({preventScroll:true});
       });
    }
    wasDialogOpen.current = dialogOpen;
    return () => cancelAnimationFrame(frame);
  }, [dialogOpen]);

  useEffect(() => {
    const frame = !dialogOpen ? requestAnimationFrame(() => {
      const active = document.activeElement;
       if (!active || active === document.body || !(active instanceof HTMLElement) || !active.isConnected) {
         const target = returnFocus && document.querySelector<HTMLElement>(returnFocus);
         const root = document.querySelector<HTMLElement>('.tv');
         const location = locations.current.get(scope);
          (root && location ? resolveFocus(location, root) : target && !target.matches(':disabled') ? target : root ? resolveFocus(undefined, root) : undefined)?.focus({preventScroll:true});
      }
    }) : 0;
    return () => cancelAnimationFrame(frame);
   }, [scope, dialogOpen, returnFocus]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      const key = ({13:'Enter',37:'ArrowLeft',38:'ArrowUp',39:'ArrowRight',40:'ArrowDown',461:'Back'} as Record<number,string>)[event.keyCode] ?? event.key;
      // webOS sends 461 for Back; the local preview also accepts Escape.
       const editing = document.activeElement instanceof HTMLInputElement || document.activeElement instanceof HTMLTextAreaElement;
       if (key === 'Backspace' && editing) return;
       if (event.keyCode === 461 || key === 'Back' || key === 'Escape' || key === 'Backspace' || key === 'BrowserBack' || key === 'GoBack' || key === 'XF86Back') {
        event.preventDefault(); backRef.current(); return;
      }
      if (key === 'Enter' || key === ' ' || key === 'NumpadEnter') {
        const active = document.activeElement;
        if (active instanceof HTMLButtonElement) {event.preventDefault(); active.click();}
        return;
      }
      if (!['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(key)) return;
       if (editing && (key==='ArrowLeft'||key==='ArrowRight')) return;
      event.preventDefault();
       // Header navigation and logout must be reachable by remote too.
       const container = (dialogOpen ? document.querySelector('[role="dialog"]') : document.querySelector('.tv')) ?? document;
      const candidates = Array.from(container.querySelectorAll<HTMLElement>(selector)).filter(el => {
        const rect = el.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0 && getComputedStyle(el).visibility !== 'hidden';
      });
      if (!candidates.length) return;
      const active = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      if (!active || active === document.body || !container.contains(active)) { candidates[0].focus(); return; }
      const rect = active.getBoundingClientRect();
      const originX = rect.left + rect.width / 2, originY = rect.top + rect.height / 2;
      const direction = key.slice(5);
       // On the task board, vertical remote navigation follows visible DOM order.
       // Spatial scoring can otherwise jump from one wide category heading to
       // the next, skipping the cards between them.
       const board = (key === 'ArrowUp' || key === 'ArrowDown') ? active.closest('.tv-task-sections') : null;
       const boardStops = board ? candidates.filter(el => el.closest('.tv-task-sections') === board) : [];
       const boardIndex = boardStops.indexOf(active);
       let next = boardIndex >= 0 ? boardStops[boardIndex + (key === 'ArrowDown' ? 1 : -1)] : undefined;
       if (!next) {
         const ranked = candidates.filter(el => el !== active).map(el => {
           const r = el.getBoundingClientRect();
           const dx = r.left + r.width / 2 - originX, dy = r.top + r.height / 2 - originY;
           const primary = direction === 'Left' ? -dx : direction === 'Right' ? dx : direction === 'Up' ? -dy : dy;
           const secondary = direction === 'Left' || direction === 'Right' ? Math.abs(dy) : Math.abs(dx);
           return {el, primary, score: primary + secondary * 2.1};
         }).filter(item => item.primary > 7).sort((a,b) => a.score - b.score);
         next = ranked[0]?.el;
       }
         if (!next) {
           if (!dialogOpen && key === 'ArrowDown') window.scrollBy({top:Math.round(window.innerHeight * .65),behavior:'smooth'});
           if (key === 'ArrowUp' && !dialogOpen) window.scrollTo({top:0,behavior:'smooth'});
          return;
        }
       next.focus({preventScroll: true});
        if (!dialogOpen && next.closest('.tv > .topbar')) {
          window.scrollTo({top:0,behavior:'smooth'});
          return;
        }
       if (dialogOpen || !next.closest('main')) {
         next.scrollIntoView({block:'nearest',inline:'nearest',behavior:'smooth'});
         return;
       }
       // Keep the entire task card clear of the sticky menu and the TV's lower edge.
       const target = next.closest<HTMLElement>('.tv-task') ?? next;
       const bounds = target.getBoundingClientRect();
       const headerBottom = document.querySelector('.tv > .topbar')?.getBoundingClientRect().bottom ?? 0;
       const topLimit = Math.max(20, headerBottom + 24);
       const bottomLimit = window.innerHeight - 80;
       if (bounds.top < topLimit) window.scrollBy({top: bounds.top - topLimit, behavior:'smooth'});
       else if (bounds.bottom > bottomLimit) window.scrollBy({top: bounds.bottom - bottomLimit, behavior:'smooth'});
    }
    document.addEventListener('keydown',onKey);
    return () => document.removeEventListener('keydown',onKey);
  }, [dialogOpen]);
}