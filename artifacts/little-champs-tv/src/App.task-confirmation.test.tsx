// @vitest-environment jsdom
import { createElement } from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from './App';
import { setTvLanguage } from './lib/tv-language';

const { complete, member, task } = vi.hoisted(() => ({
  complete: vi.fn(),
  member: {id:'child',displayName:'Mia',role:'child',totalPoints:0},
  task: {id:'task',title:'Aufräumen',points:10,requiresApproval:true},
}));

vi.mock('./hooks/use-remote', () => ({useRemote:vi.fn()}));
vi.mock('lucide-react', () => {
  const Icon = () => null;
  return Object.fromEntries([
    'ArrowLeft','ArrowRight','CalendarDays','Camera','Check','ChevronRight','CircleHelp',
    'Crown','Gamepad2','LockKeyhole','LogOut','RefreshCw','ShieldCheck','Sparkles','Star','Trophy','Users','X',
  ].map(name=>[name,Icon]));
});
// Data hooks are mocked, so no real query provider is needed. Avoid loading
// the workspace package's separate React version into this isolated UI test.
vi.mock('@tanstack/react-query', () => ({
  QueryClient:class {},
  QueryClientProvider:({children}:any)=>children,
  useQueryClient:()=>({invalidateQueries:vi.fn()}),
}));
vi.mock('./components/tv-task-board', () => ({
  TvTaskBoard: ({onComplete}:any) => createElement('button', {onClick:()=>onComplete(task)}, 'Aufgabe erledigen'),
}));
vi.mock('./components/tv-rewards', () => ({TvRewards:()=>null}));
vi.mock('./components/tv-skin-card-art', () => ({TvSkinCardArt:()=>null}));
vi.mock('./components/tv-shopping-list-dialog', () => ({TvShoppingListDialog:()=>null}));
vi.mock('./hooks/use-tv-data', () => {
  const query = () => ({data:[],isLoading:false,isFetching:false,refetch:vi.fn()});
  const mutation = () => ({isPending:false,mutateAsync:vi.fn()});
  return {
    apiOrigin:'',isPrivateTvAvatar:()=>false,memberAvatarUrl:()=>null,skinAssetUrl:()=>null,
    loadPrivateTvAvatar:vi.fn(),clearPendingPair:vi.fn(),getPendingPair:()=>null,
    useSession:()=>({data:{authenticated:true,member,members:[member],selectedMemberId:member.id},isLoading:false}),
    useTasks:query,useAppointments:query,useTaskCategoryNames:()=>({data:{},isError:false}),
    useSkins:()=>({data:{skins:[]}}),usePairPoll:()=>({}),
    useCompleteTask:()=>({isPending:false,mutateAsync:complete}),
    useDiscoverSkin:mutation,useEquipSkin:mutation,useStartPair:mutation,useSelectMember:mutation,useUnpair:mutation,
  };
});

beforeEach(() => {
  setTvLanguage('de');
  complete.mockReset();
  vi.stubGlobal('requestAnimationFrame',(callback:FrameRequestCallback)=>setTimeout(()=>callback(0),0));
  vi.stubGlobal('cancelAnimationFrame',clearTimeout);
  vi.spyOn(window,'scrollTo').mockImplementation(()=>{});
});
afterEach(() => {cleanup();vi.restoreAllMocks();vi.unstubAllGlobals();});

describe('TV task completion with one confirmation', () => {
  it.each([
    {result:{},message:'Die Aufgabe wartet auf die Freigabe.'},
    {result:{partial:true,dailyProgress:1,dailyTarget:3},message:'1 von 3 Ausführungen heute. Die Aufgabe ist noch nicht fertig.'},
    {result:{isTeamTask:true,teamReadyForApproval:false},message:'Dein Teil ist eingereicht. Die anderen sind jetzt dran.'},
  ])('shows the result without a second confirmation: $message', async ({result,message}) => {
    complete.mockResolvedValue(result);
    render(createElement(App));
    fireEvent.click(await screen.findByTestId('button-select-member-child'));
    fireEvent.click(await screen.findByText('Aufgabe erledigen'));
    expect(complete).not.toHaveBeenCalled();
    fireEvent.click(screen.getByTestId('button-confirm-task'));
    await waitFor(()=>expect(screen.queryByTestId('button-confirm-task')).toBeNull());
    expect(complete).toHaveBeenCalledTimes(1);
    expect(complete).toHaveBeenCalledWith('task');
    expect(screen.getByTestId('status-task-success').textContent).toContain(message);
    expect(screen.queryByTestId('button-close-success')).toBeNull();
  });

  it('keeps submission errors visible instead of claiming success', async () => {
    complete.mockRejectedValue(new Error('Verbindung unterbrochen'));
    render(createElement(App));
    fireEvent.click(await screen.findByTestId('button-select-member-child'));
    fireEvent.click(await screen.findByText('Aufgabe erledigen'));
    fireEvent.click(screen.getByTestId('button-confirm-task'));
    expect((await screen.findByTestId('status-task-error')).textContent).toContain('Verbindung unterbrochen');
    expect(screen.queryByTestId('status-task-success')).toBeNull();
  });
});
