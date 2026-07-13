import { useEffect, useRef, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest, getDevHeaders } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle2, Clock, Gift, Sparkles, Home, Users, UserPlus, Share2, X, Check, Pencil, MessageSquarePlus, Lock, Trophy, Star, Zap, Info, Loader2 } from "lucide-react";
import { RewardIconDisplay } from "@/lib/reward-icon";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { AlertDialog, AlertDialogAction, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { motion } from "framer-motion";
import confetti from "canvas-confetti";
import { format } from "date-fns";
import { useWebSocket } from "@/hooks/useWebSocket";
import { Link } from "wouter";
import { getAvatarUrl } from "@/lib/skins";
import { useTranslation } from "react-i18next";
import { RewardRequestDialog } from "@/components/reward-request-dialog";
import { canUseSharedRewards } from "@shared/tier-config";

type FamilyMember = {
  id: string;
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  color: string;
  role: string;
  familyName: string;
  totalPoints: number;
  weeklyPoints: number;
  monthlyPoints: number;
};

type SharingParticipant = {
  id: string;
  memberId: string;
  displayName: string;
  avatarUrl: string | null;
  activeSkinId: string | null;
  color: string;
  pointsContributed: number;
};

type RedemptionWithDetails = {
  id: string;
  rewardId: string;
  memberId: string;
  pointsSpent: number;
  originalPointsSpent: number;
  status: string;
  sharingStatus: "not_shared" | "sharing_active" | "sharing_finalized";
  redeemedAt: string;
  sharingParticipants?: SharingParticipant[];
  reward: {
    id: string;
    title: string;
    description: string | null;
    pointThreshold: number;
  };
  member: {
    id: string;
    displayName: string;
    avatarUrl: string | null;
    activeSkinId: string | null;
    color: string;
  };
};

type SharedReward = RedemptionWithDetails & {
  participants: Array<{
    id: string;
    memberId: string;
    pointsContributed: number;
    joinedAt: string;
    member: {
      id: string;
      displayName: string;
      avatarUrl: string | null;
      activeSkinId: string | null;
      color: string;
    };
  }>;
};

type RewardRequest = {
  id: string;
  familyName: string;
  requestedBy: string;
  title: string;
  description: string | null;
  pointThreshold: number;
  status: "pending" | "approved" | "declined";
  createdAt: string;
  updatedAt: string;
};

type Reward = {
  id: string;
  title: string;
  description: string | null;
  pointThreshold: number;
  isActive: boolean;
  familyName: string;
  iconEmoji: string;
};

function getProgressColor(percentage: number) {
  if (percentage >= 100) return "hsl(142 76% 36%)";
  if (percentage >= 71) return "hsl(142 69% 58%)";
  if (percentage >= 31) return "hsl(38 92% 50%)";
  return "hsl(0 72% 51%)";
}

function RewardBoardCard({ reward, currentPoints, member, t, toast }: {
  reward: Reward;
  currentPoints: number;
  member: FamilyMember;
  t: (key: string, opts?: object) => string;
  toast: ReturnType<typeof useToast>["toast"];
}) {
  const [showDetails, setShowDetails] = useState(false);
  const percentage = Math.min((currentPoints / reward.pointThreshold) * 100, 100);
  const remaining = Math.max(reward.pointThreshold - currentPoints, 0);
  const isReady = currentPoints >= reward.pointThreshold;
  const progressColor = getProgressColor(percentage);
  const redeemMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/rewards/${reward.id}/redeem`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getDevHeaders() },
      });
      if (!response.ok) throw new Error("Failed to redeem reward");
      return response.json();
    },
    onSuccess: () => {
      confetti({ particleCount: 150, spread: 100, origin: { y: 0.6 } });
      queryClient.invalidateQueries({ queryKey: ["/api/family-members/current"] });
      queryClient.invalidateQueries({ queryKey: ["/api/family-members"] });
      queryClient.invalidateQueries({ queryKey: ["/api/device-link/session"] });
      queryClient.invalidateQueries({ queryKey: ["/api/reward-redemptions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/reward-redemptions/pending-count"] });
      queryClient.invalidateQueries({ queryKey: ["/api/rewards"] });
    },
    onError: () => {
      toast({
        variant: "destructive",
        title: t("kidDashboard.error"),
        description: t("kidDashboard.rewardRequestError"),
      });
    },
  });

  const cardCls = isReady
    ? "from-amber-900/80 via-yellow-900/80 to-amber-800/80 border-amber-400/60 shadow-amber-400/20"
    : "from-indigo-900/80 via-purple-900/80 to-violet-900/80 border-violet-500/40 shadow-violet-500/10";
  const iconBgCls = isReady
    ? "from-amber-500/30 to-yellow-400/20 border-amber-400/40"
    : "from-violet-500/20 to-purple-500/20 border-violet-400/20";

  return (
    <>
      <div
        className={`relative rounded-2xl border bg-gradient-to-br ${cardCls} shadow-xl overflow-hidden active:scale-[0.98] transition-transform duration-150`}
      >
        {/* Shine overlay */}
        <div className="absolute inset-0 bg-gradient-to-b from-white/5 to-transparent pointer-events-none" />
        {/* Ready glow ring */}
        {isReady && (
          <div className="absolute inset-0 rounded-2xl border-2 border-amber-400/30 pointer-events-none" />
        )}

        <div className="p-4 flex items-center gap-3">
          {/* Icon box */}
          <div className={`relative flex-shrink-0 w-14 h-14 rounded-2xl bg-gradient-to-br ${iconBgCls} border flex items-center justify-center shadow-inner overflow-hidden`}>
            <RewardIconDisplay icon={reward.iconEmoji} imgClassName="w-9 h-9 object-contain drop-shadow-sm" textClassName="text-3xl leading-none" />
            {isReady && (
              <div className="absolute -top-1 -right-1 w-4 h-4 bg-amber-400 rounded-full flex items-center justify-center">
                <span className="text-[8px] font-bold text-amber-900">✓</span>
              </div>
            )}
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-base text-white leading-tight mb-1.5" style={{ fontFamily: "Fredoka, sans-serif" }}>
              {reward.title}
            </h3>
            {/* Custom progress bar */}
            <div className="h-3 rounded-full bg-black/30 overflow-hidden relative mb-1.5">
              <div
                className={`h-full rounded-full relative transition-all ${isReady ? "bg-gradient-to-r from-amber-400 to-yellow-300" : "bg-gradient-to-r from-violet-400 to-purple-300"}`}
                style={{ width: `${percentage}%` }}
              >
                <div className="absolute inset-0 bg-gradient-to-b from-white/30 to-transparent rounded-full" />
                {percentage > 15 && (
                  <div className="absolute right-1 top-1/2 -translate-y-1/2 w-1.5 h-1.5 bg-white/60 rounded-full" />
                )}
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs" style={{ fontFamily: "Nunito, sans-serif" }}>
                {isReady ? (
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border bg-amber-400/20 text-amber-300 border-amber-400/40">
                    <Sparkles className="h-2.5 w-2.5" />{t("kidDashboard.readyToRequest")}
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-white/50">
                    <Zap className="h-3 w-3 text-amber-400" />{remaining} {t("kidDashboard.pointsRemaining", { count: remaining }).split(" ").slice(-1)[0]}
                  </span>
                )}
              </span>
              <span className="flex items-center gap-1 text-xs font-bold text-amber-300">
                <Star className="h-3 w-3 fill-amber-400 text-amber-400" />{reward.pointThreshold}
              </span>
            </div>
          </div>

          {/* CTA */}
          <div className="flex-shrink-0 flex flex-col items-end gap-2">
            <button
              onClick={() => setShowDetails(true)}
              className="text-white/30 hover:text-white/60 transition-colors"
              data-testid={`button-info-reward-${reward.id}`}
            >
              <Info className="h-4 w-4" />
            </button>
            {isReady ? (
              <button
                onClick={() => { if (!redeemMutation.isPending) redeemMutation.mutate(); }}
                disabled={redeemMutation.isPending}
                className="flex items-center gap-1.5 px-3 h-10 rounded-xl bg-gradient-to-b from-amber-400 to-amber-500 shadow-lg shadow-amber-500/30 active:scale-95 transition-transform border border-amber-300/50 disabled:opacity-50"
                data-testid={`button-request-reward-${reward.id}`}
              >
                {redeemMutation.isPending
                  ? <Loader2 className="h-4 w-4 text-amber-900 animate-spin" />
                  : <Gift className="h-4 w-4 text-amber-900" />
                }
                <span className="text-xs font-bold text-amber-900 whitespace-nowrap">{t("kidDashboard.now")}</span>
              </button>
            ) : (
              <button
                className="flex items-center gap-1.5 px-3 h-10 rounded-xl bg-white/5 border border-white/10 cursor-not-allowed"
                disabled
                data-testid={`button-request-reward-${reward.id}`}
              >
                <Lock className="h-4 w-4 text-white/25" />
                <span className="text-xs font-bold text-white/25 whitespace-nowrap">{remaining} {t("points")}</span>
              </button>
            )}
          </div>
        </div>
      </div>

      <AlertDialog open={showDetails} onOpenChange={setShowDetails}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-3 text-2xl" style={{ fontFamily: "Fredoka, sans-serif" }}>
              <div className="h-14 w-14 bg-primary/10 rounded-2xl flex items-center justify-center flex-shrink-0 p-1.5">
                <RewardIconDisplay icon={reward.iconEmoji} imgClassName="w-full h-full object-contain drop-shadow-sm" textClassName="text-4xl leading-none" />
              </div>
              {reward.title}
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-4 pt-4">
                {reward.description && (
                  <div className="text-base text-foreground">
                    <span className="font-semibold block mb-1">{t("kidDashboard.description")}</span>
                    <span className="block">{reward.description}</span>
                  </div>
                )}
                <div className="space-y-2">
                  <div className="flex justify-between items-center p-3 bg-muted/50 rounded-xl">
                    <span className="font-semibold">{t("kidDashboard.pointsNeeded")}</span>
                    <Badge variant="secondary" className="text-lg font-bold px-3 py-1">{reward.pointThreshold}</Badge>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-muted/50 rounded-xl">
                    <span className="font-semibold">{t("kidDashboard.yourProgress")}</span>
                    <span className="font-bold" style={{ color: progressColor }}>{Math.round(percentage)}%</span>
                  </div>
                </div>
                {!isReady && (
                  <div className="p-3 bg-amber-50 dark:bg-amber-950/30 rounded-xl border border-amber-200 dark:border-amber-800">
                    <span className="text-base font-bold flex items-center gap-2">
                      <Zap className="h-5 w-5 text-amber-500" />
                      {t("kidDashboard.pointsUntilReward", { count: remaining })}
                    </span>
                  </div>
                )}
                {isReady && (
                  <div className="p-3 bg-green-50 dark:bg-green-950/30 rounded-xl border border-green-200 dark:border-green-800">
                    <span className="text-base font-bold flex items-center gap-2 text-green-600 dark:text-green-400">
                      <Sparkles className="h-5 w-5" />
                      {t("kidDashboard.canRequestNow")}
                    </span>
                  </div>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction data-testid="button-close-details">{t("kidDashboard.close")}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

export default function RewardsBoard() {
  const { toast } = useToast();
  const { t } = useTranslation();

  // Fetch current member (acting member)
  const { data: member } = useQuery<FamilyMember>({
    queryKey: ["/api/family-members/current"],
    staleTime: 5 * 60 * 1000,
  });

  // Fetch real member (authenticated user)
  const { data: realMember } = useQuery<FamilyMember>({
    queryKey: ["/api/family-members/real"],
    staleTime: 5 * 60 * 1000,
  });

  // Determine permission levels
  const isParent = member?.role === "parent";
  const isRealParent = realMember?.role === "parent";

  // WebSocket connection for real-time updates
  useWebSocket(member?.familyName || null);

  // Fetch all redemptions
  const { data: redemptions = [], isLoading } = useQuery<RedemptionWithDetails[]>({
    queryKey: ["/api/reward-redemptions"],
    enabled: !!member,
    staleTime: 5 * 60 * 1000,
  });

  // Fetch all active shared rewards
  const { data: sharedRewards = [] } = useQuery<SharedReward[]>({
    queryKey: ["/api/rewards/shared"],
    enabled: !!member,
    staleTime: 5 * 60 * 1000,
  });

  // Fetch all family members
  const { data: familyMembers = [] } = useQuery<FamilyMember[]>({
    queryKey: ["/api/family-members"],
    enabled: !!member,
    staleTime: 5 * 60 * 1000,
  });

  // Fetch family data for tier check
  const { data: familyData } = useQuery<{ subscriptionTier: string; trialEndsAt?: string | null }>({
    queryKey: ["/api/families/current"],
    enabled: !!member,
    staleTime: 5 * 60 * 1000,
  });
  const isOnTrialRb = !!(familyData?.trialEndsAt && new Date(familyData.trialEndsAt) > new Date());
  const canUseSharedRewardsFeature = canUseSharedRewards(familyData?.subscriptionTier) || isOnTrialRb;

  // Fetch reward requests (parent only)
  const { data: rewardRequests = [] } = useQuery<RewardRequest[]>({
    queryKey: ["/api/reward-requests"],
    enabled: !!member && isRealParent,
    staleTime: 5 * 60 * 1000,
  });

  // Fetch all available rewards
  const { data: allRewards = [] } = useQuery<Reward[]>({
    queryKey: ["/api/rewards"],
    enabled: !!member,
    staleTime: 5 * 60 * 1000,
  });

  const activeRewards = allRewards.filter(r => r.isActive).sort((a, b) => {
    const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    return dateB - dateA;
  });

  // Dialog states for reward request editing
  const [requestRewardDialogOpen, setRequestRewardDialogOpen] = useState(false);
  const [requestToEdit, setRequestToEdit] = useState<RewardRequest | null>(null);

  // Track which participant counts we've already acknowledged to prevent repeated API calls
  const acknowledgedParticipantsRef = useRef<string>("");

  // Auto-acknowledge sharing notifications when user views their shared rewards with participants
  // This removes "X joined your reward" notifications when the initiator sees the shared rewards section
  useEffect(() => {
    if (!member || !sharedRewards.length) return;
    
    // Find user's own shared rewards that have participants (excluding themselves)
    const ownSharedWithParticipants = sharedRewards.filter(sr => 
      sr.member.id === member.id && 
      sr.participants && 
      sr.participants.some(p => p.memberId !== member.id)
    );
    
    if (ownSharedWithParticipants.length === 0) return;
    
    // Create a fingerprint of current participants to detect changes
    const participantFingerprint = ownSharedWithParticipants
      .map(sr => `${sr.id}:${sr.participants.map(p => p.memberId).sort().join(',')}`)
      .sort()
      .join('|');
    
    // Only acknowledge if participant state has changed
    if (participantFingerprint === acknowledgedParticipantsRef.current) return;
    acknowledgedParticipantsRef.current = participantFingerprint;
    
    // Acknowledge that they've seen who joined
    apiRequest("POST", "/api/notifications/acknowledge-sharing", {})
      .then(() => {
        queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
      })
      .catch(() => {
        // Ignore errors - notifications are not critical
      });
  }, [member, sharedRewards]);

  // Update redemption status mutation
  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      return await apiRequest("PATCH", `/api/reward-redemptions/${id}`, { status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/reward-redemptions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/reward-redemptions/pending-count"] });
    },
    onError: () => {
      toast({
        title: t("rewardsBoard.toastError"),
        description: t("rewardsBoard.toastErrorDesc"),
        variant: "destructive",
      });
    },
  });

  // Start sharing a reward
  const startSharingMutation = useMutation({
    mutationFn: async (redemptionId: string) => {
      return await apiRequest("POST", `/api/rewards/redemptions/${redemptionId}/share`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/reward-redemptions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/rewards/shared"] });
    },
    onError: (error: any) => {
      toast({
        title: t("rewardsBoard.toastError"),
        description: error.message || t("rewardsBoard.sharingStartError"),
        variant: "destructive",
      });
    },
  });

  // Join a shared reward
  const joinSharingMutation = useMutation({
    mutationFn: async (redemptionId: string) => {
      return await apiRequest("POST", `/api/rewards/redemptions/${redemptionId}/join`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/rewards/shared"] });
      queryClient.invalidateQueries({ queryKey: ["/api/reward-redemptions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/family-members/current"] });
      queryClient.invalidateQueries({ queryKey: ["/api/family-members"] });
      queryClient.invalidateQueries({ queryKey: ["/api/device-link/session"] });
    },
    onError: (error: any) => {
      toast({
        title: t("rewardsBoard.toastError"),
        description: error.message || t("rewardsBoard.joinError"),
        variant: "destructive",
      });
    },
  });

  // Finalize shared reward
  const finalizeSharingMutation = useMutation({
    mutationFn: async (redemptionId: string) => {
      return await apiRequest("POST", `/api/rewards/redemptions/${redemptionId}/finalize`, {});
    },
    onSuccess: async () => {
      // Acknowledge sharing notifications (they've seen who joined)
      try {
        await apiRequest("POST", "/api/notifications/acknowledge-sharing", {});
      } catch (e) {
        // Ignore errors - notifications are not critical
      }
      queryClient.invalidateQueries({ queryKey: ["/api/reward-redemptions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/rewards/shared"] });
      queryClient.invalidateQueries({ queryKey: ["/api/family-members/current"] });
      queryClient.invalidateQueries({ queryKey: ["/api/family-members"] });
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
    },
    onError: (error: any) => {
      toast({
        title: t("rewardsBoard.toastError"),
        description: error.message || t("rewardsBoard.sharingFinalizeError"),
        variant: "destructive",
      });
    },
  });

  // Cancel sharing (when no participants have joined)
  const cancelSharingMutation = useMutation({
    mutationFn: async (redemptionId: string) => {
      return await apiRequest("POST", `/api/rewards/redemptions/${redemptionId}/cancel-sharing`, {});
    },
    onSuccess: async () => {
      // Acknowledge sharing notifications (they've seen who joined)
      try {
        await apiRequest("POST", "/api/notifications/acknowledge-sharing", {});
      } catch (e) {
        // Ignore errors - notifications are not critical
      }
      queryClient.invalidateQueries({ queryKey: ["/api/reward-redemptions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/rewards/shared"] });
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
    },
    onError: (error: any) => {
      toast({
        title: t("rewardsBoard.toastError"),
        description: error.message || t("rewardsBoard.sharingCancelError"),
        variant: "destructive",
      });
    },
  });

  // Cancel redemption and refund points (parents only)
  const cancelRedemptionMutation = useMutation({
    mutationFn: async (redemptionId: string) => {
      return await apiRequest("DELETE", `/api/reward-redemptions/${redemptionId}`, {});
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/reward-redemptions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/reward-redemptions/pending-count"] });
      queryClient.invalidateQueries({ queryKey: ["/api/rewards/shared"] });
      queryClient.invalidateQueries({ queryKey: ["/api/family-members/current"] });
      queryClient.invalidateQueries({ queryKey: ["/api/family-members"] });
      queryClient.invalidateQueries({ queryKey: ["/api/rewards"] });
    },
    onError: (error: any) => {
      toast({
        title: t("common.error"),
        description: error.message || t("rewardsBoard.cancelError"),
        variant: "destructive",
      });
    },
  });

  // Approve reward request
  const approveRewardRequestMutation = useMutation({
    mutationFn: async (requestId: string) => {
      return await apiRequest("PATCH", `/api/reward-requests/${requestId}/approve`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/reward-requests"] });
      queryClient.invalidateQueries({ queryKey: ["/api/rewards"] });
    },
    onError: (error: any) => {
      toast({
        title: t("common.error"),
        description: error.message || t("rewards.approveError"),
        variant: "destructive",
      });
    },
  });

  // Decline reward request
  const declineRewardRequestMutation = useMutation({
    mutationFn: async (requestId: string) => {
      return await apiRequest("PATCH", `/api/reward-requests/${requestId}/decline`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/reward-requests"] });
    },
    onError: (error: any) => {
      toast({
        title: t("common.error"),
        description: error.message || t("rewards.declineError"),
        variant: "destructive",
      });
    },
  });

  // Update reward request
  const updateRewardRequestMutation = useMutation({
    mutationFn: async ({ requestId, data }: { requestId: string; data: any }) => {
      return await apiRequest("PATCH", `/api/reward-requests/${requestId}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/reward-requests"] });
      setRequestRewardDialogOpen(false);
      setRequestToEdit(null);
    },
    onError: (error: any) => {
      toast({
        title: t("common.error"),
        description: error.message || t("rewards.updateError"),
        variant: "destructive",
      });
    },
  });

  // Filter redemptions based on role
  const displayRedemptions = isParent 
    ? redemptions 
    : redemptions.filter(r => r.memberId === member?.id);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return (
          <Badge variant="secondary" className="gap-1">
            <Clock className="h-3 w-3" />
            {t("rewardsBoard.statusPending")}
          </Badge>
        );
      case "approved":
        return (
          <Badge className="gap-1 bg-blue-500 hover:bg-blue-600">
            <Sparkles className="h-3 w-3" />
            {t("rewardsBoard.statusApproved")}
          </Badge>
        );
      case "completed":
        return (
          <Badge className="gap-1 bg-green-500 hover:bg-green-600">
            <CheckCircle2 className="h-3 w-3" />
            {t("rewardsBoard.statusCompleted")}
          </Badge>
        );
      default:
        return null;
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6 p-6">
        <div className="flex items-center gap-3">
          <div className="h-16 w-16 flex items-center justify-center flex-shrink-0">
            <img src="/nav-icons/shop.png" alt="" className="w-full h-full object-contain drop-shadow-lg" />
          </div>
          <div>
            <h1 className="text-3xl font-accent font-bold">{t("rewardsBoard.title")}</h1>
            <p className="text-muted-foreground">{t("rewardsBoard.loading")}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-20 relative overflow-x-hidden" style={{ paddingTop: 'calc(1.5rem + env(safe-area-inset-top))', paddingLeft: 'max(1.5rem, env(safe-area-inset-left))', paddingRight: 'max(1.5rem, env(safe-area-inset-right))' }}>
      {/* Atmosphere glow */}
      <div className="pointer-events-none fixed inset-0 z-0" style={{ background: "radial-gradient(ellipse 80% 50% at 50% 0%, rgba(251,191,36,0.13) 0%, rgba(245,158,11,0.06) 45%, transparent 75%)" }} />

      <div className="max-w-4xl mx-auto w-full min-w-0 relative z-10">
        {/* Back button */}
        <Link href={isParent ? "/dashboard" : "/kid-dashboard"}>
          <Button
            variant="outline"
            size="sm"
            className="mb-6 gap-2 bg-background/30 backdrop-blur-sm border-border/40"
            data-testid="button-back-dashboard"
          >
            <Home className="h-4 w-4" />
            {t("rewardsBoard.backToDashboard")}
          </Button>
        </Link>

        {/* Page title */}
        <div className="flex items-center gap-3 mb-8">
          {!isParent && (
            <div className="h-24 w-24 flex items-center justify-center flex-shrink-0 -my-2">
              <img src="/nav-icons/shop.png" alt="" className="w-full h-full object-contain drop-shadow-lg" />
            </div>
          )}
          <div>
            <h1 className="text-3xl font-bold text-white" style={{ fontFamily: "Fredoka, sans-serif", textShadow: "0 2px 4px rgba(0,0,0,0.8), 0 4px 12px rgba(0,0,0,0.6), 0 0 20px rgba(0,0,0,0.4)" }}>{t("rewardsBoard.title")}</h1>
            <p className="text-sm text-white/70" style={{ textShadow: "0 1px 3px rgba(0,0,0,0.8)" }}>
              {isParent
                ? t("rewardsBoard.manageRedemptions")
                : t("rewardsBoard.trackRewards")}
            </p>
          </div>
        </div>

        <div className="space-y-8">

        {/* Available Rewards Section (Children only) */}
        {!isParent && activeRewards.length > 0 && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-3">
              {activeRewards.map((reward) => (
                <RewardBoardCard
                  key={reward.id}
                  reward={reward}
                  currentPoints={member?.totalPoints ?? 0}
                  member={member!}
                  t={t}
                  toast={toast}
                />
              ))}
            </div>
          </div>
        )}

        {/* Pending Reward Requests Section (Parents only) */}
        {isRealParent && rewardRequests.filter(r => r.status === "pending").length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="h-24 w-24 flex items-center justify-center flex-shrink-0 -my-2">
                <img src="/nav-icons/clipboard.png" alt="" className="w-full h-full object-contain drop-shadow-sm" />
              </div>
              <h2 className="text-2xl font-bold text-white" style={{ fontFamily: "Fredoka, sans-serif", textShadow: "0 2px 4px rgba(0,0,0,0.8), 0 4px 12px rgba(0,0,0,0.6), 0 0 20px rgba(0,0,0,0.4)" }}>{t("dashboard.pendingRewardRequests")}</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {rewardRequests
                .filter(r => r.status === "pending")
                .map((request) => {
                  const requester = familyMembers.find(m => m.id === request.requestedBy) as FamilyMember & { activeSkinId?: string; useCustomAvatar?: boolean; updatedAt?: string };
                  return (
                    <Card key={request.id} className="p-6" data-testid={`card-request-${request.id}`}>
                      <div className="flex items-start gap-3 mb-4">
                        <Avatar className="h-10 w-10">
                          <AvatarImage src={getAvatarUrl(requester?.activeSkinId, requester?.avatarUrl, requester?.useCustomAvatar, requester?.updatedAt)} />
                          <AvatarFallback style={{ backgroundColor: requester?.color }} className="text-white">
                            {requester?.displayName[0] || '?'}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <h3 className="font-bold">{request.title}</h3>
                            <Badge variant="secondary">
                              {request.pointThreshold} pts
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground mb-1">
                            {t("dashboard.requestedBy", { name: requester?.displayName || 'Unknown' })}
                          </p>
                          {request.description && (
                            <p className="text-sm text-muted-foreground">
                              {request.description}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-2 flex-wrap">
                        <Button
                          onClick={() => {
                            setRequestToEdit(request);
                            setRequestRewardDialogOpen(true);
                          }}
                          variant="outline"
                          size="sm"
                          data-testid={`button-edit-request-${request.id}`}
                        >
                          <Pencil className="h-4 w-4 mr-1" />
                          {t("common.edit")}
                        </Button>
                        <Button
                          onClick={() => approveRewardRequestMutation.mutate(request.id)}
                          disabled={approveRewardRequestMutation.isPending || declineRewardRequestMutation.isPending}
                          size="sm"
                          data-testid={`button-approve-request-${request.id}`}
                        >
                          <Check className="h-4 w-4 mr-1" />
                          {t("rewards.approve")}
                        </Button>
                        <Button
                          onClick={() => declineRewardRequestMutation.mutate(request.id)}
                          disabled={approveRewardRequestMutation.isPending || declineRewardRequestMutation.isPending}
                          variant="outline"
                          size="sm"
                          data-testid={`button-decline-request-${request.id}`}
                        >
                          <X className="h-4 w-4 mr-1" />
                          {t("dashboard.decline")}
                        </Button>
                      </div>
                    </Card>
                  );
                })}
            </div>
          </div>
        )}

      {/* Shared Rewards Section */}
      {sharedRewards.some(sr => sr.memberId !== member?.id && !sr.participants.some(p => p.memberId === member?.id)) && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="h-24 w-24 flex items-center justify-center flex-shrink-0 -my-2">
              <img src="/nav-icons/trophy.png" alt="" className="w-full h-full object-contain drop-shadow-sm" />
            </div>
            <h2 className="text-2xl font-bold text-white" style={{ fontFamily: "Fredoka, sans-serif", textShadow: "0 2px 4px rgba(0,0,0,0.8), 0 4px 12px rgba(0,0,0,0.6), 0 0 20px rgba(0,0,0,0.4)" }}>{t("rewardsBoard.sharedRewards")}</h2>
          </div>
          <div className="grid grid-cols-1 gap-4">
            {sharedRewards
              .filter(sr => sr.memberId !== member?.id && !sr.participants.some(p => p.memberId === member?.id))
              .map((shared) => {
              const isInitiator = shared.memberId === member?.id;
              const hasJoined = shared.participants.some(p => p.memberId === member?.id);
              const totalParticipants = shared.participants.length + 1; // +1 for initiator
              const pointsPerPerson = Math.ceil(shared.originalPointsSpent / totalParticipants);
              
              return (
                <Card key={shared.id} className="border-primary/20" data-testid={`card-shared-${shared.id}`}>
                  <CardHeader>
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-center gap-3 flex-1">
                        <Avatar className="h-12 w-12">
                          <AvatarImage src={getAvatarUrl(shared.member.activeSkinId, shared.member.avatarUrl, (shared.member as any).useCustomAvatar, (shared.member as any).updatedAt)} />
                          <AvatarFallback 
                            className="text-white font-bold"
                            style={{ backgroundColor: shared.member.color }}
                          >
                            {shared.member.displayName[0]}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1">
                          <CardTitle className="text-xl font-accent flex items-center gap-2">
                            {shared.reward.title}
                            <Badge variant="secondary" className="gap-1">
                              <Users className="h-3 w-3" />
                              {totalParticipants}
                            </Badge>
                          </CardTitle>
                          <CardDescription>
                            {t("rewardsBoard.sharedBy", { name: shared.member.displayName })}
                          </CardDescription>
                        </div>
                      </div>
                    </div>
                  </CardHeader>

                  <CardContent className="space-y-4">
                    {shared.reward.description && (
                      <p className="text-sm text-muted-foreground">
                        {shared.reward.description}
                      </p>
                    )}

                    <div className="flex items-center gap-4 text-sm flex-wrap">
                      <Badge variant="outline" className="gap-1.5">
                        <Sparkles className="h-3 w-3" />
                        {t("rewardsBoard.pointsPerPerson", { count: pointsPerPerson })}
                      </Badge>
                      <Badge variant="outline" className="gap-1.5">
                        {t("rewardsBoard.originalPoints", { count: shared.originalPointsSpent })}
                      </Badge>
                    </div>

                    {/* Participants List */}
                    {shared.participants.length > 0 && (
                      <div className="space-y-2">
                        <p className="text-sm font-medium">{t("rewardsBoard.participants")}</p>
                        <div className="flex flex-wrap gap-2">
                          <Badge variant="secondary" className="gap-2">
                            <Avatar className="h-5 w-5">
                              <AvatarImage src={getAvatarUrl(shared.member.activeSkinId, shared.member.avatarUrl, (shared.member as any).useCustomAvatar, (shared.member as any).updatedAt)} />
                              <AvatarFallback 
                                className="text-xs text-white font-bold"
                                style={{ backgroundColor: shared.member.color }}
                              >
                                {shared.member.displayName[0]}
                              </AvatarFallback>
                            </Avatar>
                            {shared.member.displayName}
                          </Badge>
                          {shared.participants.map(p => (
                            <Badge key={p.id} variant="secondary" className="gap-2">
                              <Avatar className="h-5 w-5">
                                <AvatarImage src={getAvatarUrl(p.member.activeSkinId, p.member.avatarUrl, (p.member as any).useCustomAvatar, (p.member as any).updatedAt)} />
                                <AvatarFallback 
                                  className="text-xs text-white font-bold"
                                  style={{ backgroundColor: p.member.color }}
                                >
                                  {p.member.displayName[0]}
                                </AvatarFallback>
                              </Avatar>
                              {p.member.displayName}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Action Buttons */}
                    <div className="flex gap-2 pt-2 border-t flex-wrap">
                      {isInitiator && shared.participants.length === 0 && (
                        <p className="text-sm text-muted-foreground w-full">
                          {t("rewardsBoard.waitingForParticipants")}
                        </p>
                      )}
                      {isInitiator && shared.participants.length > 0 && (
                        <Button
                          size="sm"
                          variant="default"
                          className="gap-2"
                          onClick={() => finalizeSharingMutation.mutate(shared.id)}
                          disabled={finalizeSharingMutation.isPending}
                          data-testid={`button-finalize-${shared.id}`}
                        >
                          <CheckCircle2 className="h-4 w-4" />
                          {t("rewardsBoard.finalizeSharing")}
                        </Button>
                      )}
                      {isInitiator && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="gap-2"
                          onClick={() => cancelSharingMutation.mutate(shared.id)}
                          disabled={cancelSharingMutation.isPending}
                          data-testid={`button-cancel-sharing-${shared.id}`}
                        >
                          <X className="h-4 w-4" />
                          {t("kidDashboard.cancelSharing")}
                        </Button>
                      )}
                      {!isInitiator && !hasJoined && (() => {
                        const joinPointsNeeded = Math.ceil(shared.originalPointsSpent / (shared.participants.length + 2));
                        const myPoints = member?.totalPoints ?? 0;
                        const canAfford = myPoints >= joinPointsNeeded;
                        return (
                          <div className="flex flex-col gap-1">
                            {!canAfford && (
                              <p className="text-xs text-destructive font-semibold">
                                {`Nicht genug Punkte — du brauchst ${joinPointsNeeded}, hast ${myPoints}.`}
                              </p>
                            )}
                            <Button
                              size="sm"
                              variant="default"
                              className="gap-2"
                              onClick={() => joinSharingMutation.mutate(shared.id)}
                              disabled={joinSharingMutation.isPending || !canAfford}
                              data-testid={`button-join-${shared.id}`}
                            >
                              <UserPlus className="h-4 w-4" />
                              {canAfford ? t("rewardsBoard.joinSharing") : `${joinPointsNeeded} Punkte nötig`}
                            </Button>
                          </div>
                        );
                      })()}
                      {!isInitiator && hasJoined && (
                        <Badge variant="secondary" className="gap-1">
                          <CheckCircle2 className="h-3 w-3" />
                          {t("rewardsBoard.youParticipate")}
                        </Badge>
                      )}
                      {/* Parents can always fully cancel any shared redemption and refund points */}
                      {isParent && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="gap-2 text-destructive border-destructive/40 ml-auto"
                          onClick={() => cancelRedemptionMutation.mutate(shared.id)}
                          disabled={cancelRedemptionMutation.isPending}
                          data-testid={`button-cancel-redemption-shared-${shared.id}`}
                        >
                          <X className="h-4 w-4" />
                          {t("rewardsBoard.cancelRedemption")}
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* Redemptions List — parents only; kids use /my-rewards instead */}
      {isParent && (
        <div className="space-y-4">
          {displayRedemptions.length === 0 ? (
          <Card className="rounded-2xl bg-card/80">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Gift className="h-16 w-16 text-muted-foreground mb-4" />
              <h3 className="text-xl font-semibold mb-2">{t("rewardsBoard.noRewardsYet")}</h3>
              <p className="text-muted-foreground text-center">
                {t("rewardsBoard.noRewardsFamilyDesc")}
              </p>
            </CardContent>
          </Card>
          ) : (
          <div className="grid grid-cols-1 gap-4">
          {displayRedemptions.map((redemption) => (
            <Card key={redemption.id} data-testid={`card-redemption-${redemption.id}`}>
              <CardHeader>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-3 flex-1">
                    <Avatar className="h-12 w-12">
                      <AvatarImage src={getAvatarUrl(redemption.member.activeSkinId, redemption.member.avatarUrl, (redemption.member as any).useCustomAvatar, (redemption.member as any).updatedAt)} />
                      <AvatarFallback 
                        className="text-white font-bold"
                        style={{ backgroundColor: redemption.member.color }}
                      >
                        {redemption.member.displayName[0]}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <CardTitle className="text-xl font-accent">
                        {redemption.reward.title}
                      </CardTitle>
                      <CardDescription>
                        {t("rewardsBoard.redeemedBy", { 
                          name: redemption.member.displayName, 
                          date: format(new Date(redemption.redeemedAt), "MMM d, yyyy") 
                        })}
                      </CardDescription>
                    </div>
                  </div>
                  {getStatusBadge(redemption.status)}
                </div>
              </CardHeader>

              <CardContent className="space-y-4">
                {redemption.reward.description && (
                  <p className="text-sm text-muted-foreground">
                    {redemption.reward.description}
                  </p>
                )}

                <div className="flex items-center gap-4 text-sm flex-wrap">
                  <Badge variant="outline" className="gap-1.5">
                    <Sparkles className="h-3 w-3" />
                    {t("rewardsBoard.pointsSpent", { count: redemption.pointsSpent })}
                  </Badge>
                  {redemption.sharingStatus === "sharing_active" && (
                    <Badge variant="secondary" className="gap-1.5">
                      <Users className="h-3 w-3" />
                      {t("rewardsBoard.beingShared")}
                    </Badge>
                  )}
                  {redemption.sharingStatus === "sharing_finalized" && (
                    <Badge variant="secondary" className="gap-1.5">
                      <CheckCircle2 className="h-3 w-3" />
                      {t("rewardsBoard.sharedPointsPerPerson", { count: redemption.pointsSpent })}
                    </Badge>
                  )}
                </div>
                
                {/* Show participants for shared rewards — always visible, even after fulfilled */}
                {redemption.sharingParticipants && redemption.sharingParticipants.length > 0 && (
                  <div className={`flex items-center gap-2 flex-wrap rounded-xl px-3 py-2 ${
                    redemption.status === "completed"
                      ? "bg-muted/40"
                      : ""
                  }`}>
                    <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                      <Users className="h-3.5 w-3.5" />
                      <span>{t("rewardsBoard.sharedWith")}:</span>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      {redemption.sharingParticipants.map((participant) => (
                        <div key={participant.id} className="flex items-center gap-1.5">
                          <Avatar className="h-6 w-6">
                            <AvatarImage src={getAvatarUrl(participant.activeSkinId, participant.avatarUrl)} />
                            <AvatarFallback 
                              className="text-white text-xs font-bold"
                              style={{ backgroundColor: participant.color }}
                            >
                              {participant.displayName[0]}
                            </AvatarFallback>
                          </Avatar>
                          <span className="text-sm font-medium">{participant.displayName}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Finalize / Cancel Sharing - for own active shared redemptions */}
                {redemption.memberId === member?.id &&
                 redemption.sharingStatus === "sharing_active" &&
                 redemption.status !== "completed" && (
                  <div className="flex gap-2 pt-2 border-t flex-wrap">
                    {redemption.sharingParticipants && redemption.sharingParticipants.length > 0 && (
                      <Button
                        size="sm"
                        variant="default"
                        className="gap-2"
                        onClick={() => finalizeSharingMutation.mutate(redemption.id)}
                        disabled={finalizeSharingMutation.isPending}
                        data-testid={`button-finalize-${redemption.id}`}
                      >
                        <CheckCircle2 className="h-4 w-4" />
                        {t("rewardsBoard.finalizeSharing")}
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-2"
                      onClick={() => cancelSharingMutation.mutate(redemption.id)}
                      disabled={cancelSharingMutation.isPending}
                      data-testid={`button-cancel-sharing-${redemption.id}`}
                    >
                      <X className="h-4 w-4" />
                      {t("kidDashboard.cancelSharing")}
                    </Button>
                  </div>
                )}

                {/* Sharing Button - Only for own redemptions that are not yet shared and not completed */}
                {redemption.memberId === member?.id && 
                 redemption.sharingStatus === "not_shared" && 
                 redemption.status !== "completed" && (
                  <div className="flex gap-2 pt-2 border-t">
                    {canUseSharedRewardsFeature ? (
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-2"
                        onClick={() => startSharingMutation.mutate(redemption.id)}
                        disabled={startSharingMutation.isPending}
                        data-testid={`button-share-${redemption.id}`}
                      >
                        <Share2 className="h-4 w-4" />
                        {t("rewardsBoard.offerToShare")}
                      </Button>
                    ) : (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="inline-flex">
                            <Button
                              size="sm"
                              variant="outline"
                              className="gap-2 opacity-50 cursor-not-allowed"
                              disabled
                              data-testid={`button-share-locked-${redemption.id}`}
                            >
                              <Lock className="h-4 w-4" />
                              {t("rewardsBoard.offerToShare")}
                            </Button>
                          </span>
                        </TooltipTrigger>
                        <TooltipContent className="flex flex-col gap-1">
                          <span>{t("rewardsBoard.sharingRequiresFamilyTier", "Reward sharing requires the Family subscription")}</span>
                          <Link href="/pricing" className="text-xs underline text-primary">
                            {t("common.upgrade", "Upgrade")}
                          </Link>
                        </TooltipContent>
                      </Tooltip>
                    )}
                  </div>
                )}

                {/* Parent Controls - Only when acting as parent, not when switched to child */}
                {isParent && redemption.status !== "completed" && (
                  <div className="flex gap-2 pt-2 border-t">
                    {/* Mark as fulfilled only available once sharing is finalized */}
                    {redemption.sharingStatus !== "sharing_active" && (
                      <Button
                        size="sm"
                        variant="default"
                        onClick={() => updateStatusMutation.mutate({ 
                          id: redemption.id, 
                          status: "completed" 
                        })}
                        disabled={updateStatusMutation.isPending}
                        data-testid={`button-complete-${redemption.id}`}
                      >
                        {t("rewardsBoard.markFulfilled")}
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-destructive hover:text-destructive"
                      onClick={() => cancelRedemptionMutation.mutate(redemption.id)}
                      disabled={cancelRedemptionMutation.isPending}
                      data-testid={`button-cancel-redemption-${redemption.id}`}
                    >
                      <X className="h-4 w-4 mr-1" />
                      {t("rewardsBoard.cancelRedemption")}
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
          </div>
          )}
        </div>
      )}
        </div>{/* end space-y-8 */}
      </div>{/* end max-w-4xl */}

      {/* Reward Request Dialog for editing */}
      <RewardRequestDialog
        open={requestRewardDialogOpen}
        onOpenChange={(open) => {
          setRequestRewardDialogOpen(open);
          if (!open) setRequestToEdit(null);
        }}
        rewardRequest={requestToEdit}
        onSubmit={(data) => {
          if (requestToEdit) {
            updateRewardRequestMutation.mutate({ requestId: requestToEdit.id, data });
          }
        }}
        isSubmitting={updateRewardRequestMutation.isPending}
      />
    </div>
  );
}
