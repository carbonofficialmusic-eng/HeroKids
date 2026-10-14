import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from './use-tv-data';

export interface TvReward {id:string;title:string;description:string|null;pointThreshold:number;iconEmoji:string;isActive:boolean;oneTimeOnly?:boolean;familyName:string;createdAt?:string}
export interface TvParticipant {id:string;memberId:string;displayName?:string;pointsContributed:number;member?:{displayName:string}}
export interface TvRedemption {id:string;memberId:string;rewardId:string;rewardTitle?:string;rewardIconEmoji?:string;pointsSpent:number;originalPointsSpent?:number;redeemedAt?:string;status:string;sharingStatus:'not_shared'|'sharing_active'|'sharing_finalized';sharingParticipants?:TvParticipant[];participants?:TvParticipant[];reward?:TvReward;member?:{displayName:string}}
export interface TvRewardRequest {id:string;requester:{id:string;displayName:string};title:string;description:string|null;pointThreshold:number;status:'pending'|'approved'|'declined';createdAt:string}
export interface TvPendingCompletion {id:string;taskId:string;memberId:string;status:string;taskTitle:string;taskPoints:number;memberName:string;pointsEarned:number;dailyTarget?:number;dailyPointShares?:Array<{memberId:string;memberName:string;executions:number;points:number}>;proofPhotoUrl?:string|null;proofAttachments?:Array<{completionId:string;memberName:string}>;completedAt?:string}
export interface TvFamily {subscriptionTier:string;trialEndsAt?:string|null;canUseSharedRewards:boolean}

export const rewardCacheKeys = ['tv-rewards','tv-redemptions','tv-shared','tv-requests','tv-pending','tv-family'];
export function useRewardData(memberId?:string, role?:'parent'|'child', legacy=false) {
  const auth = legacy ? 'device' : 'tv';
  const enabled = !!memberId;
  const parent = enabled && role==='parent' && !legacy;
  const options = {enabled,staleTime:8000,refetchInterval:20000};
  return {
    rewards:useQuery({queryKey:['tv-rewards',memberId],queryFn:()=>api<TvReward[]>('/api/rewards','GET',undefined,auth),...options}),
    redemptions:useQuery({queryKey:['tv-redemptions',memberId],queryFn:()=>api<TvRedemption[]>('/api/reward-redemptions','GET',undefined,auth),...options}),
    shared:useQuery({queryKey:['tv-shared',memberId],queryFn:()=>api<TvRedemption[]>('/api/rewards/shared','GET',undefined,auth),...options}),
    family:useQuery({queryKey:['tv-family',memberId],queryFn:()=>api<TvFamily>('/api/families/current','GET',undefined,auth),enabled:enabled && !legacy,staleTime:30000,refetchInterval:30000}),
    requests:useQuery({queryKey:['tv-requests',memberId],queryFn:()=>api<TvRewardRequest[]>('/api/reward-requests','GET',undefined,auth),enabled,refetchInterval:20000}),
    pending:useQuery({queryKey:['tv-pending',memberId],queryFn:()=>api<TvPendingCompletion[]>('/api/tasks/completions/pending','GET',undefined,auth),enabled:parent,refetchInterval:20000}),
  };
}
function operationId() {
  if (window.crypto && window.crypto.randomUUID) return window.crypto.randomUUID();
  // Chromium 68 does not implement crypto.randomUUID.
  const bytes = new Uint8Array(16);
  window.crypto.getRandomValues(bytes);
  bytes[6]=(bytes[6]&15)|64; bytes[8]=(bytes[8]&63)|128;
  const hex=Array.from(bytes).map(v=>v.toString(16).padStart(2,'0')).join('');
  return `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`;
}
export type RewardAction =
  | {kind:'redeem';id:string}
  | {kind:'status';id:string;status:'approved'|'completed'}
  | {kind:'cancel';id:string}
  | {kind:'approve-request'|'decline-request';id:string}
  | {kind:'approve-task'|'reject-task';id:string}
  | {kind:'share'|'join'|'leave-sharing'|'finalize'|'cancel-sharing';id:string};

export function useRewardAction(memberId?:string,legacy=false) {
  const qc=useQueryClient();
  const auth=legacy?'device':'tv';
  return useMutation({
    mutationFn:(action:RewardAction):Promise<unknown>=>{
      const id='id' in action ? encodeURIComponent(action.id) : '';
      switch(action.kind) {
        case 'redeem':return api(`/api/rewards/${id}/redeem`,'POST',{operationId:operationId()},auth);
        case 'status':return api(`/api/reward-redemptions/${id}`,'PATCH',{status:action.status},auth);
        case 'cancel':return api(`/api/reward-redemptions/${id}`,'DELETE',undefined,auth);
        case 'approve-request':case 'decline-request':return api(`/api/reward-requests/${id}/${action.kind==='approve-request'?'approve':'decline'}`,'PATCH',{},auth);
        case 'approve-task':case 'reject-task':return api(`/api/tasks/completions/${id}/${action.kind==='approve-task'?'approve':'reject'}`,'POST',{},auth);
        default:return api(`/api/rewards/redemptions/${id}/${action.kind}`,'POST',{},auth);
      }
    },
    onSuccess:()=>{
      rewardCacheKeys.forEach(key=>{void qc.invalidateQueries({queryKey:[key,memberId]});});
      void qc.invalidateQueries({queryKey:['tv-session']});
      void qc.invalidateQueries({queryKey:['tv-tasks']});
    },
  });
}