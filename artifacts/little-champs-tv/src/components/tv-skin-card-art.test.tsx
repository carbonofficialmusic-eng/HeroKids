// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TvSkinCardArt } from './tv-skin-card-art';

let root: Root | undefined;
let container: HTMLDivElement;

function render(discovered: boolean) {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => root!.render(<TvSkinCardArt skinId="fox" name="Fuchs" discovered={discovered}/>));
}

afterEach(() => {
  if (root) act(() => root!.unmount());
  root = undefined;
  container?.remove();
  vi.unstubAllGlobals();
});

describe('TV skin preview memory lifetime', () => {
  it('releases offscreen images and restores them on return without losing the card', () => {
    let callback: IntersectionObserverCallback;
    let element: Element;
    const disconnect = vi.fn();
    vi.stubGlobal('IntersectionObserver', class {
      constructor(cb: IntersectionObserverCallback) { callback = cb; }
      observe(target: Element) { element = target; }
      disconnect = disconnect;
    });
    render(true);
    const intersect = (visible: boolean) => act(() => callback(
      [{ target: element, isIntersecting: visible } as IntersectionObserverEntry],
      {} as IntersectionObserver,
    ));
    expect(container.querySelectorAll('img')).toHaveLength(0);
    intersect(true);
    expect(container.querySelectorAll('img')).toHaveLength(2);
    expect(disconnect).not.toHaveBeenCalled();
    intersect(false);
    expect(container.querySelectorAll('img')).toHaveLength(0);
    expect(container.querySelector('.skin-card-art')).not.toBeNull();
    intersect(true);
    expect(container.querySelector('img[alt="Fuchs"]')).not.toBeNull();
    act(() => root!.unmount());
    root = undefined;
    expect(disconnect).toHaveBeenCalledTimes(1);
  });

  it('does not load hidden skins and supports browsers without an observer', () => {
    vi.stubGlobal('IntersectionObserver', undefined);
    render(false);
    expect(container.querySelectorAll('img')).toHaveLength(0);
    act(() => root!.render(<TvSkinCardArt skinId="fox" name="Fuchs" discovered/>));
    expect(container.querySelectorAll('img')).toHaveLength(2);
  });
});