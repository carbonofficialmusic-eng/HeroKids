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
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { getAvatarUrl } from "@/lib/skins";
import confetti from "canvas-confetti";

// Extended RewardRedemption type with sharing details
type RedemptionWithDetails = RewardRedemption & {
  rewardTitle?: string;
  sharingStatus: "not_shared" | "sharing_active" | "sharing_finalized";
  originalPointsSpent: number;
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
  });

  const { data: member } = useQuery<FamilyMember>({
    queryKey: ["/api/family-members/current"],
    enabled: !!authUser,
  });

  const { data: realMember } = useQuery<FamilyMember>({
    queryKey: ["/api/family-members/real"],
    enabled: !!authUser,
  });

  const { data: redemptions = [] } = useQuery<(RewardRedemption & { rewardTitle?: string })[]>({
    queryKey: ["/api/reward-redemptions"],
    enabled: !!member,
  });

  const { data: sharedRewards = [] } = useQuery<SharedReward[]>({
    queryKey: ["/api/rewards/shared"],
    enabled: !!member,
  });

  const { data: familyData } = useQuery<{ subscriptionTier: string }>({
    queryKey: ["/api/families/current"],
    enabled: !!member,
  });
  const canUseSharedRewards = familyData?.subscriptionTier === "family" || familyData?.subscriptionTier === "enterprise";

  // Mutations for reward sharing
  const startSharingMutation = useMutation({
    mutationFn: async (redemptionId: string) => {
      return await apiRequest("POST", `/api/rewards/redemptions/${redemptionId}/share`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/reward-redemptions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/rewards/shared"] });
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
      queryClient.invalidateQueries({ queryKey: ["/api/family-members/current"] });
      queryClient.invalidateQueries({ queryKey: ["/api/family-members"] });
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
    <div className="min-h-screen p-4 pb-20">
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="flex items-center gap-4">
          <Link href={member?.role === "parent" ? "/" : "/kid-dashboard"}>
            <button className="p-2 rounded-full bg-card/80 backdrop-blur-md" data-testid="button-back">
              <ArrowLeft className="h-6 w-6" />
            </button>
          </Link>
          <h1 className="text-2xl font-bold font-accent" style={{ fontFamily: "Fredoka, sans-serif" }}>
            {t("myRewards.title")}
          </h1>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          <Card className="p-6 bg-gradient-to-br from-green-500/10 to-emerald-500/10 border border-green-500/20 rounded-2xl">
            <div className="flex items-center gap-4">
              <div className="p-4 rounded-2xl bg-green-500/20">
                <Trophy className="h-10 w-10 text-green-500" />
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

        <div className="space-y-4">
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
              const participants = shared?.participants || [];
              const isSharing = typed.sharingStatus === "sharing_active";
              const isFinalized = typed.sharingStatus === "sharing_finalized";
              const canShare = typed.status !== "completed" && typed.sharingStatus === "not_shared" && canUseSharedRewards;
              const canFinalize = isSharing && participants.length > 0;
              const canCancelSharing = isSharing && participants.length === 0;

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

                        {/* Participants */}
                        {participants.length > 0 && (
                          <div className="flex items-center gap-2 flex-wrap pt-1">
                            <p className="text-xs text-muted-foreground">{t("myRewards.with")}:</p>
                            {participants.map(p => (
                              <Avatar key={p.id} className="h-6 w-6 border-2 border-background">
                                <AvatarImage src={getAvatarUrl(p.member.activeSkinId, p.member.avatarUrl, (p.member as any).useCustomAvatar, (p.member as any).updatedAt)} />
                                <AvatarFallback className="text-xs">
                                  {p.member.displayName[0]}
                                </AvatarFallback>
                              </Avatar>
                            ))}
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
