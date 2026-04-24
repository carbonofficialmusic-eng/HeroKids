import { useState, useRef, useEffect, useLayoutEffect } from "react";
import { isCameraUsed, clearCameraUsed } from "@/lib/cameraUtils";
import { Link } from "wouter";
import { motion } from "framer-motion";
import confetti from "canvas-confetti";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/hooks/useAuth";
import { useMidnightRefresh } from "@/hooks/useMidnightRefresh";
import { useWebSocket } from "@/hooks/useWebSocket";
import { format, differenceInDays, isToday, isTomorrow, isPast, startOfDay, parseISO, addDays } from "date-fns";
import { filterKidTasksByDate as filterKidTasksByDateUtil } from "@/lib/task-filters";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown } from "lucide-react";
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
  AlertTriangle,
} from "lucide-react";

// Helper to determine due date status
function getDueDateStatus(dueDate: Date | string | null): { status: "overdue" | "soon" | "normal" | null; daysUntil: number } {
  if (!dueDate) return { status: null, daysUntil: 0 };
  
  const due = startOfDay(new Date(dueDate));
  const today = startOfDay(new Date());
  const daysUntil = differenceInDays(due, today);
  
  if (isPast(due) && daysUntil < 0) {
    return { status: "overdue", daysUntil };
  }
  if (isToday(due) || isTomorrow(due)) {
    return { status: "soon", daysUntil };
  }
  return { status: "normal", daysUntil };
}
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
  assignedMemberCompletions?: Array<{
    memberId: string;
    displayName: string;
    avatarUrl: string | null;
    activeSkinId: string | null;
    useCustomAvatar: boolean;
    color: string;
    hasCompleted: boolean; // true only when approved
    hasSubmitted: boolean; // true when pending or approved (for UI graying)
    status: "pending" | "approved" | "rejected" | null;
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
  
  // Due date availability logic for one-time tasks
  const dueDateInfo = (() => {
    if (!task.dueDate || task.recurrence !== "none") return { notYet: false, expired: false, isLate: false, daysPast: 0 };
    const dateStr = String(task.dueDate).substring(0, 10);
    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    
    if (dateStr > todayStr) return { notYet: true, expired: false, isLate: false, daysPast: 0 };
    
    const dueMs = new Date(dateStr + "T00:00:00").getTime();
    const todayMs = new Date(todayStr + "T00:00:00").getTime();
    const daysPast = Math.floor((todayMs - dueMs) / (1000 * 60 * 60 * 24));
    
    return {
      notYet: false,
      expired: daysPast > 3,
      isLate: daysPast >= 1 && daysPast <= 3,
      daysPast,
    };
  })();
  
  // Check if this is a shared task and current member is NOT assigned
  const isSharedTaskNotAssigned = task.isSharedTask && 
    task.sharedMemberIds && 
    task.sharedMemberIds.length > 0 && 
    !task.sharedMemberIds.includes(member.id);
  
  // Check if all assigned members have completed (for multi-assignment tasks)
  const allAssignedMembersCompleted = task.assignedMemberCompletions && 
    task.assignedMemberCompletions.length > 1 &&
    task.assignedMemberCompletions.every((m: { hasCompleted: boolean }) => m.hasCompleted);
  
  // Check if all shared task members have completed (for recurring shared tasks graying) - legacy
  const allSharedMembersCompleted = task.isSharedTask && 
    task.sharedMemberCompletions && 
    task.sharedMemberCompletions.length > 0 &&
    task.sharedMemberCompletions.every((m: { hasCompleted: boolean }) => m.hasCompleted);
  
  // Combined check for all members completed (new or legacy)
  const allMembersCompleted = allAssignedMembersCompleted || allSharedMembersCompleted;
  
  // Get assigned member names for message (prefer new style over legacy)
  const assignedMemberNames = task.assignedMemberCompletions?.map(m => m.displayName).join(' & ') || 
    task.sharedMemberCompletions?.map(m => m.displayName).join(' & ') || '';
  
  // Fallback check: if memberHasCompleted is true but status is null, treat as completed
  // This handles edge cases where status might be missing due to data inconsistency
  const hasCompletedWithoutStatus = task.memberHasCompleted && neverAttempted;
  
  // Check if this is a weekdays task that is unavailable on weekends (Sat=6, Sun=0)
  const todayDow = new Date().getDay();
  const isWeekendUnavailable = task.recurrence === 'weekdays' && (todayDow === 0 || todayDow === 6);

  // Task is actionable ONLY if:
  // 1. Never attempted (completionStatus === null AND !memberHasCompleted) OR rejected (can retry)
  // 2. Task status is active
  // 3. Has available slots (or no slot limit)
  // 4. Is assigned to this member (for shared tasks)
  // 5. Not all assigned members have completed yet
  // NOT actionable if: pending, approved, has completion without status, inactive, no slots, not assigned to shared task, all members completed, due date not yet reached, due date expired, or weekday-only task on a weekend
  const isActionable = (neverAttempted && !hasCompletedWithoutStatus || isRejected) && !isInactive && !hasNoSlots && !isSharedTaskNotAssigned && !allMembersCompleted && !dueDateInfo.notYet && !dueDateInfo.expired && !isWeekendUnavailable;
  
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
  } else if (allSharedMembersCompleted) {
    statusMessage = t("kidDashboard.sharedTaskCompleted");
    statusColor = "text-green-600 dark:text-green-400";
  } else if (dueDateInfo.notYet) {
    statusMessage = t("tasks.dueDateNotYetTooltip");
    statusColor = "text-muted-foreground";
  } else if (dueDateInfo.expired) {
    statusMessage = t("tasks.dueDateExpiredTooltip");
    statusColor = "text-destructive";
  } else if (isWeekendUnavailable) {
    statusMessage = t("tasks.weekendUnavailable");
    statusColor = "text-muted-foreground";
  } else if (dueDateInfo.isLate) {
    statusMessage = t("tasks.dueDateLate", { days: dueDateInfo.daysPast });
    statusColor = "text-amber-600 dark:text-amber-400";
  }

  return (
    <motion.div
      whileHover={{ scale: isActionable ? 1.02 : 1 }}
      whileTap={{ scale: isActionable ? 0.98 : 1 }}
      className="min-w-0"
    >
      <Card
        className={`p-4 transition-all bg-card/80 backdrop-blur-md border-2 rounded-2xl min-w-0 w-full ${
          isActionable && !isRejected ? "cursor-pointer border-border hover:border-primary" : 
          isActionable && isRejected ? "cursor-pointer border-blue-500 hover:border-blue-600" :
          isApproved ? "opacity-70 border-green-500" :
          isPending ? "opacity-60 border-amber-500" :
          hasNoSlots ? "opacity-50 border-amber-500" :
          isSharedTaskNotAssigned ? "opacity-50 border-muted" :
          allSharedMembersCompleted ? "opacity-60 border-green-500" :
          dueDateInfo.notYet ? "opacity-50 border-muted" :
          dueDateInfo.expired ? "opacity-40 border-destructive" :
          isWeekendUnavailable ? "opacity-50 border-muted" :
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
            allSharedMembersCompleted ? "bg-green-500/20" :
            "bg-primary/10"
          }`}>
            {completeMutation.isPending ? (
              <Loader2 className="h-12 w-12 text-primary animate-spin" />
            ) : isApproved ? (
              <CheckCircle2 className="h-12 w-12 text-green-500" />
            ) : isPending ? (
              <CheckCircle2 className="h-12 w-12 text-amber-500" />
            ) : allSharedMembersCompleted ? (
              <CheckCircle2 className="h-12 w-12 text-green-500" />
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
          
          {/* Multi-Assignment Task Info - Show teammates who need to complete (new style) */}
          {task.assignedMemberCompletions && task.assignedMemberCompletions.length > 1 && (
            <div className="space-y-2 text-left">
              {/* Teammates section */}
              <div className="p-2 bg-primary/5 rounded-xl">
                <p className="text-xs font-semibold text-muted-foreground mb-1.5">
                  <Users className="h-3 w-3 inline mr-1" />
                  {t("kidDashboard.sharedWith")}
                </p>
                <div className="flex flex-wrap justify-center gap-1">
                  {task.assignedMemberCompletions.map((m) => {
                    const hasSubmitted = m.hasSubmitted ?? (m.status !== null);
                    return (
                      <Badge 
                        key={m.memberId} 
                        variant={hasSubmitted ? "default" : "outline"}
                        className="gap-1 text-xs"
                      >
                        <Avatar className="h-4 w-4">
                          <AvatarImage src={getAvatarUrl(m.activeSkinId, m.avatarUrl, m.useCustomAvatar)} />
                          <AvatarFallback 
                            className="text-xs text-white font-bold"
                            style={{ backgroundColor: m.color }}
                          >
                            {m.displayName[0]}
                          </AvatarFallback>
                        </Avatar>
                        {m.displayName}
                        {m.status === "approved" ? " ✓" : m.status === "pending" ? " ⏳" : ""}
                      </Badge>
                    );
                  })}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {t("tasks.sharedProgress", {
                    completed: task.assignedMemberCompletions.filter(m => m.hasCompleted).length,
                    total: task.assignedMemberCompletions.length
                  })}
                </p>
              </div>
              
              {/* Task description */}
              {task.description && (
                <p className="text-xs text-muted-foreground px-2 line-clamp-2">
                  {task.description}
                </p>
              )}
            </div>
          )}

          {/* Legacy Shared Task Info - Show teammates and description (using sharedMemberIds) */}
          {task.isSharedTask && task.sharedMemberCompletions && task.sharedMemberCompletions.length > 1 && !task.assignedMemberCompletions && (
            <div className="space-y-2 text-left">
              {/* Teammates section */}
              <div className="p-2 bg-primary/5 rounded-xl">
                <p className="text-xs font-semibold text-muted-foreground mb-1.5">
                  <Users className="h-3 w-3 inline mr-1" />
                  {t("kidDashboard.sharedWith")}
                </p>
                <div className="flex flex-wrap justify-center gap-1">
                  {task.sharedMemberCompletions.map((m) => (
                    <Badge 
                      key={m.memberId} 
                      variant={m.hasCompleted ? "default" : "outline"}
                      className="gap-1 text-xs"
                    >
                      <Avatar className="h-4 w-4">
                        <AvatarImage src={getAvatarUrl(m.activeSkinId, m.avatarUrl, m.useCustomAvatar)} />
                        <AvatarFallback 
                          className="text-xs text-white font-bold"
                          style={{ backgroundColor: m.color }}
                        >
                          {m.displayName[0]}
                        </AvatarFallback>
                      </Avatar>
                      {m.displayName}
                      {m.hasCompleted && " ✓"}
                    </Badge>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {t("tasks.sharedProgress", {
                    completed: task.sharedMemberCompletions.filter(m => m.hasCompleted).length,
                    total: task.sharedMemberCompletions.length
                  })}
                </p>
              </div>
              
              {/* Task description for shared tasks */}
              {task.description && (
                <p className="text-xs text-muted-foreground px-2 line-clamp-2">
                  {task.description}
                </p>
              )}
            </div>
          )}

          {/* Due Date Display with kid-friendly warnings */}
          {task.dueDate && (() => {
            const { status, daysUntil } = getDueDateStatus(task.dueDate);
            
            if (status === "overdue") {
              return (
                <Badge 
                  variant="destructive" 
                  className="gap-1 text-xs rounded-xl"
                  data-testid={`badge-overdue-${task.id}`}
                >
                  <AlertTriangle className="h-3 w-3" />
                  {t('kidDashboard.overdueHurry')}
                </Badge>
              );
            }
            
            if (status === "soon") {
              return (
                <Badge 
                  variant="secondary" 
                  className="gap-1 text-xs bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400 rounded-xl"
                  data-testid={`badge-due-soon-${task.id}`}
                >
                  <Calendar className="h-3 w-3" />
                  {daysUntil === 0 ? t('kidDashboard.dueTodayHurry') : t('kidDashboard.dueTomorrowHurry')}
                </Badge>
              );
            }
            
            return (
              <div className="flex items-center justify-center gap-1 text-xs text-muted-foreground">
                <Calendar className="h-3 w-3" />
                <span>{t('tasks.dueBy', { date: format(new Date(task.dueDate), "MMM d") })}</span>
              </div>
            );
          })()}

          {statusMessage ? (
            <div className="space-y-1 w-full">
              <div 
                className={`text-sm px-3 py-1.5 rounded-xl text-center whitespace-normal break-words bg-secondary ${statusColor}`}
              >
                {statusMessage}
              </div>
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
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const savedScrollRef = useRef(0);

  // Lock scroll container while any dialog is open; restore after close (iOS keyboard shifts viewport)
  const anyKidDialogOpen = taskDialogOpen || requestRewardDialogOpen || editMemberDialogOpen || switchMemberDialogOpen;
  useLayoutEffect(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    if (anyKidDialogOpen) {
      savedScrollRef.current = el.scrollTop;
      el.style.overflowY = 'hidden';
    } else {
      el.style.overflowY = 'auto';
      const target = savedScrollRef.current;
      el.scrollTop = target;
      const scrollTimer = setTimeout(() => { el.scrollTop = target; }, 350);
      return () => clearTimeout(scrollTimer);
    }
  }, [anyKidDialogOpen]);

  const [leaderboardPeriod, setLeaderboardPeriod] = useState<"week" | "month">("week");
  const [kidTaskFilter, setKidTaskFilter] = useState<"today" | "week" | "all">("all");
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(new Set());

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

  // For both Replit Auth and Device Session users, fetch fresh member from API
  // This ensures we always have up-to-date points data
  const { data: memberFromApi, isLoading: memberApiLoading } = useQuery<FamilyMember>({
    queryKey: ["/api/family-members/current"],
    enabled: !!authUser || isDeviceAuthenticated, // Fetch for both auth types
    staleTime: 0, // Always refetch to get latest points
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

  // Use API member (fresh data) with fallback to device session data
  const member = memberFromApi || memberFromDeviceSession;
  const memberLoading = memberApiLoading || deviceSessionLoading;

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
      if (isCameraUsed()) {
        clearCameraUsed();
        setTimeout(() => window.dispatchEvent(new CustomEvent('herokids:camera-fix')), 2000);
      }
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
      // Invalidate member-related queries but keep auth data intact
      // This prevents the FamilySetup flash during navigation
      queryClient.invalidateQueries({ queryKey: ["/api/family-members/current"] });
      queryClient.invalidateQueries({ queryKey: ["/api/family-members"] });
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
      
      // Navigate immediately - dialog will be gone when new page loads
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
      if (isCameraUsed()) {
        clearCameraUsed();
        setTimeout(() => window.dispatchEvent(new CustomEvent('herokids:camera-fix')), 2000);
      }
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

  // Filter tasks: different logic for multi-completion vs multi-assignment vs normal tasks
  const myTasks = tasks.filter(t => {
    // Multi-Completion Tasks (slot-based)
    if (t.maxCompletions !== null) {
      // Recurring Multi-Tasks: Always show (grayed out when all slots filled)
      if (t.recurrence !== "none") {
        return true;
      }
      // One-time Multi-Tasks: Hide when ALL slots are filled (remainingSlots <= 0)
      return t.remainingSlots === null || t.remainingSlots === undefined || t.remainingSlots > 0;
    }
    
    // Multi-Assignment Tasks (new style - using taskAssignments, each member gets full points)
    if (t.assignedMemberCompletions && t.assignedMemberCompletions.length > 1) {
      const allMembersCompleted = t.assignedMemberCompletions.every((m: { hasCompleted: boolean }) => m.hasCompleted);
      
      // Recurring: Always show (grayed out when all completed)
      if (t.recurrence !== "none") {
        return true;
      }
      
      // One-time: Show until ALL assigned members completed
      if (!allMembersCompleted) {
        return true;
      }
      
      // All members completed - check if requires approval
      if (t.requiresApproval) {
        return t.memberCompletionStatus !== "approved";
      }
      
      return false;
    }
    
    // Legacy Shared Tasks (using sharedMemberIds): Special visibility logic
    if (t.isSharedTask && t.sharedMemberCompletions && t.sharedMemberCompletions.length > 0) {
      const allMembersCompleted = t.sharedMemberCompletions.every((m: { hasCompleted: boolean }) => m.hasCompleted);
      
      // Recurring Shared Tasks: Always show (grayed out when all completed)
      if (t.recurrence !== "none") {
        return true;
      }
      
      // One-time Shared Tasks: 
      // - Show until ALL members completed
      // - If requires approval: show until approved (memberCompletionStatus === "approved" only when allCompleted and no pending approval)
      if (!allMembersCompleted) {
        return true; // Still waiting for some members
      }
      
      // All members completed - check if requires approval
      if (t.requiresApproval) {
        // Hide only when explicitly approved by parent
        return t.memberCompletionStatus !== "approved";
      }
      
      // No approval needed and all completed - hide the task
      return false;
    }
    
    // Normal one-time tasks: Hide when member (or family) has completed
    return !t.memberHasCompleted || t.recurrence !== "none";
  });

  // Task categorization helpers for kid dashboard
  const getTaskCategory = (iconEmoji: string | null): string => {
    const emoji = iconEmoji || "⭐";
    const householdIcons = ["🧹", "🍽️", "🗑️", "🧺", "🛁", "🧼", "🪣", "🧽"];
    const schoolIcons = ["📚", "✏️", "📝", "📖", "🎒", "✍️", "📓", "🎓"];
    const selfCareIcons = ["🦷", "🚿", "💇", "🛏️", "👕", "👟", "🧴"];
    const petIcons = ["🐕", "🐈", "🐾", "🌱", "🌿", "🌷", "🐟", "🐢"];
    
    if (householdIcons.includes(emoji)) return "household";
    if (schoolIcons.includes(emoji)) return "school";
    if (selfCareIcons.includes(emoji)) return "selfCare";
    if (petIcons.includes(emoji)) return "pets";
    return "other";
  };

  const getCategoryLabel = (category: string): string => {
    const labels: Record<string, string> = {
      household: t("dashboard.categoryHousehold"),
      school: t("dashboard.categorySchool"),
      selfCare: t("dashboard.categorySelfCare"),
      pets: t("dashboard.categoryPets"),
      other: t("dashboard.categoryOther"),
    };
    return labels[category] || category;
  };

  const getCategoryEmoji = (category: string): string => {
    const emojis: Record<string, string> = {
      household: "🏠",
      school: "📚",
      selfCare: "🧼",
      pets: "🐾",
      other: "⭐",
    };
    return emojis[category] || "⭐";
  };

  // Filter tasks by date range for kid dashboard
  const filterKidTasksByDate = (taskList: typeof myTasks) =>
    filterKidTasksByDateUtil(taskList, kidTaskFilter);

  // Sort tasks by type: regular < multi-assignment < shared, then by due date and title
  const sortKidTasksWithinCategory = (taskList: typeof myTasks) => {
    return [...taskList].sort((a, b) => {
      // Task type priority: 0 = regular, 1 = multi-assignment, 2 = shared
      const getTaskTypePriority = (task: typeof myTasks[0]) => {
        if (task.isSharedTask) return 2;
        // Multi-assignment tasks have assignedMemberCompletions array with > 1 members
        if ((task as any).assignedMemberCompletions && (task as any).assignedMemberCompletions.length > 1) return 1;
        return 0;
      };
      
      const priorityA = getTaskTypePriority(a);
      const priorityB = getTaskTypePriority(b);
      
      if (priorityA !== priorityB) return priorityA - priorityB;
      
      // Secondary sort by due date (tasks with due dates first, then by date)
      const dueDateA = a.dueDate ? new Date(a.dueDate).getTime() : Infinity;
      const dueDateB = b.dueDate ? new Date(b.dueDate).getTime() : Infinity;
      if (dueDateA !== dueDateB) return dueDateA - dueDateB;
      
      // Tertiary sort by title
      return a.title.localeCompare(b.title);
    });
  };

  // Group tasks by category
  const groupKidTasksByCategory = (taskList: typeof myTasks) => {
    const groups: Record<string, typeof myTasks> = {};
    
    taskList.forEach(task => {
      const category = getTaskCategory(task.iconEmoji);
      if (!groups[category]) {
        groups[category] = [];
      }
      groups[category].push(task);
    });
    
    const categoryOrder = ["household", "school", "selfCare", "pets", "other"];
    const sortedGroups: Record<string, typeof myTasks> = {};
    
    categoryOrder.forEach(cat => {
      if (groups[cat] && groups[cat].length > 0) {
        // Sort tasks within each category
        sortedGroups[cat] = sortKidTasksWithinCategory(groups[cat]);
      }
    });
    
    return sortedGroups;
  };

  const filteredKidTasks = filterKidTasksByDate(myTasks);
  const groupedKidTasks = groupKidTasksByCategory(filteredKidTasks);
  const hasMultipleCategories = Object.keys(groupedKidTasks).length > 1;

  const toggleCategory = (category: string) => {
    setCollapsedCategories(prev => {
      const newSet = new Set(prev);
      if (newSet.has(category)) {
        newSet.delete(category);
      } else {
        newSet.add(category);
      }
      return newSet;
    });
  };

  return (
    <div style={{ position: 'fixed', inset: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden', zIndex: 1 }}>
      {/* Header - Like Dashboard */}
      <header className="border-b flex-shrink-0 backdrop-blur-md z-40 bg-background/80" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
        <div className="container mx-auto max-w-7xl px-4 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div className="flex-shrink-0" data-testid="avatar-header-kid">
              <Avatar className="h-10 w-10" style={{ borderWidth: "3px", borderStyle: "solid", borderColor: member.color }}>
                <AvatarImage src={getAvatarUrl(member.activeSkinId, member.avatarUrl, member.useCustomAvatar, member.updatedAt)} />
                <AvatarFallback style={{ backgroundColor: member.color }} className="text-white">
                  {member.displayName[0]}
                </AvatarFallback>
              </Avatar>
            </div>
            <div className="min-w-0">
              <div className="text-sm text-muted-foreground truncate hidden sm:block">{member.familyName}</div>
              <div className="font-semibold truncate" data-testid="text-user-name">
                {member.displayName}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3 flex-shrink-0">
            {familyData && (() => {
              const tierLabel = familyData.subscriptionTier === "free"
                ? t("subscription.free")
                : familyData.subscriptionTier === "family"
                ? t("subscription.family")
                : familyData.subscriptionTier === "family_plus"
                ? t("subscription.familyPlus")
                : t("subscription.familyHero");
              const badge = (
                <Badge
                  variant="secondary"
                  className="cursor-pointer hover-elevate"
                  data-testid="badge-current-tier"
                >
                  <Crown className="h-3 w-3 mr-1" />
                  {tierLabel}
                </Badge>
              );
              return <Link href="/pricing">{badge}</Link>;
            })()}
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

      {/* Scrollable content area — isolated from #root so Radix dialogs don't reset scroll */}
      <div ref={scrollContainerRef} style={{ flex: 1, overflowY: 'auto', overscrollBehavior: 'none' }}>
      <div className="container mx-auto px-4 max-w-6xl space-y-8 pt-6 pb-[calc(8rem+env(safe-area-inset-bottom))] overflow-hidden">
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
          <div className="py-4">
            <div className="flex items-center justify-between flex-wrap gap-5">
              <div className="flex items-center gap-5">
                <button
                  onClick={() => { setMemberToEdit(member); setEditMemberDialogOpen(true); }}
                  className="flex-shrink-0 rounded-full cursor-pointer hover-elevate"
                  data-testid="button-avatar-profile-large-kid"
                >
                  <Avatar className="h-20 w-20 border-4 border-primary shadow-lg">
                    <AvatarImage src={getAvatarUrl(member.activeSkinId, member.avatarUrl, member.useCustomAvatar, member.updatedAt)} />
                    <AvatarFallback style={{ backgroundColor: member.color }} className="text-3xl font-bold text-white">
                      {member.displayName[0]}
                    </AvatarFallback>
                  </Avatar>
                </button>
                {streak > 0 && (
                  <div className="flex items-center gap-2">
                    <motion.div
                      animate={{ scale: [1, 1.2, 1] }}
                      transition={{ repeat: Infinity, duration: 1.5 }}
                    >
                      <Flame className="h-6 w-6 text-orange-500" />
                    </motion.div>
                    <span className="text-base font-bold">{t("kidDashboard.dayStreak", { count: streak })}</span>
                  </div>
                )}
                {/* Star Counter - Links to Skins Gallery */}
                <Link href="/skins">
                  <div className="flex items-center gap-2 bg-gradient-to-r from-yellow-500/60 to-orange-500/60 px-4 py-2 rounded-xl border border-yellow-500/70 cursor-pointer hover:from-yellow-500/75 hover:to-orange-500/75 transition-colors" data-testid="link-stars-to-skins">
                    <motion.div
                      animate={{ rotate: [0, 10, -10, 0], scale: [1, 1.1, 1] }}
                      transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
                    >
                      <Star className="h-6 w-6 fill-yellow-400 text-yellow-400" />
                    </motion.div>
                    <span className="text-xl font-bold" style={{ fontFamily: "Fredoka, sans-serif" }} data-testid="text-stars-found">
                      {member.starsFound ?? 0}/{TOTAL_HIDDEN_STARS}
                    </span>
                  </div>
                </Link>
              </div>
              <div className="bg-card/80 p-5 rounded-2xl border-2 border-primary/30 min-w-[260px]">
                <p className="text-sm text-muted-foreground mb-3 font-medium text-center">{t("kidDashboard.yourPoints")}</p>
                <div className="space-y-3">
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
          </div>
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
                <h2 className="text-3xl font-bold text-white" style={{ fontFamily: "Fredoka, sans-serif", textShadow: "0 2px 4px rgba(0,0,0,0.8), 0 4px 12px rgba(0,0,0,0.6), 0 0 20px rgba(0,0,0,0.4)" }}>
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
              <h2 className="text-3xl font-bold text-white" style={{ fontFamily: "Fredoka, sans-serif", textShadow: "0 2px 4px rgba(0,0,0,0.8), 0 4px 12px rgba(0,0,0,0.6), 0 0 20px rgba(0,0,0,0.4)" }}>
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
            <h2 className="text-4xl font-bold text-white" style={{ fontFamily: "Fredoka, sans-serif", textShadow: "0 2px 4px rgba(0,0,0,0.8), 0 4px 12px rgba(0,0,0,0.6), 0 0 20px rgba(0,0,0,0.4)" }}>
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
                <h2 className="text-3xl font-bold text-white" style={{ fontFamily: "Fredoka, sans-serif", textShadow: "0 2px 4px rgba(0,0,0,0.8), 0 4px 12px rgba(0,0,0,0.6), 0 0 20px rgba(0,0,0,0.4)" }}>
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
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-gradient-to-br from-purple-500 to-pink-500 rounded-2xl">
                <Star className="h-8 w-8 text-white" />
              </div>
              <h2 className="text-3xl font-bold text-white" style={{ fontFamily: "Fredoka, sans-serif", textShadow: "0 2px 4px rgba(0,0,0,0.8), 0 4px 12px rgba(0,0,0,0.6), 0 0 20px rgba(0,0,0,0.4)" }}>
                {t("kidDashboard.tasks")}
              </h2>
            </div>
            
            {/* Kid-friendly filter tabs */}
            <div className="flex gap-2 flex-wrap">
              <Button
                variant={kidTaskFilter === "today" ? "default" : "outline"}
                size="sm"
                onClick={() => setKidTaskFilter("today")}
                className="rounded-full gap-1.5"
                data-testid="button-kid-filter-today"
              >
                <Calendar className="h-4 w-4" />
                {t("kidDashboard.filterToday")}
              </Button>
              <Button
                variant={kidTaskFilter === "week" ? "default" : "outline"}
                size="sm"
                onClick={() => setKidTaskFilter("week")}
                className="rounded-full gap-1.5"
                data-testid="button-kid-filter-week"
              >
                <Calendar className="h-4 w-4" />
                {t("kidDashboard.filterThisWeek")}
              </Button>
              <Button
                variant={kidTaskFilter === "all" ? "default" : "outline"}
                size="sm"
                onClick={() => setKidTaskFilter("all")}
                className="rounded-full gap-1.5"
                data-testid="button-kid-filter-all"
              >
                <Star className="h-4 w-4" />
                {t("kidDashboard.filterAll")}
              </Button>
            </div>
          </div>

          {filteredKidTasks.length === 0 ? (
            <Card className="p-8 text-center bg-card/80 backdrop-blur-md rounded-2xl">
              <CheckCircle2 className="h-16 w-16 mx-auto mb-4 text-green-500" />
              {myTasks.length === 0 ? (
                <>
                  <p className="text-lg font-bold text-green-500">{t("kidDashboard.noTasksYet")}</p>
                  <p className="text-sm text-muted-foreground mt-2">{t("kidDashboard.askParentsTasks")}</p>
                </>
              ) : (
                <>
                  <p className="text-lg font-bold text-muted-foreground">{t("kidDashboard.noTasksForFilter")}</p>
                  <Button 
                    variant="outline" 
                    className="mt-4 rounded-full"
                    onClick={() => setKidTaskFilter("all")}
                  >
                    {t("kidDashboard.showAllTasks")}
                  </Button>
                </>
              )}
            </Card>
          ) : hasMultipleCategories ? (
            <div className="space-y-4">
              {Object.entries(groupedKidTasks).map(([category, categoryTasks]) => (
                <Collapsible
                  key={category}
                  open={!collapsedCategories.has(category)}
                  onOpenChange={() => toggleCategory(category)}
                >
                  <Card className="bg-card/60 backdrop-blur-md rounded-2xl overflow-hidden">
                    <CollapsibleTrigger asChild>
                      <div className="p-4 flex items-center justify-between cursor-pointer hover-elevate transition-colors">
                        <div className="flex items-center gap-3">
                          <span className="text-2xl">{getCategoryEmoji(category)}</span>
                          <span className="font-bold text-lg" style={{ fontFamily: "Fredoka, sans-serif" }}>
                            {getCategoryLabel(category)}
                          </span>
                          <Badge variant="secondary" className="rounded-full">
                            {categoryTasks.length}
                          </Badge>
                        </div>
                        <ChevronDown className={`h-5 w-5 transition-transform ${!collapsedCategories.has(category) ? "rotate-180" : ""}`} />
                      </div>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <div className="p-4 pt-0 grid sm:grid-cols-2 lg:grid-cols-3 gap-4 overflow-hidden">
                        {categoryTasks.map((task, index) => (
                          <motion.div
                            key={task.id}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: index * 0.05 }}
                            className="min-w-0"
                          >
                            <TaskCard task={task} member={member} onOpenTaskDialog={handleOpenTaskDialog} />
                          </motion.div>
                        ))}
                      </div>
                    </CollapsibleContent>
                  </Card>
                </Collapsible>
              ))}
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 overflow-hidden">
              {filteredKidTasks.map((task, index) => (
                <motion.div
                  key={task.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className="min-w-0"
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
              <h2 className="text-4xl font-bold text-white" style={{ fontFamily: "Fredoka, sans-serif", textShadow: "0 2px 4px rgba(0,0,0,0.8), 0 4px 12px rgba(0,0,0,0.6), 0 0 20px rgba(0,0,0,0.4)" }}>
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
              <h2 className="text-4xl font-bold text-white" style={{ fontFamily: "Fredoka, sans-serif", textShadow: "0 2px 4px rgba(0,0,0,0.8), 0 4px 12px rgba(0,0,0,0.6), 0 0 20px rgba(0,0,0,0.4)" }}>
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
      </div>{/* end scrollable content area */}

      {/* Simplified Navigation - Fixed Bottom Bar */}
      <motion.div
        className="fixed bottom-0 left-0 right-0 z-50 p-2"
        style={{ paddingBottom: 'calc(0.5rem + env(safe-area-inset-bottom))' }}
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
