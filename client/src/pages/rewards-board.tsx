import { useEffect, useRef, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest, getDevHeaders } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle2, Clock, Gift, Sparkles, Home, Users, UserPlus, Share2, X, Check, Pencil, MessageSquarePlus, Lock, Trophy, Star, Zap, Info, Loader2 } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Progress } from "@/components/ui/progress";
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
};

function getProgressColor(percentage: number) {
  if (percentage >= 100) return "hsl(142 76% 36%)";
  if (percentage >= 71) return "hsl(142 69% 58%)";
  if (percentage >= 31) return "hsl(38 92% 50%)";
  return "hsl(0 72% 51%)";
}

function getRewardIcon(title: string) {
  const lower = title?.toLowerCase() ?? "";
  if (lower.includes("kino") || lower.includes("film") || lower.includes("movie")) return Gift;
  if (lower.includes("eis") || lower.includes("ice")) return Gift;
  if (lower.includes("pizza") || lower.includes("essen") || lower.includes("food")) return Gift;
  if (lower.includes("spiel") || lower.includes("game") || lower.includes("lego")) return Gift;
  if (lower.includes("computer") || lower.includes("tablet") || lower.includes("screen")) return Gift;
  return Gift;
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
  const RewardIcon = getRewardIcon(reward.title);

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
      toast({
        title: t("kidDashboard.rewardRequested"),
        description: t("kidDashboard.rewardRequestedDesc", { title: reward.title }),
      });
    },
    onError: () => {
      toast({
        variant: "destructive",
        title: t("kidDashboard.error"),
        description: t("kidDashboard.rewardRequestError"),
      });
    },
  });

  return (
    <>
      <motion.div
        whileHover={{ y: -3 }}
        whileTap={{ scale: 0.98 }}
        transition={{ type: "spring", stiffness: 300, damping: 20 }}
      >
        <Card className={`p-4 transition-all backdrop-blur-md border-2 rounded-2xl ${
          isReady
            ? "bg-gradient-to-br from-amber-500/12 to-yellow-400/8 ring-4 ring-inset ring-amber-400/50 shadow-xl shadow-amber-500/20 border-amber-400/55"
            : "bg-card/80 border-border shadow-md shadow-black/15"
        }`}>
          {/* Top row: icon + title */}
          <div className="flex items-start gap-3 mb-3">
            <div className={`flex-shrink-0 p-2.5 rounded-2xl ${isReady ? "bg-primary/20" : "bg-primary/10"}`}>
              <RewardIcon className="h-10 w-10 text-primary" />
            </div>
            <div className="flex-1 min-w-0 pt-0.5">
              <div className="flex items-center gap-1.5 min-w-0">
                <h3 className="font-bold text-lg leading-tight truncate min-w-0" style={{ fontFamily: "Fredoka, sans-serif" }}>
                  {reward.title}
                </h3>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setShowDetails(true)}
                  className="h-7 w-7 rounded-full flex-shrink-0"
                  data-testid={`button-info-reward-${reward.id}`}
                >
                  <Info className="h-4 w-4 text-primary" />
                </Button>
              </div>
            </div>
          </div>

          {/* Progress bar */}
          <Progress value={percentage} className="h-4 rounded-full mb-2" />

          {/* Bottom row: status text + action button */}
          <div className="flex items-center justify-between gap-3">
            {!isReady ? (
              <p className="text-sm text-muted-foreground flex items-center gap-1 min-w-0">
                <Zap className="h-4 w-4 text-amber-500 flex-shrink-0" />
                <span className="truncate">{t("kidDashboard.pointsRemaining", { count: remaining })}</span>
              </p>
            ) : (
              <p className="text-sm font-bold text-green-500 flex items-center gap-1">
                <Sparkles className="h-4 w-4 flex-shrink-0" />
                {t("kidDashboard.readyToRequest")}
              </p>
            )}
            <Button
              variant={isReady ? "default" : "outline"}
              size="sm"
              onClick={() => { if (isReady && !redeemMutation.isPending) redeemMutation.mutate(); }}
              disabled={!isReady || redeemMutation.isPending}
              className={`flex-shrink-0 font-bold rounded-xl ${isReady ? "shadow-md shadow-primary/30" : "opacity-55"}`}
              data-testid={`button-request-reward-${reward.id}`}
            >
              {redeemMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : isReady ? (
                <><Gift className="h-4 w-4 mr-1.5" />{t("kidDashboard.now")}</>
              ) : (
                <><Trophy className="h-4 w-4 mr-1.5" />{t("kidDashboard.collect")}</>
              )}
            </Button>
          </div>
        </Card>
      </motion.div>

      <AlertDialog open={showDetails} onOpenChange={setShowDetails}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-3 text-2xl" style={{ fontFamily: "Fredoka, sans-serif" }}>
              <div className="p-3 bg-primary/10 rounded-2xl">
                <RewardIcon className="h-10 w-10 text-primary" />
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
  const { data: familyData } = useQuery<{ subscriptionTier: string }>({
    queryKey: ["/api/families/current"],
    enabled: !!member,
    staleTime: 5 * 60 * 1000,
  });
  const canUseSharedRewardsFeature = canUseSharedRewards(familyData?.subscriptionTier);

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
    const currentPoints = member?.totalPoints ?? 0;
    const aReady = currentPoints >= a.pointThreshold;
    const bReady = currentPoints >= b.pointThreshold;
    if (aReady && !bReady) return -1;
    if (!bReady && aReady) return 1;
    return Math.abs(currentPoints - a.pointThreshold) - Math.abs(currentPoints - b.pointThreshold);
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
      toast({
        title: t("rewardsBoard.toastStatusUpdated"),
        description: t("rewardsBoard.toastStatusUpdatedDesc"),
      });
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
      toast({
        title: t("rewardsBoard.sharingStarted"),
        description: t("rewardsBoard.sharingStartedDesc"),
      });
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
      toast({
        title: t("rewardsBoard.joinedSuccess"),
        description: t("rewardsBoard.joinedSuccessDesc"),
      });
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
      toast({
        title: t("rewardsBoard.sharingFinalized"),
        description: t("rewardsBoard.sharingFinalizedDesc"),
      });
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
      toast({
        title: t("kidDashboard.sharingCancelled"),
        description: t("kidDashboard.canRedeemSolo"),
      });
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
      toast({
        title: t("rewardsBoard.redemptionCancelled"),
        description: t("rewardsBoard.pointsRefunded", { count: data.pointsRefunded }),
      });
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
      toast({
        title: t("rewards.approved"),
        description: t("rewards.approvedDesc"),
      });
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
      toast({
        title: t("rewards.declined"),
        description: t("rewards.declinedDesc"),
      });
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
      toast({
        title: t("rewards.updated"),
        description: t("rewards.updatedDesc"),
      });
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
  // Also exclude redemptions that are actively being shared (they appear in the shared rewards section)
  const displayRedemptions = (isParent 
    ? redemptions 
    : redemptions.filter(r => r.memberId === member?.id)
  ).filter(r => r.sharingStatus !== "sharing_active");

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
          <Gift className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-3xl font-accent font-bold">{t("rewardsBoard.title")}</h1>
            <p className="text-muted-foreground">{t("rewardsBoard.loading")}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-6 overflow-x-hidden" style={{ paddingTop: 'calc(1.5rem + env(safe-area-inset-top))', paddingLeft: 'max(1.5rem, env(safe-area-inset-left))', paddingRight: 'max(1.5rem, env(safe-area-inset-right))' }}>
      <div className="max-w-4xl mx-auto w-full min-w-0">
        {/* Back button */}
        <Link href="/">
          <Button
            variant="outline"
            size="sm"
            className="mb-4 gap-2 bg-background/30 backdrop-blur-sm border-border/40 hover:bg-background/60"
            data-testid="button-back-dashboard"
          >
            <Home className="h-4 w-4" />
            {t("rewardsBoard.backToDashboard")}
          </Button>
        </Link>

        {/* Page title */}
        <div className="flex items-center gap-3 mb-6">
          <Gift className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-3xl font-accent font-bold">{t("rewardsBoard.title")}</h1>
            <p className="text-muted-foreground">
              {isParent
                ? t("rewardsBoard.manageRedemptions")
                : t("rewardsBoard.trackRewards")}
            </p>
          </div>
        </div>

        <div className="space-y-6">

        {/* Available Rewards Section (Children only) */}
        {!isParent && activeRewards.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Trophy className="h-6 w-6 text-amber-500" />
              <h2 className="text-2xl font-accent font-bold">{t("kidDashboard.rewards")}</h2>
            </div>
            <div className="grid grid-cols-1 gap-4">
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
            <div className="flex items-center gap-2">
              <MessageSquarePlus className="h-6 w-6 text-primary" />
              <h2 className="text-2xl font-accent font-bold">{t("dashboard.pendingRewardRequests")}</h2>
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
      {sharedRewards.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Users className="h-6 w-6 text-primary" />
            <h2 className="text-2xl font-accent font-bold">{t("rewardsBoard.sharedRewards")}</h2>
          </div>
          <div className="grid grid-cols-1 gap-4">
            {sharedRewards.map((shared) => {
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
                      {!isInitiator && !hasJoined && (
                        <Button
                          size="sm"
                          variant="default"
                          className="gap-2"
                          onClick={() => joinSharingMutation.mutate(shared.id)}
                          disabled={joinSharingMutation.isPending}
                          data-testid={`button-join-${shared.id}`}
                        >
                          <UserPlus className="h-4 w-4" />
                          {t("rewardsBoard.joinSharing")}
                        </Button>
                      )}
                      {!isInitiator && hasJoined && (
                        <Badge variant="secondary" className="gap-1">
                          <CheckCircle2 className="h-3 w-3" />
                          {t("rewardsBoard.youParticipate")}
                        </Badge>
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
      {isParent && (displayRedemptions.length === 0 ? (
        <Card>
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
                    {/* Rewards are auto-approved, parents only mark as fulfilled */}
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
      ))}
        </div>{/* end space-y-6 */}
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
