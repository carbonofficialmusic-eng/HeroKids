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
  UserPlus,
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

  // Mutations for reward sharing
  const startSharingMutation = useMutation({
    mutationFn: async (redemptionId: string) => {
      return await apiRequest("POST", `/api/rewards/redemptions/${redemptionId}/share`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/reward-redemptions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/rewards/shared"] });
      toast({
        title: "Teilen gestartet! 🎉",
        description: "Deine Geschwister können jetzt mitmachen.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Fehler",
        description: error.message || "Teilen konnte nicht gestartet werden.",
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
        title: "Du nimmst teil! 🎉",
        description: "Du bist jetzt bei der geteilten Belohnung dabei.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Fehler",
        description: error.message || "Beitreten nicht möglich.",
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
        title: "Teilen abgeschlossen! ✓",
        description: "Die Punkte wurden gleichmäßig aufgeteilt.",
      });
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 }
      });
    },
    onError: (error: any) => {
      toast({
        title: "Fehler",
        description: error.message || "Teilen konnte nicht abgeschlossen werden.",
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
        <div className="text-muted-foreground">Lädt...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <header className="border-b sticky top-0 z-40 bg-background/80 backdrop-blur-md">
        <div className="container mx-auto px-4 py-3 flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild data-testid="button-back">
            <Link href="/kid-dashboard">
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>
          <h1 className="text-2xl font-bold" style={{ fontFamily: "Fredoka, sans-serif" }}>
            Meine Belohnungen
          </h1>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8 max-w-6xl">
        {myRedemptions.length === 0 ? (
          <Card className="p-12 text-center bg-card/80 backdrop-blur-md rounded-2xl">
            <Trophy className="h-20 w-20 mx-auto mb-4 text-muted-foreground opacity-50" />
            <p className="text-xl text-muted-foreground">Noch keine Belohnungen eingelöst</p>
            <p className="text-sm text-muted-foreground mt-2">
              Sammle Punkte und löse deine erste Belohnung ein!
            </p>
            <Button asChild className="mt-6" data-testid="button-go-back">
              <Link href="/kid-dashboard">Zurück zum Dashboard</Link>
            </Button>
          </Card>
        ) : (
          <div className="space-y-6">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-2xl bg-green-500/20">
                  <Trophy className="h-7 w-7 text-green-500" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold" style={{ fontFamily: "Fredoka, sans-serif" }}>
                    Alle meine Belohnungen
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    {myRedemptions.length} {myRedemptions.length === 1 ? "Belohnung" : "Belohnungen"} eingelöst
                  </p>
                </div>
              </div>
            </div>

            <div className="grid gap-3">
              {myRedemptions.map((redemption, index) => {
                const typed = redemption as RedemptionWithDetails;
                const shared = sharedRewards.find(s => s.id === typed.id);
                const participants = shared?.participants || [];
                const isSharing = typed.sharingStatus === "sharing_active";
                const isFinalized = typed.sharingStatus === "sharing_finalized";
                const canShare = typed.status !== "completed" && typed.sharingStatus === "not_shared";
                const canFinalize = isSharing && participants.length > 0;

                return (
                  <motion.div
                    key={redemption.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.05 }}
                  >
                    <Card className="p-4 hover-elevate">
                      <div className="space-y-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-center gap-3 flex-1 min-w-0">
                            <div className={`p-3 rounded-xl flex-shrink-0 ${
                              redemption.status === "completed" 
                                ? "bg-green-500/20" 
                                : "bg-amber-500/20"
                            }`}>
                              {redemption.status === "completed" ? (
                                <CheckCircle2 className="h-6 w-6 text-green-500" />
                              ) : (
                                <Clock className="h-6 w-6 text-amber-500" />
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <h3 className="font-bold text-lg truncate" style={{ fontFamily: "Fredoka, sans-serif" }}>
                                {redemption.rewardTitle || "Belohnung"}
                              </h3>
                              <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground flex-wrap">
                                <Coins className="h-3.5 w-3.5 flex-shrink-0" />
                                <span className="whitespace-nowrap">{redemption.pointsSpent} Punkte</span>
                                <span>•</span>
                                <span className="whitespace-nowrap">{redemption.redeemedAt ? new Date(redemption.redeemedAt).toLocaleDateString("de-DE") : "-"}</span>
                              </div>
                            </div>
                          </div>
                          <div className="flex gap-1.5 flex-shrink-0">
                            <Badge 
                              variant={redemption.status === "completed" ? "default" : "secondary"}
                              className="text-xs whitespace-nowrap"
                              data-testid={`badge-status-${redemption.id}`}
                            >
                              {redemption.status === "completed" ? "✓ Erfüllt" : 
                               redemption.status === "approved" ? "Warte" : 
                               "Ausstehend"}
                            </Badge>
                            {isSharing && (
                              <Badge variant="secondary" className="gap-1 text-xs">
                                <Users className="h-3 w-3" />
                                Wird geteilt
                              </Badge>
                            )}
                            {isFinalized && (
                              <Badge variant="outline" className="gap-1 text-xs">
                                <CheckCircle2 className="h-3 w-3" />
                                Geteilt
                              </Badge>
                            )}
                          </div>
                        </div>

                        {/* Participants */}
                        {participants.length > 0 && (
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-xs text-muted-foreground">Mit:</p>
                            {participants.map(p => (
                              <Avatar key={p.id} className="h-6 w-6 border-2 border-background">
                                <AvatarImage src={getAvatarUrl(p.member.activeSkinId, p.member.avatarUrl)} />
                                <AvatarFallback className="text-xs">
                                  {p.member.displayName[0]}
                                </AvatarFallback>
                              </Avatar>
                            ))}
                          </div>
                        )}

                        {/* Sharing Actions */}
                        {(canShare || canFinalize) && (
                          <div className="pt-2 border-t flex gap-2">
                            {canShare && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="flex-1 gap-1.5 text-xs"
                                onClick={() => startSharingMutation.mutate(typed.id)}
                                disabled={startSharingMutation.isPending}
                                data-testid={`button-share-${typed.id}`}
                              >
                                <Share2 className="h-3.5 w-3.5" />
                                Teilen
                              </Button>
                            )}
                            {canFinalize && (
                              <Button
                                size="sm"
                                variant="default"
                                className="flex-1 gap-1.5 text-xs"
                                onClick={() => finalizeSharingMutation.mutate(typed.id)}
                                disabled={finalizeSharingMutation.isPending}
                                data-testid={`button-finalize-${typed.id}`}
                              >
                                <CheckCircle2 className="h-3.5 w-3.5" />
                                Beenden
                              </Button>
                            )}
                          </div>
                        )}
                      </div>
                    </Card>
                  </motion.div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
