export type TvSkinAssetKind = 'avatars' | 'backgrounds';

/** Small card artwork belongs to the TV artifact, not the shared Web/iOS URLs. */
export function resolveTvSkinPreviewUrl(skinId: string, kind: TvSkinAssetKind, basePath: string): string {
  if (!/^[a-z0-9-]+$/.test(skinId)) throw new Error('Invalid skin identifier');
  const base = basePath.endsWith('/') ? basePath : `${basePath}/`;
  return `${base}skin-previews/${kind}/${skinId}.webp`;
}

/**
 * Resolves public TV media URLs. In production the empty-origin case is
 * same-host, so shared app assets live at the site root. Development can pass
 * its Vite proxy prefix explicitly; packaged skins use their own local path.
 */
export function resolveTvAssetUrl(path: string, apiOrigin: string, devAssetBase = ''): string {
  if (/^https?:\/\//.test(path)) return path;
  const absolutePath = path.startsWith('/') ? path : `/${path}`;
  const origin = apiOrigin.replace(/\/$/, '');
  if (origin) return `${origin}${absolutePath}`;
  const devBase = devAssetBase.replace(/\/$/, '');
  return devBase ? `${devBase}${absolutePath}` : absolutePath;
}

export function resolveTvSkinAssetUrl(
  skinId: string,
  kind: TvSkinAssetKind,
  packaged: boolean,
  apiOrigin: string,
  devAssetBase = '',
): string {
  if (!/^[a-z0-9-]+$/.test(skinId)) throw new Error('Invalid skin identifier');
  if (packaged) return `./media/skins/${kind}/${skinId}.webp`;
  return resolveTvAssetUrl(
    `/skins/${kind}/${skinId}.png?v=${kind === 'avatars' ? 10 : 21}`,
    apiOrigin,
    devAssetBase,
  );
}