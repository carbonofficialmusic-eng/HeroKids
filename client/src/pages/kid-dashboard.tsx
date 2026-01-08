import { useState } from "react";
import { Link } from "wouter";
import { motion } from "framer-motion";
import confetti from "canvas-confetti";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/hooks/useAuth";
import { useMidnightRefresh } from "@/hooks/useMidnightRefresh";
import { useWebSocket } from "@/hooks/useWebSocket";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";
import {
  Gift,
  Star,
  Trophy,
  Flame,
  Info,
  IceCream,
  Gamepad2,
  Film,
  Bike,
  ArrowLeft,
  Zap,
  Sparkles,
  Loader2,
  CheckCircle2,
  Crown,
  MessageCircle,
  Lightbulb,
  Target,
  TrendingUp,
  Calendar,
  Coins,
  Users,
  Share2,
  UserPlus,
  X,
} from "lucide-react";
import type { User, FamilyMember, Reward, Task, Family, RewardRedemption, FamilyGoal } from "@shared/schema";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { ProfileMenu } from "@/components/profile-menu";
import { NotificationBell } from "@/components/notification-bell";
import { EditMemberDialog } from "@/components/edit-member-dialog";
import { SwitchMemberDialog } from "@/components/switch-member-dialog";
import { TaskCompletionDialog } from "@/components/task-completion-dialog";
import { RewardRequestDialog } from "@/components/reward-request-dialog";
import { Leaderboard } from "@/components/leaderboard";
import { getAvatarUrl } from "@/lib/skins";
import { hasFeature, type SubscriptionTier } from "@shared/tier-config";
import { TOTAL_HIDDEN_STARS } from "@shared/skin-config";
import logoUrl from "@assets/ChatGPT Image 7. Nov. 2025, 19_19_07_1762539654932.png";

// Extended Task type with metadata from API
interface TaskWithMeta extends Task {
  memberHasCompleted?: boolean;
  remainingSlots?: number | null;
  memberCompletionStatus?: "pending" | "approved" | "rejected" | null;
  sharedMemberCompletions?: Array<{
    memberId: string;
    displayName: string;
    avatarUrl: string | null;
    activeSkinId: string | null;
    useCustomAvatar: boolean;
    color: string;
    hasCompleted: boolean;
  }>;
}

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

// Achievement definition type for special rewards display
interface AchievementDefinition {
  id: string;
  familyName: string;
  type: "first_weekly_finisher" | "weekly_leaderboard" | "perfect_week" | "lifetime_milestone" | "task_streak";
  slug: string;
  title: string;
  description: string;
  bonusPoints: number;
  rewardType: "points" | "custom";
  customReward: string | null;
  isActive: boolean;
  config: Record<string, any>;
}

// Helper: Get generic icon for rewards
function getRewardIcon(title: string) {
  const lowerTitle = title.toLowerCase();
  if (lowerTitle.includes("eis") || lowerTitle.includes("ice")) return IceCream;
  if (lowerTitle.includes("spiel") || lowerTitle.includes("game")) return Gamepad2;
  if (lowerTitle.includes("kino") || lowerTitle.includes("film") || lowerTitle.includes("movie")) return Film;
  if (lowerTitle.includes("fahrrad") || lowerTitle.includes("bike")) return Bike;
  return Gift;
}

// Helper: Get generic icon for tasks
function getTaskIcon(title: string) {
  const lowerTitle = title.toLowerCase();
  if (lowerTitle.includes("lesen") || lowerTitle.includes("read")) return Film;
  if (lowerTitle.includes("spiel") || lowerTitle.includes("play")) return Gamepad2;
  return Star;
}

// Helper: Calculate progress percentage for family goals
function calculateProgress(goal: FamilyGoal): number {
  if (goal.targetPoints === 0) return 0;
  return Math.min((goal.currentPoints / goal.targetPoints) * 100, 100);
}

// Helper: Get current period string (e.g., "2025-W47" for weekly, "2025-11" for monthly)
function getCurrentPeriod(period: "weekly" | "monthly"): string {
  const now = new Date();
  if (period === "weekly") {
    const weekNumber = getWeekNumber(now);
    return `${now.getFullYear()}-W${String(weekNumber).padStart(2, '0')}`;
  } else {
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  }
}

// Helper: Get when the next contribution period starts
function getNextContributionDate(contributionPeriod: "weekly" | "monthly"): string {
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
}

// Helper: Get ISO week number
function getWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}

// Helper: Format period for display (moved inside component to use t())
// Note: This is just a stub that returns the period - the actual implementation
// is inside the component where t() is available

// Get color based on progress percentage
function getProgressColor(percentage: number) {
  if (percentage >= 100) return "hsl(142 76% 36%)";
  if (percentage >= 71) return "hsl(142 69% 58%)";
  if (percentage >= 31) return "hsl(38 92% 50%)";
  return "hsl(0 72% 51%)";
}

