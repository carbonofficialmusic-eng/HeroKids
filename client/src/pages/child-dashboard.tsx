import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useWebSocket } from "@/hooks/useWebSocket";
import { TaskCard } from "@/components/task-card";
import { TaskCompletionDialog } from "@/components/task-completion-dialog";
import { SuccessCelebration } from "@/components/success-celebration";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Trophy, Star, Gift, Sparkles, Target, Settings, LogOut } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { FamilyMember, Task, Reward } from "@shared/schema";
import { getAvatarUrl } from "@/lib/skins";
import { celebrateTaskCompletion } from "@/lib/confetti";
import { motion } from "framer-motion";

export default function ChildDashboard() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [completionDialogOpen, setCompletionDialogOpen] = useState(false);
  const [taskToComplete, setTaskToComplete] = useState<Task | null>(null);
  const [showCelebration, setShowCelebration] = useState(false);
  const [celebrationData, setCelebrationData] = useState<{
    points: number;
    message: string;
  }>({ points: 0, message: "" });

  const { data: member, isLoading: memberLoading } = useQuery<FamilyMember>({
    queryKey: ["/api/family-members/current"],
    enabled: !!user,
  });

  useWebSocket(member?.familyName || null);

  const { data: tasks = [], isLoading: tasksLoading } = useQuery<Task[]>({
    queryKey: ["/api/tasks"],
    enabled: !!member,
  });

  const { data: familyMembers = [] } = useQuery<FamilyMember[]>({
    queryKey: ["/api/family-members"],
    enabled: !!member,
  });

  const { data: rewards = [] } = useQuery<Reward[]>({
    queryKey: ["/api/rewards"],
    enabled: !!member,
  });

  const completeTaskMutation = useMutation({
    mutationFn: async (taskId: string) => {
      const response = await apiRequest("POST", `/api/tasks/${taskId}/complete`, {});
      return response.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
      queryClient.invalidateQueries({ queryKey: ["/api/family-members/current"] });
      queryClient.invalidateQueries({ queryKey: ["/api/family-members"] });

      celebrateTaskCompletion();

      setCelebrationData({
        points: data.pointsEarned || 0,
        message: data.requiresApproval 
          ? "Awesome! Waiting for approval!" 
          : "Great job! You earned points!",
      });
      setShowCelebration(true);

      toast({
        title: "✅ Task completed!",
        description: data.requiresApproval
          ? "Your parent will review it soon!"
          : `You earned ${data.pointsEarned} points!`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Oops!",
        description: error.message || "Something went wrong. Try again!",
        variant: "destructive",
      });
    },
  });

  const handleTaskClick = (task: Task & { memberHasCompleted?: boolean }) => {
    const isCompleted = task.memberHasCompleted || false;
    const isUnavailable = !!(task.nextAvailableDate && new Date(task.nextAvailableDate) > new Date());

    if (isCompleted || isUnavailable) {
      return;
    }

    if (task.requiresProof) {
      setTaskToComplete(task);
      setCompletionDialogOpen(true);
    } else {
      completeTaskMutation.mutate(task.id);
    }
  };

  if (memberLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
          <p className="mt-4 text-lg text-muted-foreground">Loading your adventure...</p>
        </div>
      </div>
    );
  }

  if (!member) {
    return null;
  }

  const activeTasks = tasks.filter(t => t.status === "active");
  const myLeaderboardRank = familyMembers
    .filter(m => !m.excludeFromLeaderboard)
    .sort((a, b) => b.monthlyPoints - a.monthlyPoints)
    .findIndex(m => m.id === member.id) + 1;

  const availableRewards = rewards.filter(r => r.pointThreshold <= member.totalPoints);
  const nextReward = rewards
    .filter(r => r.pointThreshold > member.totalPoints)
    .sort((a, b) => a.pointThreshold - b.pointThreshold)[0];

  const pointsToNextReward = nextReward ? nextReward.pointThreshold - member.totalPoints : 0;
  const progressToNextReward = nextReward 
    ? ((member.totalPoints / nextReward.pointThreshold) * 100)
    : 100;

  return (
    <div className="min-h-screen bg-gradient-to-b from-primary/5 to-background">
      {showCelebration && (
        <SuccessCelebration
          points={celebrationData.points}
          message={celebrationData.message}
          onComplete={() => setShowCelebration(false)}
        />
      )}

      <div className="container mx-auto p-4 md:p-6 space-y-6">
        <div className="flex items-center justify-between">
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-4"
          >
            <Avatar className="h-16 w-16 border-4 border-primary">
              <AvatarImage src={getAvatarUrl(member.activeSkinId, member.avatarUrl)} />
              <AvatarFallback>{member.displayName[0]}</AvatarFallback>
            </Avatar>
            <div>
              <h1 className="text-3xl md:text-4xl font-black font-accent" data-testid="text-welcome">
                Hi, {member.displayName}!
              </h1>
              <p className="text-lg text-muted-foreground">Ready for your next quest?</p>
            </div>
          </motion.div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" data-testid="button-profile-menu">
                <Avatar className="h-9 w-9">
                  <AvatarImage src={getAvatarUrl(member.activeSkinId, member.avatarUrl)} />
                  <AvatarFallback>{member.displayName[0]}</AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => window.location.href = "/logout"}>
                <LogOut className="mr-2 h-4 w-4" />
                Logout
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.1 }}
          >
            <Card className="bg-gradient-to-br from-yellow-400/20 to-orange-500/20 border-yellow-400/50">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-2xl">
                  <Star className="h-6 w-6 fill-yellow-400 text-yellow-400" />
                  Your Points
                </CardTitle>
                <CardDescription className="text-5xl font-black font-accent mt-2" data-testid="text-total-points">
                  {member.totalPoints}
                </CardDescription>
              </CardHeader>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2 }}
          >
            <Card className="bg-gradient-to-br from-purple-400/20 to-pink-500/20 border-purple-400/50">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-2xl">
                  <Trophy className="h-6 w-6 fill-purple-400 text-purple-400" />
                  Your Rank
                </CardTitle>
                <CardDescription className="text-5xl font-black font-accent mt-2">
                  #{myLeaderboardRank}
                </CardDescription>
              </CardHeader>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.3 }}
          >
            <Card className="bg-gradient-to-br from-blue-400/20 to-cyan-500/20 border-blue-400/50">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-2xl">
                  <Target className="h-6 w-6 text-blue-400" />
                  Tasks Done
                </CardTitle>
                <CardDescription className="text-5xl font-black font-accent mt-2">
                  {member.rewardsRedeemed}
                </CardDescription>
              </CardHeader>
            </Card>
          </motion.div>
        </div>

        {nextReward && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
          >
            <Card className="bg-gradient-to-r from-primary/10 to-primary/5">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-2xl">
                  <Gift className="h-6 w-6" />
                  Next Reward: {nextReward.title}
                </CardTitle>
                <div className="space-y-3 mt-4">
                  <div className="flex justify-between text-sm">
                    <span className="font-medium">You're almost there!</span>
                    <span className="text-muted-foreground">
                      {pointsToNextReward} points to go
                    </span>
                  </div>
                  <Progress value={progressToNextReward} className="h-3" />
                </div>
              </CardHeader>
            </Card>
          </motion.div>
        )}

        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-bold flex items-center gap-2">
              <Sparkles className="h-6 w-6 text-primary" />
              Your Quests
            </h2>
            <Badge variant="secondary" className="text-lg px-4 py-2">
              {activeTasks.length} available
            </Badge>
          </div>

          {tasksLoading ? (
            <div className="text-center py-12">
              <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
              <p className="mt-4 text-muted-foreground">Loading quests...</p>
            </div>
          ) : activeTasks.length === 0 ? (
            <Card className="p-12 text-center">
              <p className="text-xl text-muted-foreground">No quests available right now!</p>
              <p className="text-sm text-muted-foreground mt-2">Check back soon for new adventures!</p>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {activeTasks.map((task, index) => (
                <motion.div
                  key={task.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.5 + index * 0.1 }}
                >
                  <TaskCard
                    task={task}
                    onComplete={() => handleTaskClick(task)}
                    isCompleting={completeTaskMutation.isPending}
                    onClick={() => handleTaskClick(task)}
                  />
                </motion.div>
              ))}
            </div>
          )}
        </div>

        {availableRewards.length > 0 && (
          <div>
            <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
              <Gift className="h-6 w-6 text-primary" />
              Rewards You Can Get!
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {availableRewards.slice(0, 3).map((reward) => (
                <Card key={reward.id} className="hover-elevate">
                  <CardHeader>
                    <div className="text-4xl mb-2">🎁</div>
                    <CardTitle className="text-lg">{reward.title}</CardTitle>
                    <Badge variant="secondary" className="w-fit">
                      {reward.pointThreshold} points
                    </Badge>
                  </CardHeader>
                </Card>
              ))}
            </div>
          </div>
        )}
      </div>

      {taskToComplete && (
        <TaskCompletionDialog
          open={completionDialogOpen}
          onOpenChange={(open) => {
            setCompletionDialogOpen(open);
            if (!open) setTaskToComplete(null);
          }}
          task={taskToComplete}
          onComplete={async (proofUrl?: string) => {
            await completeTaskMutation.mutateAsync(taskToComplete.id);
            setCompletionDialogOpen(false);
            setTaskToComplete(null);
          }}
        />
      )}
    </div>
  );
}
