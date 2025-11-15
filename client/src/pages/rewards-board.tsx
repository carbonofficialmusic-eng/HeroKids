import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle2, Clock, Gift, Sparkles, Home, Users, UserPlus, Share2 } from "lucide-react";
import { format } from "date-fns";
import { useWebSocket } from "@/hooks/useWebSocket";
import { Link } from "wouter";
import { getAvatarUrl } from "@/lib/skins";
import { useTranslation } from "react-i18next";

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

type RedemptionWithDetails = {
  id: string;
  rewardId: string;
  memberId: string;
  pointsSpent: number;
  originalPointsSpent: number;
  status: string;
  sharingStatus: "not_shared" | "sharing_active" | "sharing_finalized";
  redeemedAt: string;
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

  // Update redemption status mutation
  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      return await apiRequest("PATCH", `/api/reward-redemptions/${id}`, { status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/reward-redemptions"] });
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
        title: "Teilen gestartet!",
        description: "Andere Familienmitglieder können jetzt beitreten.",
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

  // Join a shared reward
  const joinSharingMutation = useMutation({
    mutationFn: async (redemptionId: string) => {
      return await apiRequest("POST", `/api/rewards/redemptions/${redemptionId}/join`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/rewards/shared"] });
      queryClient.invalidateQueries({ queryKey: ["/api/family-members/current"] });
      toast({
        title: "Erfolgreich beigetreten!",
        description: "Du bist jetzt Teil der geteilten Belohnung.",
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

  // Finalize shared reward
  const finalizeSharingMutation = useMutation({
    mutationFn: async (redemptionId: string) => {
      return await apiRequest("POST", `/api/rewards/redemptions/${redemptionId}/finalize`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/reward-redemptions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/rewards/shared"] });
      queryClient.invalidateQueries({ queryKey: ["/api/family-members/current"] });
      toast({
        title: "Teilen abgeschlossen!",
        description: "Die Punkte wurden gleichmäßig aufgeteilt.",
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
    <div className="space-y-6 p-6">
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

      {/* Shared Rewards Section */}
      {sharedRewards.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Users className="h-6 w-6 text-primary" />
            <h2 className="text-2xl font-accent font-bold">Geteilte Belohnungen</h2>
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
                          <AvatarImage src={getAvatarUrl(shared.member.activeSkinId, shared.member.avatarUrl)} />
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
                            Geteilt von {shared.member.displayName}
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
                        {pointsPerPerson} Punkte pro Person
                      </Badge>
                      <Badge variant="outline" className="gap-1.5">
                        Original: {shared.originalPointsSpent} Punkte
                      </Badge>
                    </div>

                    {/* Participants List */}
                    {shared.participants.length > 0 && (
                      <div className="space-y-2">
                        <p className="text-sm font-medium">Teilnehmer:</p>
                        <div className="flex flex-wrap gap-2">
                          <Badge variant="secondary" className="gap-2">
                            <Avatar className="h-5 w-5">
                              <AvatarImage src={getAvatarUrl(shared.member.activeSkinId, shared.member.avatarUrl)} />
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
                                <AvatarImage src={getAvatarUrl(p.member.activeSkinId, p.member.avatarUrl)} />
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
                    <div className="flex gap-2 pt-2 border-t">
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
                          Teilen beenden
                        </Button>
                      )}
                      {isInitiator && shared.participants.length === 0 && (
                        <p className="text-sm text-muted-foreground">
                          Warte auf Teilnehmer...
                        </p>
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
                          Mitmachen
                        </Button>
                      )}
                      {!isInitiator && hasJoined && (
                        <Badge variant="secondary" className="gap-1">
                          <CheckCircle2 className="h-3 w-3" />
                          Du nimmst teil
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
                      <AvatarImage src={getAvatarUrl(redemption.member.activeSkinId, redemption.member.avatarUrl)} />
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
                      Wird geteilt
                    </Badge>
                  )}
                  {redemption.sharingStatus === "sharing_finalized" && (
                    <Badge variant="secondary" className="gap-1.5">
                      <CheckCircle2 className="h-3 w-3" />
                      Geteilt ({redemption.pointsSpent} Punkte pro Person)
                    </Badge>
                  )}
                </div>

                {/* Sharing Button - Only for own redemptions that are not yet shared */}
                {redemption.memberId === member?.id && redemption.sharingStatus === "not_shared" && (
                  <div className="flex gap-2 pt-2 border-t">
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-2"
                      onClick={() => startSharingMutation.mutate(redemption.id)}
                      disabled={startSharingMutation.isPending}
                      data-testid={`button-share-${redemption.id}`}
                    >
                      <Share2 className="h-4 w-4" />
                      Zum Teilen anbieten
                    </Button>
                  </div>
                )}

                {/* Parent Controls - Only when acting as parent, not when switched to child */}
                {isParent && redemption.status !== "completed" && (
                  <div className="flex gap-2 pt-2 border-t">
                    {redemption.status === "pending" && (
                      <Button
                        size="sm"
                        variant="default"
                        onClick={() => updateStatusMutation.mutate({ 
                          id: redemption.id, 
                          status: "approved" 
                        })}
                        disabled={updateStatusMutation.isPending}
                        data-testid={`button-approve-${redemption.id}`}
                      >
                        {t("rewardsBoard.approve")}
                      </Button>
                    )}
                    {redemption.status === "approved" && (
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
                      onClick={() => updateStatusMutation.mutate({ 
                        id: redemption.id, 
                        status: "pending" 
                      })}
                      disabled={updateStatusMutation.isPending}
                      data-testid={`button-reset-${redemption.id}`}
                    >
                      {t("rewardsBoard.resetPending")}
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
