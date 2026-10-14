import { useEffect, useSyncExternalStore } from 'react';

export const TV_LANGUAGES = ['de','en','fr','es','pt','sv','ja','zh','ko'] as const;
export type TvLanguage = typeof TV_LANGUAGES[number];
declare const __TV_CATALOG__: Record<string, string[]>;
const catalog = __TV_CATALOG__;
const CACHE_KEY = 'littlechamps_tv_family_language';
const locales: Record<TvLanguage,string> = {de:'de-DE',en:'en-GB',fr:'fr-FR',es:'es-ES',pt:'pt-PT',sv:'sv-SE',ja:'ja-JP',zh:'zh-CN',ko:'ko-KR'};

export function supportedTvLanguage(value: string | null | undefined): TvLanguage | undefined {
  const code = value?.toLowerCase().replace('_','-').split('-')[0];
  return TV_LANGUAGES.find(language => language === code);
}
export function detectTvLanguage(preferences: readonly string[]): TvLanguage {
  for (const preference of preferences) {
    const supported = supportedTvLanguage(preference);
    if (supported) return supported;
  }
  return 'en';
}
function deviceLanguage(): TvLanguage {
  return typeof navigator === 'undefined' ? 'en' : detectTvLanguage(navigator.languages?.length ? navigator.languages : [navigator.language]);
}
function cachedLanguage(): TvLanguage | undefined {
  try { return supportedTvLanguage(window.localStorage.getItem(CACHE_KEY)); } catch { return undefined; }
}
let language: TvLanguage = cachedLanguage() || deviceLanguage();
const listeners = new Set<() => void>();
const subscribe = (listener: () => void) => {listeners.add(listener); return () => listeners.delete(listener);};

export function setTvLanguage(next: TvLanguage): void {
  if (language === next) return;
  language = next;
  if (typeof document !== 'undefined') document.documentElement.lang = next;
  listeners.forEach(listener => listener());
}
export function syncTvFamilyLanguage(familyLanguage: string | null): void {
  const next = familyLanguage === null ? deviceLanguage() : supportedTvLanguage(familyLanguage) || 'en';
  try {
    if (familyLanguage === null) window.localStorage.removeItem(CACHE_KEY);
    else window.localStorage.setItem(CACHE_KEY,next);
  } catch { /* A storage restriction must not prevent language changes. */ }
  setTvLanguage(next);
}
export function useTvLanguage(): TvLanguage {
  const current = useSyncExternalStore(subscribe, () => language, () => 'en' as TvLanguage);
  useEffect(() => { document.documentElement.lang = current; }, [current]);
  return current;
}
export const tvLocale = (): string => locales[language];
export function tvText(key: string, values: readonly unknown[] = []): string {
  const text = catalog[key]?.[TV_LANGUAGES.indexOf(language)] ?? key;
  return text.replace(/\{(\d+)\}/g, (_, index: string) => String(values[Number(index)] ?? ''));
}
export function tvSkinName(id: string, fallback: string): string {
  return catalog[`skinNames.${id}`] ? tvText(`skinNames.${id}`) : fallback;
}

// Dialogs and notices may remain open across a family-language update.
// Re-resolve ONLY these app-owned strings, never arbitrary family content.
const exact = new Map<string,string>();
const patterns: Array<{key:string;pattern:RegExp;indices:number[];specificity:number}> = [];
for (const [key, translations] of Object.entries(catalog)) {
  for (const text of translations) {
    if (!/\{\d+\}/.test(text)) {exact.set(text,key);continue;}
    if (!/[A-Za-z\u00c0-\uffff]/.test(text.replace(/\{\d+\}/g,''))) continue;
    const indices: number[] = [];
    const escaped = text.replace(/[.*+?^$()|[\]\\]/g,'\\$&').replace(/\{(\d+)\}/g, (_, index: string) => {indices.push(Number(index));return '([\\s\\S]*?)';});
    patterns.push({key,pattern:new RegExp(`^${escaped}$`),indices,specificity:text.replace(/\{\d+\}/g,'').length});
  }
}
patterns.sort((a,b) => b.specificity - a.specificity);
export function tvTextValue(value: string): string {
  const key = exact.get(value);
  if (key) return tvText(key);
  for (const entry of patterns) {
    const match = entry.pattern.exec(value);
    if (!match) continue;
    const values: string[] = [];
    entry.indices.forEach((index, position) => {values[index] = match[position+1];});
    return tvText(entry.key,values);
  }
  return value;
}
export function tvApiError(status: number, path: string, serverMessage?: string): string {
  if (serverMessage && /not enough points|insufficient points|nicht gen[üu]gend punkte/i.test(serverMessage)) return tvText('Nicht genügend Punkte.');
  if (path === '/api/tv/select-member' && status === 401) return tvText('Die PIN ist falsch. Bitte erneut versuchen.');
  if (status === 429) return tvText('Zu viele Versuche. Bitte kurz warten.');
  if (status >= 500) return tvText('Der Server ist gerade nicht erreichbar.');
  if (status === 401) return tvText('Die TV-Anmeldung ist abgelaufen. Bitte erneut verbinden.');
  if (status === 403) return tvText('Diese Aktion ist für dieses Profil nicht erlaubt.');
  if (status === 409) return tvText('Der Stand hat sich geändert. Bitte erneut laden.');
  if (serverMessage && (catalog[serverMessage] || exact.has(serverMessage))) return tvTextValue(serverMessage);
  return tvText('Diese Aktion ist gerade nicht möglich. Bitte erneut laden.');
}
