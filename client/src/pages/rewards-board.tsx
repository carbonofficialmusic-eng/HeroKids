import { useEffect, useRef, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle2, Clock, Gift, Sparkles, Home, Users, UserPlus, Share2, X, Check, Pencil, MessageSquarePlus, Lock } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { format } from "date-fns";
import { useWebSocket } from "@/hooks/useWebSocket";
import { Link } from "wouter";
import { getAvatarUrl } from "@/lib/skins";
import { useTranslation } from "react-i18next";
import { RewardRequestDialog } from "@/components/reward-request-dialog";

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

export default function RewardsBoard() {
  const { toast } = useToast();
  const { t } = useTranslation();

  // Fetch current member (acting member)
  const { data: member } = useQuery<FamilyMember>({
    queryKey: ["/api/family-members/current"],
  });

  // Fetch real member (authenticated user)
  const { data: realMember } = useQuery<FamilyMember>({
    queryKey: ["/api/family-members/real"],
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
  });

  // Fetch all active shared rewards
  const { data: sharedRewards = [] } = useQuery<SharedReward[]>({
    queryKey: ["/api/rewards/shared"],
    enabled: !!member,
  });

  // Fetch all family members
  const { data: familyMembers = [] } = useQuery<FamilyMember[]>({
    queryKey: ["/api/family-members"],
    enabled: !!member,
  });

  // Fetch family data for tier check
  const { data: familyData } = useQuery<{ subscriptionTier: string }>({
    queryKey: ["/api/families/current"],
    enabled: !!member,
  });
  const canUseSharedRewards = familyData?.subscriptionTier === "family" || familyData?.subscriptionTier === "enterprise";

  // Fetch reward requests (parent only)
  const { data: rewardRequests = [] } = useQuery<RewardRequest[]>({
    queryKey: ["/api/reward-requests"],
    enabled: !!member && isRealParent,
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
      queryClient.invalidateQueries({ queryKey: ["/api/family-members/current"] });
      queryClient.invalidateQueries({ queryKey: ["/api/family-members"] });
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
    <div className="min-h-screen p-4 sm:p-6" style={{ paddingTop: 'calc(1rem + env(safe-area-inset-top))' }}>
      <div className="container mx-auto max-w-4xl space-y-6">
        {/* Header */}
        <div className="space-y-4">
          <Link href="/">
            <Button 
              variant="outline" 
              size="sm" 
              className="gap-2 bg-background/30 backdrop-blur-sm border-border/40 hover:bg-background/60" 
              data-testid="button-back-dashboard"
            >
              <Home className="h-4 w-4" />
              {t("rewardsBoard.backToDashboard")}
            </Button>
          </Link>
          <div className="flex items-center gap-3">
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
        </div>

        {/* Pending Reward Requests Section (Parents only) */}
        {isRealParent && rewardRequests.filter(r => r.status === "pending").length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <MessageSquarePlus className="h-6 w-6 text-primary" />
              <h2 className="text-2xl font-accent font-bold">{t("dashboard.pendingRewardRequests")}</h2>
            </div>
            <div className="grid md:grid-cols-2 gap-4">
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
          <div className="grid gap-4">
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

      {/* Redemptions List */}
      {displayRedemptions.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Gift className="h-16 w-16 text-muted-foreground mb-4" />
            <h3 className="text-xl font-semibold mb-2">{t("rewardsBoard.noRewardsYet")}</h3>
            <p className="text-muted-foreground text-center">
              {isParent 
                ? t("rewardsBoard.noRewardsFamilyDesc")
                : t("rewardsBoard.noRewardsYouDesc")}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
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
                
                {/* Show participants for shared rewards */}
                {(redemption.sharingStatus === "sharing_active" || redemption.sharingStatus === "sharing_finalized") && 
                 redemption.sharingParticipants && redemption.sharingParticipants.length > 0 && (
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm text-muted-foreground">{t("rewardsBoard.sharedWith")}:</span>
                    <div className="flex items-center gap-1">
                      {redemption.sharingParticipants.map((participant) => (
                        <div key={participant.id} className="flex items-center gap-1">
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
                    {canUseSharedRewards ? (
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
      )}
      </div>

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
