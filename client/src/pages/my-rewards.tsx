import { useQuery, useMutation } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import {
  CheckCircle2,
  Trophy,
  ArrowLeft,
  Home,
  Clock,
  Coins,
  Users,
  Share2,
  X,
  Gift,
  Sparkles,
} from "lucide-react";
import { Link } from "wouter";
import { useTranslation } from "react-i18next";
import type { User, FamilyMember, RewardRedemption } from "@shared/schema";
import { canUseSharedRewards } from "@shared/tier-config";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { getAvatarUrl } from "@/lib/skins";
import confetti from "canvas-confetti";

// Extended RewardRedemption type with sharing details
type SharingParticipant = {
  id: string;
  memberId: string;
  displayName: string;
  avatarUrl: string | null;
  activeSkinId: string | null;
  color: string;
  pointsContributed: number;
};

type RedemptionWithDetails = RewardRedemption & {
  rewardTitle?: string;
  sharingStatus: "not_shared" | "sharing_active" | "sharing_finalized";
  originalPointsSpent: number;
  sharingParticipants?: SharingParticipant[];
};

// Shared reward type with participants
type SharedReward = RedemptionWithDetails & {
  reward: {
    id: string;
    title: string;
    description: string | null;
    pointThreshold: number;
  };
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

export default function MyRewards() {
  const { t } = useTranslation();
  const { toast } = useToast();

  const { data: authUser } = useQuery<User>({
    queryKey: ["/api/auth/user"],
    staleTime: 5 * 60 * 1000,
  });

  const { data: member } = useQuery<FamilyMember>({
    queryKey: ["/api/family-members/current"],
    enabled: !!authUser,
    staleTime: 5 * 60 * 1000,
  });

  const { data: realMember } = useQuery<FamilyMember>({
    queryKey: ["/api/family-members/real"],
    enabled: !!authUser,
    staleTime: 5 * 60 * 1000,
  });

  const { data: redemptions = [] } = useQuery<(RewardRedemption & { rewardTitle?: string })[]>({
    queryKey: ["/api/reward-redemptions"],
    enabled: !!member,
    staleTime: 5 * 60 * 1000,
  });

  const { data: sharedRewards = [] } = useQuery<SharedReward[]>({
    queryKey: ["/api/rewards/shared"],
    enabled: !!member,
    staleTime: 5 * 60 * 1000,
  });

  const { data: familyData } = useQuery<{ subscriptionTier: string }>({
    queryKey: ["/api/families/current"],
    enabled: !!member,
    staleTime: 5 * 60 * 1000,
  });
  const canUseSharedRewardsFeature = canUseSharedRewards(familyData?.subscriptionTier);

  // Mutations for reward sharing
  const startSharingMutation = useMutation({
    mutationFn: async (redemptionId: string) => {
      return await apiRequest("POST", `/api/rewards/redemptions/${redemptionId}/share`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/reward-redemptions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/rewards/shared"] });
      queryClient.invalidateQueries({ queryKey: ["/api/family-members/current"] });
      queryClient.invalidateQueries({ queryKey: ["/api/family-members"] });
      toast({
        title: t("myRewards.sharingStarted"),
        description: t("myRewards.sharingStartedDesc"),
      });
    },
    onError: (error: any) => {
      toast({
        title: t("myRewards.error"),
        description: error.message || t("myRewards.sharingError"),
        variant: "destructive",
      });
    },
  });

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
        title: t("myRewards.joinedSharing"),
        description: t("myRewards.joinedSharingDesc"),
      });
    },
    onError: (error: any) => {
      toast({
        title: t("myRewards.error"),
        description: error.message || t("myRewards.joinError"),
        variant: "destructive",
      });
    },
  });

  const finalizeSharingMutation = useMutation({
    mutationFn: async (redemptionId: string) => {
      return await apiRequest("POST", `/api/rewards/redemptions/${redemptionId}/finalize`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/reward-redemptions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/rewards/shared"] });
      queryClient.invalidateQueries({ queryKey: ["/api/family-members/current"] });
      queryClient.invalidateQueries({ queryKey: ["/api/family-members"] });
      toast({
        title: t("myRewards.sharingFinalized"),
        description: t("myRewards.sharingFinalizedDesc"),
      });
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 }
      });
    },
    onError: (error: any) => {
      toast({
        title: t("myRewards.error"),
        description: error.message || t("myRewards.finalizeError"),
        variant: "destructive",
      });
    },
  });

  const cancelSharingMutation = useMutation({
    mutationFn: async (redemptionId: string) => {
      return await apiRequest("POST", `/api/rewards/redemptions/${redemptionId}/cancel-sharing`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/reward-redemptions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/rewards/shared"] });
      toast({
        title: t("myRewards.sharingCancelled"),
        description: t("myRewards.sharingCancelledDesc"),
      });
    },
    onError: (error: any) => {
      toast({
        title: t("myRewards.error"),
        description: error.message || t("myRewards.cancelError"),
        variant: "destructive",
      });
    },
  });

  const cancelRedemptionMutation = useMutation({
    mutationFn: async (redemptionId: string) => {
      return await apiRequest("DELETE", `/api/reward-redemptions/${redemptionId}`);
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/reward-redemptions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/reward-redemptions/pending-count"] });
      queryClient.invalidateQueries({ queryKey: ["/api/rewards/shared"] });
      queryClient.invalidateQueries({ queryKey: ["/api/family-members/current"] });
      queryClient.invalidateQueries({ queryKey: ["/api/family-members"] });
      queryClient.invalidateQueries({ queryKey: ["/api/device-link/session"] });
      queryClient.invalidateQueries({ queryKey: ["/api/rewards"] });
      toast({
        title: t("rewardsBoard.redemptionCancelled"),
        description: t("rewardsBoard.pointsRefunded", { count: data?.pointsRefunded ?? 0 }),
      });
    },
    onError: (error: any) => {
      toast({ title: t("rewardsBoard.cancelError"), description: error.message, variant: "destructive" });
    },
  });

  // Filter and sort redemptions by newest first
  const myRedemptions = member 
    ? redemptions
        .filter(r => r.memberId === member.id)
        .sort((a, b) => {
          const dateA = a.redeemedAt ? new Date(a.redeemedAt).getTime() : 0;
          const dateB = b.redeemedAt ? new Date(b.redeemedAt).getTime() : 0;
          return dateB - dateA;
        })
    : [];

  if (!member) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-muted-foreground">{t("common.loading")}</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4 pb-20" style={{ paddingTop: 'calc(1rem + env(safe-area-inset-top))', paddingLeft: 'max(1rem, env(safe-area-inset-left))', paddingRight: 'max(1rem, env(safe-area-inset-right))' }}>
      <div className="max-w-2xl landscape:max-w-4xl mx-auto space-y-6">
        {/* Back button */}
        <Link href={member?.role === "parent" ? "/" : "/kid-dashboard"}>
          <Button
            variant="outline"
            size="sm"
            className="mb-4 gap-2 bg-background/30 backdrop-blur-sm border-border/40 hover:bg-background/60"
            data-testid="button-back"
          >
            <Home className="h-4 w-4" />
            {t("rewardsBoard.backToDashboard")}
          </Button>
        </Link>

        {/* Page title — chest only, centered */}
        <div className="flex justify-center mb-2">
          <div className="h-32 w-32 flex items-center justify-center">
            <img src="/nav-icons/chest.png" alt="" className="w-full h-full object-contain drop-shadow-2xl" style={{ filter: "drop-shadow(0 8px 24px rgba(0,0,0,0.5)) drop-shadow(0 2px 6px rgba(0,0,0,0.4))" }} />
          </div>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          <Card className="p-6 bg-gradient-to-br from-green-500/10 to-emerald-500/10 border border-green-500/20 rounded-2xl">
            <div className="flex items-center gap-4">
              <div className="h-16 w-16 flex items-center justify-center flex-shrink-0">
                <img src="/nav-icons/chest.png" alt="" className="w-full h-full object-contain drop-shadow-lg" />
              </div>
              <div>
                <h2 className="text-xl font-bold" style={{ fontFamily: "Fredoka, sans-serif" }}>
                  {t("myRewards.allRewards")}
                </h2>
                <p className="text-muted-foreground">
                  {t("myRewards.rewardsCount", { count: myRedemptions.length })}
                </p>
              </div>
              <Sparkles className="h-6 w-6 text-green-500 ml-auto animate-pulse" />
            </div>
          </Card>
        </motion.div>

        <div className="grid grid-cols-1 landscape:grid-cols-2 gap-4">
          {myRedemptions.length === 0 ? (
            <Card className="p-8 text-center bg-card/80 backdrop-blur-md rounded-2xl">
              <Gift className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
              <p className="text-lg text-muted-foreground">{t("myRewards.noRewards")}</p>
              <p className="text-sm text-muted-foreground mt-2">
                {t("myRewards.collectPoints")}
              </p>
            </Card>
          ) : (
            myRedemptions.map((redemption, index) => {
              const typed = redemption as RedemptionWithDetails;
              const shared = sharedRewards.find(s => s.id === typed.id);
              // For active shares use the /api/rewards/shared data (has join actions)
              // For finalized/completed shares use sharingParticipants from /api/reward-redemptions
              const participants = shared?.participants ||
                typed.sharingParticipants?.map(p => ({
                  id: p.id,
                  memberId: p.memberId,
                  pointsContributed: p.pointsContributed,
                  joinedAt: "",
                  member: {
                    id: p.memberId,
                    displayName: p.displayName,
                    avatarUrl: p.avatarUrl,
                    activeSkinId: p.activeSkinId,
                    color: p.color,
                  },
                })) || [];
              const isSharing = typed.sharingStatus === "sharing_active";
              const isFinalized = typed.sharingStatus === "sharing_finalized";
              const canShare = typed.status !== "completed" && typed.sharingStatus === "not_shared" && canUseSharedRewardsFeature;
              const canFinalize = isSharing && participants.length > 0;
              const canCancelSharing = isSharing && participants.length === 0;
              const canCancel = typed.status !== "completed" && typed.sharingStatus === "not_shared";

              return (
                <motion.div
                  key={redemption.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                >
                  <Card className="p-5 bg-gradient-to-br from-green-500/20 to-emerald-500/20 border border-green-500/30 rounded-2xl">
                    <div className="flex items-start gap-4">
                      <div className="p-3 rounded-xl flex-shrink-0 bg-green-500/20">
                        {redemption.status === "completed" ? (
                          <CheckCircle2 className="h-7 w-7 text-green-500" />
                        ) : (
                          <Clock className="h-7 w-7 text-green-600" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0 space-y-2">
                        <h3 className="font-bold text-lg" style={{ fontFamily: "Fredoka, sans-serif" }}>
                          {redemption.rewardTitle || t("myRewards.reward")}
                        </h3>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground flex-wrap">
                          <Coins className="h-3.5 w-3.5 flex-shrink-0" />
                          <span>{t("myRewards.pointsSpent", { count: redemption.pointsSpent })}</span>
                          <span>•</span>
                          <span>{redemption.redeemedAt ? new Date(redemption.redeemedAt).toLocaleDateString() : "-"}</span>
                        </div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge 
                            variant={redemption.status === "completed" ? "default" : "secondary"}
                            className="gap-1.5"
                            data-testid={`badge-status-${redemption.id}`}
                          >
                            {redemption.status === "completed" ? (
                              <>
                                <CheckCircle2 className="h-3.5 w-3.5" />
                                {t("myRewards.fulfilled")}
                              </>
                            ) : redemption.status === "approved" ? (
                              <>
                                <Clock className="h-3.5 w-3.5" />
                                {t("myRewards.waiting")}
                              </>
                            ) : (
                              <>
                                <Clock className="h-3.5 w-3.5" />
                                {t("myRewards.pending")}
                              </>
                            )}
                          </Badge>
                          {isSharing && (
                            <Badge variant="secondary" className="gap-1.5">
                              <Users className="h-3.5 w-3.5" />
                              {t("myRewards.beingShared")}
                            </Badge>
                          )}
                          {isFinalized && (
                            <Badge variant="outline" className="gap-1.5">
                              <CheckCircle2 className="h-3.5 w-3.5" />
                              {t("myRewards.shared")}
                            </Badge>
                          )}
                        </div>

                        {/* Participants — always shown, even for fulfilled shared rewards */}
                        {participants.length > 0 && (
                          <div className={`flex items-center gap-2 flex-wrap rounded-xl px-3 py-2 mt-1 ${
                            typed.status === "completed" ? "bg-black/10 dark:bg-white/5" : ""
                          }`}>
                            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                              <Users className="h-3.5 w-3.5" />
                              <span>{t("myRewards.with")}:</span>
                            </div>
                            <div className="flex items-center gap-2 flex-wrap">
                              {participants.map(p => (
                                <div key={p.id} className="flex items-center gap-1.5">
                                  <Avatar className="h-6 w-6 border-2 border-background">
                                    <AvatarImage src={getAvatarUrl(p.member.activeSkinId, p.member.avatarUrl, (p.member as any).useCustomAvatar, (p.member as any).updatedAt)} />
                                    <AvatarFallback
                                      className="text-xs font-bold text-white"
                                      style={{ backgroundColor: p.member.color }}
                                    >
                                      {p.member.displayName[0]}
                                    </AvatarFallback>
                                  </Avatar>
                                  <span className="text-sm font-medium">{p.member.displayName}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Cancel Redemption */}
                        {canCancel && (
                          <div className="pt-2">
                            <Button
                              size="sm"
                              variant="outline"
                              className="gap-1.5 text-destructive border-destructive/40 hover:bg-destructive/10"
                              onClick={() => cancelRedemptionMutation.mutate(typed.id)}
                              disabled={cancelRedemptionMutation.isPending}
                              data-testid={`button-cancel-redemption-${typed.id}`}
                            >
                              <X className="h-3.5 w-3.5" />
                              {t("rewardsBoard.cancelRedemption")}
                            </Button>
                          </div>
                        )}

                        {/* Sharing Actions */}
                        {(canShare || canFinalize || canCancelSharing) && (
                          <div className="pt-2 flex gap-2 flex-wrap">
                            {canShare && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="gap-1.5"
                                onClick={() => startSharingMutation.mutate(typed.id)}
                                disabled={startSharingMutation.isPending}
                                data-testid={`button-share-${typed.id}`}
                              >
                                <Share2 className="h-3.5 w-3.5" />
                                {t("myRewards.share")}
                              </Button>
                            )}
                            {canCancelSharing && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="gap-1.5"
                                onClick={() => cancelSharingMutation.mutate(typed.id)}
                                disabled={cancelSharingMutation.isPending}
                                data-testid={`button-cancel-share-${typed.id}`}
                              >
                                <X className="h-3.5 w-3.5" />
                                {t("myRewards.cancelSharing")}
                              </Button>
                            )}
                            {canFinalize && (
                              <Button
                                size="sm"
                                variant="default"
                                className="gap-1.5"
                                onClick={() => finalizeSharingMutation.mutate(typed.id)}
                                disabled={finalizeSharingMutation.isPending}
                                data-testid={`button-finalize-${typed.id}`}
                              >
                                <CheckCircle2 className="h-3.5 w-3.5" />
                                {t("myRewards.finalize")}
                              </Button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </Card>
                </motion.div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
