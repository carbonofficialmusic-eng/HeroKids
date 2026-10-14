import { describe, expect, it } from 'vitest';
import { resolveTvAssetUrl, resolveTvSkinAssetUrl, resolveTvSkinPreviewUrl } from './tv-asset-url';

describe('TV asset URLs', () => {
  it('keeps browser card previews inside the TV base path', () => {
    expect(resolveTvSkinPreviewUrl('junior-champion', 'avatars', '/tv/')).toBe(
      '/tv/skin-previews/avatars/junior-champion.webp',
    );
    expect(resolveTvSkinPreviewUrl('forest-home', 'backgrounds', '/tv')).toBe(
      '/tv/skin-previews/backgrounds/forest-home.webp',
    );
  });

  it('keeps packaged card previews relative to the local widget', () => {
    expect(resolveTvSkinPreviewUrl('junior-champion', 'avatars', './')).toBe(
      './skin-previews/avatars/junior-champion.webp',
    );
    expect(resolveTvSkinPreviewUrl('forest-home', 'backgrounds', './')).toBe(
      './skin-previews/backgrounds/forest-home.webp',
    );
    expect(() => resolveTvSkinPreviewUrl('../escape', 'avatars', '/tv/')).toThrow('Invalid skin identifier');
  });
  it('resolves relative and root-relative shared paths on the same host by default', () => {
    expect(resolveTvAssetUrl('nav-icons/shop.png', '')).toBe('/nav-icons/shop.png');
    expect(resolveTvAssetUrl('/skins/avatars/fox.png', '')).toBe('/skins/avatars/fox.png');
  });

  it('uses the explicit API origin for shared assets', () => {
    expect(resolveTvAssetUrl('/nav-icons/shop.png', 'https://api.example.test/')).toBe(
      'https://api.example.test/nav-icons/shop.png',
    );
  });

  it('preserves absolute URLs and their query strings', () => {
    const url = 'https://cdn.example.test/avatar.png?size=large&v=4';
    expect(resolveTvAssetUrl(url, 'https://api.example.test')).toBe(url);
  });

  it('can retain the development-only Vite proxy prefix', () => {
    expect(resolveTvAssetUrl('/nav-icons/shop.png', '', '/tv/source-assets')).toBe(
      '/tv/source-assets/nav-icons/shop.png',
    );
  });

  it('keeps packaged skin media local and uses shared root paths otherwise', () => {
    expect(resolveTvSkinAssetUrl('fox', 'avatars', true, '')).toBe(
      './media/skins/avatars/fox.webp',
    );
    expect(resolveTvSkinAssetUrl('forest-home', 'backgrounds', true, 'https://api.example.test')).toBe(
      './media/skins/backgrounds/forest-home.webp',
    );
    expect(resolveTvSkinAssetUrl('fox', 'avatars', false, '')).toBe(
      '/skins/avatars/fox.png?v=10',
    );
    expect(resolveTvSkinAssetUrl('forest-home', 'backgrounds', false, 'https://api.example.test')).toBe(
      'https://api.example.test/skins/backgrounds/forest-home.png?v=21',
    );
  });

  it('rejects skin identifiers that could escape the skin asset path', () => {
    expect(() => resolveTvSkinAssetUrl('../fox', 'avatars', true, '')).toThrow(
      'Invalid skin identifier',
    );
  });
});