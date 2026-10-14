import { useState, useEffect } from 'react';

function checkLandscape(): boolean {
  if (typeof window === 'undefined') return false;
  return window.innerWidth > window.innerHeight;
}

export function useIsLandscape() {
  const [isLandscape, setIsLandscape] = useState(checkLandscape);

  useEffect(() => {
    const handler = () => setIsLandscape(checkLandscape());
    window.addEventListener('resize', handler);
    window.addEventListener('orientationchange', handler);
    return () => {
      window.removeEventListener('resize', handler);
      window.removeEventListener('orientationchange', handler);
    };
  }, []);

  return isLandscape;
}
