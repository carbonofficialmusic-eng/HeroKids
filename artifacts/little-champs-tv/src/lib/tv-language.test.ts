import { afterEach, describe, expect, it } from 'vitest';
import { TV_LANGUAGES, detectTvLanguage, supportedTvLanguage, setTvLanguage, tvApiError, tvLocale, tvSkinName, tvText, tvTextValue } from './tv-language';

afterEach(() => setTvLanguage('de'));

describe('TV languages', () => {
  it('detects every supported regional language and uses English for unsupported languages', () => {
    for (const lang of TV_LANGUAGES) expect(supportedTvLanguage(`${lang.toUpperCase()}_ZZ`)).toBe(lang);
    expect(detectTvLanguage(['it-IT','fr-CA'])).toBe('fr');
    expect(detectTvLanguage(['it-IT'])).toBe('en');
    expect(detectTvLanguage([])).toBe('en');
  });

  it.each(TV_LANGUAGES)('has localized TV instructions, interpolations and dates for %s', lang => {
    setTvLanguage(lang);
    const heading = tvText('PIN für {0}', ['Mia']);
    expect(heading).toContain('Mia');
    expect(heading).not.toContain('{0}');
    const explanation = tvText('Bei {0} Sternen wird dieser Legacy-Charakter aufgedeckt. {1} von {2} Sternen gefunden.', [8,3,8]);
    expect(explanation).toContain('3');
    expect(explanation).not.toMatch(/\{\d+\}/);
    if (lang !== 'de') {
      expect(tvText('Die ganze Familie. Ein Bildschirm.')).not.toBe('Die ganze Familie. Ein Bildschirm.');
      expect(tvText('Wartet auf Genehmigung')).not.toBe('Wartet auf Genehmigung');
      expect(tvText('Sterne')).not.toBe('Sterne');
    }
    expect(new Intl.DateTimeFormat(tvLocale()).resolvedOptions().locale.slice(0,2)).toBe(lang);
    expect(tvSkinName('brave-knight','Ritter')).not.toBe('Ritter');
  });

  it('relocalizes stored dialog messages while preserving names and order', () => {
    setTvLanguage('en');
    const message = tvText('„{0}“ von {1} ablehnen?', ['Zimmer aufräumen','Mia']);
    setTvLanguage('ja');
    expect(tvTextValue(message)).toBe(tvText('„{0}“ von {1} ablehnen?', ['Zimmer aufräumen','Mia']));
    setTvLanguage('de');
    expect(tvTextValue(message)).toBe('„Zimmer aufräumen“ von Mia ablehnen?');
    expect(tvTextValue('custom API diagnostic')).toBe('custom API diagnostic');
  });

  it('localizes server and connection errors without showing English server details', () => {
    setTvLanguage('fr');
    expect(tvApiError(401,'/api/tv/select-member','Invalid PIN')).toBe(tvText('Die PIN ist falsch. Bitte erneut versuchen.'));
    expect(tvApiError(409,'/api/tasks','Task was already completed')).toBe(tvText('Der Stand hat sich geändert. Bitte erneut laden.'));
    expect(tvApiError(500,'/api/tv/session','Database error')).toBe(tvText('Der Server ist gerade nicht erreichbar.'));
  });
});
