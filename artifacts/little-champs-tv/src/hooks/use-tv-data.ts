import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import foxAvatar from '@assets/generated_images/Cute_fox_avatar_character_e27462ae.png';
import bearAvatar from '@assets/generated_images/Cute_bear_avatar_character_c2930694.png';
import rabbitAvatar from '@assets/generated_images/Cute_rabbit_avatar_character_12cf3f2c.png';
import catAvatar from '@assets/generated_images/Cute_cat_avatar_character_0fe91690.png';
import penguinAvatar from '@assets/generated_images/Cute_penguin_avatar_character_8788d7ad.png';
import lionAvatar from '@assets/generated_images/Cute_lion_avatar_character_5e5b20aa.png';
import { resolveTvAssetUrl, resolveTvSkinAssetUrl } from '../lib/tv-asset-url';
import { syncTvFamilyLanguage, tvApiError, tvText } from '../lib/tv-language';
const rewardCacheKeys = ['tv-rewards','tv-redemptions','tv-shared','tv-requests','tv-pending','tv-family'];

export interface TvMember {
  id: string; displayName: string; role: 'parent' | 'child';
  avatarUrl?: string | null; color?: string | null;
  activeSkinId?: string | null; useCustomAvatar?: boolean;
  usesDefaultPin?: boolean;
  totalPoints?: number; totalEarned?: number;
}
export interface TvSession {
  authenticated: boolean;
  language?: string;
  familyName?: string;
  selectedMemberId?: string | null;
  members: TvMember[];
  member?: TvMember | null;
  legacy?: boolean;
}
export interface TvTaskMemberProgress {
  memberId: string;
  displayName: string;
  status: string | null;
  hasCompleted: boolean;
  hasSubmitted?: boolean;
  dailyProgress?: number;
  nextAvailableDate?: string | null;
}
export interface TvTask {
  id: string; title: string; description?: string | null; points: number;
  status: string; recurrence: string; dueDate?: string | null;
  dueTime?: string | null; durationMinutes?: number | null; iconEmoji?: string | null;
  isImportant?: boolean; isGoogleCalendarEvent?: boolean;
  requiresProof?: boolean; requiresApproval?: boolean; isShoppingList?: boolean;
  isSharedTask?: boolean; sharedMemberIds?: string[];
  recurrenceDays?: number | null;
  assignedMemberCompletions?: TvTaskMemberProgress[];
  sharedMemberCompletions?: TvTaskMemberProgress[];
  memberHasCompleted?: boolean; memberCompletionStatus?: 'pending' | 'approved' | 'rejected' | null;
  memberNextAvailableDate?: string | null; nextAvailableDate?: string | null;
  remainingSlots?: number | null; dailyTarget?: number; dailyProgress?: number;
}
export interface TvTaskCompletionResponse {
  partial?: boolean;
  dailyProgress?: number;
  dailyTarget?: number;
  message?: string;
  isTeamTask?: boolean;
  autoApproved?: boolean;
  teamReadyForApproval?: boolean;
}
export interface TvShoppingListItem {
  id: string;
  taskId: string;
  text: string;
  sortOrder: number;
  completedByMemberId: string | null;
  completedAt: string | null;
  completedByMemberName?: string | null;
  completedByMemberColor?: string | null;
}
export interface TvShoppingItemToggleResponse {
  item: TvShoppingListItem;
  allCompleted: boolean;
}
export interface TvSkin {
  id: string; name: string; description?: string; position?: number;
  isDiscovered: boolean; isActive: boolean; canDiscover: boolean; isOverLimit: boolean;
}
export interface SkinsResponse {
  skins: TvSkin[]; availableCards: number; totalEarned: number; maxSkins: number;
  tierLimitReached: boolean; starStats?: {starsFound: number; totalStars: number};
  starPlacements?: Record<string, boolean>;
}

