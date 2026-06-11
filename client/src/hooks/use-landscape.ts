import { useState, useEffect } from 'react';

const QUERY = '(orientation: landscape)';

function canMatchMedia() {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function';
}

export function useIsLandscape() {
  const [isLandscape, setIsLandscape] = useState(
    () => canMatchMedia() ? window.matchMedia(QUERY).matches : false
  );

  useEffect(() => {
    if (!canMatchMedia()) return;
    const mq = window.matchMedia(QUERY);
    const handler = (e: MediaQueryListEvent) => setIsLandscape(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  return isLandscape;
}
