import { useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import {
  CheckCircle2,
  Home,
  Clock,
  Coins,
  Users,
  Share2,
  X,
  Gift,
  Sparkles,
  Star,
  Trophy,
  Gem,
  Hourglass,
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

  // Gold sparkle confetti on enter — fires once when rewards are loaded
  const confettiFiredRef = useRef(false);
  useEffect(() => {
    if (confettiFiredRef.current || myRedemptions.length === 0) return;
    confettiFiredRef.current = true;
    const timer = setTimeout(() => {
      confetti({
        particleCount: 60,
        spread: 80,
        origin: { y: 0.25 },
        colors: ["#FFD700", "#FFC107", "#FFEB3B", "#FFA000", "#fff8dc"],
        shapes: ["circle"],
        scalar: 0.9,
        gravity: 0.6,
        drift: 0,
        ticks: 180,
      });
    }, 500);
    return () => clearTimeout(timer);
  }, [myRedemptions.length]);

  if (!member) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-muted-foreground">{t("common.loading")}</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4 pb-20 relative overflow-x-hidden" style={{ paddingTop: 'calc(1rem + env(safe-area-inset-top))', paddingLeft: 'max(1rem, env(safe-area-inset-left))', paddingRight: 'max(1rem, env(safe-area-inset-right))' }}>
      {/* Golden atmosphere glow */}
      <div className="pointer-events-none fixed inset-0 z-0" style={{ background: "radial-gradient(ellipse 80% 50% at 50% 0%, rgba(251,191,36,0.13) 0%, rgba(245,158,11,0.06) 45%, transparent 75%)" }} />

      <div className="max-w-2xl landscape:max-w-4xl mx-auto space-y-6 relative z-10">
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

        {/* Floating chest */}
        <div className="flex justify-center mb-2">
          <motion.div
            className="h-36 w-36 flex items-center justify-center"
            animate={{ y: [0, -10, 0] }}
            transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
          >
            <img
              src="/nav-icons/chest.png"
              alt=""
              className="w-full h-full object-contain"
              style={{ filter: "drop-shadow(0 12px 32px rgba(251,191,36,0.45)) drop-shadow(0 4px 10px rgba(0,0,0,0.5))" }}
            />
          </motion.div>
        </div>

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

              const isCompleted = redemption.status === "completed";
              const isApproved = redemption.status === "approved";
              // Rarity tier by status
              const rarity = isCompleted
                ? { label: "LEGENDARY", banner: "from-amber-500 via-yellow-400 to-amber-300", glow: "rgba(251,191,36,0.35)", border: "rgba(251,191,36,0.55)", iconBg: "rgba(251,191,36,0.18)", textColor: "#fbbf24" }
                : isApproved
                ? { label: "EPIC", banner: "from-violet-600 via-purple-500 to-indigo-500", glow: "rgba(167,139,250,0.35)", border: "rgba(167,139,250,0.55)", iconBg: "rgba(167,139,250,0.18)", textColor: "#a78bfa" }
                : { label: "RARE", banner: "from-orange-500 via-orange-400 to-amber-400", glow: "rgba(251,146,60,0.35)", border: "rgba(251,146,60,0.5)", iconBg: "rgba(251,146,60,0.18)", textColor: "#fb923c" };

              return (
                <motion.div
                  key={redemption.id}
                  initial={{ opacity: 0, y: 24, scale: 0.96 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ delay: index * 0.08, duration: 0.35, ease: "easeOut" }}
                >
                  {/* Premium collectible treasure card */}
                  <div
                    className="rounded-2xl overflow-hidden"
                    style={{
                      background: "linear-gradient(160deg, rgba(30,20,10,0.92) 0%, rgba(20,15,8,0.97) 100%)",
                      border: `1.5px solid ${rarity.border}`,
                      boxShadow: `0 0 0 1px rgba(255,255,255,0.04) inset, 0 8px 0 ${rarity.glow.replace("0.35", "0.28")}, 0 12px 0 ${rarity.glow.replace("0.35", "0.14")}, 0 4px 24px ${rarity.glow}`,
                    }}
                  >
                    {/* Rarity banner */}
                    <div className={`bg-gradient-to-r ${rarity.banner} px-4 py-2 flex items-center justify-between`}>
                      <div className="flex items-center gap-2">
                        <Star className="h-3 w-3 fill-white text-white opacity-90" />
                        <span className="text-white text-xs font-black tracking-widest opacity-95" style={{ fontFamily: "Fredoka, sans-serif", letterSpacing: "0.18em" }}>
                          {rarity.label}
                        </span>
                      </div>
                      <div className="flex items-center gap-1 opacity-80">
                        <Star className="h-2.5 w-2.5 fill-white text-white" />
                        <Star className="h-3 w-3 fill-white text-white" />
                        <Star className="h-2.5 w-2.5 fill-white text-white" />
                      </div>
                    </div>

                    {/* Icon zone */}
                    <div className="flex justify-center pt-5 pb-3 relative">
                      {/* Decorative sparkle dots */}
                      <Sparkles className="absolute left-5 top-4 h-3.5 w-3.5 opacity-40" style={{ color: rarity.textColor }} />
                      <Sparkles className="absolute right-5 top-5 h-3 w-3 opacity-30" style={{ color: rarity.textColor }} />
                      {/* Icon with glow halo */}
                      <div
                        className="h-16 w-16 rounded-full flex items-center justify-center"
                        style={{
                          background: rarity.iconBg,
                          boxShadow: `0 0 28px ${rarity.glow}, 0 0 8px ${rarity.glow}`,
                        }}
                      >
                        {isCompleted ? (
                          <Trophy className="h-8 w-8" style={{ color: rarity.textColor }} />
                        ) : isApproved ? (
                          <Gem className="h-8 w-8" style={{ color: rarity.textColor }} />
                        ) : (
                          <Hourglass className="h-8 w-8" style={{ color: rarity.textColor }} />
                        )}
                      </div>
                    </div>

                    {/* Content zone */}
                    <div className="px-4 pb-4 space-y-3">
                      {/* Title */}
                      <h3
                        className="font-black text-xl text-center text-white leading-tight"
                        style={{ fontFamily: "Fredoka, sans-serif", textShadow: `0 1px 8px ${rarity.glow}` }}
                      >
                        {redemption.rewardTitle || t("myRewards.reward")}
                      </h3>

                      {/* Stats chips */}
                      <div className="flex items-center justify-center gap-2 flex-wrap">
                        <div
                          className="flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold"
                          style={{ background: rarity.iconBg, color: rarity.textColor, border: `1px solid ${rarity.border}` }}
                        >
                          <Coins className="h-3.5 w-3.5" />
                          <span>{t("myRewards.pointsSpent", { count: redemption.pointsSpent })}</span>
                        </div>
                        <div className="flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold bg-white/5 text-white/60 border border-white/10">
                          <span>{redemption.redeemedAt ? new Date(redemption.redeemedAt).toLocaleDateString() : "-"}</span>
                        </div>
                      </div>

                      {/* Status badges */}
                      <div className="flex items-center justify-center gap-2 flex-wrap">
                        <div
                          className="flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold"
                          data-testid={`badge-status-${redemption.id}`}
                          style={{ background: isCompleted ? "rgba(34,197,94,0.15)" : "rgba(255,255,255,0.08)", color: isCompleted ? "#4ade80" : "rgba(255,255,255,0.7)", border: isCompleted ? "1px solid rgba(34,197,94,0.4)" : "1px solid rgba(255,255,255,0.15)" }}
                        >
                          {isCompleted ? (
                            <><CheckCircle2 className="h-3.5 w-3.5" />{t("myRewards.fulfilled")}</>
                          ) : isApproved ? (
                            <><Clock className="h-3.5 w-3.5" />{t("myRewards.waiting")}</>
                          ) : (
                            <><Clock className="h-3.5 w-3.5" />{t("myRewards.pending")}</>
                          )}
                        </div>
                        {isSharing && (
                          <div className="flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold bg-violet-500/15 text-violet-300 border border-violet-400/30">
                            <Users className="h-3.5 w-3.5" />{t("myRewards.beingShared")}
                          </div>
                        )}
                        {isFinalized && (
                          <div className="flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold bg-white/8 text-white/60 border border-white/15">
                            <CheckCircle2 className="h-3.5 w-3.5" />{t("myRewards.shared")}
                          </div>
                        )}
                      </div>

                      {/* Participants */}
                      {participants.length > 0 && (
                        <div className="flex items-center gap-2 flex-wrap rounded-xl px-3 py-2 bg-white/5 border border-white/10">
                          <div className="flex items-center gap-1.5 text-xs text-white/50">
                            <Users className="h-3.5 w-3.5" />
                            <span>{t("myRewards.with")}:</span>
                          </div>
                          <div className="flex items-center gap-2 flex-wrap">
                            {participants.map(p => (
                              <div key={p.id} className="flex items-center gap-1.5">
                                <Avatar className="h-6 w-6 border-2 border-white/20">
                                  <AvatarImage src={getAvatarUrl(p.member.activeSkinId, p.member.avatarUrl, (p.member as any).useCustomAvatar, (p.member as any).updatedAt)} />
                                  <AvatarFallback className="text-xs font-bold text-white" style={{ backgroundColor: p.member.color }}>
                                    {p.member.displayName[0]}
                                  </AvatarFallback>
                                </Avatar>
                                <span className="text-sm font-semibold text-white/80">{p.member.displayName}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Cancel Redemption */}
                      {canCancel && (
                        <Button
                          variant="outline"
                          className="w-full gap-2 h-11 rounded-xl border-red-500/30 text-red-400 bg-red-500/10 font-bold"
                          onClick={() => cancelRedemptionMutation.mutate(typed.id)}
                          disabled={cancelRedemptionMutation.isPending}
                          data-testid={`button-cancel-redemption-${typed.id}`}
                        >
                          <X className="h-4 w-4" />
                          {t("rewardsBoard.cancelRedemption")}
                        </Button>
                      )}

                      {/* Sharing Actions */}
                      {(canShare || canFinalize || canCancelSharing) && (
                        <div className="flex flex-col gap-2">
                          {canShare && (
                            <Button
                              className="w-full gap-2 h-11 rounded-xl font-bold"
                              style={{ background: `linear-gradient(135deg, ${rarity.textColor}33, ${rarity.textColor}22)`, border: `1px solid ${rarity.border}`, color: rarity.textColor }}
                              onClick={() => startSharingMutation.mutate(typed.id)}
                              disabled={startSharingMutation.isPending}
                              data-testid={`button-share-${typed.id}`}
                            >
                              <Share2 className="h-4 w-4" />
                              {t("myRewards.share")}
                            </Button>
                          )}
                          {canCancelSharing && (
                            <Button
                              variant="outline"
                              className="w-full gap-2 h-11 rounded-xl border-white/20 text-white/70 font-bold"
                              onClick={() => cancelSharingMutation.mutate(typed.id)}
                              disabled={cancelSharingMutation.isPending}
                              data-testid={`button-cancel-share-${typed.id}`}
                            >
                              <X className="h-4 w-4" />
                              {t("myRewards.cancelSharing")}
                            </Button>
                          )}
                          {canFinalize && (
                            <Button
                              className="w-full gap-2 h-11 rounded-xl font-bold text-white"
                              style={{ background: "linear-gradient(135deg, #22c55e, #16a34a)", boxShadow: "0 4px 12px rgba(34,197,94,0.4)" }}
                              onClick={() => finalizeSharingMutation.mutate(typed.id)}
                              disabled={finalizeSharingMutation.isPending}
                              data-testid={`button-finalize-${typed.id}`}
                            >
                              <CheckCircle2 className="h-4 w-4" />
                              {t("myRewards.finalize")}
                            </Button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </motion.div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