const TOKEN_KEY = 'little-champs-tv-token';
const DEVICE_KEY = 'little-champs-tv-device-token';
const PENDING_KEY = 'little-champs-tv-pair-pending';
export interface PairRequest {id: string; secret: string; code: string; expiresAt: string}
export const getPendingPair = (): PairRequest | null => {
  try {
    const saved = window.sessionStorage.getItem(PENDING_KEY);
    return saved ? JSON.parse(saved) as PairRequest : null;
  } catch { return null; }
};
export const clearPendingPair = () => window.sessionStorage.removeItem(PENDING_KEY);
export const hasTvToken = () => !!window.localStorage.getItem(TOKEN_KEY);
export const hasDeviceToken = () => !!window.localStorage.getItem(DEVICE_KEY);
export const apiOrigin = (import.meta.env.VITE_TV_API_ORIGIN || '').replace(/\/$/, '');
const devAssetBase = import.meta.env.DEV
  ? `${import.meta.env.BASE_URL.replace(/\/$/, '')}/source-assets`
  : '';
export const assetUrl = (path: string) => resolveTvAssetUrl(path, apiOrigin, devAssetBase);
export function skinAssetUrl(skinId: string, kind: 'avatars' | 'backgrounds'): string {
  return resolveTvSkinAssetUrl(
    skinId,
    kind,
    import.meta.env.VITE_TV_PACKAGED === '1',
    apiOrigin,
    devAssetBase,
  );
}
const defaultAvatars: Record<string, string> = {
  fox: foxAvatar, bear: bearAvatar, rabbit: rabbitAvatar,
  cat: catAvatar, penguin: penguinAvatar, lion: lionAvatar,
};
export function memberAvatarUrl(member: TvMember): string | undefined {
  const custom = member.avatarUrl?.trim();
  const fallback = custom?.startsWith('default:')
    ? defaultAvatars[custom.slice('default:'.length)]
    : custom && !isPrivateTvAvatar(custom) ? assetUrl(custom) : undefined;
  if (member.useCustomAvatar && fallback) return fallback;
  if (member.activeSkinId) return skinAssetUrl(member.activeSkinId, 'avatars');
  return fallback;
}
export function isPrivateTvAvatar(path: string | null | undefined): path is string {
  return !!path && /^\/api\/tv\/members\/[^/]+\/avatar$/.test(path);
}
export async function loadPrivateTvAvatar(path: string): Promise<string> {
  if (!isPrivateTvAvatar(path)) throw new Error('Invalid TV avatar path');
  const token = getToken();
  if (!token) throw new Error('TV session required for private avatar');
  const response = await fetch(`${apiOrigin}${path}`, {
    headers: { Authorization: `TV ${token}` },
    credentials: 'omit',
    cache: 'no-store',
  });
  if (!response.ok) throw new Error(`Avatar could not be loaded (${response.status})`);
  const image = await response.blob();
  if (!image.type.startsWith('image/')) throw new Error('Avatar response is not an image');
  return URL.createObjectURL(image);
}
/** Private proof media must never be loaded with a plain img URL: it needs the TV bearer token. */
export async function loadPrivateTvTaskProof(completionId: string): Promise<string> {
  if (!/^[a-zA-Z0-9_-]+$/.test(completionId)) throw new Error('Ungültige Einreichung.');
  const token = getToken();
  if (!token) throw new Error('Für den Fotobeweis ist ein Familien-TV-Profil erforderlich.');
  const response = await fetch(`${apiOrigin}/api/tv/task-proofs/${encodeURIComponent(completionId)}`, {
    headers: {Authorization:`TV ${token}`}, credentials:'omit', cache:'no-store',
  });
  if (!response.ok) {
    const details = await response.json().catch(()=>null) as {message?:string}|null;
    throw new Error(tvApiError(response.status, '/api/tv/task-proofs', details?.message));
  }
  const photo = await response.blob();
  if (!photo.type.startsWith('image/')) throw new Error('Der Fotobeweis ist kein Bild.');
  return URL.createObjectURL(photo);
}
const getToken = () => window.localStorage.getItem(TOKEN_KEY);

