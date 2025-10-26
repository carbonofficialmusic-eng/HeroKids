import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useWebSocket } from "@/hooks/useWebSocket";
import { FamilySetup } from "@/components/family-setup";
import { PointCounter } from "@/components/point-counter";
import { TaskCard } from "@/components/task-card";
import { Leaderboard } from "@/components/leaderboard";
import { TaskDialog } from "@/components/task-dialog";
import { RewardDialog } from "@/components/reward-dialog";
import { AddMemberDialog } from "@/components/add-member-dialog";
import { SuccessCelebration } from "@/components/success-celebration";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Plus, LogOut, Trophy, Gift, Star, Crown, BarChart3, UserPlus } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";
import type { FamilyMember, Task, Reward } from "@shared/schema";

export default function Dashboard() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [taskDialogOpen, setTaskDialogOpen] = useState(false);
  const [rewardDialogOpen, setRewardDialogOpen] = useState(false);
  const [addMemberDialogOpen, setAddMemberDialogOpen] = useState(false);
  const [celebration, setCelebration] = useState<{
    points: number;
    message: string;
  } | null>(null);

  // Fetch current family member
  const { data: member, isLoading: memberLoading } = useQuery<FamilyMember>({
    queryKey: ["/api/family-members/current"],
    enabled: !!user,
  });

  // WebSocket connection for real-time updates
  useWebSocket(member?.familyName || null);

  // Fetch all family members
  const { data: familyMembers = [] } = useQuery<FamilyMember[]>({
    queryKey: ["/api/family-members"],
    enabled: !!member,
  });

  // Fetch tasks
  const { data: tasks = [] } = useQuery<Task[]>({
    queryKey: ["/api/tasks"],
    enabled: !!member,
  });

  // Fetch rewards
  const { data: rewards = [] } = useQuery<Reward[]>({
    queryKey: ["/api/rewards"],
    enabled: !!member,
  });

  // Fetch family subscription tier
  const { data: familyData } = useQuery<{
    familyName: string;
    subscriptionTier: string;
    memberCount: number;
  }>({
    queryKey: ["/api/families/current"],
    enabled: !!member,
  });

  // Setup family member
  const setupMutation = useMutation({
    mutationFn: async (data: any) => {
      return await apiRequest("POST", "/api/family-members", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/family-members/current"] });
      toast({
        title: "Welcome to HomeHero!",
        description: "Your profile has been created.",
      });
    },
  });

  // Add family member
  const addMemberMutation = useMutation({
    mutationFn: async (data: any) => {
      return await apiRequest("POST", "/api/family-members", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/family-members"] });
      queryClient.invalidateQueries({ queryKey: ["/api/families/current"] });
      setAddMemberDialogOpen(false);
      toast({
        title: "Member added!",
        description: "The new family member can now join and earn points.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to add member",
        description: error.message || "Unable to add member. You may have reached your tier limit.",
        variant: "destructive",
      });
    },
  });

  // Create task
  const createTaskMutation = useMutation({
    mutationFn: async (data: any) => {
      // Transform empty dueDate string to null
      const taskData = {
        ...data,
        dueDate: data.dueDate && data.dueDate.trim() !== "" ? data.dueDate : undefined,
      };
      return await apiRequest("POST", "/api/tasks", taskData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
      setTaskDialogOpen(false);
      toast({
        title: "Task created!",
        description: "The task has been added to the list.",
      });
    },
  });

  // Complete task
  const completeTaskMutation = useMutation({
    mutationFn: async (taskId: string) => {
      return await apiRequest("POST", `/api/tasks/${taskId}/complete`, {});
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
      queryClient.invalidateQueries({ queryKey: ["/api/family-members"] });
      
      if (data.pointsEarned) {
        setCelebration({
          points: data.pointsEarned,
          message: "Awesome job!",
        });
      }
    },
  });

  // Create reward
  const createRewardMutation = useMutation({
    mutationFn: async (data: any) => {
      return await apiRequest("POST", "/api/rewards", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/rewards"] });
      setRewardDialogOpen(false);
      toast({
        title: "Reward created!",
        description: "The reward is now available to earn.",
      });
    },
  });

  // Redeem reward
  const redeemRewardMutation = useMutation({
    mutationFn: async (rewardId: string) => {
      return await apiRequest("POST", `/api/rewards/${rewardId}/redeem`, {});
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/family-members"] });
      queryClient.invalidateQueries({ queryKey: ["/api/family-members/current"] });
      toast({
        title: "Reward redeemed!",
        description: data.message,
      });
      setCelebration({
        points: -data.redemption.pointsSpent,
        message: `You redeemed: ${data.redemption.title || 'reward'}!`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to redeem",
        description: error.message || "Not enough points",
        variant: "destructive",
      });
    },
  });

  if (memberLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto mb-4" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!member) {
    return (
      <FamilySetup
        onComplete={(data) => setupMutation.mutate(data)}
        isSubmitting={setupMutation.isPending}
      />
    );
  }

  const isParent = member.role === "parent";
  const activeTasks = tasks.filter((t) => t.status === "active");
  const activeRewards = rewards.filter((r) => r.isActive);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b sticky top-0 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 z-40">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="h-10 w-10 rounded-lg gradient-celebration flex items-center justify-center">
              <Trophy className="h-6 w-6 text-white" />
            </div>
            <div>
              <div className="text-sm text-muted-foreground">{member.familyName}</div>
              <div className="font-semibold" data-testid="text-user-name">
                {member.displayName}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {familyData && (
              <Link href="/pricing">
                <Badge
                  variant="secondary"
                  className="cursor-pointer hover-elevate"
                  data-testid="badge-current-tier"
                >
                  <Crown className="h-3 w-3 mr-1" />
                  {familyData.subscriptionTier === "free"
                    ? "Free"
                    : familyData.subscriptionTier === "family"
                    ? "Family"
                    : familyData.subscriptionTier === "family_plus"
                    ? "Family+"
                    : "HeroPro"}
                </Badge>
              </Link>
            )}
            <PointCounter
              points={member.weeklyPoints}
              size="compact"
              showAnimation
            />
            <ThemeToggle />
            <Button
              variant="ghost"
              size="icon"
              onClick={() => (window.location.href = "/api/logout")}
              data-testid="button-logout"
              aria-label="Logout"
            >
              <LogOut className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        {isParent ? (
          /* Parent View */
          <div className="grid lg:grid-cols-3 gap-8">
            {/* Main Content */}
            <div className="lg:col-span-2 space-y-6">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <h1 className="text-3xl font-black font-accent" data-testid="text-page-title">
                  Family Tasks
                </h1>
                <div className="flex gap-2 flex-wrap">
                  <Link href="/analytics">
                    <Button variant="outline" data-testid="button-analytics">
                      <BarChart3 className="h-4 w-4 mr-2" />
                      Analytics
                    </Button>
                  </Link>
                  <Button
                    onClick={() => setAddMemberDialogOpen(true)}
                    variant="outline"
                    data-testid="button-add-member"
                  >
                    <UserPlus className="h-4 w-4 mr-2" />
                    Add Member
                  </Button>
                  <Button
                    onClick={() => setRewardDialogOpen(true)}
                    variant="outline"
                    data-testid="button-add-reward"
                  >
                    <Gift className="h-4 w-4 mr-2" />
                    Add Reward
                  </Button>
                  <Button
                    onClick={() => setTaskDialogOpen(true)}
                    data-testid="button-add-task"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add Task
                  </Button>
                </div>
              </div>

              {activeTasks.length === 0 ? (
                <Card className="p-12 text-center">
                  <Star className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
                  <h3 className="text-xl font-bold font-accent mb-2">No tasks yet</h3>
                  <p className="text-muted-foreground mb-6">
                    Create your first task to get started!
                  </p>
                  <Button onClick={() => setTaskDialogOpen(true)} data-testid="button-create-first-task">
                    <Plus className="h-4 w-4 mr-2" />
                    Create Task
                  </Button>
                </Card>
              ) : (
                <div className="grid md:grid-cols-2 gap-4">
                  {activeTasks.map((task) => (
                    <TaskCard key={task.id} task={task} showAssignee />
                  ))}
                </div>
              )}

              {/* Rewards Section */}
              {activeRewards.length > 0 && (
                <div>
                  <h2 className="text-2xl font-bold font-accent mb-4">Active Rewards</h2>
                  <div className="grid md:grid-cols-2 gap-4">
                    {activeRewards.map((reward) => (
                      <Card key={reward.id} className="p-6" data-testid={`card-reward-${reward.id}`}>
                        <div className="flex items-start gap-3">
                          <div className="h-12 w-12 rounded-full gradient-winner flex items-center justify-center shrink-0">
                            <Gift className="h-6 w-6 text-white" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <h3 className="font-bold mb-1" data-testid={`text-reward-title-${reward.id}`}>
                              {reward.title}
                            </h3>
                            {reward.description && (
                              <p className="text-sm text-muted-foreground mb-2">
                                {reward.description}
                              </p>
                            )}
                            <Badge variant="secondary" data-testid={`badge-reward-points-${reward.id}`}>
                              {reward.pointThreshold} points
                            </Badge>
                          </div>
                        </div>
                      </Card>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Sidebar */}
            <div className="space-y-6">
              <Leaderboard members={familyMembers} period="week" />
            </div>
          </div>
        ) : (
          /* Child View */
          <div className="max-w-4xl mx-auto space-y-6">
            <div className="text-center">
              <div className="mb-4">
                <PointCounter points={member.weeklyPoints} size="hero" showAnimation />
              </div>
              <h1 className="text-3xl font-black font-accent mb-2" data-testid="text-child-welcome">
                Hi, {member.displayName}!
              </h1>
              <p className="text-muted-foreground">
                Complete tasks to earn points and climb the leaderboard
              </p>
            </div>

            <Tabs defaultValue="active" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="active" data-testid="tab-active-tasks">Active Tasks</TabsTrigger>
                <TabsTrigger value="leaderboard" data-testid="tab-leaderboard">Leaderboard</TabsTrigger>
              </TabsList>

              <TabsContent value="active" className="space-y-4 mt-6">
                {activeTasks.length === 0 ? (
                  <Card className="p-12 text-center">
                    <Star className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
                    <h3 className="text-xl font-bold font-accent mb-2">No tasks available</h3>
                    <p className="text-muted-foreground">
                      Ask your parents to add some tasks for you!
                    </p>
                  </Card>
                ) : (
                  <div className="grid md:grid-cols-2 gap-4">
                    {activeTasks.map((task) => (
                      <TaskCard
                        key={task.id}
                        task={task}
                        onComplete={(taskId) => completeTaskMutation.mutate(taskId)}
                        isCompleting={completeTaskMutation.isPending}
                        showAssignee={false}
                      />
                    ))}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="leaderboard" className="mt-6">
                <Leaderboard members={familyMembers} period="week" />
              </TabsContent>
            </Tabs>

            {/* Available Rewards */}
            {activeRewards.length > 0 && (
              <div>
                <h2 className="text-2xl font-bold font-accent mb-4">Rewards You Can Earn</h2>
                <div className="grid md:grid-cols-2 gap-4">
                  {activeRewards.map((reward) => (
                    <Card key={reward.id} className="p-6" data-testid={`card-reward-${reward.id}`}>
                      <div className="flex items-start gap-3">
                        <div className="h-12 w-12 rounded-full gradient-winner flex items-center justify-center shrink-0">
                          <Gift className="h-6 w-6 text-white" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-bold mb-1">{reward.title}</h3>
                          {reward.description && (
                            <p className="text-sm text-muted-foreground mb-2">
                              {reward.description}
                            </p>
                          )}
                          <div className="flex items-center gap-2 mb-3">
                            <Badge
                              variant={
                                member.totalPoints >= reward.pointThreshold
                                  ? "default"
                                  : "secondary"
                              }
                            >
                              {reward.pointThreshold} points
                            </Badge>
                            {member.totalPoints >= reward.pointThreshold && (
                              <span className="text-xs font-semibold text-green-600">
                                You can claim this!
                              </span>
                            )}
                          </div>
                          <Button
                            onClick={() => redeemRewardMutation.mutate(reward.id)}
                            disabled={
                              member.totalPoints < reward.pointThreshold ||
                              redeemRewardMutation.isPending
                            }
                            size="sm"
                            className="w-full"
                            data-testid={`button-redeem-${reward.id}`}
                          >
                            {redeemRewardMutation.isPending ? (
                              "Redeeming..."
                            ) : member.totalPoints >= reward.pointThreshold ? (
                              "Redeem Now!"
                            ) : (
                              `Need ${reward.pointThreshold - member.totalPoints} more points`
                            )}
                          </Button>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Dialogs */}
      {isParent && member && (
        <>
          <TaskDialog
            open={taskDialogOpen}
            onOpenChange={setTaskDialogOpen}
            onSubmit={(data) => createTaskMutation.mutate(data)}
            isSubmitting={createTaskMutation.isPending}
            familyName={member.familyName}
            createdBy={member.id}
          />
          <RewardDialog
            open={rewardDialogOpen}
            onOpenChange={setRewardDialogOpen}
            onSubmit={(data) => createRewardMutation.mutate(data)}
            isSubmitting={createRewardMutation.isPending}
            familyName={member.familyName}
          />
          <AddMemberDialog
            open={addMemberDialogOpen}
            onOpenChange={setAddMemberDialogOpen}
            onSubmit={(data) => addMemberMutation.mutate(data)}
            isSubmitting={addMemberMutation.isPending}
            familyName={member.familyName}
          />
        </>
      )}

      {/* Celebration */}
      {celebration && (
        <SuccessCelebration
          points={celebration.points}
          message={celebration.message}
          onComplete={() => setCelebration(null)}
        />
      )}
    </div>
  );
}
