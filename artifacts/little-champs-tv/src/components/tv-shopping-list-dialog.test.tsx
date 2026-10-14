// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createElement, type ComponentProps } from 'react';
import type { TvTask } from '../hooks/use-tv-data';
import { TvShoppingListDialog } from './tv-shopping-list-dialog';
import { setTvLanguage } from '../lib/tv-language';
beforeEach(() => setTvLanguage('de'));

const hookState=vi.hoisted(()=>({
  tasksQuery:{data:undefined as any,isFetching:false,isError:false,error:null as unknown,refetch:vi.fn()},
  itemsQuery:{data:undefined as any,isLoading:false,isError:false,isFetching:false,error:null as unknown,refetch:vi.fn()},
  toggle:{isPending:false,isError:false,error:null as unknown,variables:undefined as any,mutate:vi.fn(),reset:vi.fn()},
  listHookArgs:[] as unknown[][],
}));

vi.mock('../hooks/use-tv-data',async(importOriginal)=>{
  const actual=await importOriginal<typeof import('../hooks/use-tv-data')>();
  return {
    ...actual,
    useTasks:()=>hookState.tasksQuery,
    useShoppingListItems:(...args:unknown[])=>{
      hookState.listHookArgs.push(args);
      return hookState.itemsQuery;
    },
    useToggleShoppingListItem:()=>hookState.toggle,
  };
});

vi.mock('lucide-react',()=>{
  const Icon=()=>null;
  return {AlertCircle:Icon,Check:Icon,CheckCircle2:Icon,Circle:Icon,Clock3:Icon,LockKeyhole:Icon,RefreshCw:Icon,ShoppingBasket:Icon,X:Icon};
});

const task:TvTask={id:'list-1',title:'Einkauf',points:5,status:'active',recurrence:'none',isShoppingList:true};
const openItems=[
  {id:'item-1',taskId:'list-1',text:'Äpfel',sortOrder:0,completedByMemberId:null,completedAt:null},
  {id:'item-2',taskId:'list-1',text:'Brot',sortOrder:1,completedByMemberId:'child',completedAt:'2026-06-12T10:00:00.000Z',completedByMemberName:'Mia'},
];
const completedItems=openItems.map(item=>({...item,completedByMemberId:'child',completedAt:'2026-06-12T11:00:00.000Z'}));

function resetHooks(selectedTask:TvTask=task,items:unknown[]=openItems) {
  hookState.tasksQuery={data:[selectedTask],isFetching:false,isError:false,error:null,refetch:vi.fn()};
  hookState.itemsQuery={data:items,isLoading:false,isError:false,isFetching:false,error:null,refetch:vi.fn()};
  hookState.toggle={isPending:false,isError:false,error:null,variables:undefined,mutate:vi.fn(),reset:vi.fn()};
  hookState.listHookArgs=[];
}

function renderDialog(props:Partial<ComponentProps<typeof TvShoppingListDialog>>={}) {
  const selectedTask=props.task || task;
  resetHooks(selectedTask);
  const onSuccess=vi.fn();
  const onClose=vi.fn();
  const result=render(createElement(TvShoppingListDialog,{task,memberId:'child',legacy:false,onClose,onSuccess,...props}));
  return {...result,onSuccess,onClose};
}

afterEach(()=>{
  cleanup();
});