async function revokeOldChildLink(): Promise<void> {
  if (!window.localStorage.getItem(DEVICE_KEY)) return;
  await api<{success:boolean}>('/api/device-link/logout','POST',undefined,'device');
  window.localStorage.removeItem(DEVICE_KEY);
}

export async function api<T>(path: string, method = 'GET', body?: unknown, auth: 'tv' | 'device' | 'none' = 'tv'): Promise<T> {
  const token = auth === 'tv' ? getToken() : auth === 'device' ? window.localStorage.getItem(DEVICE_KEY) : null;
  const response = await fetch(`${apiOrigin}${path}`, {
    method, credentials: 'omit',
    headers: {...(body === undefined ? {} : {'Content-Type': 'application/json'}), ...(token ? {Authorization: `${auth === 'device' ? 'Device' : 'TV'} ${token}`} : {})},
    body: body === undefined ? undefined : JSON.stringify(body),
    cache: 'no-store',
  }).catch(() => { throw new Error(tvText('Keine Verbindung. Bitte erneut versuchen.')); });
  // A wrong parent PIN also returns 401. Only the session endpoint may decide
  // whether a family token is actually revoked; never discard it here.
  if (response.status === 401 && auth === 'tv' && token && path !== '/api/tv/select-member' && path !== '/api/tv/session') {
    window.dispatchEvent(new Event('tv-auth-check'));
  }
  if (!response.ok) {
    const details = await response.json().catch(() => null) as {message?: string} | null;
    throw new Error(tvApiError(response.status, path, details?.message));
  }
  return response.json() as Promise<T>;
}

