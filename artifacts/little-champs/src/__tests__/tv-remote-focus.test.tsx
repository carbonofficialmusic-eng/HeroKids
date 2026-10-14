// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createElement, useState } from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useRemote } from '../../../little-champs-tv/src/hooks/use-remote';
import { rememberFocus, resolveFocus } from '../../../little-champs-tv/src/lib/tv-focus';

type Props = { role?: 'child'|'parent'; removed?: boolean; completed?: boolean; disabled?: boolean; revision?: number; loading?: boolean };

function Board({role='child',removed=false,completed=false,disabled=false,revision=0,loading=false}: Props) {
  const [modal,setModal] = useState<'confirm'|'success'|null>(null);
  useRemote(`tasks:${role}`, !!modal, ()=>setModal(null), '[data-testid="confirm"]');
  return createElement('div',{className:'tv'},
    createElement('header',null,createElement('button',{'data-testid':'menu'},'Aufgaben')),
    createElement('main',{'data-revision':revision},
      loading ? createElement('div',{className:'skeleton'}) : createElement('div',{className:'task-grid',key:role},
        !removed && createElement('article',{className:role==='parent'?'approval-card':'tv-task',tabIndex:completed?0:undefined,'data-testid':'card-task-one'},
          completed ? 'Wartet auf Freigabe' : createElement('button',{key:revision,'data-testid':'task-one',disabled,onClick:()=>setModal('confirm')},role==='parent'?'Genehmigen':'Erledigt')),
        createElement('article',{className:'tv-task','data-testid':'card-task-two'},createElement('button',{'data-testid':'task-two'},'Zweite Aufgabe')))),
    modal && createElement('div',{role:'dialog'},
      createElement('button',{'data-testid':'cancel',onClick:()=>setModal(null)},'Zurück'),
      modal==='confirm'
        ? createElement('button',{'data-testid':'confirm',autoFocus:true,onClick:()=>setModal('success')},'Bestätigen')
        : createElement('button',{'data-testid':'success',autoFocus:true,onClick:()=>setModal(null)},'Weiter')));
}

async function flush() {
  await act(async()=>{
    await Promise.resolve();
    vi.runOnlyPendingTimers();
    await Promise.resolve();
    vi.runOnlyPendingTimers();
  });
}

beforeEach(()=>{
  vi.useFakeTimers();
  vi.stubGlobal('requestAnimationFrame',(cb: FrameRequestCallback)=>window.setTimeout(()=>cb(0),0));
  vi.stubGlobal('cancelAnimationFrame',(id:number)=>window.clearTimeout(id));
});
afterEach(()=>{cleanup();vi.useRealTimers();vi.unstubAllGlobals();});

