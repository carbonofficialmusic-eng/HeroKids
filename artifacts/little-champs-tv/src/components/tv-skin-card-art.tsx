import { useEffect, useRef, useState } from 'react';
import { resolveTvSkinPreviewUrl } from '../lib/tv-asset-url';

/** Card previews only: the large fitting preview and equipped artwork stay unchanged. */
export function TvSkinCardArt({ skinId, name, discovered }: { skinId: string; name: string; discovered: boolean }) {
  if (!discovered) return null;
  // A new identity or a locked state must not inherit a previous card's load permission.
  return <DiscoveredCardArt key={skinId} skinId={skinId} name={name}/>;
}

function DiscoveredCardArt({ skinId, name }: { skinId: string; name: string }) {
  const target = useRef<HTMLSpanElement>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const element = target.current;
    if (!element) return;
    // webOS 5 supports IntersectionObserver, but not native image lazy loading.
    // Other browsers without the observer still need usable artwork.
    if (typeof IntersectionObserver === 'undefined') {
      setReady(true);
      return;
    }
    let disposed = false;
    const observer = new IntersectionObserver(entries => {
      if (disposed) return;
      const entry = entries.find(entry => entry.target === element);
      if (entry) setReady(entry.isIntersecting);
    }, { root: null, rootMargin: '240px 0px', threshold: 0 });
    observer.observe(element);
    return () => {
      disposed = true;
      observer.disconnect();
    };
  }, []);

  // Keep the reserved artwork area even while no image element (and thus no
  // request) exists. Remove offscreen image elements so webOS can release
  // decoded image surfaces instead of retaining every visited card.
  return <span className="skin-card-art" ref={target}>
    {ready && <>
      <img className="skin-bg" src={resolveTvSkinPreviewUrl(skinId, 'backgrounds', import.meta.env.BASE_URL)} alt="" decoding="async"/>
      <img className="skin-avatar" src={resolveTvSkinPreviewUrl(skinId, 'avatars', import.meta.env.BASE_URL)} alt={name} decoding="async"/>
    </>}
  </span>;
}