export function useSession() {
  return useQuery({queryKey: ['tv-session'], queryFn: async (): Promise<TvSession> => {
    if (hasTvToken()) {
      let session: TvSession;
      try { session = await api<TvSession>('/api/tv/session'); }
      catch (error) {
        // A revoked TV token is a signed-out state, not an offline error.
        if (!hasTvToken()) return {authenticated:false,members:[]};
        throw error;
      }
      if (!session.authenticated) {
        window.localStorage.removeItem(TOKEN_KEY);
        syncTvFamilyLanguage(null);
        return {authenticated: false, members: []};
      }
      syncTvFamilyLanguage(session.language || 'en');
      // The old child credential must stay available until its server-side
      // revocation succeeds. Retry while the family TV session remains active.
      if (hasDeviceToken()) void revokeOldChildLink().catch(() => {});
      return session;
    }
    if (hasDeviceToken()) {
      try {
        const legacy = await api<{authenticated: boolean; language?:string; memberId?: string; memberName?: string; familyName?: string; avatarUrl?: string | null; totalPoints?: number; totalEarned?: number}>('/api/device-link/session','GET',undefined,'device');
        if (legacy.authenticated) {
          syncTvFamilyLanguage(legacy.language || 'en');
          const linked: TvMember = {id:legacy.memberId || 'linked',displayName:legacy.memberName || 'Kind',role:'child',avatarUrl:legacy.avatarUrl,totalPoints:legacy.totalPoints,totalEarned:legacy.totalEarned};
          return {authenticated:true,legacy:true,language:legacy.language,familyName:legacy.familyName,members:[linked],member:linked,selectedMemberId:linked.id};
        }
        window.localStorage.removeItem(DEVICE_KEY);
      } catch (error) {
        if (!hasDeviceToken()) return {authenticated:false,members:[]};
        throw error;
      }
    }
    syncTvFamilyLanguage(null);
    return {authenticated:false,members:[]};
  }, refetchInterval: 30000, retry: 1});
}
export function useStartPair() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      clearPendingPair();
      const result = await api<PairRequest>('/api/tv/pair/start','POST',undefined,'none');
      window.sessionStorage.setItem(PENDING_KEY,JSON.stringify(result));
      return result;
    },
    onSuccess: () => qc.removeQueries({queryKey:['tv-pair-poll']}),
  });
}
export function usePairPoll(pair: PairRequest | null) {
  const qc = useQueryClient();
  return useQuery({
    queryKey:['tv-pair-poll',pair?.id],
    enabled:!!pair,
    retry:false,
    refetchInterval:3000,
    queryFn:async () => {
      if (!pair) throw new Error('Kein Verbindungscode vorhanden.');
      if (Date.now() >= new Date(pair.expiresAt).getTime()) return {status:'expired' as const};
      const result = await api<{status:'pending'|'expired'|'approved'; tvToken?:string}>('/api/tv/pair/poll','POST',{id:pair.id,secret:pair.secret},'none');
      if (result.status === 'approved') {
        if (!result.tvToken) throw new Error('Freigabe ohne TV-Zugang erhalten. Bitte erneut versuchen.');
        // Revoke the linked-child token only after approval. The TV token is
        // persisted first, so a failed legacy logout cannot strand the TV.
        window.localStorage.setItem(TOKEN_KEY,result.tvToken);
        clearPendingPair();
        const oldToken = window.localStorage.getItem(DEVICE_KEY);
        if (oldToken) {
          try { await revokeOldChildLink(); } catch { /* Keep token for retry on the next session refresh. */ }
        }
        await qc.cancelQueries({queryKey:['tv-tasks']});
        await qc.cancelQueries({queryKey:['tv-skins']});
        await qc.cancelQueries({queryKey:['tv-shopping-items']});
        qc.removeQueries({queryKey:['tv-tasks']});
        qc.removeQueries({queryKey:['tv-skins']});
        qc.removeQueries({queryKey:['tv-shopping-items']});
        rewardCacheKeys.forEach(key=>qc.removeQueries({queryKey:[key]}));
        qc.invalidateQueries({queryKey:['tv-session']});
      }
      return result;
    },
  });
}
export function useSelectMember() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({memberId,pin}:{memberId:string;pin?:string}) => {
      // Cancel in-flight responses from the previous member before changing
      // identity. Clear cached private results before rendering the new member.
      await qc.cancelQueries({queryKey:['tv-tasks']});
      await qc.cancelQueries({queryKey:['tv-skins']});
      await qc.cancelQueries({queryKey:['tv-shopping-items']});
       await Promise.all(rewardCacheKeys.map(key=>qc.cancelQueries({queryKey:[key]})));
      const session = await api<TvSession>('/api/tv/select-member','POST',{memberId,...(pin ? {pin} : {})});
      qc.removeQueries({queryKey:['tv-tasks']});
      qc.removeQueries({queryKey:['tv-skins']});
       qc.removeQueries({queryKey:['tv-shopping-items']});
       rewardCacheKeys.forEach(key=>qc.removeQueries({queryKey:[key]}));
      qc.setQueryData(['tv-session'],session);
      return session;
    },
    onError: () => { void qc.invalidateQueries({queryKey:['tv-session']}); },
  });
}
export function useUnpair() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => hasTvToken() ? api<{success:boolean}>('/api/tv/logout','POST') : api<{success:boolean}>('/api/device-link/logout','POST',undefined,'device'),
    onSuccess: async () => {
      window.localStorage.removeItem(TOKEN_KEY);window.localStorage.removeItem(DEVICE_KEY);clearPendingPair();
       await qc.cancelQueries({queryKey:['tv-tasks']});await qc.cancelQueries({queryKey:['tv-skins']});await qc.cancelQueries({queryKey:['tv-shopping-items']});
       await Promise.all(rewardCacheKeys.map(key=>qc.cancelQueries({queryKey:[key]})));
       qc.removeQueries({queryKey:['tv-tasks']});qc.removeQueries({queryKey:['tv-skins']});qc.removeQueries({queryKey:['tv-shopping-items']});
       rewardCacheKeys.forEach(key=>qc.removeQueries({queryKey:[key]}));
      qc.setQueryData(['tv-session'],{authenticated:false,members:[]});
    },
  });
}
export function useTasks(memberId?: string, legacy = false) {
  return useQuery({queryKey: ['tv-tasks',memberId,legacy], queryFn: () => api<TvTask[]>('/api/tasks','GET',undefined,legacy?'device':'tv'), enabled: !!memberId, refetchInterval: 20000, staleTime: 8000});
}
export function useAppointments(memberId?: string, legacy = false) {
  return useQuery({queryKey:['tv-appointments',memberId,legacy],queryFn:()=>api<TvTask[]>('/api/appointments','GET',undefined,legacy?'device':'tv'),enabled:!!memberId,refetchInterval:20000,staleTime:8000});
}
export function useTaskCategoryNames(memberId?: string, legacy = false) {
  return useQuery({queryKey:['tv-task-category-names',memberId,legacy],queryFn:()=>api<{categoryNames?: Record<string,string>|null}>('/api/families/current','GET',undefined,legacy?'device':'tv'),enabled:!!memberId,staleTime:60000,refetchInterval:60000});
}
export function useCompleteTask(memberId?: string, legacy = false) {
  const qc = useQueryClient();
  return useMutation({
    // Proof-required tasks must be submitted on a phone with a photo; this caller
    // is only used for tasks whose requiresProof field is false.
    mutationFn: (taskId: string) => api<TvTaskCompletionResponse>(`/api/tasks/${encodeURIComponent(taskId)}/complete`, 'POST', {},legacy?'device':'tv'),
    onSuccess: () => {qc.invalidateQueries({queryKey: ['tv-tasks',memberId]}); qc.invalidateQueries({queryKey: ['tv-appointments',memberId]}); qc.invalidateQueries({queryKey: ['tv-session']});},
  });
}
export function useShoppingListItems(taskId?: string, memberId?: string, legacy = false) {
  return useQuery({
    queryKey:['tv-shopping-items',taskId,memberId,legacy],
    queryFn:()=>api<TvShoppingListItem[]>(`/api/tasks/${encodeURIComponent(taskId!)}/shopping-items`,'GET',undefined,legacy?'device':'tv'),
    enabled:!!taskId && !!memberId,
    retry:false,
    staleTime:0,
    refetchInterval:10000,
  });
}
export function useToggleShoppingListItem(memberId?: string, legacy = false) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn:({itemId}:{taskId:string;itemId:string})=>api<TvShoppingItemToggleResponse>(`/api/shopping-items/${encodeURIComponent(itemId)}/toggle`,'PATCH',undefined,legacy?'device':'tv'),
    onSuccess:(_result,{taskId})=>{
      void qc.invalidateQueries({queryKey:['tv-shopping-items',taskId,memberId,legacy]});
      void qc.invalidateQueries({queryKey:['tv-tasks',memberId]});
      void qc.invalidateQueries({queryKey:['tv-appointments',memberId]});
      void qc.invalidateQueries({queryKey:['tv-session']});
      void qc.invalidateQueries({queryKey:['tv-pending',memberId]});
    },
  });
}
export function useSkins(memberId?: string, legacy = false) {
  return useQuery({queryKey: ['tv-skins',memberId,legacy], queryFn: () => api<SkinsResponse>('/api/skins','GET',undefined,legacy?'device':'tv'), enabled: !!memberId, staleTime: 8000, refetchInterval: 30000});
}
export function useDiscoverSkin(memberId?: string, legacy = false) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (skinId: string) => api<{skinId: string;starFound?: boolean;legacySkinAwarded?: string}>('/api/skins/discover','POST',{skinId},legacy?'device':'tv'),
    onSuccess: () => {qc.invalidateQueries({queryKey: ['tv-skins',memberId]});qc.invalidateQueries({queryKey: ['tv-session']});},
  });
}
export function useEquipSkin(memberId?: string, legacy = false) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (skinId: string) => api<unknown>('/api/skins/select','POST',{skinId},legacy?'device':'tv'),
    onSuccess: () => {qc.invalidateQueries({queryKey: ['tv-skins',memberId]});qc.invalidateQueries({queryKey: ['tv-session']});},
  });
}