// @vitest-environment jsdom
import { createElement } from 'react';
import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TvTaskCard } from '../components/tv-task-card';
import { TV_LANGUAGES, setTvLanguage, syncTvFamilyLanguage, tvText } from './tv-language';
import type { TvTask } from '../hooks/use-tv-data';

vi.mock('lucide-react', () => {
  const Icon = () => null;
  return {CalendarDays:Icon,Camera:Icon,Check:Icon,CheckCircle2:Icon,Clock3:Icon,LockKeyhole:Icon,RefreshCw:Icon,ShoppingBasket:Icon,Star:Icon,Users:Icon};
});
afterEach(() => {cleanup();setTvLanguage('de');localStorage.clear();});
const task: TvTask = {id:'task',title:'Schließen',description:'Meine eigene Beschreibung',points:5,status:'active',recurrence:'daily'};

describe('TV language updates without touching family content', () => {
  it('updates a mounted card across all nine languages without replacing task data or focus', () => {
    setTvLanguage('de');
    render(createElement(TvTaskCard,{task,memberId:'mia',onComplete:()=>{}}));
    const button = screen.getByTestId('button-complete-task-task');
    button.focus();
    for (const lang of TV_LANGUAGES) {
      act(() => syncTvFamilyLanguage(lang));
      expect(button.textContent).toContain(tvText('Erledigt'));
      expect(screen.getByTestId('card-task-task').textContent).toContain(tvText('Täglich'));
      expect(screen.getByTestId('text-task-title-task').textContent).toBe('Schließen');
      expect(screen.getByText('Meine eigene Beschreibung')).not.toBeNull();
      expect(document.documentElement.lang).toBe(lang);
      expect(document.activeElement).toBe(button);
    }
    expect(localStorage.getItem('littlechamps_tv_family_language')).toBe('ko');
  });
});