// Reward Card Component
function RewardCard({ reward, currentPoints, member }: { reward: Reward; currentPoints: number; member: FamilyMember }) {
  const { t } = useTranslation();
  const [showDetails, setShowDetails] = useState(false);
  const { toast } = useToast();
  const percentage = Math.min((currentPoints / reward.pointThreshold) * 100, 100);
  const remaining = Math.max(reward.pointThreshold - currentPoints, 0);
  const isReady = currentPoints >= reward.pointThreshold;
  const progressColor = getProgressColor(percentage);
  const RewardIcon = getRewardIcon(reward.title);

  const redeemMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/rewards/${reward.id}/redeem`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      if (!response.ok) throw new Error("Failed to redeem reward");
      return response.json();
    },
    onSuccess: () => {
      confetti({
        particleCount: 150,
        spread: 100,
        origin: { y: 0.6 }
      });
      queryClient.invalidateQueries({ queryKey: ["/api/family-members/current"] });
      queryClient.invalidateQueries({ queryKey: ["/api/reward-redemptions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/rewards"] });
      toast({
        title: t("kidDashboard.rewardRequested"),
        description: t("kidDashboard.rewardRequestedDesc", { title: reward.title }),
      });
    },
    onError: () => {
      toast({
        variant: "destructive",
        title: t("kidDashboard.error"),
        description: t("kidDashboard.rewardRequestError"),
      });
    },
  });

  const handleRequest = () => {
    if (isReady && !redeemMutation.isPending) {
      redeemMutation.mutate();
    }
  };

  return (
    <>
      <motion.div
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        transition={{ type: "spring", stiffness: 300, damping: 20 }}
      >
        <Card className={`p-4 transition-all bg-card/80 backdrop-blur-md border-2 rounded-2xl ${
          isReady ? "ring-4 ring-primary shadow-2xl border-primary" : "border-border"
        }`}>
          <div className="flex items-center gap-4">
            <div className={`flex-shrink-0 p-3 rounded-2xl ${
              isReady ? "bg-primary/20" : "bg-primary/10"
            }`}>
              <RewardIcon className="h-12 w-12 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-2">
                <h3 className="font-bold text-xl" style={{ fontFamily: "Fredoka, sans-serif" }}>
                  {reward.title}
                </h3>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setShowDetails(true)}
                  className="h-8 w-8 rounded-full"
                  data-testid={`button-info-reward-${reward.id}`}
                >
                  <Info className="h-5 w-5 text-primary" />
                </Button>
              </div>
              
              <Progress value={percentage} className="h-5 rounded-full mb-1" />
              
              {!isReady && (
                <p className="text-sm text-muted-foreground flex items-center gap-1">
                  <Zap className="h-4 w-4 text-amber-500" />
                  {t("kidDashboard.pointsRemaining", { count: remaining })}
                </p>
              )}
              {isReady && (
                <p className="text-sm font-bold text-green-500 flex items-center gap-1">
                  <Sparkles className="h-4 w-4" />
                  {t("kidDashboard.readyToRequest")}
                </p>
              )}
            </div>
            <div className="flex-shrink-0">
              <Button
                variant={isReady ? "default" : "outline"}
                size="default"
                onClick={handleRequest}
                disabled={!isReady || redeemMutation.isPending}
                className="h-11 px-5 text-base font-bold rounded-2xl"
                data-testid={`button-request-reward-${reward.id}`}
              >
                {redeemMutation.isPending ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : isReady ? (
                  <>
                    <Gift className="h-5 w-5 mr-2" />
                    {t("kidDashboard.now")}
                  </>
                ) : (
                  <>
                    <Trophy className="h-4 w-4 mr-2" />
                    {t("kidDashboard.collect")}
                  </>
                )}
              </Button>
            </div>
          </div>
        </Card>
      </motion.div>

      {/* Details Dialog */}
      <AlertDialog open={showDetails} onOpenChange={setShowDetails}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-3 text-2xl" style={{ fontFamily: "Fredoka, sans-serif" }}>
              <div className="p-3 bg-primary/10 rounded-2xl">
                <RewardIcon className="h-10 w-10 text-primary" />
              </div>
              {reward.title}
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-4 pt-4">
                {reward.description && (
                  <div className="text-base text-foreground">
                    <span className="font-semibold block mb-1">{t("kidDashboard.description")}</span>
                    <span className="block">{reward.description}</span>
                  </div>
                )}
                
                <div className="space-y-2">
                  <div className="flex justify-between items-center p-3 bg-muted/50 rounded-xl">
                    <span className="font-semibold">{t("kidDashboard.pointsNeeded")}</span>
                    <Badge variant="secondary" className="text-lg font-bold px-3 py-1">
                      {reward.pointThreshold}
                    </Badge>
                  </div>
                  
                  <div className="flex justify-between items-center p-3 bg-muted/50 rounded-xl">
                    <span className="font-semibold">{t("kidDashboard.yourProgress")}</span>
                    <span className="font-bold" style={{ color: progressColor }}>
                      {Math.round(percentage)}%
                    </span>
                  </div>
                </div>
                
                {!isReady && (
                  <div className="p-3 bg-amber-50 dark:bg-amber-950/30 rounded-xl border border-amber-200 dark:border-amber-800">
                    <span className="text-base font-bold flex items-center gap-2">
                      <Zap className="h-5 w-5 text-amber-500" />
                      {t("kidDashboard.pointsUntilReward", { count: remaining })}
                    </span>
                  </div>
                )}
                
                {isReady && (
                  <div className="p-3 bg-green-50 dark:bg-green-950/30 rounded-xl border border-green-200 dark:border-green-800">
                    <span className="text-base font-bold flex items-center gap-2 text-green-600 dark:text-green-400">
                      <Sparkles className="h-5 w-5" />
                      {t("kidDashboard.canRequestNow")}
                    </span>
                  </div>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction data-testid="button-close-details">{t("kidDashboard.close")}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

// Task Card Component
function TaskCard({ 
  task, 
  member, 
  onOpenTaskDialog 
}: { 
  task: TaskWithMeta; 
  member: FamilyMember;
  onOpenTaskDialog: (task: TaskWithMeta) => void;
}) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [showDetails, setShowDetails] = useState(false);
  
  // Determine task state based on memberCompletionStatus
  const completionStatus = task.memberCompletionStatus;
  const isPending = completionStatus === "pending";
  const isApproved = completionStatus === "approved";
  const isRejected = completionStatus === "rejected";
  const neverAttempted = completionStatus === null;
  const hasNoSlots = task.remainingSlots !== null && task.remainingSlots !== undefined && task.remainingSlots <= 0;
  const isInactive = task.status !== "active";
  
  // Check if this is a shared task and current member is NOT assigned
  const isSharedTaskNotAssigned = task.isSharedTask && 
    task.sharedMemberIds && 
    task.sharedMemberIds.length > 0 && 
    !task.sharedMemberIds.includes(member.id);
  
  // Get assigned member names for message
  const assignedMemberNames = task.sharedMemberCompletions?.map(m => m.displayName).join(' & ') || '';
  
  // Fallback check: if memberHasCompleted is true but status is null, treat as completed
  // This handles edge cases where status might be missing due to data inconsistency
  const hasCompletedWithoutStatus = task.memberHasCompleted && neverAttempted;
  
  // Task is actionable ONLY if:
  // 1. Never attempted (completionStatus === null AND !memberHasCompleted) OR rejected (can retry)
  // 2. Task status is active
  // 3. Has available slots (or no slot limit)
  // 4. Is assigned to this member (for shared tasks)
  // NOT actionable if: pending, approved, has completion without status, inactive, no slots, or not assigned to shared task
  const isActionable = (neverAttempted && !hasCompletedWithoutStatus || isRejected) && !isInactive && !hasNoSlots && !isSharedTaskNotAssigned;
  
  const TaskIcon = getTaskIcon(task.title);

  const completeMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/tasks/${task.id}/complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: "Unknown error" }));
        throw new Error(errorData.message || "Failed to complete task");
      }
      return response.json();
    },
    onSuccess: () => {
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 }
      });
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
      queryClient.invalidateQueries({ queryKey: ["/api/family-members/current"] });
      toast({
        title: t("kidDashboard.taskCompleted"),
        description: task.requiresApproval 
          ? t("kidDashboard.waitingForApproval")
          : t("kidDashboard.earnedPoints", { count: task.points }),
      });
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: t("kidDashboard.error"),
        description: error.message || t("kidDashboard.taskError"),
      });
    },
  });

  const handleComplete = () => {
    if (!isActionable || completeMutation.isPending) return;
    
    // If task requires photo proof, open dialog for photo upload
    if (task.requiresProof) {
      onOpenTaskDialog(task);
    } else {
      // No photo needed, complete directly
      completeMutation.mutate();
    }
  };
  
  // Display message for different states
  let statusMessage = "";
  let statusColor = "";
  
  if (isPending) {
    statusMessage = t("kidDashboard.waitingApproval");
    statusColor = "text-amber-600 dark:text-amber-400";
  } else if (isApproved) {
    statusMessage = t("kidDashboard.completedApproved");
    statusColor = "text-green-600 dark:text-green-400";
  } else if (isRejected) {
    statusMessage = t("kidDashboard.tryAgain");
    statusColor = "text-blue-600 dark:text-blue-400";
  } else if (hasNoSlots) {
    statusMessage = t("kidDashboard.allSlotsTaken");
    statusColor = "text-amber-600 dark:text-amber-400";
  } else if (isInactive) {
    statusMessage = t("kidDashboard.notAvailable");
    statusColor = "text-muted-foreground";
  } else if (isSharedTaskNotAssigned) {
    statusMessage = t("tasks.sharedTaskNotAssigned", { members: assignedMemberNames });
    statusColor = "text-muted-foreground";
  }

  return (
    <motion.div
      whileHover={{ scale: isActionable ? 1.05 : 1, rotate: isActionable ? 2 : 0 }}
      whileTap={{ scale: isActionable ? 0.95 : 1 }}
    >
      <Card
        className={`p-4 transition-all bg-card/80 backdrop-blur-md border-2 rounded-2xl ${
          isActionable && !isRejected ? "cursor-pointer border-border hover:border-primary" : 
          isActionable && isRejected ? "cursor-pointer border-blue-500 hover:border-blue-600" :
          isApproved ? "opacity-70 border-green-500" :
          isPending ? "opacity-60 border-amber-500" :
          hasNoSlots ? "opacity-50 border-amber-500" :
          isSharedTaskNotAssigned ? "opacity-50 border-muted" :
          "opacity-70 border-muted"
        }`}
        data-testid={`task-card-${task.id}`}
        onClick={isActionable ? handleComplete : undefined}
      >
        <div className="text-center space-y-3">
          <div className={`flex justify-center p-3 rounded-2xl mx-auto w-fit ${
            isApproved ? "bg-green-500/20" : 
            isPending ? "bg-amber-500/20" :
            isRejected ? "bg-blue-500/20" :
            hasNoSlots ? "bg-amber-500/20" :
            "bg-primary/10"
          }`}>
            {completeMutation.isPending ? (
              <Loader2 className="h-12 w-12 text-primary animate-spin" />
            ) : isApproved ? (
              <CheckCircle2 className="h-12 w-12 text-green-500" />
            ) : isPending ? (
              <CheckCircle2 className="h-12 w-12 text-amber-500" />
            ) : (
              <TaskIcon className="h-12 w-12 text-primary" />
            )}
          </div>
          <div className="flex items-center justify-center gap-2">
            <h3 className="font-bold text-lg" style={{ fontFamily: "Fredoka, sans-serif" }}>
              {task.title}
            </h3>
            {/* Info Button - only show if description exists */}
            {task.description && (
              <Button
                variant="ghost"
                size="icon"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowDetails(true);
                }}
                className="h-7 w-7 rounded-full shrink-0"
                data-testid={`button-info-task-${task.id}`}
              >
                <Info className="h-4 w-4 text-primary" />
              </Button>
            )}
            {/* Multi-Completion Counter Badge */}
            {task.maxCompletions !== null && task.maxCompletions !== undefined && (
              <Badge 
                variant="secondary" 
                className="shrink-0 text-xs font-bold"
                data-testid={`badge-multi-completion-${task.id}`}
              >
                {task.completionCount || 0}/{task.maxCompletions}
              </Badge>
            )}
          </div>
          
          {statusMessage ? (
            <div className="space-y-1">
              <Badge 
                variant="secondary"
                className={`text-sm px-3 py-1 rounded-xl ${statusColor}`}
              >
                {statusMessage}
              </Badge>
              <p className="text-sm font-bold text-muted-foreground">
                {task.points} {t("kidDashboard.points")}
              </p>
            </div>
          ) : (
            <Badge 
              variant="default" 
              className="text-base px-3 py-1 font-bold rounded-xl"
            >
              {t("kidDashboard.plusPoints", { count: task.points })}
            </Badge>
          )}
          
          {hasNoSlots && task.remainingSlots === 0 && (
            <p className="text-xs text-amber-600 dark:text-amber-400 font-medium">
              {t("kidDashboard.noSlotsLeft")}
            </p>
          )}
        </div>
      </Card>

      {/* Task Details Dialog */}
      <AlertDialog open={showDetails} onOpenChange={setShowDetails}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-3 text-2xl" style={{ fontFamily: "Fredoka, sans-serif" }}>
              <div className="p-3 bg-primary/10 rounded-2xl">
                <TaskIcon className="h-10 w-10 text-primary" />
              </div>
              {task.title}
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-4 pt-4">
                {task.description && (
                  <div className="text-base text-foreground">
                    <span className="font-semibold block mb-1">{t("kidDashboard.description")}</span>
                    <span className="whitespace-pre-wrap block">{task.description}</span>
                  </div>
                )}
                
                <div className="space-y-2">
                  <div className="flex justify-between items-center p-3 bg-muted/50 rounded-xl">
                    <span className="font-semibold">{t("kidDashboard.pointsToEarn")}</span>
                    <Badge variant="secondary" className="text-lg font-bold px-3 py-1">
                      +{task.points}
                    </Badge>
                  </div>
                  
                  {task.requiresApproval && (
                    <div className="flex justify-between items-center p-3 bg-amber-50 dark:bg-amber-950/30 rounded-xl border border-amber-200 dark:border-amber-800">
                      <span className="font-semibold">{t("kidDashboard.needsApproval")}</span>
                      <CheckCircle2 className="h-5 w-5 text-amber-500" />
                    </div>
                  )}
                  
                  {task.requiresProof && (
                    <div className="flex justify-between items-center p-3 bg-blue-50 dark:bg-blue-950/30 rounded-xl border border-blue-200 dark:border-blue-800">
                      <span className="font-semibold">{t("kidDashboard.needsPhoto")}</span>
                      <Lightbulb className="h-5 w-5 text-blue-500" />
                    </div>
                  )}
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction data-testid="button-close-task-details">{t("kidDashboard.close")}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </motion.div>
  );
}

export default function KidDashboard() {
  const { t } = useTranslation();
  const { toast } = useToast();
  
  // Helper: Format period for display with translations
  const formatPeriod = (period: string, type: "weekly" | "monthly"): string => {
    if (type === "weekly") {
      const match = period.match(/(\d{4})-W(\d{2})/);
      if (match) {
        return t("kidDashboard.weekFormat", { week: match[2], year: match[1] });
      }
    } else {
      const match = period.match(/(\d{4})-(\d{2})/);
      if (match) {
        const monthKeys = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
        const monthKey = monthKeys[parseInt(match[2]) - 1];
        const monthName = t(`kidDashboard.monthNames.${monthKey}`);
        return `${monthName} ${match[1]}`;
      }
    }
    return period;
  };
  const { user } = useAuth();
  const [editMemberDialogOpen, setEditMemberDialogOpen] = useState(false);
  const [switchMemberDialogOpen, setSwitchMemberDialogOpen] = useState(false);
  const [memberToEdit, setMemberToEdit] = useState<FamilyMember | null>(null);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [taskDialogOpen, setTaskDialogOpen] = useState(false);
  const [requestRewardDialogOpen, setRequestRewardDialogOpen] = useState(false);
  const [leaderboardPeriod, setLeaderboardPeriod] = useState<"week" | "month">("week");

  // Auto-refresh tasks at midnight when daily tasks reset
  useMidnightRefresh();

  // Family Goals mutations
  const contributeMutation = useMutation({
    mutationFn: async (goalId: string) => {
      return await apiRequest("POST", `/api/family-goals/${goalId}/contribute`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/family-goals"] });
      queryClient.invalidateQueries({ queryKey: ["/api/family-members/current"] });
      toast({
        title: t("kidDashboard.pointsContributed"),
        description: t("kidDashboard.contributionAdded"),
      });
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 }
      });
    },
    onError: (error: any) => {
      toast({
        title: t("kidDashboard.error"),
        description: error.message || t("kidDashboard.contributionError"),
        variant: "destructive",
      });
    },
  });

  // Create reward request (children can propose new rewards)
  const createRewardRequestMutation = useMutation({
    mutationFn: async (data: any) => {
      return await apiRequest("POST", "/api/reward-requests", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/reward-requests"] });
      setRequestRewardDialogOpen(false);
      toast({
        title: t("kidDashboard.wishSent"),
        description: t("kidDashboard.wishSentDesc"),
      });
    },
    onError: (error: any) => {
      toast({
        title: t("kidDashboard.error"),
        description: error.message || t("kidDashboard.wishError"),
        variant: "destructive",
      });
    },
  });

  // Reward Sharing Mutations
  const startSharingMutation = useMutation({
    mutationFn: async (redemptionId: string) => {
      return await apiRequest("POST", `/api/rewards/redemptions/${redemptionId}/share`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/rewards/shared"] });
      queryClient.invalidateQueries({ queryKey: ["/api/reward-redemptions"] });
      toast({
        title: t("kidDashboard.sharingStarted"),
        description: t("kidDashboard.othersCanJoin"),
      });
    },
    onError: (error: any) => {
      toast({
        title: t("kidDashboard.error"),
        description: error.message || t("kidDashboard.sharingStartError"),
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
        title: t("kidDashboard.joinedSuccess"),
        description: t("kidDashboard.nowPartOfReward"),
      });
    },
    onError: (error: any) => {
      toast({
        title: t("kidDashboard.error"),
        description: error.message || t("kidDashboard.joinError"),
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
        title: t("kidDashboard.sharingCompleted"),
        description: t("kidDashboard.pointsSplitEvenly"),
      });
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 }
      });
    },
    onError: (error: any) => {
      toast({
        title: t("kidDashboard.error"),
        description: error.message || t("kidDashboard.sharingCompleteError"),
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
        title: t("kidDashboard.sharingCancelled"),
        description: t("kidDashboard.canRedeemSolo"),
      });
    },
    onError: (error: any) => {
      toast({
        title: t("kidDashboard.error"),
        description: error.message || t("kidDashboard.sharingCancelError"),
        variant: "destructive",
      });
    },
  });

  // Load user and member data - support both Replit Auth and Device Sessions
  const { data: authUser, isLoading: userLoading } = useQuery<User>({
    queryKey: ["/api/auth/user"],
    retry: false,
  });

  // Check for device session (for linked child devices)
  // This response now includes full member data including skin fields
  const { data: deviceSession, isLoading: deviceSessionLoading } = useQuery<{
    authenticated: boolean;
    memberId?: string;
    memberName?: string;
    familyName?: string;
    role?: string;
    avatarUrl?: string | null;
    color?: string;
    activeSkinId?: string | null;
    discoveredSkinIds?: string[];
    useCustomAvatar?: boolean;
    totalPoints?: number;
    totalEarned?: number;
    weeklyPoints?: number;
    monthlyPoints?: number;
    starsFound?: number;
  }>({
    queryKey: ["/api/device-link/session"],
    retry: false,
  });

  // User is authenticated via either Replit Auth OR Device Session
  const isDeviceAuthenticated = deviceSession?.authenticated === true;
  const hasAnyAuth = !!authUser || isDeviceAuthenticated;

  // For Replit Auth users, fetch member from API
  // For Device Session users, we already have member data in deviceSession
  const { data: memberFromApi, isLoading: memberApiLoading } = useQuery<FamilyMember>({
    queryKey: ["/api/family-members/current"],
    enabled: !!authUser, // Only fetch via API for Replit Auth users
  });

  // Build member object from device session if available
  const memberFromDeviceSession: FamilyMember | undefined = isDeviceAuthenticated && deviceSession?.memberId ? {
    id: deviceSession.memberId,
    familyName: deviceSession.familyName || "",
    displayName: deviceSession.memberName || "",
    role: (deviceSession.role as "parent" | "child") || "child",
    avatarUrl: deviceSession.avatarUrl || null,
    color: deviceSession.color || "#3B82F6",
    activeSkinId: deviceSession.activeSkinId || null,
    totalPoints: deviceSession.totalPoints || 0,
    totalEarned: deviceSession.totalEarned || 0,
    weeklyPoints: deviceSession.weeklyPoints || 0,
    monthlyPoints: deviceSession.monthlyPoints || 0,
    userId: null,
    pinCode: null,
    rewardsRedeemed: 0,
    unlockedSkins: [],
    discoveredSkinIds: deviceSession.discoveredSkinIds || [],
    useCustomAvatar: deviceSession.useCustomAvatar || false,
    useThemeBackground: true,
    avatarHistory: [],
    lastReadChatAt: null,
    excludeFromLeaderboard: false,
    starsFound: deviceSession.starsFound || 0,
    earnedLegacySkinIds: [],
    createdAt: null,
    updatedAt: null,
  } : undefined;

  // Use API member for Replit Auth, device session member for Device Link
  const member = memberFromApi || memberFromDeviceSession;
  const memberLoading = authUser ? memberApiLoading : deviceSessionLoading;

  // WebSocket connection for real-time updates
  useWebSocket(member?.familyName || null);

  const { data: realMember } = useQuery<FamilyMember>({
    queryKey: ["/api/family-members/real"],
    enabled: hasAnyAuth,
  });

  const { data: familyData } = useQuery<Family>({
    queryKey: ["/api/families/current"],
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

  const { data: tasks = [] } = useQuery<TaskWithMeta[]>({
    queryKey: ["/api/tasks"],
    enabled: !!member,
  });

  // Fetch family goals
  const { data: goals = [] } = useQuery<FamilyGoal[]>({
    queryKey: ["/api/family-goals"],
    enabled: !!member,
  });

  // Fetch reward redemptions (child's redeemed rewards)
  const { data: redemptions = [] } = useQuery<(RewardRedemption & { rewardTitle?: string })[]>({
    queryKey: ["/api/reward-redemptions"],
    enabled: !!member,
  });

  // Fetch active shared rewards from other family members
  const { data: sharedRewards = [] } = useQuery<SharedReward[]>({
    queryKey: ["/api/rewards/shared"],
    enabled: !!member,
  });

  // Fetch unread chat message count
  const { data: unreadChatData } = useQuery<{ count: number }>({
    queryKey: ["/api/chat/unread-count"],
    enabled: !!member && hasFeature(familyData?.subscriptionTier as SubscriptionTier || "free", "familyChat"),
    refetchInterval: 5000,
  });

  // Fetch achievement definitions for special rewards display
  const { data: achievements = [] } = useQuery<AchievementDefinition[]>({
    queryKey: ["/api/achievements"],
    enabled: !!member,
  });

  // Filter for all active achievements
  const specialRewards = achievements
    .filter(a => a.isActive)
    .sort((a, b) => {
      // Sort by type priority, then by slug for stable ordering
      const order: Record<string, number> = {
        "perfect_week": 0,
        "weekly_leaderboard": 1,
        "first_weekly_finisher": 2,
        "lifetime_milestone": 3,
        "task_streak": 4,
      };
      const typeDiff = (order[a.type] ?? 99) - (order[b.type] ?? 99);
      if (typeDiff !== 0) return typeDiff;
      return a.slug.localeCompare(b.slug);
    });

  // Filter to show only this child's redemptions, sorted by newest first
  const myRedemptions = member 
    ? redemptions
        .filter(r => r.memberId === member.id)
        .sort((a, b) => {
          const dateA = a.redeemedAt ? new Date(a.redeemedAt).getTime() : 0;
          const dateB = b.redeemedAt ? new Date(b.redeemedAt).getTime() : 0;
          return dateB - dateA;
        })
    : [];

  // Edit member mutation
  const editMemberMutation = useMutation({
    mutationFn: async ({ memberId, data }: { memberId: string; data: any }) => {
      return await apiRequest("PUT", `/api/family-members/${memberId}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/family-members"] });
      queryClient.invalidateQueries({ queryKey: ["/api/family-members/current"] });
      setEditMemberDialogOpen(false);
      setMemberToEdit(null);
      toast({
        title: t("toast.profileUpdated"),
        description: t("toast.profileUpdatedDesc"),
      });
    },
    onError: (error: any) => {
      toast({
        title: t("toast.failedUpdateProfile"),
        description: error.message || t("toast.unableUpdateProfile"),
        variant: "destructive",
      });
    },
  });

  // Switch member mutation (for parents to switch between profiles)
  const switchMemberMutation = useMutation({
    mutationFn: async (params: { memberId: string | null; pinCode?: string }) => {
      const response = await apiRequest("POST", "/api/family-members/switch", params);
      return await response.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/family-members/current"] });
      queryClient.invalidateQueries({ queryKey: ["/api/family-members"] });
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
      queryClient.invalidateQueries({ queryKey: ["/api/skins"] });
      queryClient.invalidateQueries({ queryKey: ["/api/rewards"] });
      setSwitchMemberDialogOpen(false);
      
      // Navigate based on the new member's role
      if (data?.member?.role === "child") {
        window.location.href = "/kid-dashboard";
      } else if (data?.member?.role === "parent") {
        window.location.href = "/dashboard";
      }
    },
    onError: (error: any) => {
      toast({
        title: t("toast.failedSwitchMember"),
        description: error.message || t("toast.unableSwitchMember"),
        variant: "destructive",
      });
    },
  });

  // Complete task mutation (for task dialog)
  const completeTaskMutation = useMutation({
    mutationFn: async ({ taskId, proofPhotoUrl }: { taskId: string; proofPhotoUrl?: string }) => {
      const response = await fetch(`/api/tasks/${taskId}/complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(proofPhotoUrl ? { proofPhotoUrl } : {}),
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: "Unknown error" }));
        throw new Error(errorData.message || "Failed to complete task");
      }
      return response.json();
    },
    onSuccess: () => {
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 }
      });
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
      queryClient.invalidateQueries({ queryKey: ["/api/family-members/current"] });
      setTaskDialogOpen(false);
      setSelectedTask(null);
      toast({
        title: t("kidDashboard.taskCompleted"),
        description: selectedTask?.requiresApproval 
          ? t("kidDashboard.waitingForApproval")
          : t("kidDashboard.earnedPoints", { count: selectedTask?.points || 0 }),
      });
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: t("kidDashboard.error"),
        description: error.message || t("kidDashboard.taskError"),
      });
    },
  });

  // Handler for completing a task from dialog
  const handleTaskComplete = (taskId: string, proofPhotoUrl?: string) => {
    completeTaskMutation.mutate({ taskId, proofPhotoUrl });
  };

  // Handler for opening task dialog
  const handleOpenTaskDialog = (task: TaskWithMeta) => {
    setSelectedTask(task);
    setTaskDialogOpen(true);
  };

  // Show loading state
  const isLoading = userLoading || deviceSessionLoading || memberLoading;
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // If not logged in via either method
  if (!hasAnyAuth || !member) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Card className="p-8 text-center">
          <p className="text-lg mb-4">{t("kidDashboard.loginPrompt")}</p>
          <Button asChild>
            <Link href="/dashboard">{t("kidDashboard.goToDashboard")}</Link>
          </Button>
        </Card>
      </div>
    );
  }

  const currentPoints = member.totalPoints || 0;
  const streak = 0; // TODO: Implement streak tracking
  const isParent = member?.role === "parent";
  const isRealParent = realMember?.role === "parent";

  // Filter active rewards and sort by proximity
  const activeRewards = rewards
    .filter(r => r.isActive)
    .sort((a, b) => {
      const aReady = currentPoints >= a.pointThreshold;
      const bReady = currentPoints >= b.pointThreshold;
      if (aReady && !bReady) return -1;
      if (!aReady && bReady) return 1;
      return Math.abs(currentPoints - a.pointThreshold) - Math.abs(currentPoints - b.pointThreshold);
    });

  // Filter tasks: different logic for multi-completion vs normal tasks
  const myTasks = tasks.filter(t => {
    // Multi-Completion Tasks
    if (t.maxCompletions !== null) {
      // Recurring Multi-Tasks: Always show (grayed out when all slots filled)
      if (t.recurrence !== "none") {
        return true;
      }
      // One-time Multi-Tasks: Hide when ALL slots are filled (remainingSlots <= 0)
      return t.remainingSlots === null || t.remainingSlots === undefined || t.remainingSlots > 0;
    }
    // Normal one-time tasks: Hide when member (or family) has completed
    return !t.memberHasCompleted || t.recurrence !== "none";
  });

  return (
    <div className="min-h-screen pb-20">
      {/* Header - Like Dashboard */}
      <header className="border-b sticky top-0 backdrop-blur-md z-40 bg-background/80">
        <div className="container mx-auto max-w-7xl px-4 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <Avatar className="h-10 w-10 flex-shrink-0" style={{ borderWidth: "3px", borderStyle: "solid", borderColor: member.color }}>
              <AvatarImage src={getAvatarUrl(member.activeSkinId, member.avatarUrl, member.useCustomAvatar, member.updatedAt)} />
              <AvatarFallback style={{ backgroundColor: member.color }} className="text-white">
                {member.displayName[0]}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <div className="text-sm text-muted-foreground truncate">{member.familyName}</div>
              <div className="font-semibold truncate" data-testid="text-user-name">
                {member.displayName}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3 flex-shrink-0">
            {familyData && (
              <Link href="/pricing">
                <Badge
                  variant="secondary"
                  className="cursor-pointer hover-elevate"
                  data-testid="badge-current-tier"
                >
                  <Crown className="h-3 w-3 mr-1" />
                  {familyData.subscriptionTier === "free"
                    ? t("subscription.free")
                    : familyData.subscriptionTier === "family"
                    ? t("subscription.family")
                    : familyData.subscriptionTier === "family_plus"
                    ? t("subscription.familyPlus")
                    : t("subscription.familyHero")}
                </Badge>
              </Link>
            )}
            <NotificationBell familyLanguage="en" memberRole={member.role} />
            <ProfileMenu
              member={member}
              isParent={isParent}
              isRealParent={isRealParent}
              familyMemberCount={familyMembers.length}
              onEditProfile={() => {
                setMemberToEdit(member);
                setEditMemberDialogOpen(true);
              }}
              onSwitchMember={() => setSwitchMemberDialogOpen(true)}
            />
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 max-w-6xl space-y-8 pt-6 pb-[calc(8rem+env(safe-area-inset-bottom))]">
        {/* HeroKids Logo */}
        <div className="flex justify-center">
          <motion.img 
            src={logoUrl} 
            alt="HeroKids Logo" 
            className="h-32 w-auto object-contain"
            data-testid="img-kid-dashboard-logo"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6, type: "spring", stiffness: 100 }}
          />
        </div>

        {/* Hero Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <Card className="p-7 bg-gradient-to-br from-primary/10 via-card/80 to-purple-500/10 backdrop-blur-md border-2 border-primary/30 rounded-3xl shadow-xl">
            <div className="flex items-center justify-between flex-wrap gap-5">
              <div className="flex items-center gap-5">
                <motion.div
                  whileHover={{ scale: 1.1, rotate: 5 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <Avatar className="h-20 w-20 border-4 border-primary shadow-lg">
                    <AvatarImage src={getAvatarUrl(member.activeSkinId, member.avatarUrl, member.useCustomAvatar, member.updatedAt)} />
                    <AvatarFallback style={{ backgroundColor: member.color }} className="text-3xl font-bold text-white">
                      {member.displayName[0]}
                    </AvatarFallback>
                  </Avatar>
                </motion.div>
                <div className="flex-1">
                  <h1 className="text-4xl font-bold mb-1" style={{ fontFamily: "Fredoka, sans-serif" }}>
                    {member.displayName}
                  </h1>
                  {streak > 0 && (
                    <div className="flex items-center gap-3 mt-2">
                      <motion.div
                        animate={{ scale: [1, 1.2, 1] }}
                        transition={{ repeat: Infinity, duration: 1.5 }}
                      >
                        <Flame className="h-7 w-7 text-orange-500" />
                      </motion.div>
                      <span className="text-lg font-bold">{t("kidDashboard.dayStreak", { count: streak })}</span>
                    </div>
                  )}
                </div>
                {/* Star Counter */}
                <div className="flex items-center gap-2 bg-gradient-to-r from-yellow-500/20 to-orange-500/20 px-4 py-2 rounded-xl border border-yellow-500/30">
                  <motion.div
                    animate={{ rotate: [0, 10, -10, 0], scale: [1, 1.1, 1] }}
                    transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
                  >
                    <Star className="h-6 w-6 fill-yellow-400 text-yellow-400" />
                  </motion.div>
                  <span className="text-xl font-bold" style={{ fontFamily: "Fredoka, sans-serif" }} data-testid="text-stars-found">
                    {member.starsFound || 0}/{TOTAL_HIDDEN_STARS}
                  </span>
                </div>
              </div>
              <div className="bg-card/80 backdrop-blur-sm p-5 rounded-2xl border-2 border-primary/30 min-w-[260px]">
                <p className="text-sm text-muted-foreground mb-3 font-medium text-center">{t("kidDashboard.yourPoints")}</p>
                <div className="space-y-3">
                  {/* Total Earned - Prominent Display */}
                  <div className="text-center pb-3 border-b border-border">
                    <p className="text-xs text-muted-foreground mb-1">{t("kidDashboard.totalEarned")}</p>
                    <motion.div
                      className="text-4xl font-bold bg-gradient-to-r from-amber-500 to-orange-500 bg-clip-text text-transparent"
                      animate={{ scale: [1, 1.05, 1] }}
                      transition={{ repeat: Infinity, duration: 2 }}
                      style={{ fontFamily: "Fredoka, sans-serif" }}
                      data-testid="text-total-earned"
                    >
                      {member.totalEarned.toLocaleString()}
                    </motion.div>
                  </div>

                  {/* Available Points */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Coins className="h-4 w-4 text-green-500" />
                      <span className="font-semibold text-sm">{t("kidDashboard.available")}</span>
                    </div>
                    <span className="text-xl font-bold text-green-600 dark:text-green-400" data-testid="text-total-points">
                      {member.totalPoints.toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </Card>
        </motion.div>

        {/* Special Achievement Rewards Section */}
        {specialRewards.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="space-y-4"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-gradient-to-br from-purple-500 to-pink-500 rounded-2xl">
                  <Trophy className="h-7 w-7 text-white" />
                </div>
                <h2 className="text-3xl font-bold" style={{ fontFamily: "Fredoka, sans-serif" }}>
                  {t("kidDashboard.specialPrizes")}
                </h2>
                <Sparkles className="h-5 w-5 text-purple-500 animate-pulse" />
              </div>
              {specialRewards.length > 2 && (
                <Button variant="ghost" size="sm" asChild data-testid="button-view-all-achievements">
                  <Link href="/my-achievements">
                    {t("kidDashboard.viewAll")}
                  </Link>
                </Button>
              )}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {specialRewards.slice(0, 2).map((achievement, index) => (
                <motion.div
                  key={achievement.id}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: index * 0.1 }}
                >
                  <Card className="p-5 bg-gradient-to-br from-purple-100/90 to-pink-100/90 dark:from-purple-900/40 dark:to-pink-900/40 backdrop-blur-md border-2 border-purple-400/40 dark:border-purple-500/30 rounded-2xl shadow-lg">
                    <div className="flex items-center gap-4">
                      <div className="p-3 rounded-xl bg-purple-500/30 dark:bg-purple-500/40 flex-shrink-0">
                        <Gift className="h-7 w-7 text-purple-600 dark:text-purple-300" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-bold text-lg text-purple-900 dark:text-purple-100 truncate" style={{ fontFamily: "Fredoka, sans-serif" }}>
                          {t(`achievements.title_${achievement.slug}`)}
                        </h3>
                        <p className="text-base text-purple-700 dark:text-purple-300 font-semibold truncate" style={{ fontFamily: "Fredoka, sans-serif" }}>
                          {achievement.rewardType === "custom" && achievement.customReward
                            ? achievement.customReward
                            : `+${achievement.bonusPoints} ${t("points")}`}
                        </p>
                      </div>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-9 w-9 flex-shrink-0 bg-white/50 dark:bg-black/20" data-testid={`button-info-${achievement.slug}`}>
                            <Info className="h-5 w-5 text-purple-600 dark:text-purple-300" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent side="left" className="max-w-[250px]">
                          <p className="text-sm">{t(`achievements.desc_${achievement.slug}`)}</p>
                        </PopoverContent>
                      </Popover>
                    </div>
                  </Card>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}

        {/* Active Shared Rewards Section - From other family members */}
        {sharedRewards.filter(sr => sr.memberId !== member?.id).length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.25 }}
            className="space-y-4"
          >
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-2xl bg-blue-500/20">
                <Users className="h-7 w-7 text-blue-500" />
              </div>
              <h2 className="text-3xl font-bold" style={{ fontFamily: "Fredoka, sans-serif" }}>
                {t("kidDashboard.joinableRewards")}
              </h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {sharedRewards
                .filter(sr => sr.memberId !== member?.id)
                .map((shared, index) => {
                  const hasJoined = shared.participants.some(p => p.memberId === member?.id);
                  const initiatorMember = familyMembers.find(m => m.id === shared.memberId);

                  return (
                    <motion.div
                      key={shared.id}
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: index * 0.1 }}
                    >
                      <Card className="p-4 bg-gradient-to-br from-blue-500/10 to-purple-500/10 border-2 border-blue-500/30 rounded-2xl">
                        <div className="space-y-3">
                          <div className="text-center space-y-2">
                            <div className="flex justify-center p-3 rounded-2xl mx-auto w-fit bg-blue-500/20">
                              <Gift className="h-10 w-10 text-blue-500" />
                            </div>
                            <h3 className="font-bold text-lg" style={{ fontFamily: "Fredoka, sans-serif" }}>
                              {shared.reward?.title || t("kidDashboard.reward")}
                            </h3>
                            <div className="flex flex-col items-center gap-1.5">
                              <div className="flex items-center gap-2">
                                {initiatorMember && (
                                  <Avatar className="h-6 w-6 border-2 border-background">
                                    <AvatarImage src={getAvatarUrl(initiatorMember.activeSkinId, initiatorMember.avatarUrl, (initiatorMember as any).useCustomAvatar, (initiatorMember as any).updatedAt)} />
                                    <AvatarFallback className="text-xs">
                                      {initiatorMember.displayName[0]}
                                    </AvatarFallback>
                                  </Avatar>
                                )}
                                <p className="text-sm text-muted-foreground">
                                  {initiatorMember?.displayName} {t("kidDashboard.startSharing")}
                                </p>
                              </div>
                              <Badge variant="secondary" className="gap-1.5 text-xs">
                                <Users className="h-3 w-3" />
                                {t("kidDashboard.participants", { count: shared.participants.length + 1 })}
                              </Badge>
                            </div>
                            <p className="text-xs text-muted-foreground">
                              {t("kidDashboard.pointsSpent", { count: shared.originalPointsSpent })}
                            </p>
                          </div>

                          {/* Participants */}
                          {shared.participants.length > 0 && (
                            <div className="flex items-center justify-center gap-1.5 flex-wrap">
                              <p className="text-xs text-muted-foreground mr-1">{t("kidDashboard.with")}</p>
                              {shared.participants.map(p => (
                                <Badge key={p.id} variant="secondary" className="gap-1.5 text-xs py-1">
                                  <Avatar className="h-5 w-5">
                                    <AvatarImage src={getAvatarUrl(p.member.activeSkinId, p.member.avatarUrl, (p.member as any).useCustomAvatar, (p.member as any).updatedAt)} />
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
                          )}

                          {/* Join Button */}
                          <div className="pt-2 border-t border-blue-500/20">
                            {!hasJoined ? (
                              <Button
                                size="sm"
                                variant="default"
                                className="w-full gap-1.5 text-xs"
                                onClick={() => joinSharingMutation.mutate(shared.id)}
                                disabled={joinSharingMutation.isPending}
                                data-testid={`button-join-${shared.id}`}
                              >
                                <UserPlus className="h-3.5 w-3.5" />
                                {t("kidDashboard.joinFree")}
                              </Button>
                            ) : (
                              <Badge variant="secondary" className="w-full gap-1 justify-center">
                                <CheckCircle2 className="h-3 w-3" />
                                {t("kidDashboard.shared")}
                              </Badge>
                            )}
                          </div>
                        </div>
                      </Card>
                    </motion.div>
                  );
                })}
            </div>
          </motion.div>
        )}

        {/* Rewards Section */}
        <div className="space-y-6 mb-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-gradient-to-br from-amber-400 to-orange-500 rounded-2xl">
              <Trophy className="h-8 w-8 text-white" />
            </div>
            <h2 className="text-4xl font-bold" style={{ fontFamily: "Fredoka, sans-serif" }}>
              {t("kidDashboard.rewards")}
            </h2>
            <Sparkles className="h-6 w-6 text-amber-500 animate-pulse" />
          </div>

          {activeRewards.length === 0 ? (
            <Card className="p-8 text-center bg-card/80 backdrop-blur-md rounded-2xl">
              <Gift className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
              <p className="text-lg text-muted-foreground">{t("kidDashboard.noRewardsYet")}</p>
              <p className="text-sm text-muted-foreground mt-2">{t("kidDashboard.parentsCanCreate")}</p>
            </Card>
          ) : (
            <div className="space-y-4">
              {activeRewards.map((reward, index) => (
                <motion.div
                  key={reward.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                >
                  <RewardCard reward={reward} currentPoints={currentPoints} member={member} />
                </motion.div>
              ))}
            </div>
          )}
        </div>

        {/* My Redeemed Rewards Section */}
        {myRedemptions.length > 0 && (
          <div className="space-y-4 mb-8">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-2xl bg-green-500/20">
                  <CheckCircle2 className="h-7 w-7 text-green-500" />
                </div>
                <h2 className="text-3xl font-bold" style={{ fontFamily: "Fredoka, sans-serif" }}>
                  {t("kidDashboard.myRewards")}
                </h2>
              </div>
              <Button variant="ghost" size="sm" asChild data-testid="button-view-all-rewards">
                <Link href="/my-rewards">
                  {t("kidDashboard.viewAll")}
                </Link>
              </Button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {myRedemptions.slice(0, 2).map((redemption, index) => {
                const typed = redemption as RedemptionWithDetails;
                const shared = sharedRewards.find(s => s.id === typed.id);
                const participants = shared?.participants || [];
                const isSharing = typed.sharingStatus === "sharing_active";
                const isFinalized = typed.sharingStatus === "sharing_finalized";
                const canShare = typed.status !== "completed" && typed.sharingStatus === "not_shared";
                const canFinalize = isSharing && participants.length > 0;
                const canCancelSharing = isSharing; // Can cancel anytime while sharing is active

                return (
                  <motion.div
                    key={redemption.id}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: index * 0.1 }}
                  >
                    <Card className="p-4 bg-gradient-to-br from-green-500/10 to-emerald-500/10 border-2 border-green-500/30 rounded-2xl">
                      <div className="space-y-3">
                        <div className="text-center space-y-2">
                          <div className="flex justify-center p-3 rounded-2xl mx-auto w-fit bg-green-500/20">
                            <CheckCircle2 className="h-10 w-10 text-green-500" />
                          </div>
                          <h3 className="font-bold text-lg" style={{ fontFamily: "Fredoka, sans-serif" }}>
                            {redemption.rewardTitle || t("kidDashboard.reward")}
                          </h3>
                          <div className="flex flex-wrap gap-1.5 justify-center">
                            <Badge 
                              variant={redemption.status === "completed" ? "default" : "secondary"}
                              className="text-sm"
                            >
                              {redemption.status === "completed" ? `✓ ${t("kidDashboard.fulfilled")}` : 
                               redemption.status === "approved" ? `⏳ ${t("kidDashboard.waiting")}` : 
                               `⏸️ ${t("kidDashboard.pending")}`}
                            </Badge>
                            {isSharing && (
                              <Badge variant="secondary" className="gap-1.5 text-xs">
                                <Users className="h-3 w-3" />
                                {t("kidDashboard.beingShared")}
                              </Badge>
                            )}
                            {isFinalized && (
                              <Badge variant="secondary" className="gap-1.5 text-xs">
                                <CheckCircle2 className="h-3 w-3" />
                                {t("kidDashboard.shared")}
                              </Badge>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {t("kidDashboard.pointsSpent", { count: typed.pointsSpent })} {isFinalized && t("kidDashboard.wasPoints", { count: typed.originalPointsSpent })}
                          </p>
                        </div>

                        {/* Participants */}
                        {participants.length > 0 && (
                          <div className="flex items-center justify-center gap-1.5 flex-wrap">
                            <p className="text-xs text-muted-foreground mr-1">{t("kidDashboard.with")}</p>
                            {participants.map(p => (
                              <Badge key={p.id} variant="secondary" className="gap-1.5 text-xs py-1">
                                <Avatar className="h-5 w-5">
                                  <AvatarImage src={getAvatarUrl(p.member.activeSkinId, p.member.avatarUrl, (p.member as any).useCustomAvatar, (p.member as any).updatedAt)} />
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
                        )}

                        {/* Sharing Actions */}
                        {(canShare || canFinalize || canCancelSharing) && (
                          <div className="flex gap-2 pt-2 border-t border-green-500/20 flex-wrap">
                            {canShare && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="flex-1 gap-1.5 text-xs"
                                onClick={() => startSharingMutation.mutate(typed.id)}
                                disabled={startSharingMutation.isPending}
                                data-testid={`button-start-share-${typed.id}`}
                              >
                                <Share2 className="h-3.5 w-3.5" />
                                {t("kidDashboard.startSharing")}
                              </Button>
                            )}
                            {canCancelSharing && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="flex-1 gap-1.5 text-xs"
                                onClick={() => cancelSharingMutation.mutate(typed.id)}
                                disabled={cancelSharingMutation.isPending}
                                data-testid={`button-cancel-share-${typed.id}`}
                              >
                                <X className="h-3.5 w-3.5" />
                                {t("kidDashboard.cancelSharing")}
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
                                {t("kidDashboard.finalize")}
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

        {/* Tasks Section */}
        <div className="space-y-6">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-gradient-to-br from-purple-500 to-pink-500 rounded-2xl">
              <Star className="h-8 w-8 text-white" />
            </div>
            <h2 className="text-3xl font-bold" style={{ fontFamily: "Fredoka, sans-serif" }}>
              {t("kidDashboard.tasks")}
            </h2>
          </div>

          {myTasks.length === 0 ? (
            <Card className="p-8 text-center bg-card/80 backdrop-blur-md rounded-2xl">
              <CheckCircle2 className="h-16 w-16 mx-auto mb-4 text-green-500" />
              <p className="text-lg font-bold text-green-500">{t("kidDashboard.noTasksYet")}</p>
              <p className="text-sm text-muted-foreground mt-2">{t("kidDashboard.askParentsTasks")}</p>
            </Card>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {myTasks.map((task, index) => (
                <motion.div
                  key={task.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                >
                  <TaskCard task={task} member={member} onOpenTaskDialog={handleOpenTaskDialog} />
                </motion.div>
              ))}
            </div>
          )}
        </div>

        {/* Family Goals Section */}
        {goals.filter(g => g.isActive).length > 0 && (
          <div className="space-y-6">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-2xl">
                <Target className="h-8 w-8 text-white" />
              </div>
              <h2 className="text-4xl font-bold" style={{ fontFamily: "Fredoka, sans-serif" }}>
                {t("kidDashboard.familyGoals")}
              </h2>
            </div>

            {goals.filter(g => g.isActive).map((goal, index) => {
              const progress = calculateProgress(goal);
              const currentPeriod = getCurrentPeriod(goal.contributionPeriod);
              const isCompleted = goal.currentPoints >= goal.targetPoints;
              
              return (
                <motion.div
                  key={goal.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                >
                  <Card className="p-6 bg-gradient-to-br from-blue-500/10 to-cyan-500/10 border-2 border-blue-500/30 rounded-3xl">
                    <div className="space-y-4">
                      <div className="flex items-start gap-4">
                        <div className="text-5xl flex-shrink-0">{goal.iconEmoji}</div>
                        <div className="flex-1 min-w-0">
                          <h3 className="text-2xl font-bold mb-1" style={{ fontFamily: "Fredoka, sans-serif" }}>
                            {goal.title}
                          </h3>
                          {goal.description && (
                            <p className="text-muted-foreground text-sm mb-2">{goal.description}</p>
                          )}
                          {isCompleted && (
                            <Badge variant="default" className="gap-1 mb-2">
                              <CheckCircle2 className="h-3 w-3" />
                              {t("kidDashboard.goalAchieved")}
                            </Badge>
                          )}
                          <div className="flex flex-wrap items-center gap-2 mt-2">
                            <Badge variant="secondary" className="gap-1 text-xs">
                              <Calendar className="h-3 w-3" />
                              {goal.contributionPeriod === "weekly" ? t("kidDashboard.weeklyLabel") : t("kidDashboard.monthlyLabel")}
                            </Badge>
                            <Badge variant="secondary" className="gap-1 text-xs">
                              <Coins className="h-3 w-3" />
                              {goal.contributionAmount} {t("kidDashboard.points")}
                            </Badge>
                          </div>
                        </div>
                      </div>

                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-medium">{t("kidDashboard.progressLabel")}</span>
                          <span className="text-sm font-bold">
                            {t("kidDashboard.goalProgress", { current: goal.currentPoints, target: goal.targetPoints })}
                          </span>
                        </div>
                        <Progress value={progress} className="h-3" />
                      </div>

                      {/* Contributors list - shows who has contributed this period */}
                      {(goal as any).contributions && (goal as any).contributions.length > 0 && (
                        <div className="flex items-center gap-2 pt-2">
                          <span className="text-sm text-muted-foreground">{t("familyGoals.contributedThisPeriod")}:</span>
                          <div className="flex -space-x-2">
                            {(goal as any).contributions.map((contribution: any) => {
                              const contributorMember = familyMembers.find(m => m.id === contribution.memberId);
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

                      <div className="flex items-center justify-between pt-4 border-t">
                        <div className="text-sm text-muted-foreground">
                          {formatPeriod(currentPeriod, goal.contributionPeriod)}
                        </div>
                        {!isCompleted && member && (
                          (goal as any).contributions?.some((c: any) => c.memberId === member.id) ? (
                            <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-green-500/10 border border-green-500/30 text-green-600 dark:text-green-400">
                              <CheckCircle2 className="h-4 w-4" />
                              <span className="text-sm font-bold">
                                {t("familyGoals.nextContribution", { date: getNextContributionDate(goal.contributionPeriod) })}
                              </span>
                            </div>
                          ) : (
                            <Button
                              onClick={() => contributeMutation.mutate(goal.id)}
                              disabled={contributeMutation.isPending || member.totalPoints < goal.contributionAmount}
                              data-testid={`button-contribute-${goal.id}`}
                              className="font-bold rounded-xl"
                            >
                              <TrendingUp className="h-4 w-4 mr-2" />
                              {t("kidDashboard.contributePoints", { count: goal.contributionAmount })}
                            </Button>
                          )
                        )}
                      </div>
                    </div>
                  </Card>
                </motion.div>
              );
            })}
          </div>
        )}

        {/* Leaderboard Section */}
        {familyData?.showLeaderboard && (
          <div className="space-y-6">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-2xl">
                <Trophy className="h-8 w-8 text-white" />
              </div>
              <h2 className="text-4xl font-bold" style={{ fontFamily: "Fredoka, sans-serif" }}>
                {t("kidDashboard.leaderboard")}
              </h2>
            </div>

            {/* Weekly/Monthly Toggle */}
            {hasFeature(familyData?.subscriptionTier as SubscriptionTier || "free", "weeklyLeaderboard") && (
              <div className="mb-4">
                <Tabs value={leaderboardPeriod} onValueChange={(value) => setLeaderboardPeriod(value as "week" | "month")}>
                  <TabsList className="grid w-full grid-cols-2" data-testid="tabs-leaderboard-period">
                    <TabsTrigger value="week" data-testid="tab-leaderboard-week">
                      {t("dashboard.weekly")}
                    </TabsTrigger>
                    <TabsTrigger value="month" data-testid="tab-leaderboard-month">
                      {t("dashboard.monthly")}
                    </TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>
            )}

            <Leaderboard 
              members={familyMembers} 
              period={leaderboardPeriod}
              weeklyPrize={familyData?.weeklyPrize}
              monthlyPrize={familyData?.monthlyPrize}
            />
          </div>
        )}

      </div>

      {/* Simplified Navigation - Fixed Bottom Bar */}
      <motion.div
        className="fixed bottom-0 left-0 right-0 z-50 p-2"
        initial={{ y: 100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.5, type: "spring" }}
      >
        <Card className="p-1.5 mx-2 bg-gradient-to-r from-primary/20 via-purple-500/20 to-pink-500/20 backdrop-blur-md border-2 border-primary/30 rounded-3xl shadow-2xl max-w-2xl sm:mx-auto">
          <div className="flex justify-center gap-1 sm:gap-2">
            <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} className="flex-1 max-w-[200px]">
              <Button 
                variant="ghost" 
                size="lg" 
                onClick={() => setRequestRewardDialogOpen(true)}
                data-testid="button-nav-request-reward" 
                className="h-14 w-full px-3 sm:px-5 rounded-2xl"
              >
                <Lightbulb className="h-5 w-5 sm:h-6 sm:w-6 mr-1.5 sm:mr-2 text-amber-500 flex-shrink-0" />
                <span className="font-bold text-sm sm:text-base truncate">{t("kidDashboard.requestNewReward")}</span>
              </Button>
            </motion.div>
            <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} className="flex-1 max-w-[200px] relative">
              <Button variant="ghost" size="lg" asChild data-testid="button-nav-chat" className="h-14 w-full px-3 sm:px-5 rounded-2xl">
                <Link href="/chat">
                  <MessageCircle className="h-5 w-5 sm:h-6 sm:w-6 mr-1.5 sm:mr-2 text-blue-500 flex-shrink-0" />
                  <span className="font-bold text-sm sm:text-base truncate">{t("nav.chat")}</span>
                </Link>
              </Button>
              {unreadChatData && unreadChatData.count > 0 && (
                <span 
                  className="absolute -top-1 -right-1 z-50 h-5 w-5 flex items-center justify-center rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold"
                  data-testid="badge-unread-chat-count"
                >
                  {unreadChatData.count}
                </span>
              )}
            </motion.div>
          </div>
        </Card>
      </motion.div>

      {/* Edit Profile Dialog - Available to all members */}
      {member && (
        <EditMemberDialog
          open={editMemberDialogOpen}
          onOpenChange={setEditMemberDialogOpen}
          onSubmit={(memberId, data) => editMemberMutation.mutate({ memberId, data })}
          isSubmitting={editMemberMutation.isPending}
          member={memberToEdit}
        />
      )}

      {/* Switch Member Dialog - Real parents only */}
      {member && isRealParent && (
        <SwitchMemberDialog
          open={switchMemberDialogOpen}
          onOpenChange={setSwitchMemberDialogOpen}
          members={familyMembers}
          currentMember={member}
          familyData={familyData || null}
          onSwitch={(params) => switchMemberMutation.mutate(params)}
          isSubmitting={switchMemberMutation.isPending}
        />
      )}

      {/* Task Completion Dialog with Photo Upload */}
      <TaskCompletionDialog
        open={taskDialogOpen}
        onOpenChange={setTaskDialogOpen}
        task={selectedTask}
        onComplete={handleTaskComplete}
        isSubmitting={completeTaskMutation.isPending}
      />

      {/* Reward Request Dialog - Children can propose new rewards */}
      {member && (
        <RewardRequestDialog
          open={requestRewardDialogOpen}
          onOpenChange={setRequestRewardDialogOpen}
          onSubmit={(data) => createRewardRequestMutation.mutate(data)}
          isSubmitting={createRewardRequestMutation.isPending}
          familyName={member.familyName}
        />
      )}
    </div>
  );
}
