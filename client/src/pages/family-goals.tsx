import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useWebSocket } from "@/hooks/useWebSocket";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { 
  Target, 
  Plus, 
  TrendingUp, 
  Users, 
  Calendar,
  CheckCircle2,
  Coins,
  Trash2,
  ArrowLeft
} from "lucide-react";
import { Link } from "wouter";
import type { FamilyGoal, GoalContribution, FamilyMember } from "@shared/schema";
import { FamilyGoalDialog } from "@/components/family-goal-dialog";

// Extended FamilyGoal type with contributions from API
type FamilyGoalWithContributions = FamilyGoal & {
  contributions: GoalContribution[];
  currentPeriod: string;
};

export default function FamilyGoals() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const { user } = useAuth();
  const [selectedGoal, setSelectedGoal] = useState<FamilyGoal | null>(null);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [goalToDelete, setGoalToDelete] = useState<FamilyGoal | null>(null);

  const { data: member } = useQuery<FamilyMember>({
    queryKey: ["/api/family-members/current"],
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
  });

  // Enable real-time WebSocket updates
  useWebSocket(member?.familyName || null);

  const { data: familyMembers = [] } = useQuery<FamilyMember[]>({
    queryKey: ["/api/family-members"],
    enabled: !!member,
    staleTime: 5 * 60 * 1000,
  });

  const { data: goals = [], isLoading } = useQuery<FamilyGoalWithContributions[]>({
    queryKey: ["/api/family-goals"],
    enabled: !!member,
    staleTime: 5 * 60 * 1000,
  });

  const createGoalMutation = useMutation({
    mutationFn: async (data: any) => {
      return await apiRequest("POST", "/api/family-goals", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/family-goals"] });
      setCreateDialogOpen(false);
      toast({
        title: t("familyGoals.goalCreated"),
        description: t("familyGoals.goalCreatedDesc"),
      });
    },
    onError: (error: any) => {
      toast({
        title: t("errors.error"),
        description: error.message || t("familyGoals.errorCreateGoal"),
        variant: "destructive",
      });
    },
  });

  const contributeMutation = useMutation({
    mutationFn: async (goalId: string) => {
      return await apiRequest("POST", `/api/family-goals/${goalId}/contribute`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/family-goals"] });
      queryClient.invalidateQueries({ queryKey: ["/api/family-members/current"] });
      toast({
        title: t("familyGoals.pointsContributed"),
        description: t("familyGoals.pointsContributedDesc"),
      });
    },
    onError: (error: any) => {
      toast({
        title: t("errors.error"),
        description: error.message || t("familyGoals.errorContribute"),
        variant: "destructive",
      });
    },
  });

  const deleteGoalMutation = useMutation({
    mutationFn: async (goalId: string) => {
      return await apiRequest("DELETE", `/api/family-goals/${goalId}`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/family-goals"] });
      queryClient.invalidateQueries({ queryKey: ["/api/family-members"] });
      queryClient.invalidateQueries({ queryKey: ["/api/family-members/current"] });
      setDeleteDialogOpen(false);
      setGoalToDelete(null);
      toast({
        title: t("familyGoals.goalDeleted"),
        description: t("familyGoals.goalDeletedDesc"),
      });
    },
    onError: (error: any) => {
      toast({
        title: t("errors.error"),
        description: error.message || t("familyGoals.errorDeleteGoal"),
        variant: "destructive",
      });
    },
  });

  const getMemberById = (memberId: string) => {
    return familyMembers.find((m) => m.id === memberId);
  };

  const calculateProgress = (goal: FamilyGoal) => {
    return Math.min((goal.currentPoints / goal.targetPoints) * 100, 100);
  };

  const formatPeriod = (period: string, contributionPeriod: "weekly" | "monthly") => {
    if (contributionPeriod === "weekly") {
      const parts = period.split("-W");
      return t("familyGoals.weekFormat", { week: parts[1], year: parts[0] });
    } else {
      const parts = period.split("-");
      const monthIndex = parseInt(parts[1]) - 1;
      return t("familyGoals.monthFormat", { month: t(`common.monthsShort.${monthIndex}`), year: parts[0] });
    }
  };

  const getCurrentPeriod = (contributionPeriod: "weekly" | "monthly") => {
    const now = new Date();
    if (contributionPeriod === "weekly") {
      const weekNumber = Math.ceil((now.getTime() - new Date(now.getFullYear(), 0, 1).getTime()) / 604800000);
      return `${now.getFullYear()}-W${String(weekNumber).padStart(2, '0')}`;
    } else {
      return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    }
  };

  // Calculate when the next contribution period starts
  const getNextContributionDate = (contributionPeriod: "weekly" | "monthly") => {
    const now = new Date();
    if (contributionPeriod === "weekly") {
      // Next Monday
      const daysUntilMonday = (8 - now.getDay()) % 7 || 7;
      const nextMonday = new Date(now);
      nextMonday.setDate(now.getDate() + daysUntilMonday);
      return nextMonday.toLocaleDateString();
    } else {
      // First day of next month
      const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
      return nextMonth.toLocaleDateString();
    }
  };

  // Check if current member has already contributed to a goal this period
  const hasContributedThisPeriod = (goal: FamilyGoalWithContributions) => {
    if (!member || !goal.contributions) return false;
    return goal.contributions.some(c => c.memberId === member.id);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg">{t("familyGoals.loading")}</div>
      </div>
    );
  }

  const activeGoals = goals.filter((goal) => goal.isActive);
  const completedGoals = goals.filter((goal) => !goal.isActive && goal.completedAt);

  return (
    <div className="min-h-screen p-6" style={{ paddingTop: 'calc(1.5rem + env(safe-area-inset-top))' }}>
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="mb-8">
          <Link href="/dashboard">
            <Button 
              variant="outline" 
              size="sm"
              className="mb-4 bg-background/30 backdrop-blur-sm border-border/40 hover:bg-background/60"
              data-testid="button-back-dashboard"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              {t("familyGoals.backToDashboard")}
            </Button>
          </Link>
          <h1 className="text-4xl font-black font-accent flex items-center gap-3">
            <Target className="h-10 w-10" />
            {t("familyGoals.title")}
          </h1>
          <p className="text-muted-foreground mt-2">
            {t("familyGoals.subtitle")}
          </p>
        </div>

        {member?.role === "parent" && (
          <Card className="p-6 bg-card border-2 border-primary/20">
            <div className="flex items-start gap-4">
              <div className="p-3 bg-primary/10 rounded-lg">
                <Plus className="h-6 w-6 text-primary" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-lg mb-1">{t("familyGoals.createNewGoal")}</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  {t("familyGoals.createNewGoalDesc")}
                </p>
                <Button onClick={() => setCreateDialogOpen(true)} data-testid="button-create-goal">
                  <Plus className="h-4 w-4 mr-2" />
                  {t("familyGoals.createGoal")}
                </Button>
              </div>
            </div>
          </Card>
        )}

        {activeGoals.length === 0 && (
          <Card className="p-12 text-center">
            <Target className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-xl font-semibold mb-2">{t("familyGoals.noGoalsYet")}</h3>
            <p className="text-muted-foreground mb-6">
              {member?.role === "parent" 
                ? t("familyGoals.noGoalsParent")
                : t("familyGoals.noGoalsChild")}
            </p>
          </Card>
        )}

        <div className="space-y-6">
          {activeGoals.map((goal) => {
            const progress = calculateProgress(goal);
            const currentPeriod = goal.currentPeriod || getCurrentPeriod(goal.contributionPeriod);
            const isCompleted = goal.currentPoints >= goal.targetPoints;
            const alreadyContributed = hasContributedThisPeriod(goal);
            const contributors = goal.contributions || [];
            
            return (
              <Card key={goal.id} className="overflow-hidden relative" data-testid={`card-goal-${goal.id}`}>
                <div className="p-6">
                  {/* Delete Button - Fixed top right position */}
                  {member?.role === "parent" && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        setGoalToDelete(goal);
                        setDeleteDialogOpen(true);
                      }}
                      data-testid={`button-delete-goal-${goal.id}`}
                      className="absolute top-4 right-4 z-10"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                  
                  <div className="mb-4 pr-12">
                    <div className="flex items-start gap-3 sm:gap-4">
                      <div className="text-4xl sm:text-5xl flex-shrink-0">{goal.iconEmoji}</div>
                      <div className="flex-1 min-w-0">
                        <h3 className="text-xl sm:text-2xl font-bold mb-1">{goal.title}</h3>
                        {goal.description && (
                          <p className="text-muted-foreground text-sm">{goal.description}</p>
                        )}
                        {isCompleted && (
                          <Badge variant="default" className="gap-1 mt-2">
                            <CheckCircle2 className="h-3 w-3" />
                            {t("familyGoals.achieved")}
                          </Badge>
                        )}
                        <div className="flex flex-wrap items-center gap-2 mt-3">
                          <Badge variant="secondary" className="gap-1 text-xs">
                            <Calendar className="h-3 w-3" />
                            {goal.contributionPeriod === "weekly" ? t("familyGoals.weekly") : t("familyGoals.monthly")}
                          </Badge>
                          <Badge variant="secondary" className="gap-1 text-xs">
                            <Coins className="h-3 w-3" />
                            {t("familyGoals.pointsAmount", { amount: goal.contributionAmount })}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium">{t("familyGoals.progress")}</span>
                        <span className="text-sm font-bold">
                          {t("familyGoals.progressPoints", { current: goal.currentPoints, target: goal.targetPoints })}
                        </span>
                      </div>
                      <Progress value={progress} className="h-3" />
                    </div>

                    {/* Contributors list - shows who has contributed this period */}
                    {contributors.length > 0 && (
                      <div className="flex items-center gap-2 pt-2">
                        <span className="text-sm text-muted-foreground">{t("familyGoals.contributedThisPeriod")}:</span>
                        <div className="flex -space-x-2">
                          {contributors.map((contribution) => {
                            const contributorMember = getMemberById(contribution.memberId);
                            return (
                              <Avatar 
                                key={contribution.id} 
                                className="h-7 w-7 border-2 border-background"
                                title={contributorMember?.displayName}
                              >
                                <AvatarFallback 
                                  className="text-white text-xs font-bold"
                                  style={{ backgroundColor: contributorMember?.color || "#888" }}
                                >
                                  {contributorMember?.displayName?.charAt(0).toUpperCase() || "?"}
                                </AvatarFallback>
                              </Avatar>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-4 border-t">
                      <div className="flex items-center gap-2">
                        <Users className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm text-muted-foreground">
                          {formatPeriod(currentPeriod, goal.contributionPeriod)}
                        </span>
                      </div>
                      
                      {!isCompleted && member && (
                        alreadyContributed ? (
                          <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-muted/50 border border-border/50">
                            <CheckCircle2 className="h-4 w-4 text-green-500" />
                            <span className="text-sm text-muted-foreground">
                              {t("familyGoals.nextContribution", { date: getNextContributionDate(goal.contributionPeriod) })}
                            </span>
                          </div>
                        ) : (
                          <Button
                            onClick={() => contributeMutation.mutate(goal.id)}
                            disabled={contributeMutation.isPending || member.totalPoints < goal.contributionAmount}
                            data-testid={`button-contribute-${goal.id}`}
                          >
                            <TrendingUp className="h-4 w-4 mr-2" />
                            {t("familyGoals.contributePoints", { amount: goal.contributionAmount })}
                          </Button>
                        )
                      )}
                    </div>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>

        {completedGoals.length > 0 && (
          <div className="mt-12">
            <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
              <CheckCircle2 className="h-6 w-6 text-green-500" />
              {t("familyGoals.achievedGoals")}
            </h2>
            <div className="grid gap-4">
              {completedGoals.map((goal) => (
                <Card key={goal.id} className="p-4 opacity-75" data-testid={`card-completed-goal-${goal.id}`}>
                  <div className="flex items-center gap-4">
                    <div className="text-3xl">{goal.iconEmoji}</div>
                    <div className="flex-1">
                      <h4 className="font-semibold">{goal.title}</h4>
                      <p className="text-sm text-muted-foreground">
                        {t("familyGoals.achievedOn", { date: new Date(goal.completedAt!).toLocaleDateString() })}
                      </p>
                    </div>
                    <Badge variant="outline" className="gap-1">
                      <CheckCircle2 className="h-3 w-3" />
                      {t("familyGoals.pointsAmount", { amount: goal.targetPoints })}
                    </Badge>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        )}
      </div>

      {member && (
        <FamilyGoalDialog
          open={createDialogOpen}
          onOpenChange={setCreateDialogOpen}
          onSubmit={(data) => createGoalMutation.mutate(data)}
          isSubmitting={createGoalMutation.isPending}
          familyName={member.familyName}
        />
      )}

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent data-testid="dialog-delete-goal">
          <AlertDialogHeader>
            <AlertDialogTitle>{t("familyGoals.deleteGoalTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {goalToDelete && (
                <>
                  {t("familyGoals.deleteGoalConfirm", { title: goalToDelete.title })}
                  <br /><br />
                  {goalToDelete.currentPoints > 0 && (
                    <span className="text-primary font-semibold">
                      {t("familyGoals.deleteGoalRefund", { points: goalToDelete.currentPoints })}
                    </span>
                  )}
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (goalToDelete) {
                  deleteGoalMutation.mutate(goalToDelete.id);
                }
              }}
              data-testid="button-confirm-delete"
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {t("common.delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
