// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createElement, StrictMode } from 'react';
import { act, cleanup, render } from '@testing-library/react';
import { TvSkinCardArt } from '../../../little-champs-tv/src/components/tv-skin-card-art';

class ObserverMock {
  static instances: ObserverMock[] = [];
  target?: Element;
  observe = vi.fn((target: Element) => { this.target = target; });
  disconnect = vi.fn();
  constructor(private callback: IntersectionObserverCallback, readonly options?: IntersectionObserverInit) {
    ObserverMock.instances.push(this);
  }
  notify(isIntersecting: boolean) {
    act(() => this.callback([{target:this.target, isIntersecting} as IntersectionObserverEntry], this as unknown as IntersectionObserver));
  }
}

beforeEach(() => {
  ObserverMock.instances = [];
  vi.stubGlobal('IntersectionObserver', ObserverMock);
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

const card = (discovered = true, skinId = 'junior-champion', name = 'Junior Champion') =>
  createElement(TvSkinCardArt, {skinId, name, discovered});
const latestObserver = () => ObserverMock.instances[ObserverMock.instances.length - 1];

describe('TV-only skin card artwork', () => {
  it('uses both small TV previews, never the shared full-size artwork', () => {
    const {container}=render(card());
    latestObserver().notify(true);
    const images=Array.from(container.querySelectorAll('img'));
    expect(images).toHaveLength(2);
    expect(images[0].getAttribute('src')).toMatch(/\/skin-previews\/backgrounds\/junior-champion\.webp$/);
    expect(images[1].getAttribute('src')).toMatch(/\/skin-previews\/avatars\/junior-champion\.webp$/);
    expect(images[1].alt).toBe('Junior Champion');
    for (const image of images) {
      expect(image.getAttribute('src')).not.toContain('/source-assets/');
      expect(image.getAttribute('src')).not.toContain('/skins/');
      expect(image.getAttribute('decoding')).toBe('async');
    }
  });

  it('does not load any artwork before a skin is revealed', () => {
    const {container,rerender}=render(card(false));
    expect(container.querySelectorAll('img')).toHaveLength(0);
    expect(ObserverMock.instances).toHaveLength(0);
    rerender(card());
    expect(container.querySelectorAll('img')).toHaveLength(0);
    latestObserver().notify(true);
    expect(container.querySelectorAll('img')).toHaveLength(2);
    rerender(card(false));
    expect(container.querySelectorAll('img')).toHaveLength(0);
  });

  it('only loads near the viewport and keeps artwork after rapid exits and re-entries', () => {
    const {container}=render(card());
    const observer=latestObserver();
    const placeholder=container.querySelector('.skin-card-art');
    expect(observer.options).toEqual({root:null,rootMargin:'240px 0px',threshold:0});
    expect(observer.observe).toHaveBeenCalledWith(placeholder);
    observer.notify(false);
    expect(container.querySelectorAll('img')).toHaveLength(0);
    observer.notify(true);
    const images=Array.from(container.querySelectorAll('img'));
    expect(images).toHaveLength(2);
    expect(observer.disconnect).toHaveBeenCalledTimes(1);
    observer.notify(false);
    observer.notify(true);
    expect(Array.from(container.querySelectorAll('img'))).toEqual(images);
    expect(container.querySelector('.skin-card-art')).toBe(placeholder);
  });

  it('leaves distant discovered cards unloaded while other cards enter the viewport', () => {
    const {container}=render(createElement('div',null,card(),card(true,'astro-bot','Astro Bot')));
    ObserverMock.instances[0].notify(true);
    ObserverMock.instances[1].notify(false);
    expect(container.querySelectorAll('img')).toHaveLength(2);
    ObserverMock.instances[1].notify(true);
    expect(container.querySelectorAll('img')).toHaveLength(4);
  });

  it('keeps loaded images and button focus when equipping updates the surrounding card', () => {
    const article = (active: boolean) => createElement('article',{className:active?'active-skin':''},
      card(), createElement('button',null,active?'Ausgewählt':'Auswählen'));
    const {container,rerender}=render(article(false));
    latestObserver().notify(true);
    const image=container.querySelector('img');
    const button=container.querySelector('button')!;
    button.focus();
    rerender(article(true));
    expect(document.activeElement).toBe(button);
    expect(container.querySelector('img')).toBe(image);
    expect(ObserverMock.instances).toHaveLength(1);
  });

  it('ignores queued notifications after unmount, lock, or a skin identity change', () => {
    const {container,rerender,unmount}=render(card());
    const original=latestObserver();
    rerender(card(true,'astro-bot','Astro Bot'));
    expect(original.disconnect).toHaveBeenCalled();
    original.notify(true);
    expect(container.querySelectorAll('img')).toHaveLength(0);
    const replacement=latestObserver();
    replacement.notify(true);
    expect(container.querySelector('img')?.getAttribute('src')).toContain('astro-bot.webp');
    rerender(card(false,'astro-bot'));
    replacement.notify(true);
    expect(container.querySelectorAll('img')).toHaveLength(0);
    rerender(card(true,'astro-bot'));
    expect(container.querySelectorAll('img')).toHaveLength(0);
    const last=latestObserver();
    unmount();
    expect(last.disconnect).toHaveBeenCalled();
    last.notify(true);
    expect(container.querySelectorAll('img')).toHaveLength(0);
  });

  it('cleans up StrictMode observers and only accepts the live observer', () => {
    const {container}=render(createElement(StrictMode,null,card()));
    expect(ObserverMock.instances).toHaveLength(2);
    ObserverMock.instances[0].notify(true);
    expect(container.querySelectorAll('img')).toHaveLength(0);
    latestObserver().notify(true);
    expect(container.querySelectorAll('img')).toHaveLength(2);
  });

  it('renders usable previews in browsers without IntersectionObserver', () => {
    vi.stubGlobal('IntersectionObserver',undefined);
    const {container}=render(card());
    expect(container.querySelectorAll('img')).toHaveLength(2);
  });
});