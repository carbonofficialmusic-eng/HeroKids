import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { ChevronLeft, Trophy, Star, Award, TrendingUp, Flame } from "lucide-react";
import { useLocation } from "wouter";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { FamilyMember } from "@shared/schema";

interface AchievementDefinition {
  id: string;
  familyName: string;
  type: "first_weekly_finisher" | "weekly_leaderboard" | "perfect_week" | "lifetime_milestone" | "task_streak";
  slug: string;
  title: string;
  description: string;
  bonusPoints: number;
  isActive: boolean;
  config: Record<string, any>;
}

export default function Achievements() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  // Fetch current family member
  const { data: member } = useQuery<FamilyMember>({
    queryKey: ["/api/family-members/current"],
    enabled: !!user,
  });

  // Fetch real user's member record (to determine permissions)
  const { data: realMember } = useQuery<FamilyMember>({
    queryKey: ["/api/family-members/real"],
    enabled: !!user,
  });

  // Fetch achievement definitions
  const { data: achievements = [], isLoading } = useQuery<AchievementDefinition[]>({
    queryKey: ["/api/achievements"],
    enabled: !!member,
  });

  // Update achievement mutation
  const updateAchievementMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<AchievementDefinition> }) => {
      return await apiRequest("PATCH", `/api/achievements/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/achievements"] });
      toast({
        title: "Achievement Updated",
        description: "Achievement settings saved successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update achievement",
        variant: "destructive",
      });
    },
  });

  const isParent = realMember?.role === "parent";

  if (!isParent) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardHeader>
            <CardTitle>Access Denied</CardTitle>
            <CardDescription>
              Only parents can configure achievements
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => setLocation("/dashboard")} className="w-full" data-testid="button-back">
              Go Back
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const getAchievementIcon = (type: string) => {
    switch (type) {
      case "first_weekly_finisher":
        return <Star className="h-5 w-5" />;
      case "weekly_leaderboard":
        return <Trophy className="h-5 w-5" />;
      case "perfect_week":
        return <Award className="h-5 w-5" />;
      case "lifetime_milestone":
        return <TrendingUp className="h-5 w-5" />;
      case "task_streak":
        return <Flame className="h-5 w-5" />;
      default:
        return <Trophy className="h-5 w-5" />;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 p-4 md:p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setLocation("/settings")}
            data-testid="button-back"
          >
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <Trophy className="h-8 w-8 text-primary" />
              Achievements
            </h1>
            <p className="text-muted-foreground">
              Configure automatic allowance bonuses for achieving milestones
            </p>
          </div>
        </div>

        {/* Achievements List */}
        {isLoading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          </div>
        ) : (
          <div className="space-y-4">
            {achievements.map((achievement) => (
              <Card key={achievement.id} data-testid={`achievement-card-${achievement.slug}`}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3">
                      <div className="p-2 rounded-lg bg-primary/10 text-primary mt-1">
                        {getAchievementIcon(achievement.type)}
                      </div>
                      <div>
                        <CardTitle className="text-lg">{achievement.title}</CardTitle>
                        <CardDescription className="mt-1">
                          {achievement.description}
                        </CardDescription>
                      </div>
                    </div>
                    <Switch
                      checked={achievement.isActive}
                      onCheckedChange={(checked) => {
                        updateAchievementMutation.mutate({
                          id: achievement.id,
                          data: { isActive: checked },
                        });
                      }}
                      data-testid={`switch-${achievement.slug}-active`}
                    />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-4">
                    <div className="flex-1">
                      <Label htmlFor={`bonus-${achievement.id}`} className="text-sm font-medium">
                        Bonus Points
                      </Label>
                      <div className="flex items-center gap-2 mt-1">
                        <Input
                          id={`bonus-${achievement.id}`}
                          type="number"
                          min="0"
                          step="10"
                          value={achievement.bonusPoints}
                          onChange={(e) => {
                            const value = parseInt(e.target.value) || 0;
                            updateAchievementMutation.mutate({
                              id: achievement.id,
                              data: { bonusPoints: value },
                            });
                          }}
                          disabled={!achievement.isActive}
                          className="w-32"
                          data-testid={`input-${achievement.slug}-bonus`}
                        />
                        <span className="text-sm text-muted-foreground">points</span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}

            {achievements.length === 0 && (
              <Card>
                <CardContent className="py-12 text-center">
                  <Trophy className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">No achievements configured yet</p>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* Info Card */}
        <Card className="bg-muted/50">
          <CardHeader>
            <CardTitle className="text-base">How Achievements Work</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-2">
            <p>
              Achievements are automatically detected and awarded when children reach specific milestones.
              Bonus points are added immediately with a celebration notification.
            </p>
            <ul className="list-disc list-inside space-y-1 mt-2">
              <li>First Weekly Finisher: First to complete all weekly tasks</li>
              <li>Weekly Leaderboard: Top 3 positions at week end</li>
              <li>Perfect Week: No rejected tasks all week</li>
              <li>Lifetime Milestones: Reaching total point thresholds</li>
              <li>Task Streaks: Consecutive days completing tasks</li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
