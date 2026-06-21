import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Gift, ArrowLeft, Loader2, Pencil, Trash2 } from "lucide-react";
import { Link } from "wouter";
import { useTranslation } from "react-i18next";
import type { User, FamilyMember, Reward } from "@shared/schema";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import confetti from "canvas-confetti";
import { RewardDialog } from "@/components/reward-dialog";
import { RewardIconDisplay } from "@/lib/reward-icon";

export default function ActiveRewards() {
  const { t } = useTranslation();
  const { toast } = useToast();

  const [rewardDialogOpen, setRewardDialogOpen] = useState(false);
  const [selectedReward, setSelectedReward] = useState<Reward | null>(null);

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

  const isRealParent = realMember?.role === "parent";

  const { data: rewards = [], isLoading } = useQuery<Reward[]>({
    queryKey: ["/api/rewards"],
    enabled: !!member,
    staleTime: 30 * 1000,
  });

  const activeRewards = rewards.filter((r) => r.isActive);

  const redeemMutation = useMutation({
    mutationFn: async (rewardId: string) => {
      const res = await apiRequest("POST", `/api/rewards/${rewardId}/redeem`);
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/rewards"] });
      queryClient.invalidateQueries({ queryKey: ["/api/family-members/current"] });
      queryClient.invalidateQueries({ queryKey: ["/api/reward-redemptions"] });
      const pointsSpent = data?.redemption?.pointsSpent || 0;
      const rewardTitle = data?.redemption?.rewardTitle || t("dashboard.activeRewards");
      confetti({ particleCount: 80, spread: 60, origin: { y: 0.7 } });
      toast({
        title: t("dashboard.rewardRedeemed"),
        description: `${rewardTitle} - ${pointsSpent} ${t("dashboard.pointsLabel")}`,
      });
    },
    onError: () => {
      toast({
        title: t("errors.somethingWrong"),
        variant: "destructive",
      });
    },
  });

  const updateRewardMutation = useMutation({
    mutationFn: async ({ rewardId, data }: { rewardId: string; data: any }) => {
      return await apiRequest("PUT", `/api/rewards/${rewardId}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/rewards"] });
      setRewardDialogOpen(false);
      setSelectedReward(null);
    },
    onError: () => {
      toast({ title: t("errors.somethingWrong"), variant: "destructive" });
    },
  });

  const deleteRewardMutation = useMutation({
    mutationFn: async (rewardId: string) => {
      return await apiRequest("DELETE", `/api/rewards/${rewardId}`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/rewards"] });
    },
    onError: () => {
      toast({ title: t("errors.somethingWrong"), variant: "destructive" });
    },
  });

  return (
    <div
      className="min-h-screen p-4 pb-20"
      style={{
        paddingTop: "calc(1rem + env(safe-area-inset-top))",
        paddingLeft: "max(1rem, env(safe-area-inset-left))",
        paddingRight: "max(1rem, env(safe-area-inset-right))",
      }}
    >
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" asChild data-testid="button-back-active-rewards" className="gap-2 shrink-0 bg-background/30 backdrop-blur-sm border-border/40">
            <Link href="/">
              <ArrowLeft className="h-4 w-4" />
              {t("common.back") || "Zurück"}
            </Link>
          </Button>
          <div className="flex items-center gap-2">
            <div className="h-9 w-9 rounded-full gradient-winner flex items-center justify-center shrink-0">
              <Gift className="h-5 w-5 text-white" />
            </div>
            <h1 className="text-2xl font-bold font-accent">{t("dashboard.activeRewards")}</h1>
          </div>
        </div>

        {/* Content */}
        {isLoading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : activeRewards.length === 0 ? (
          <Card className="p-12 text-center">
            <Gift className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-xl font-bold font-accent mb-2">{t("dashboard.noRewardsAvailable")}</h3>
          </Card>
        ) : (
          <div className="grid gap-4">
            {activeRewards.map((reward, index) => (
              <motion.div
                key={reward.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
              >
                <Card className="p-5 relative overflow-visible" data-testid={`card-reward-${reward.id}`}>
                  {isRealParent && (
                    <div className="absolute top-2 right-2 flex gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => {
                          setSelectedReward(reward);
                          setRewardDialogOpen(true);
                        }}
                        data-testid={`button-edit-reward-${reward.id}`}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => deleteRewardMutation.mutate(reward.id)}
                        disabled={deleteRewardMutation.isPending}
                        data-testid={`button-delete-reward-${reward.id}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                  <div className="flex items-start gap-4">
                    <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center shrink-0 p-1.5">
                      <RewardIconDisplay icon={reward.iconEmoji} imgClassName="w-full h-full object-contain drop-shadow-sm" textClassName="text-4xl leading-none" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-bold text-lg mb-1" data-testid={`text-reward-title-${reward.id}`}>
                        {reward.title}
                      </h3>
                      {reward.description && (
                        <p className="text-sm text-muted-foreground mb-2">{reward.description}</p>
                      )}
                      <div className="flex items-center gap-2 mb-3 flex-wrap">
                        <Badge
                          variant={
                            member && member.totalPoints >= reward.pointThreshold ? "default" : "secondary"
                          }
                          data-testid={`badge-reward-points-${reward.id}`}
                        >
                          {reward.pointThreshold} {t("dashboard.pointsLabel")}
                        </Badge>
                        {member && member.totalPoints >= reward.pointThreshold && (
                          <span className="text-xs font-semibold text-green-600">
                            {t("dashboard.youCanClaim")}
                          </span>
                        )}
                      </div>
                      <Button
                        onClick={() => redeemMutation.mutate(reward.id)}
                        disabled={
                          !member ||
                          member.totalPoints < reward.pointThreshold ||
                          redeemMutation.isPending
                        }
                        size="sm"
                        className="w-full"
                        data-testid={`button-redeem-${reward.id}`}
                      >
                        {redeemMutation.isPending ? (
                          t("dashboard.redeeming")
                        ) : member && member.totalPoints >= reward.pointThreshold ? (
                          t("dashboard.redeemNow")
                        ) : (
                          t("dashboard.needMorePoints", {
                            count: reward.pointThreshold - (member?.totalPoints ?? 0),
                          })
                        )}
                      </Button>
                    </div>
                  </div>
                </Card>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {isRealParent && member && (
        <RewardDialog
          open={rewardDialogOpen}
          onOpenChange={(open) => {
            setRewardDialogOpen(open);
            if (!open) setSelectedReward(null);
          }}
          onSubmit={(data) => {
            if (selectedReward) {
              updateRewardMutation.mutate({ rewardId: selectedReward.id, data });
            }
          }}
          isSubmitting={updateRewardMutation.isPending}
          familyName={member.familyName}
          reward={selectedReward}
        />
      )}
    </div>
  );
}
