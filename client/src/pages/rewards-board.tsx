import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle2, Clock, Gift, Sparkles, Home } from "lucide-react";
import { format } from "date-fns";
import { useWebSocket } from "@/hooks/useWebSocket";
import { Link } from "wouter";

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
  status: string;
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
    color: string;
  };
};

export default function RewardsBoard() {
  const { toast } = useToast();

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

  // Update redemption status mutation
  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      return await apiRequest(`/api/reward-redemptions/${id}`, "PATCH", { status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/reward-redemptions"] });
      toast({
        title: "Status Updated",
        description: "Reward status has been updated successfully.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update reward status.",
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
            Pending
          </Badge>
        );
      case "approved":
        return (
          <Badge className="gap-1 bg-blue-500 hover:bg-blue-600">
            <Sparkles className="h-3 w-3" />
            Approved
          </Badge>
        );
      case "completed":
        return (
          <Badge className="gap-1 bg-green-500 hover:bg-green-600">
            <CheckCircle2 className="h-3 w-3" />
            Completed
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
            <h1 className="text-3xl font-accent font-bold">Rewards Board</h1>
            <p className="text-muted-foreground">Loading...</p>
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
          <Button variant="ghost" size="sm" className="gap-2" data-testid="button-back-dashboard">
            <Home className="h-4 w-4" />
            Back to Dashboard
          </Button>
        </Link>
        <div className="flex items-center gap-3">
          <Gift className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-3xl font-accent font-bold">Rewards Board</h1>
            <p className="text-muted-foreground">
              {isParent 
                ? "Manage reward redemptions for your family" 
                : "Track your redeemed rewards"}
            </p>
          </div>
        </div>
      </div>

      {/* Redemptions List */}
      {displayRedemptions.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Gift className="h-16 w-16 text-muted-foreground mb-4" />
            <h3 className="text-xl font-semibold mb-2">No Rewards Yet</h3>
            <p className="text-muted-foreground text-center">
              {isParent 
                ? "No rewards have been redeemed by your family yet." 
                : "You haven't redeemed any rewards yet. Keep earning points!"}
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
                      <AvatarImage src={redemption.member.avatarUrl || undefined} />
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
                        Redeemed by {redemption.member.displayName} on{" "}
                        {format(new Date(redemption.redeemedAt), "MMM d, yyyy")}
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

                <div className="flex items-center gap-4 text-sm">
                  <Badge variant="outline" className="gap-1.5">
                    <Sparkles className="h-3 w-3" />
                    {redemption.pointsSpent} points
                  </Badge>
                </div>

                {/* Parent Controls */}
                {isRealParent && redemption.status !== "completed" && (
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
                        Approve
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
                        Mark as Fulfilled
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
                      Reset to Pending
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