describe('TvShoppingListDialog',()=>{
  it('renders server items and progress and reacts to a completed toggle response',()=>{
    const {onSuccess,rerender}=renderDialog();
    expect(screen.getByText('Äpfel')).not.toBeNull();
    expect(screen.getByTestId('shopping-list-progress').textContent).toContain('1 von 2');
    expect(hookState.listHookArgs[0]).toEqual(['list-1','child',false]);

    hookState.toggle.mutate=vi.fn((_input,callbacks)=>callbacks.onSuccess({item:openItems[0],allCompleted:true}));
    fireEvent.click(screen.getByTestId('button-shopping-item-item-1'));
    expect(hookState.toggle.mutate).toHaveBeenCalledWith(
      {taskId:'list-1',itemId:'item-1'},
      expect.objectContaining({onSuccess:expect.any(Function)}),
    );
    expect(onSuccess).toHaveBeenCalledWith('Liste erledigt','Alle Produkte sind abgehakt. Die Liste wurde abgeschlossen.');

    hookState.itemsQuery={...hookState.itemsQuery,data:completedItems};
    rerender(createElement(TvShoppingListDialog,{task,memberId:'child',legacy:false,onClose:vi.fn(),onSuccess}));
    expect(screen.getByTestId('shopping-list-progress').textContent).toContain('2 von 2');
    expect(screen.getByTestId('shopping-list-complete')).not.toBeNull();
  });

  it.each([
    ['pending approval',{memberCompletionStatus:'pending' as const},false],
    ['approved',{memberCompletionStatus:'approved' as const,memberHasCompleted:true},false],
    ['completed task',{status:'completed'},true],
    ['not assigned',{sharedMemberIds:['other']},true],
  ])('keeps a %s list viewable with the expected toggle policy',(_name,taskChanges,readOnly)=>{
    const selectedTask={...task,...taskChanges} as TvTask;
    const {rerender}=renderDialog({task:selectedTask});
    const item=screen.getByTestId('button-shopping-item-item-1');
    expect(item.getAttribute('aria-disabled')).toBe(readOnly?'true':'false');
    expect(screen.getByText('Äpfel')).not.toBeNull();
    if (readOnly) {
      fireEvent.click(item);
      expect(hookState.toggle.mutate).not.toHaveBeenCalled();
    }
    rerender(createElement(TvShoppingListDialog,{task:selectedTask,memberId:'child',legacy:false,onClose:vi.fn(),onSuccess:vi.fn()}));
  });

  it('allows unchecking an all-complete active pending list and refreshes its stale completion state',()=>{
    const pendingTask={...task,memberCompletionStatus:'pending' as const,requiresApproval:true};
    const {onSuccess,rerender}=renderDialog({task:pendingTask});
    hookState.itemsQuery={...hookState.itemsQuery,data:completedItems};
    rerender(createElement(TvShoppingListDialog,{task:pendingTask,memberId:'child',legacy:false,onClose:vi.fn(),onSuccess}));

    expect(screen.getByTestId('shopping-list-complete').textContent).toContain('wieder öffnen');
    expect(screen.getByTestId('button-shopping-item-item-1').getAttribute('aria-disabled')).toBe('false');
    hookState.toggle.mutate=vi.fn((_input,callbacks)=>callbacks.onSuccess({item:openItems[0],allCompleted:false}));
    fireEvent.click(screen.getByTestId('button-shopping-item-item-1'));
    expect(hookState.toggle.mutate).toHaveBeenCalled();
    expect(onSuccess).not.toHaveBeenCalled();

    hookState.itemsQuery={...hookState.itemsQuery,data:openItems};
    rerender(createElement(TvShoppingListDialog,{task:pendingTask,memberId:'child',legacy:false,onClose:vi.fn(),onSuccess}));
    expect(screen.getByTestId('shopping-list-progress').textContent).toContain('1 von 2');
  });

  it('keeps a stale dialog read-only after refreshed task data no longer includes its task',()=>{
    const {rerender}=renderDialog();
    hookState.tasksQuery={...hookState.tasksQuery,data:[]};
    rerender(createElement(TvShoppingListDialog,{task,memberId:'child',legacy:false,onClose:vi.fn(),onSuccess:vi.fn()}));

    expect(screen.getByTestId('shopping-list-lock').textContent).toContain('wurde entfernt');
    const item=screen.getByTestId('button-shopping-item-item-1');
    expect(item.getAttribute('aria-disabled')).toBe('true');
    fireEvent.click(item);
    expect(hookState.toggle.mutate).not.toHaveBeenCalled();
  });

  it('uses a separate member-scoped query after switching the dialog profile',()=>{
    const {rerender}=renderDialog();
    rerender(createElement(TvShoppingListDialog,{task,memberId:'other',legacy:false,onClose:vi.fn(),onSuccess:vi.fn()}));
    expect(hookState.listHookArgs[hookState.listHookArgs.length-1]).toEqual(['list-1','other',false]);
  });

  it('shows empty and recoverable item-fetch error states',()=>{
    const {rerender}=renderDialog();
    hookState.itemsQuery={...hookState.itemsQuery,data:[],isLoading:false,isError:false};
    rerender(createElement(TvShoppingListDialog,{task,memberId:'child',legacy:false,onClose:vi.fn(),onSuccess:vi.fn()}));
    expect(screen.getByTestId('shopping-list-empty')).not.toBeNull();

    const refetch=vi.fn();
    hookState.itemsQuery={...hookState.itemsQuery,isError:true,error:new Error('Offline'),refetch};
    rerender(createElement(TvShoppingListDialog,{task,memberId:'child',legacy:false,onClose:vi.fn(),onSuccess:vi.fn()}));
    expect(screen.getByTestId('shopping-list-error').textContent).toContain('Offline');
    fireEvent.click(screen.getByTestId('button-retry-shopping-list'));
    expect(refetch).toHaveBeenCalled();
  });

  it('reports collective approval rather than auto-approval for pending lists',()=>{
    const approvalTask={...task,requiresApproval:true};
    const {onSuccess}=renderDialog({task:approvalTask});
    hookState.toggle.mutate=vi.fn((_input,callbacks)=>callbacks.onSuccess({item:openItems[0],allCompleted:true}));
    fireEvent.click(screen.getByTestId('button-shopping-item-item-1'));

    expect(onSuccess).toHaveBeenCalledWith('Liste eingereicht','Alle Produkte sind abgehakt. Die Liste wartet jetzt auf die gemeinsame Freigabe.');
  });
});