describe('TV keeps the last remote selection after actions and refreshes',()=>{
  for (const role of ['child','parent'] as const) {
    it(`${role}: returns to the same card after confirmation, success and a changed action`,async()=>{
      const {rerender}=render(createElement(Board,{role}));
      await flush();
      screen.getByTestId('task-one').focus();
      fireEvent.click(screen.getByTestId('task-one'));
      await flush();
      expect(document.activeElement).toBe(screen.getByTestId('confirm'));
      fireEvent.click(screen.getByTestId('confirm'));
      rerender(createElement(Board,{role,completed:true}));
      await flush();
      expect(document.activeElement).toBe(screen.getByTestId('success'));
      fireEvent.click(screen.getByTestId('success'));
      await flush();
      expect(document.activeElement).toBe(screen.getByTestId('card-task-one'));
    });
  }

  it('returns to the launcher when confirmation is canceled',async()=>{
    render(createElement(Board));
    await flush();
    screen.getByTestId('task-two').focus();
    screen.getByTestId('task-one').focus();
    fireEvent.click(screen.getByTestId('task-one'));
    await flush();
    fireEvent.click(screen.getByTestId('cancel'));
    await flush();
    expect(document.activeElement).toBe(screen.getByTestId('task-one'));
  });

  it('selects the next task when an approved card disappears, never the menu',async()=>{
    const {rerender}=render(createElement(Board,{role:'parent'}));
    await flush();
    screen.getByTestId('task-one').focus();
    fireEvent.click(screen.getByTestId('task-one'));
    await flush();
    rerender(createElement(Board,{role:'parent',removed:true}));
    fireEvent.click(screen.getByTestId('cancel'));
    await flush();
    expect(document.activeElement).toBe(screen.getByTestId('task-two'));
  });

  it('preserves selection during automatic data refresh',async()=>{
    const {rerender}=render(createElement(Board));
    await flush();
    screen.getByTestId('task-two').focus();
    rerender(createElement(Board,{revision:1}));
    await flush();
    expect(document.activeElement).toBe(screen.getByTestId('task-two'));
  });

  it('recovers the selected card if an action is temporarily disabled',async()=>{
    const {rerender}=render(createElement(Board));
    await flush();
    screen.getByTestId('task-one').focus();
    rerender(createElement(Board,{disabled:true}));
    // Chromium can blur a newly disabled button; emulate that explicitly.
    (document.activeElement as HTMLElement).blur();
    await flush();
    expect(document.activeElement).toBe(screen.getByTestId('card-task-one'));
    expect(document.activeElement).not.toBe(screen.getByTestId('menu'));
  });

  it('restores a replacement action with the same stable ID after a refetch',async()=>{
    const {rerender}=render(createElement(Board));
    await flush();
    screen.getByTestId('task-one').focus();
    rerender(createElement(Board,{revision:1}));
    await flush();
    expect(document.activeElement).toBe(screen.getByTestId('task-one'));
  });

  it('does not restore another member’s last task',async()=>{
    const {rerender}=render(createElement(Board,{role:'parent'}));
    await flush();
    screen.getByTestId('task-two').focus();
    rerender(createElement(Board,{role:'child'}));
    await flush();
    expect(document.activeElement).toBe(screen.getByTestId('task-one'));
  });

  it('keeps the intended task through temporary loading content',async()=>{
    const {rerender}=render(createElement(Board));
    await flush();
    screen.getByTestId('task-two').focus();
    rerender(createElement(Board,{loading:true}));
    await flush();
    expect(document.activeElement).not.toBe(screen.getByTestId('menu'));
    rerender(createElement(Board));
    await flush();
    expect(document.activeElement).toBe(screen.getByTestId('task-two'));
  });

  it('keeps a bought reward selected when its purchase button becomes disabled',()=>{
    render(createElement('div',{className:'tv'},
      createElement('main',null,createElement('article',{className:'reward-card','data-testid':'card-reward-one'},
        createElement('button',{'data-testid':'buy-reward'},'Kaufen')))));
    const root=document.querySelector<HTMLElement>('.tv')!;
    const button=screen.getByTestId('buy-reward') as HTMLButtonElement;
    const location=rememberFocus(button,root);
    button.disabled=true;
    const target=resolveFocus(location,root);
    expect(target).toBe(screen.getByTestId('card-reward-one'));
    target?.focus();
    expect(document.activeElement).toBe(target);
  });

  it('selects the previous approval if the last card is removed',()=>{
    render(createElement('div',{className:'tv'},createElement('main',null,
      createElement('div',{className:'reward-grid'},
        createElement('article',{'data-testid':'card-approval-one'},createElement('button',{'data-testid':'approve-one'},'Genehmigen')),
        createElement('article',{'data-testid':'card-approval-two'},createElement('button',{'data-testid':'approve-two'},'Genehmigen'))))));
    const root=document.querySelector<HTMLElement>('.tv')!;
    const location=rememberFocus(screen.getByTestId('approve-two'),root);
    screen.getByTestId('card-approval-two').remove();
    expect(resolveFocus(location,root)).toBe(screen.getByTestId('approve-one'));
  });
});