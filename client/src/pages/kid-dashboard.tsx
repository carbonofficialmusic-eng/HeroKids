import { useState, useRef, useEffect, useLayoutEffect } from "react";
import { kickScrollReset, kickHeaderRepaint, isPhotoUsed, clearPhotoUsed } from "@/lib/cameraUtils";
import { isNativePlatform } from "@/lib/platform";
import { scrollFieldIntoView } from "@/lib/keyboard-scroll";
import { Link, useLocation } from "wouter";
import confetti from "canvas-confetti";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/hooks/useAuth";
import { useMidnightRefresh } from "@/hooks/useMidnightRefresh";
import { useWebSocket } from "@/hooks/useWebSocket";
import { format, differenceInDays, isToday, isTomorrow, isPast, startOfDay, parseISO, addDays } from "date-fns";
import { filterKidTasksByDate as filterKidTasksByDateUtil } from "@/lib/task-filters";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown, ChevronLeft, ChevronRight, Clock, MessageSquare, RefreshCw, LayoutGrid, LayoutList, Camera, Pin, Gem, Hourglass, Lock, LogOut } from "lucide-react";
import { RewardIconDisplay } from "@/lib/reward-icon";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
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
  ShoppingCart,
  Square,
  CheckSquare,
} from "lucide-react";

// Helper to determine due date status
function getAvailableAgainDays(nextAvailableDate: Date | string | null): number | null {
  if (!nextAvailableDate) return null;
  const now = startOfDay(new Date());
  const next = startOfDay(new Date(nextAvailableDate));
  const diff = differenceInDays(next, now);
  return Math.max(0, diff);
}

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
import familyGoalsIcon from "@assets/family-goals-icon.png";
import { queryClient, apiRequest, getDevHeaders } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { ProfileMenu } from "@/components/profile-menu";
import { NotificationBell } from "@/components/notification-bell";
import { EditMemberDialog } from "@/components/edit-member-dialog";
import { SwitchMemberDialog } from "@/components/switch-member-dialog";
import { TaskCompletionDialog } from "@/components/task-completion-dialog";
import { GoalCompletedModal } from "@/components/GoalCompletedModal";
import { RewardRequestDialog } from "@/components/reward-request-dialog";
import { Leaderboard } from "@/components/leaderboard";
import { Pinboard } from "@/components/pinboard";
import { getAvatarUrl } from "@/lib/skins";
import { hasFeature, canUseSharedRewards, type SubscriptionTier } from "@shared/tier-config";
import { TOTAL_HIDDEN_STARS } from "@shared/skin-config";
import logoUrl from "@assets/herokids_logo_neu.png";

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
  rewardIconEmoji?: string | null;
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
  const redeemMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/rewards/${reward.id}/redeem`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getDevHeaders() },
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

  const cardCls = isReady
    ? "from-amber-900/80 via-yellow-900/80 to-amber-800/80 border-amber-400/60 shadow-amber-400/20"
    : "from-indigo-900/80 via-purple-900/80 to-violet-900/80 border-violet-500/40 shadow-violet-500/10";
  const iconBgCls = isReady
    ? "from-amber-500/30 to-yellow-400/20 border-amber-400/40"
    : "from-violet-500/20 to-purple-500/20 border-violet-400/20";

  return (
    <>
      <div
        className={`relative rounded-2xl border bg-gradient-to-br ${cardCls} shadow-xl overflow-hidden active:scale-[0.98] transition-transform duration-150`}
      >
        {/* Shine overlay */}
        <div className="absolute inset-0 bg-gradient-to-b from-white/5 to-transparent pointer-events-none" />
        {/* Ready glow ring */}
        {isReady && (
          <div className="absolute inset-0 rounded-2xl border-2 border-amber-400/30 pointer-events-none" />
        )}

        <div className="p-4 flex items-center gap-3">
          {/* Icon box */}
          <div className={`relative flex-shrink-0 w-14 h-14 rounded-2xl bg-gradient-to-br ${iconBgCls} border flex items-center justify-center shadow-inner overflow-hidden`}>
            <RewardIconDisplay icon={reward.iconEmoji} imgClassName="w-9 h-9 object-contain drop-shadow-sm" textClassName="text-3xl leading-none" />
            {isReady && (
              <div className="absolute -top-1 -right-1 w-4 h-4 bg-amber-400 rounded-full flex items-center justify-center">
                <span className="text-[8px] font-bold text-amber-900">✓</span>
              </div>
            )}
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-base text-white leading-tight mb-1.5" style={{ fontFamily: "Fredoka, sans-serif" }}>
              {reward.title}
            </h3>
            {/* Progress bar — mockup style */}
            <div className="h-3 rounded-full bg-black/30 overflow-hidden relative mb-1.5">
              <div
                className={`h-full rounded-full relative transition-all ${isReady ? "bg-gradient-to-r from-amber-400 to-yellow-300" : "bg-gradient-to-r from-violet-400 to-purple-300"}`}
                style={{ width: `${percentage}%` }}
              >
                <div className="absolute inset-0 bg-gradient-to-b from-white/30 to-transparent rounded-full" />
                {percentage > 15 && (
                  <div className="absolute right-1 top-1/2 -translate-y-1/2 w-1.5 h-1.5 bg-white/60 rounded-full" />
                )}
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs" style={{ fontFamily: "Nunito, sans-serif" }}>
                {isReady ? (
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border bg-amber-400/20 text-amber-300 border-amber-400/40">
                    <Sparkles className="h-2.5 w-2.5" />{t("kidDashboard.readyToRequest")}
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-white/50">
                    <Zap className="h-3 w-3 text-amber-400" />{remaining} {t("kidDashboard.pointsRemaining", { count: remaining }).split(" ").slice(-1)[0]}
                  </span>
                )}
              </span>
              <span className="flex items-center gap-1 text-xs font-bold text-amber-300">
                <Star className="h-3 w-3 fill-amber-400 text-amber-400" />{reward.pointThreshold}
              </span>
            </div>
          </div>

          {/* CTA */}
          <div className="flex-shrink-0 flex flex-col items-end gap-2">
            <button
              onClick={() => setShowDetails(true)}
              className="text-white/30 hover:text-white/60 transition-colors"
              data-testid={`button-info-reward-${reward.id}`}
            >
              <Info className="h-4 w-4" />
            </button>
            {isReady ? (
              <button
                onClick={handleRequest}
                disabled={redeemMutation.isPending}
                className="flex items-center gap-1.5 px-3 h-10 rounded-xl bg-gradient-to-b from-amber-400 to-amber-500 shadow-lg shadow-amber-500/30 active:scale-95 transition-transform border border-amber-300/50 disabled:opacity-50"
                data-testid={`button-request-reward-${reward.id}`}
              >
                {redeemMutation.isPending
                  ? <Loader2 className="h-4 w-4 text-amber-900 animate-spin" />
                  : <Gift className="h-4 w-4 text-amber-900" />
                }
                <span className="text-xs font-bold text-amber-900 whitespace-nowrap">{t("kidDashboard.now")}</span>
              </button>
            ) : (
              <button
                className="flex items-center gap-1.5 px-3 h-10 rounded-xl bg-white/5 border border-white/10 cursor-not-allowed"
                disabled
                data-testid={`button-request-reward-${reward.id}`}
              >
                <Lock className="h-4 w-4 text-white/25" />
                <span className="text-xs font-bold text-white/25 whitespace-nowrap">{remaining} {t("points")}</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Details Dialog */}
      <AlertDialog open={showDetails} onOpenChange={setShowDetails}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-3 text-2xl" style={{ fontFamily: "Fredoka, sans-serif" }}>
              <div className="h-14 w-14 bg-primary/10 rounded-2xl flex items-center justify-center flex-shrink-0 p-1.5">
                <RewardIconDisplay icon={reward.iconEmoji} imgClassName="w-full h-full object-contain drop-shadow-sm" textClassName="text-4xl leading-none" />
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

// Shopping list section for kid dashboard
function KidShoppingListSection({ taskId, expanded, onToggle }: { taskId: string | number; expanded: boolean; onToggle: () => void }) {
  const queryClient_local = queryClient;
  const { t } = useTranslation();

  const { data: items = [] } = useQuery<any[]>({
    queryKey: ["/api/tasks", taskId, "shopping-items"],
    queryFn: async () => {
      const res = await fetch(`/api/tasks/${taskId}/shopping-items`, { headers: getDevHeaders() });
      if (!res.ok) throw new Error("Failed to fetch shopping items");
      return res.json();
    },
    staleTime: 15000,
  });

  const toggleMutation = useMutation({
    mutationFn: async (itemId: number) => {
      const res = await apiRequest("PATCH", `/api/shopping-items/${itemId}/toggle`);
      return res.json();
    },
    onMutate: async (itemId: number) => {
      await queryClient_local.cancelQueries({ queryKey: ["/api/tasks", taskId, "shopping-items"] });
      const previous = queryClient_local.getQueryData<any[]>(["/api/tasks", taskId, "shopping-items"]);
      queryClient_local.setQueryData(["/api/tasks", taskId, "shopping-items"], (old: any[] = []) =>
        old.map((item) =>
          item.id === itemId
            ? { ...item, completedAt: item.completedAt ? null : new Date().toISOString() }
            : item
        )
      );
      return { previous };
    },
    onError: (_err: any, _itemId: any, context: any) => {
      if (context?.previous) {
        queryClient_local.setQueryData(["/api/tasks", taskId, "shopping-items"], context.previous);
      }
    },
    onSuccess: () => {
      queryClient_local.refetchQueries({ queryKey: ["/api/tasks", taskId, "shopping-items"] });
      queryClient_local.invalidateQueries({ queryKey: ["/api/tasks"] });
      queryClient_local.invalidateQueries({ queryKey: ["/api/family-members/current"] });
    },
  });

  if (items.length === 0) return null;

  const doneCount = items.filter((it: any) => it.completedAt !== null).length;

  return (
    <div className="w-full space-y-2 text-left" data-testid={`kid-shopping-list-${taskId}`}>
      {/* Collapsible header — always visible */}
      <button
        type="button"
        className="flex items-center gap-1.5 w-full text-left"
        onClick={(e) => { e.stopPropagation(); onToggle(); }}
        data-testid={`kid-shopping-list-toggle-${taskId}`}
      >
        <ShoppingCart className="h-4 w-4 text-primary" />
        <span className="text-sm font-semibold flex-1">
          {doneCount}/{items.length} {t("tasks.shoppingItemsDone", { defaultValue: "Artikel erledigt" })}
        </span>
        <ChevronDown className={`h-4 w-4 text-white/70 transition-transform ${expanded ? "rotate-180" : ""}`} />
      </button>
      {expanded && (
        <div className="space-y-1.5">
          {items.map((item: any) => {
            const isDone = item.completedAt !== null;
            return (
              <div
                key={item.id}
                className={`flex items-center gap-2 rounded-xl px-3 py-2 cursor-pointer transition-colors border ${
                  isDone
                    ? "bg-green-500/15 border-green-400/30"
                    : "bg-white/8 border-white/15 hover-elevate"
                }`}
                onClick={(e) => {
                  e.stopPropagation();
                  if (!toggleMutation.isPending) toggleMutation.mutate(item.id);
                }}
                data-testid={`kid-shopping-item-${item.id}`}
              >
                {isDone
                  ? <CheckSquare className="h-5 w-5 text-green-400 flex-shrink-0" />
                  : <Square className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                }
                <span className={`text-sm flex-1 min-w-0 font-medium ${isDone ? "line-through text-muted-foreground" : "text-white"}`}
                  style={{ textShadow: "0 1px 3px rgba(0,0,0,0.7)" }}>
                  {item.text}
                </span>
                {isDone && item.completedByMemberName && (
                  <span
                    className="text-xs font-bold px-1.5 py-0.5 rounded-full shrink-0"
                    style={{
                      backgroundColor: item.completedByMemberColor ? `${item.completedByMemberColor}40` : "rgba(255,255,255,0.15)",
                      color: item.completedByMemberColor ?? "rgba(255,255,255,0.8)",
                    }}
                  >
                    {item.completedByMemberName}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// Task Card Component
function TaskCard({ 
  task, 
  member, 
  onOpenTaskDialog,
  compact = false,
}: { 
  task: TaskWithMeta; 
  member: FamilyMember;
  onOpenTaskDialog: (task: TaskWithMeta) => void;
  compact?: boolean;
}) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [showDetails, setShowDetails] = useState(false);
  const [shoppingListExpanded, setShoppingListExpanded] = useState(false);
  
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

  // Is this a task shared between 2+ people?
  const isMultiMemberSharedTask =
    (task.sharedMemberCompletions && task.sharedMemberCompletions.length > 1) ||
    (task.assignedMemberCompletions && task.assignedMemberCompletions.length > 1);

  // For multi-member tasks the displayed states differ from the raw status:
  // - No yellow "waiting for approval" — suppress isPending in the UI
  // - Green "completed & approved" only when ALL members are approved (allMembersCompleted)
  // - If THIS member submitted but not all are approved yet → show as a neutral submitted state
  const showAsApproved = isMultiMemberSharedTask ? allMembersCompleted : isApproved;
  const showAsPending  = isMultiMemberSharedTask ? false : isPending;
  const showAsSubmitted = isMultiMemberSharedTask && (isPending || (isApproved && !allMembersCompleted));

  // Get assigned member names for message (prefer new style over legacy)
  const assignedMemberNames = task.assignedMemberCompletions?.map(m => m.displayName).join(' & ') || 
    task.sharedMemberCompletions?.map(m => m.displayName).join(' & ') || '';
  
  // Fallback check: if memberHasCompleted is true but status is null, treat as completed
  // This handles edge cases where status might be missing due to data inconsistency
  const hasCompletedWithoutStatus = task.memberHasCompleted && neverAttempted;

  // "Available again in X days" — shown on locked recurring tasks
  // Custom-days tasks have recurrence="none" but recurrenceDays > 0 — treat them as recurring too
  const isRecurringTask = (task.recurrence !== "none" && task.recurrence !== "immediate") || !!(task as any).recurrenceDays;
  const availableAgainDays = (isApproved || isPending || hasNoSlots || hasCompletedWithoutStatus) && isRecurringTask
    ? getAvailableAgainDays((task as any).nextAvailableDate ?? null)
    : null;

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
        headers: { "Content-Type": "application/json", ...getDevHeaders() },
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
  
  if (showAsSubmitted) {
    statusMessage = task.requiresApproval
      ? t("kidDashboard.waitingApproval")
      : (t("kidDashboard.waitingForOthers") || "Warte auf andere Mitglieder…");
    statusColor = task.requiresApproval ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground";
  } else if (showAsPending) {
    statusMessage = t("kidDashboard.waitingApproval");
    statusColor = "text-amber-600 dark:text-amber-400";
  } else if (showAsApproved) {
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

  // Compact grid card for shopping list tasks
  if (compact && (task as any).isShoppingList) {
    const borderColor = showAsPending || showAsSubmitted
      ? "border-amber-400/80"
      : showAsApproved
      ? "border-green-500/50"
      : "border-blue-500/30";

    const cardBg = showAsPending || showAsSubmitted
      ? "linear-gradient(135deg, rgba(120,80,5,0.92) 0%, rgba(92,60,3,0.95) 55%, rgba(70,45,2,0.97) 100%)"
      : showAsApproved
      ? "rgba(34,197,94,0.20)"
      : "linear-gradient(135deg, rgba(51,65,85,0.88) 0%, rgba(30,41,59,0.92) 55%, rgba(15,23,42,0.95) 100%)";

    return (
      <div className="min-w-0 active:scale-[0.97] transition-transform duration-150">
        <div
          className={`rounded-2xl border transition-colors min-w-0 w-full cursor-pointer ${borderColor}`}
          style={{ background: cardBg }}
          data-testid={`task-card-${task.id}`}
          onClick={() => setShoppingListExpanded(v => !v)}
        >
          {/* Header row */}
          <div className="flex items-center gap-2 p-2.5">
            <span className="text-2xl leading-none flex-shrink-0">
              {task.iconEmoji || "🛒"}
            </span>
            <p className="font-bold text-sm leading-snug line-clamp-2 flex-1 min-w-0 text-white" style={{ fontFamily: "Fredoka, sans-serif", textShadow: "0 1px 3px rgba(0,0,0,0.8)" }}>
              {task.title}
            </p>
            <ChevronDown className={`h-4 w-4 text-white/70 flex-shrink-0 transition-transform ${shoppingListExpanded ? "rotate-180" : ""}`} />
          </div>
          {/* Progress row */}
          <div className="px-2.5 pb-2.5">
            <KidShoppingListSection
              taskId={task.id}
              expanded={shoppingListExpanded}
              onToggle={() => setShoppingListExpanded(v => !v)}
            />
          </div>
        </div>
      </div>
    );
  }

  // Standard compact card (non-shopping-list tasks)
  if (compact) {
    const isTransparentState = showAsApproved || allSharedMembersCompleted || showAsPending || showAsSubmitted || isRejected || dueDateInfo.expired;

    const borderColor = showAsApproved || allSharedMembersCompleted
      ? "border-green-500/50"
      : showAsPending || showAsSubmitted
      ? "border-amber-400/80"
      : isRejected
      ? "border-blue-400/40"
      : dueDateInfo.expired
      ? "border-destructive/40"
      : "border-blue-500/30";

    const cardBg = showAsApproved || allSharedMembersCompleted
      ? "rgba(34,197,94,0.20)"
      : showAsPending || showAsSubmitted
      ? "linear-gradient(135deg, rgba(120,80,5,0.92) 0%, rgba(92,60,3,0.95) 55%, rgba(70,45,2,0.97) 100%)"
      : isRejected
      ? "rgba(59,130,246,0.15)"
      : dueDateInfo.expired
      ? undefined
      : "linear-gradient(135deg, rgba(51,65,85,0.88) 0%, rgba(30,41,59,0.92) 55%, rgba(15,23,42,0.95) 100%)";

    return (
      <div className={`min-w-0 transition-transform duration-150 ${isActionable ? "active:scale-[0.96]" : ""}`}>
        <div
          className={`p-2.5 rounded-2xl border transition-colors min-w-0 w-full ${borderColor} ${isActionable ? "cursor-pointer" : ""} ${!isActionable && !showAsApproved && !allSharedMembersCompleted && !showAsPending && !showAsSubmitted && !isRejected && !dueDateInfo.expired ? "opacity-70" : ""}`}
          style={cardBg ? { background: cardBg } : undefined}
          data-testid={`task-card-${task.id}`}
          onClick={isActionable ? handleComplete : undefined}
        >
          {/* Emoji + title row */}
          <div className="flex items-start gap-2 min-w-0">
            <span className={`text-2xl leading-none flex-shrink-0 mt-0.5 ${isActionable ? "" : "opacity-50"}`}>
              {task.iconEmoji || "✅"}
            </span>
            <p className="font-bold text-sm leading-snug line-clamp-2 flex-1 min-w-0 text-white" style={{ fontFamily: "Fredoka, sans-serif", textShadow: "0 1px 3px rgba(0,0,0,0.8)" }}>
              {task.title}
            </p>
            {task.requiresProof && isActionable && (
              <Camera className="h-3.5 w-3.5 text-sky-400 flex-shrink-0 mt-0.5" />
            )}
            {(showAsApproved || allSharedMembersCompleted) && (
              <CheckCircle2 className="h-4 w-4 text-green-400 flex-shrink-0 mt-0.5" />
            )}
            {showAsPending && !showAsApproved && (
              <CheckCircle2 className="h-4 w-4 text-amber-400 flex-shrink-0 mt-0.5" />
            )}
          </div>
          {/* Points / status row */}
          <div className="mt-1.5 flex items-center gap-1">
            {completeMutation.isPending ? (
              <Loader2 className="h-3 w-3 animate-spin text-primary" />
            ) : statusMessage ? (
              <p className={`text-xs leading-tight truncate ${statusColor}`}>{statusMessage}</p>
            ) : (
              <>
                <Star className="h-3 w-3 fill-amber-400 text-amber-400 flex-shrink-0" />
                <span className="text-xs font-bold text-amber-400">+{task.points}</span>
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-w-0 ${isActionable ? "active:scale-[0.97] transition-transform duration-150" : ""}`}>
      <Card
        className={`p-5 transition-colors border-2 rounded-2xl min-w-0 w-full ${
          isActionable && !isRejected 
            ? "cursor-pointer border-blue-500/30 shadow-lg" 
            : isActionable && isRejected 
            ? "cursor-pointer border-blue-400/40 shadow-md shadow-blue-900/15" 
            : showAsApproved 
            ? "border-green-500/20" 
            : showAsSubmitted 
            ? "border-amber-400/50 shadow-md shadow-amber-900/10" 
            : showAsPending 
            ? "border-amber-400/50 shadow-md shadow-amber-900/10" 
            : allSharedMembersCompleted 
            ? "border-green-500/20" 
            : dueDateInfo.expired 
            ? "border-destructive/40" 
            : "border-blue-500/20 opacity-70"
        }`}
        style={{
          background:
            isActionable && !isRejected
              ? "linear-gradient(135deg, rgba(51,65,85,0.88) 0%, rgba(30,41,59,0.92) 55%, rgba(15,23,42,0.95) 100%)"
              : isActionable && isRejected
              ? "rgba(59,130,246,0.2)"
              : showAsApproved || allSharedMembersCompleted
              ? "rgba(34,197,94,0.20)"
              : showAsSubmitted || showAsPending
              ? "linear-gradient(135deg, rgba(120,80,5,0.92) 0%, rgba(92,60,3,0.95) 55%, rgba(70,45,2,0.97) 100%)"
              : dueDateInfo.expired
              ? "rgba(239,68,68,0.15)"
              : "linear-gradient(135deg, rgba(51,65,85,0.88) 0%, rgba(30,41,59,0.92) 55%, rgba(15,23,42,0.95) 100%)"
        }}
        data-testid={`task-card-${task.id}`}
        onClick={(task as any).isShoppingList
          ? () => setShoppingListExpanded(v => !v)
          : isActionable ? handleComplete : undefined}
      >
        <div className="text-center space-y-3">
          <div className={`flex justify-center p-4 rounded-2xl mx-auto w-fit shadow-inner ${
            showAsApproved ? "bg-green-500/25" : 
            showAsSubmitted ? "bg-amber-500/50" :
            showAsPending ? "bg-amber-500/50" :
            isRejected ? "bg-blue-500/20" :
            hasNoSlots ? "bg-amber-500/15" :
            allSharedMembersCompleted ? "bg-green-500/25" :
            isActionable ? "bg-gradient-to-br from-primary/25 to-primary/15 shadow-primary/15" :
            "bg-white/10"
          }`}>
            {completeMutation.isPending ? (
              <Loader2 className="h-12 w-12 text-primary animate-spin" />
            ) : showAsApproved ? (
              <CheckCircle2 className="h-12 w-12 text-green-500" />
            ) : showAsSubmitted ? (
              <CheckCircle2 className="h-12 w-12 text-amber-500" />
            ) : showAsPending ? (
              <CheckCircle2 className="h-12 w-12 text-amber-500" />
            ) : allSharedMembersCompleted ? (
              <CheckCircle2 className="h-12 w-12 text-green-500" />
            ) : (
              <TaskIcon
                className={`h-12 w-12 text-primary transition-all duration-300 ${isActionable ? "" : "opacity-40"}`}
              />
            )}
          </div>
          <div className="flex items-center justify-center gap-2">
            <h3 className="font-bold text-lg" style={{ fontFamily: "Fredoka, sans-serif" }}>
              {task.title}
            </h3>
            {task.requiresProof && isActionable && (
              <Camera className="h-4 w-4 text-sky-400 flex-shrink-0" />
            )}
            {/* Info Button - always visible */}
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

          {/* Shopping List Items */}
          {(task as any).isShoppingList && (
            <KidShoppingListSection taskId={task.id} expanded={shoppingListExpanded} onToggle={() => setShoppingListExpanded(v => !v)} />
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
            <div className="space-y-1.5 w-full">
              <div 
                className={`text-sm px-4 py-2 rounded-full text-center font-semibold border ${
                  showAsSubmitted ? 'bg-amber-500/40 border-amber-400/60 text-amber-600 dark:text-amber-400' :
                  showAsPending ? 'bg-amber-500/40 border-amber-400/60 text-amber-600 dark:text-amber-400' :
                  showAsApproved || allSharedMembersCompleted ? 'bg-green-500/15 border-green-400/30 text-green-600 dark:text-green-400' :
                  isRejected ? 'bg-blue-500/15 border-blue-400/30 text-blue-600 dark:text-blue-400' :
                  hasNoSlots ? 'bg-amber-500/15 border-amber-400/30 text-amber-600 dark:text-amber-400' :
                  dueDateInfo.expired ? 'bg-destructive/15 border-destructive/30 text-destructive' :
                  'bg-white/8 border-white/15 text-muted-foreground'
                }`}
              >
                {statusMessage}
              </div>
              <div className="flex items-center justify-center gap-1.5 opacity-55">
                <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                <span className="text-sm font-bold text-muted-foreground">{task.points}</span>
              </div>
            </div>
          ) : (
            <div
              className="flex items-center justify-center gap-1.5 bg-gradient-to-r from-amber-500/90 to-yellow-400/90 text-white px-4 py-2 rounded-full font-bold text-base shadow-md shadow-amber-900/30"
              onClick={(task as any).isShoppingList ? (e) => { e.stopPropagation(); setShoppingListExpanded(v => !v); } : undefined}
            >
              <Star className="h-4 w-4 fill-white text-white" />
              <span>+{task.points}</span>
            </div>
          )}
          
          {hasNoSlots && task.remainingSlots === 0 && (
            <div className="flex items-center justify-center gap-1.5 text-xs bg-amber-500/10 text-amber-600 dark:text-amber-400 px-3 py-1 rounded-full border border-amber-400/20 font-medium">
              {t("kidDashboard.noSlotsLeft")}
            </div>
          )}

          {/* Available-again time chip for locked recurring tasks */}
          {availableAgainDays !== null && (
            <div className="flex items-center justify-center gap-2 bg-black/40 text-white px-4 py-2 rounded-full border border-white/30 text-sm font-bold shadow-md">
              <Clock className="h-4 w-4 shrink-0 text-white/80" />
              <span>
                {availableAgainDays === 0
                  ? t("tasks.availableToday")
                  : availableAgainDays === 1
                  ? t("tasks.availableTomorrow")
                  : t("tasks.availableInDays", { count: availableAgainDays })}
              </span>
            </div>
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

                  {availableAgainDays !== null && (
                    <div className="flex justify-between items-center p-3 bg-muted/50 rounded-xl">
                      <span className="font-semibold">{t("tasks.availableAgainLabel")}</span>
                      <div className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
                        <Clock className="h-4 w-4" />
                        <span>
                          {availableAgainDays === 0
                            ? t("tasks.availableToday")
                            : availableAgainDays === 1
                            ? t("tasks.availableTomorrow")
                            : t("tasks.availableInDays", { count: availableAgainDays })}
                        </span>
                      </div>
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
    </div>
  );
}


// Scrollt die Pinnwand so, dass sie direkt unterhalb des fixen Headers erscheint
function scrollToPinboard(el: HTMLElement) {
  const root = document.getElementById("root") ?? document.documentElement;
  const header = document.querySelector("[data-app-header]") as HTMLElement | null;
  // headerBottom ist die Unterkante des Headers (viewport-relativ, inkl. safe-area)
  const headerBottom = header ? header.getBoundingClientRect().bottom : 72;
  // Wo ist das Element gerade (viewport-relativ)?
  const currentTop = el.getBoundingClientRect().top;
  // Wir wollen, dass currentTop nach dem Scroll gleich headerBottom + 8px ist
  const delta = currentTop - (headerBottom + 8);
  root.scrollTo({ top: root.scrollTop + delta, behavior: "smooth" });
}

function scrollToSection(id: string, behavior: ScrollBehavior = "smooth") {
  const root = document.getElementById("root") ?? document.documentElement;
  const el = document.getElementById(id);
  if (!el) return;
  const header = document.querySelector("[data-app-header]") as HTMLElement | null;
  const headerBottom = header ? header.getBoundingClientRect().bottom : 72;
  const currentTop = el.getBoundingClientRect().top;
  const delta = currentTop - (headerBottom + 16);
  root.scrollTo({ top: root.scrollTop + delta, behavior });
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
  const [, navigate] = useLocation();
  const [editMemberDialogOpen, setEditMemberDialogOpen] = useState(false);
  const [switchMemberDialogOpen, setSwitchMemberDialogOpen] = useState(false);
  const [memberToEdit, setMemberToEdit] = useState<FamilyMember | null>(null);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [taskDialogOpen, setTaskDialogOpen] = useState(false);
  const [requestRewardDialogOpen, setRequestRewardDialogOpen] = useState(false);
  const savedScrollRef = useRef(0);
  const [chatBarCollapsed, setChatBarCollapsed] = useState(() => {
    try { return localStorage.getItem("herokids_chatbar_collapsed") === "true"; } catch { return false; }
  });

  // Parental Gate state
  const [parentalGateOpen, setParentalGateOpen] = useState(false);
  const [parentalGateQ, setParentalGateQ] = useState({ question: "", answer: 0 });
  const [parentalGateInput, setParentalGateInput] = useState("");
  const [parentalGateError, setParentalGateError] = useState(false);
  const [justJoinedIds, setJustJoinedIds] = useState<Set<string>>(new Set());
  const [dismissedSharedIds, setDismissedSharedIds] = useState<Set<string>>(new Set());

  function generateMathQ() {
    const ops = [
      () => { const a = Math.floor(Math.random() * 9) + 2; const b = Math.floor(Math.random() * 9) + 2; return { question: `${a} × ${b}`, answer: a * b }; },
      () => { const a = Math.floor(Math.random() * 50) + 20; const b = Math.floor(Math.random() * 30) + 10; return { question: `${a} + ${b}`, answer: a + b }; },
    ];
    return ops[Math.floor(Math.random() * ops.length)]();
  }

  function openParentalGate() {
    setParentalGateQ(generateMathQ());
    setParentalGateInput("");
    setParentalGateError(false);
    setParentalGateOpen(true);
  }

  function handleParentalGateSubmit() {
    if (parseInt(parentalGateInput) === parentalGateQ.answer) {
      setParentalGateOpen(false);
      navigate("/pricing");
    } else {
      setParentalGateError(true);
      setParentalGateQ(generateMathQ());
      setParentalGateInput("");
    }
  }

  // Kick WKWebView header repaint on mount (App.tsx already owns --sat, no re-read here)
  useEffect(() => {
    const t = setTimeout(() => kickHeaderRepaint(), 300);
    return () => clearTimeout(t);
  }, []);

  // Scroll to pinboard when navigated here from a pinboard_posted notification
  useEffect(() => {
    if (window.location.hash !== "#pinboard") return;
    const el = document.getElementById("pinboard");
    if (el) {
      setTimeout(() => scrollToPinboard(el), 300);
    }
  }, []);

  useEffect(() => {
    const target = sessionStorage.getItem("dashboardScrollTarget");
    if (!target) return;
    sessionStorage.removeItem("dashboardScrollTarget");

    // Retry until the section element appears in the DOM (data may still be loading)
    let attempts = 0;
    const maxAttempts = 10;
    let timerId: ReturnType<typeof setTimeout>;

    let settleTimer: ReturnType<typeof setTimeout>;

    const tryScroll = () => {
      const el = document.getElementById(target);
      if (el) {
        // Wait for layout to fully settle after data loads, then scroll once (instant = no jump)
        settleTimer = setTimeout(() => scrollToSection(target, "instant"), 300);
        return;
      }
      attempts++;
      if (attempts < maxAttempts) {
        timerId = setTimeout(tryScroll, 200);
      }
    };

    // First attempt after 400ms (App.tsx scroll-to-top runs before this)
    timerId = setTimeout(tryScroll, 400);
    return () => { clearTimeout(timerId); clearTimeout(settleTimer); };
  }, []);

  // Lock #root scroll while any dialog is open — same pattern as parent dashboard
  const anyKidDialogOpen = taskDialogOpen || requestRewardDialogOpen || editMemberDialogOpen || switchMemberDialogOpen;
  const prevAnyKidDialogOpenRef = useRef(false);
  useLayoutEffect(() => {
    const root = document.getElementById('root');
    if (!root) return;
    if (anyKidDialogOpen) {
      savedScrollRef.current = root.scrollTop;
      root.style.overflowY = 'hidden';
      prevAnyKidDialogOpenRef.current = true;
    } else if (prevAnyKidDialogOpenRef.current) {
      // Only restore scroll when a dialog was actually just closed
      prevAnyKidDialogOpenRef.current = false;
      root.style.overflowY = 'auto';
      const target = savedScrollRef.current;
      root.scrollTop = target;
      const t1 = setTimeout(() => { root.scrollTop = target; }, 350);
      const t2 = setTimeout(() => { root.scrollTop = target; }, 700);
      return () => { clearTimeout(t1); clearTimeout(t2); };
    } else {
      // Initial mount: just ensure overflow is auto, don't touch scrollTop
      root.style.overflowY = 'auto';
    }
  }, [anyKidDialogOpen]);

  const [leaderboardPeriod, setLeaderboardPeriod] = useState<"week" | "month">("week");

  // Detect desktop for sticky leaderboard sidebar (lg = 1024px)
  const [isDesktop, setIsDesktop] = useState(false);
  useEffect(() => {
    const check = () => setIsDesktop(window.innerWidth >= 1024);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  useEffect(() => {
    localStorage.setItem("herokids_chatbar_collapsed", String(chatBarCollapsed));
  }, [chatBarCollapsed]);

  const [kidTaskFilter, setKidTaskFilter] = useState<"daily" | "weekly" | "monthly" | "onetime" | "all">("all");
  const [kidDashboardView, setKidDashboardView] = useState<"list" | "grid">(() => {
    const saved = localStorage.getItem("herokids_kid_dashboard_view");
    return saved === "grid" ? "grid" : "list";
  });
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem("herokids_kid_collapsed_categories");
      return saved ? new Set<string>(JSON.parse(saved)) : new Set<string>();
    } catch {
      return new Set<string>();
    }
  });

  // Persist kid dashboard view preference
  useEffect(() => {
    localStorage.setItem("herokids_kid_dashboard_view", kidDashboardView);
  }, [kidDashboardView]);

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
      queryClient.invalidateQueries({ queryKey: ["/api/family-members/current"] });
      queryClient.invalidateQueries({ queryKey: ["/api/family-members"] });
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
    onSuccess: (_data, redemptionId) => {
      const idStr = String(redemptionId);
      setDismissedSharedIds(prev => new Set([...prev, idStr]));
      queryClient.invalidateQueries({ queryKey: ["/api/rewards/shared"] });
      queryClient.invalidateQueries({ queryKey: ["/api/reward-redemptions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/family-members/current"] });
      queryClient.invalidateQueries({ queryKey: ["/api/family-members"] });
      queryClient.invalidateQueries({ queryKey: ["/api/device-link/session"] });
    },
    onError: (error: any, redemptionId) => {
      const idStr = String(redemptionId);
      setJustJoinedIds(prev => { const next = new Set(prev); next.delete(idStr); return next; });
      toast({
        title: t("kidDashboard.error"),
        description: error.message || t("kidDashboard.joinError"),
        variant: "destructive",
      });
    },
  });

  const leaveSharingMutation = useMutation({
    mutationFn: async (redemptionId: string) => {
      return await apiRequest("POST", `/api/rewards/redemptions/${redemptionId}/leave-sharing`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/rewards/shared"] });
      queryClient.invalidateQueries({ queryKey: ["/api/reward-redemptions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/family-members/current"] });
      queryClient.invalidateQueries({ queryKey: ["/api/family-members"] });
      queryClient.invalidateQueries({ queryKey: ["/api/device-link/session"] });
    },
    onError: (error: any) => {
      toast({
        title: t("kidDashboard.error"),
        description: error.message || t("kidDashboard.leaveError"),
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

  const cancelRedemptionMutation = useMutation({
    mutationFn: async (redemptionId: string) => {
      return await apiRequest("DELETE", `/api/reward-redemptions/${redemptionId}`);
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/reward-redemptions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/reward-redemptions/pending-count"] });
      queryClient.invalidateQueries({ queryKey: ["/api/rewards/shared"] });
      queryClient.invalidateQueries({ queryKey: ["/api/family-members/current"] });
      queryClient.invalidateQueries({ queryKey: ["/api/family-members"] });
      queryClient.invalidateQueries({ queryKey: ["/api/device-link/session"] });
      queryClient.invalidateQueries({ queryKey: ["/api/rewards"] });
    },
    onError: (error: any) => {
      toast({ title: t("rewardsBoard.cancelError"), description: error.message, variant: "destructive" });
    },
  });

  const cancelSharingMutation = useMutation({
    mutationFn: async (redemptionId: string) => {
      return await apiRequest("POST", `/api/rewards/redemptions/${redemptionId}/cancel-sharing`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/reward-redemptions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/rewards/shared"] });
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
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
    staleTime: 5 * 60 * 1000,
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
    staleTime: 5 * 60 * 1000,
  });

  // User is authenticated via either Replit Auth OR Device Session
  const isDeviceAuthenticated = deviceSession?.authenticated === true;
  const hasAnyAuth = !!authUser || isDeviceAuthenticated;

  // For both Replit Auth and Device Session users, fetch fresh member from API
  // This ensures we always have up-to-date points data
  const { data: memberFromApi, isLoading: memberApiLoading } = useQuery<FamilyMember>({
    queryKey: ["/api/family-members/current"],
    enabled: !!authUser || isDeviceAuthenticated, // Fetch for both auth types
    staleTime: 5 * 60 * 1000,
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
  const [completedGoal, setCompletedGoal] = useState<{ id: number; title: string } | null>(null);
  useWebSocket(member?.familyName || null, undefined, {
    onGoalCompleted: (goalId, goalTitle) => {
      const key = `herokids_goal_celebrated_${goalId}_${member?.id ?? 0}`;
      if (!localStorage.getItem(key)) {
        localStorage.setItem(key, '1');
        setCompletedGoal({ id: goalId, title: goalTitle });
      }
    },
  });

  const { data: realMember } = useQuery<FamilyMember>({
    queryKey: ["/api/family-members/real"],
    enabled: hasAnyAuth,
    staleTime: 5 * 60 * 1000,
  });

  const { data: familyData } = useQuery<Family>({
    queryKey: ["/api/families/current"],
    enabled: !!member,
    staleTime: 5 * 60 * 1000,
  });

  const { data: familyMembers = [] } = useQuery<FamilyMember[]>({
    queryKey: ["/api/family-members"],
    enabled: !!member,
    staleTime: 5 * 60 * 1000,
  });

  const { data: rewards = [] } = useQuery<Reward[]>({
    queryKey: ["/api/rewards"],
    enabled: !!member,
    staleTime: 5 * 60 * 1000,
  });

  const { data: tasks = [] } = useQuery<TaskWithMeta[]>({
    queryKey: ["/api/tasks"],
    enabled: !!member,
    staleTime: 5 * 60 * 1000,
  });

  // Fetch family goals
  const { data: goals = [] } = useQuery<FamilyGoal[]>({
    queryKey: ["/api/family-goals"],
    enabled: !!member,
    staleTime: 5 * 60 * 1000,
  });

  // Show celebration modal for recently completed goals that haven't been celebrated yet.
  // This catches members who missed the live WS event (e.g. were on a sub-page).
  useEffect(() => {
    if (!goals.length) return;
    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    for (const goal of goals) {
      if (!goal.isActive && goal.completedAt) {
        const completedTime = new Date(goal.completedAt).getTime();
        if (completedTime > sevenDaysAgo) {
          const key = `herokids_goal_celebrated_${goal.id}_${member?.id ?? 0}`;
          if (!localStorage.getItem(key)) {
            localStorage.setItem(key, '1');
            setCompletedGoal({ id: goal.id, title: goal.title });
            break;
          }
        }
      }
    }
  }, [goals]);

  // Fetch reward redemptions (child's redeemed rewards)
  const { data: redemptions = [] } = useQuery<(RewardRedemption & { rewardTitle?: string })[]>({
    queryKey: ["/api/reward-redemptions"],
    enabled: !!member,
    staleTime: 5 * 60 * 1000,
  });

  // Fetch active shared rewards from other family members
  const { data: sharedRewards = [] } = useQuery<SharedReward[]>({
    queryKey: ["/api/rewards/shared"],
    enabled: !!member,
    staleTime: 5 * 60 * 1000,
  });

  // Fetch unread chat message count
  const { data: unreadChatData } = useQuery<{ count: number }>({
    queryKey: ["/api/chat/unread-count"],
    enabled: !!member && (hasFeature(familyData?.subscriptionTier as SubscriptionTier || "free", "familyChat") || !!(familyData?.trialEndsAt && new Date(familyData.trialEndsAt) > new Date())),
    staleTime: 5 * 60 * 1000,
  });

  // Fetch achievement definitions for special rewards display
  const { data: achievements = [] } = useQuery<AchievementDefinition[]>({
    queryKey: ["/api/achievements"],
    enabled: !!member,
    staleTime: 5 * 60 * 1000,
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

  // Shared rewards this member has joined as participant (not initiator)
  // Use `redemptions` (all family redemptions) so that sharing_finalized is also included
  const joinedSharedRewards = member
    ? (redemptions as any[]).filter(r =>
        r.memberId !== member.id &&
        Array.isArray(r.sharingParticipants) &&
        r.sharingParticipants.some((p: any) => p.memberId === member.id)
      )
    : [];

  // Combined chronological list for dashboard "last 2 acquired" section
  const dashboardLastTwo = [
    ...myRedemptions.map(r => ({ ...r, _isOwn: true })),
    ...joinedSharedRewards.map(r => ({ ...r, _isOwn: false })),
  ]
    .sort((a, b) => {
      const da = a.redeemedAt ? new Date(a.redeemedAt).getTime() : 0;
      const db = b.redeemedAt ? new Date(b.redeemedAt).getTime() : 0;
      return db - da;
    })
    .slice(0, 2);

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
      if (isPhotoUsed()) {
        clearPhotoUsed();
        setTimeout(() => { window.location.href = window.location.pathname; }, 500);
      }
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
        headers: { "Content-Type": "application/json", ...getDevHeaders() },
        body: JSON.stringify(proofPhotoUrl ? { proofPhotoUrl } : {}),
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: "Unknown error" }));
        throw new Error(errorData.message || "Failed to complete task");
      }
      return response.json();
    },
    onMutate: async ({ taskId }) => {
      await queryClient.cancelQueries({ queryKey: ["/api/tasks"] });
      const previousTasks = queryClient.getQueryData(["/api/tasks"]);
      queryClient.setQueryData<any[]>(["/api/tasks"], (old) =>
        old ? old.map((t) => {
          if (t.id !== taskId) return t;
          // If task requires approval → optimistically set pending (yellow)
          // Otherwise → set approved (gray/green)
          if (t.requiresApproval) {
            return { ...t, memberHasCompleted: true, memberCompletionStatus: "pending" };
          }
          return { ...t, memberHasCompleted: true, memberCompletionStatus: "approved" };
        }) : old
      );
      return { previousTasks };
    },
    onError: (error: any, _vars: any, context: any) => {
      if (context?.previousTasks) {
        queryClient.setQueryData(["/api/tasks"], context.previousTasks);
      }
      toast({
        variant: "destructive",
        title: t("kidDashboard.error"),
        description: error.message || t("kidDashboard.taskError"),
      });
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
      clearPhotoUsed();
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

  // Show loading state — use same fixed container so WKWebView never sees a layout shift
  const isLoading = userLoading || deviceSessionLoading || memberLoading;
  if (isLoading) {
    return (
      <div style={{ position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1 }}>
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // If not logged in via either method
  if (!hasAnyAuth || !member) {
    return (
      <div style={{ position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1 }}>
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

  // Filter active rewards and sort newest first
  const activeRewards = rewards
    .filter(r => r.isActive)
    .sort((a, b) => {
      const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return dateB - dateA;
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
    
    // One-time tasks with approval: stay visible (yellow pending state) until parent approves
    // One-time tasks without approval disappear immediately (task status becomes "completed" on backend)
    // Custom-interval tasks (recurrenceDays > 0) must be excluded — they stay visible after approval
    if (t.recurrence === "none" && !(t as any).recurrenceDays && t.requiresApproval && t.memberHasCompleted) {
      return t.memberCompletionStatus !== "approved";
    }

    // Normal one-time tasks: Hide when member (or family) has completed.
    // Custom-interval tasks (recurrence="none" but recurrenceDays > 0) are recurring —
    // keep them visible even after completion so the "available again in X days" UI shows.
    const isCustomInterval = !!(t as any).recurrenceDays;
    return !t.memberHasCompleted || t.recurrence !== "none" || isCustomInterval;
  });

  // Task categorization helpers for kid dashboard
  const getTaskCategory = (iconEmoji: string | null): string => {
    const emoji = iconEmoji || "⭐";
    const householdIcons = ["🧹", "🍽️", "🗑️", "🧺", "🛁", "🧼", "🪣", "🧽"];
    const schoolIcons = ["📚", "✏️", "📝", "📖", "🎒", "✍️", "📓", "🎓"];
    const selfCareIcons = ["🦷", "🚿", "💇", "🛏️", "👕", "👟", "🧴"];
    if (householdIcons.includes(emoji)) return "household";
    if (schoolIcons.includes(emoji)) return "school";
    if (selfCareIcons.includes(emoji)) return "selfCare";
    return "other";
  };

  const getCategoryLabel = (category: string): string => {
    const customNames = familyData?.categoryNames as { household?: string; school?: string; selfCare?: string; other?: string } | null | undefined;
    if (customNames && customNames[category as keyof typeof customNames]) {
      return customNames[category as keyof typeof customNames]!;
    }
    const labels: Record<string, string> = {
      household: t("dashboard.categoryHousehold"),
      school: t("dashboard.categorySchool"),
      selfCare: t("dashboard.categorySelfCare"),
      other: t("dashboard.categoryOther"),
    };
    return labels[category] || category;
  };

  const getCategoryEmoji = (category: string): string => {
    const emojis: Record<string, string> = {
      household: "🏠",
      school: "📚",
      selfCare: "🧼",
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
    
    const categoryOrder = ["household", "school", "selfCare", "other"];
    const sortedGroups: Record<string, typeof myTasks> = {};
    
    categoryOrder.forEach(cat => {
      if (groups[cat] && groups[cat].length > 0) {
        // Sort tasks within each category
        sortedGroups[cat] = sortKidTasksWithinCategory(groups[cat]);
      }
    });
    
    return sortedGroups;
  };

  const importantMyTasks = myTasks.filter(t => (t as any).isImportant);
  const regularMyTasks = myTasks.filter(t => !(t as any).isImportant);
  const filteredKidTasks = filterKidTasksByDate(regularMyTasks);
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
      localStorage.setItem("herokids_kid_collapsed_categories", JSON.stringify([...newSet]));
      return newSet;
    });
  };

  return (
    <div className="min-h-dvh">
      {/* Header — same structure as parent dashboard: fixed, in root stacking context */}
      <header
        data-app-header
        className="fixed top-0 left-0 right-0 z-40 w-full bg-background/95"
        style={{
          paddingTop: 'max(calc(var(--sat, env(safe-area-inset-top)) - 6px), 0px)',
          height: 'calc(var(--header-h) + max(calc(var(--sat, env(safe-area-inset-top)) - 6px), 0px))',
          minHeight: 'calc(var(--header-h) + max(calc(var(--sat, env(safe-area-inset-top)) - 6px), 0px))',
          maxHeight: 'calc(var(--header-h) + max(calc(var(--sat, env(safe-area-inset-top)) - 6px), 0px))',
          transform: 'translateZ(0)',
          backfaceVisibility: 'hidden',
          WebkitBackfaceVisibility: 'hidden',
        }}
      >
        <div className="container mx-auto max-w-7xl h-full flex items-center justify-between gap-4" style={{ paddingLeft: 'max(1rem, env(safe-area-inset-left))', paddingRight: 'max(1rem, env(safe-area-inset-right))' }}>
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div className="flex-shrink-0" data-testid="avatar-header-kid">
              <Avatar className="h-10 w-10 header-avatar" style={{ borderWidth: "3px", borderStyle: "solid", borderColor: member.color }}>
                <AvatarImage src={getAvatarUrl(member.activeSkinId, member.avatarUrl, member.useCustomAvatar, member.updatedAt)} />
                <AvatarFallback style={{ backgroundColor: member.color }} className="text-white">
                  {member.displayName[0]}
                </AvatarFallback>
              </Avatar>
            </div>
            <div className="min-w-0">
              <div className="text-sm text-muted-foreground truncate hidden sm:block header-secondary-text">{member.familyName}</div>
              <div className="font-semibold truncate header-name-text" data-testid="text-user-name">
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
              return <span onClick={openParentalGate} className="cursor-pointer">{badge}</span>;
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

      {/* Content — paddingTop pushes below fixed header, #root handles scrolling like parent dashboard */}
      <div style={{ paddingTop: 'calc(var(--header-h) + var(--sat, env(safe-area-inset-top)))' }}>
      <div className="container mx-auto max-w-7xl pt-4 pb-[calc(8rem+env(safe-area-inset-bottom))] relative" style={{ paddingLeft: 'max(1rem, env(safe-area-inset-left))', paddingRight: 'max(1rem, env(safe-area-inset-right))' }}>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
      <div className="lg:col-span-2 space-y-8 min-w-0 overflow-hidden">
        {/* HeroKids Logo */}
        <div className="flex justify-center">
          <img 
            src={logoUrl} 
            alt="HeroKids Logo" 
            className="h-36 w-auto object-contain"
            data-testid="img-kid-dashboard-logo"
          />
        </div>

        {/* Hero Header */}
        <div>
          <div className="py-4">
            <div className="flex items-center justify-between flex-wrap gap-5">
              <div className="flex items-center gap-5">
                <button
                  onClick={() => { setMemberToEdit(member); setEditMemberDialogOpen(true); }}
                  className="flex-shrink-0 rounded-full cursor-pointer hover-elevate"
                  data-testid="button-avatar-profile-large-kid"
                >
                  <Avatar className="h-20 w-20 shadow-lg" style={{ borderWidth: "4px", borderStyle: "solid", borderColor: member.color }}>
                    <AvatarImage src={getAvatarUrl(member.activeSkinId, member.avatarUrl, member.useCustomAvatar, member.updatedAt)} />
                    <AvatarFallback style={{ backgroundColor: member.color }} className="text-3xl font-bold text-white">
                      {member.displayName[0]}
                    </AvatarFallback>
                  </Avatar>
                </button>
                {streak > 0 && (
                  <div className="flex items-center gap-2">
                    <Flame className="h-6 w-6 text-orange-500" />
                    <span className="text-base font-bold">{t("kidDashboard.dayStreak", { count: streak })}</span>
                  </div>
                )}
                {/* Star Counter - Links to Skins Gallery */}
                <Link href="/skins">
                  <div className="flex items-center gap-2 bg-gradient-to-r from-yellow-500/60 to-orange-500/60 px-4 py-2 rounded-xl border border-yellow-500/70 cursor-pointer hover:from-yellow-500/75 hover:to-orange-500/75 transition-colors" data-testid="link-stars-to-skins">
                    <Star className="h-6 w-6 fill-yellow-400 text-yellow-400" />
                    <span className="text-xl font-bold" style={{ fontFamily: "Fredoka, sans-serif" }} data-testid="text-stars-found">
                      {member.starsFound ?? 0}/{TOTAL_HIDDEN_STARS}
                    </span>
                  </div>
                </Link>
                <button
                  data-testid="button-scroll-to-pinboard-kid"
                  className="flex items-center gap-2 bg-card px-3 py-1.5 rounded-xl border border-border cursor-pointer hover-elevate"
                  onClick={() => {
                    const el = document.getElementById("pinboard");
                    if (el) scrollToPinboard(el);
                  }}
                >
                  <MessageSquare className="h-5 w-5" />
                </button>
              </div>
              <div className="bg-card p-4 rounded-2xl border min-w-[220px]">
                <p className="text-xs text-muted-foreground mb-2 font-medium text-center">{t("kidDashboard.yourPoints")}</p>
                <div className="space-y-2">
                  <div className="text-center pb-2 border-b border-border">
                    <p className="text-xs text-muted-foreground mb-0.5">{t("kidDashboard.totalEarned")}</p>
                    <div
                      className="text-3xl font-bold"
                      style={{ fontFamily: "Fredoka, sans-serif" }}
                      data-testid="text-total-earned"
                    >
                      {member.totalEarned.toLocaleString()}
                    </div>
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-sm text-muted-foreground">{t("kidDashboard.available")}</span>
                    <span className="text-lg font-bold" data-testid="text-total-points">
                      {member.totalPoints.toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Special Achievement Rewards Section */}
        {specialRewards.length > 0 && (
          <div className="space-y-4" id="section-bonus-rewards">
            <div className="flex items-end justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="h-24 w-24 flex items-center justify-center flex-shrink-0 -my-2">
                  <img src="/nav-icons/bonus.png" alt="" className="w-full h-full object-contain drop-shadow-sm" />
                </div>
                <h2 className="text-2xl font-bold text-white" style={{ fontFamily: "Fredoka, sans-serif", textShadow: "0 2px 4px rgba(0,0,0,0.8), 0 4px 12px rgba(0,0,0,0.6), 0 0 20px rgba(0,0,0,0.4)" }}>
                  {t("kidDashboard.specialPrizes")}
                </h2>
              </div>
              {specialRewards.length > 2 && (
                <Button variant="ghost" size="icon" asChild className="bg-card border-2 border-border shadow-sm text-foreground flex-shrink-0 mb-1" data-testid="button-view-all-achievements">
                  <Link href="/my-achievements" onClick={() => sessionStorage.setItem("dashboardScrollTarget", "section-bonus-rewards")}>
                    <ChevronRight className="h-5 w-5" />
                  </Link>
                </Button>
              )}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {specialRewards.slice(0, 2).map((achievement, index) => (
                <div key={achievement.id} className="relative rounded-2xl border bg-gradient-to-br from-indigo-900/80 via-purple-900/80 to-violet-900/80 border-violet-500/40 shadow-xl shadow-violet-500/10 overflow-hidden">
                  {/* Shine overlay */}
                  <div className="absolute inset-0 bg-gradient-to-b from-white/5 to-transparent pointer-events-none" />
                  <div className="p-4 flex items-center gap-3">
                    {/* Icon box */}
                    <div className="relative flex-shrink-0 w-14 h-14 rounded-2xl bg-gradient-to-br from-violet-500/20 to-purple-500/20 border border-violet-400/20 flex items-center justify-center shadow-inner overflow-hidden">
                      <Gift className="h-7 w-7 text-violet-300" />
                    </div>
                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <h3 className="font-bold text-base text-white truncate" style={{ fontFamily: "Fredoka, sans-serif" }}>
                        {t(`achievements.title_${achievement.slug}`)}
                      </h3>
                      <p className="text-sm text-violet-300 font-semibold truncate" style={{ fontFamily: "Fredoka, sans-serif" }}>
                        {achievement.rewardType === "custom" && achievement.customReward
                          ? achievement.customReward
                          : `+${achievement.bonusPoints} ${t("points")}`}
                      </p>
                    </div>
                    {/* Info button */}
                    <Popover>
                      <PopoverTrigger asChild>
                        <button className="flex-shrink-0 text-white/30 hover:text-white/60 transition-colors" data-testid={`button-info-${achievement.slug}`}>
                          <Info className="h-4 w-4" />
                        </button>
                      </PopoverTrigger>
                      <PopoverContent side="left" className="max-w-[250px]">
                        <p className="text-sm">{t(`achievements.desc_${achievement.slug}`)}</p>
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Active Shared Rewards Section - From other family members */}
        {sharedRewards.filter(sr => sr.memberId !== member?.id && !dismissedSharedIds.has(String(sr.id)) && !sr.participants.some(p => p.memberId === member?.id)).length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-2xl bg-blue-500/20">
                <Users className="h-7 w-7 text-blue-500" />
              </div>
              <h2 className="text-2xl font-bold text-white" style={{ fontFamily: "Fredoka, sans-serif", textShadow: "0 2px 4px rgba(0,0,0,0.8), 0 4px 12px rgba(0,0,0,0.6), 0 0 20px rgba(0,0,0,0.4)" }}>
                {t("kidDashboard.joinableRewards")}
              </h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {sharedRewards
                .filter(sr => sr.memberId !== member?.id && !dismissedSharedIds.has(String(sr.id)) && !sr.participants.some(p => p.memberId === member?.id))
                .map((shared, index) => {
                  const hasJoined = shared.participants.some(p => p.memberId === member?.id) || justJoinedIds.has(String(shared.id));
                  const initiatorMember = familyMembers.find(m => m.id === shared.memberId);

                  const joinRarity = hasJoined ? "LEGENDARY" : "SPECIAL";
                  const joinRarityColors = {
                    LEGENDARY: { glow: "rgba(251,191,36,0.15)", border: "rgba(251,191,36,0.22)", icon: "#d97706", iconBg: "rgba(251,191,36,0.1)", chip: "rgba(251,191,36,0.12)", chipText: "#d97706", cardBg: "linear-gradient(160deg,#161008 0%,#1e1408 40%,#130e06 100%)" },
                    SPECIAL:   { glow: "rgba(96,165,250,0.13)", border: "rgba(96,165,250,0.2)", icon: "#3b82f6", iconBg: "rgba(59,130,246,0.1)", chip: "rgba(59,130,246,0.12)", chipText: "#60a5fa", cardBg: "linear-gradient(160deg,#080d18 0%,#0d1528 40%,#060a14 100%)" },
                  };
                  const jrc = joinRarityColors[joinRarity];
                  const JoinIcon = hasJoined ? Trophy : Users;

                  return (
                    <div key={shared.id} style={{ borderRadius: "20px", background: jrc.cardBg, border: `2px solid ${jrc.border}`, boxShadow: `0 0 18px ${jrc.glow}, 0 6px 20px rgba(0,0,0,0.6), 0 2px 6px rgba(0,0,0,0.4)`, overflow: "hidden" }}>
                      <div style={{ padding: "14px 14px 16px" }}>
                        {/* Icon zone */}
                        <div style={{ display: "flex", justifyContent: "center", marginBottom: 12 }}>
                          <div style={{ width: 70, height: 70, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: "50%", background: jrc.iconBg, border: `2px solid ${jrc.border}`, boxShadow: `0 0 20px ${jrc.glow}` }}>
                            <JoinIcon style={{ width: 32, height: 32, color: jrc.icon }} />
                          </div>
                        </div>

                        {/* Title */}
                        <h3 style={{ fontFamily: "Fredoka, sans-serif", fontSize: 17, fontWeight: 700, color: "#fff", textAlign: "center", marginBottom: 10, textShadow: "0 1px 4px rgba(0,0,0,0.7)", lineHeight: 1.2 }}>
                          {shared.reward?.title || t("kidDashboard.reward")}
                        </h3>

                        {/* Stat chips */}
                        <div style={{ display: "flex", gap: 6, justifyContent: "center", flexWrap: "wrap", marginBottom: 10 }}>
                          <div style={{ background: jrc.chip, border: `1px solid ${jrc.border}`, borderRadius: 20, padding: "3px 10px" }}>
                            <span style={{ fontSize: 13, color: jrc.chipText, fontWeight: 700 }}>★ {shared.originalPointsSpent}</span>
                          </div>
                          <div style={{ background: "rgba(99,102,241,0.18)", border: "1px solid rgba(99,102,241,0.4)", borderRadius: 20, padding: "3px 10px", display: "flex", alignItems: "center", gap: 4 }}>
                            <Users style={{ width: 10, height: 10, color: "#a5b4fc" }} />
                            <span style={{ fontSize: 12, color: "#a5b4fc", fontWeight: 600 }}>{t("kidDashboard.participants", { count: shared.participants.length + 1 })}</span>
                          </div>
                          {hasJoined && <div style={{ background: "rgba(34,197,94,0.18)", border: "1px solid rgba(34,197,94,0.45)", borderRadius: 20, padding: "3px 10px" }}><span style={{ fontSize: 12, color: "#4ade80", fontWeight: 600 }}>{t("kidDashboard.shared")}</span></div>}
                        </div>

                        {/* Initiator */}
                        {initiatorMember && (
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, marginBottom: shared.participants.length > 0 ? 8 : 0 }}>
                            <span style={{ fontSize: 11, color: "#94a3b8" }}>{t("kidDashboard.with")}</span>
                            <div style={{ display: "flex", alignItems: "center", gap: 4, background: "rgba(255,255,255,0.08)", borderRadius: 20, padding: "2px 8px 2px 3px" }}>
                              <Avatar className="h-4 w-4">
                                <AvatarImage src={getAvatarUrl(initiatorMember.activeSkinId, initiatorMember.avatarUrl, (initiatorMember as any).useCustomAvatar, (initiatorMember as any).updatedAt)} />
                                <AvatarFallback className="text-xs text-white font-bold" style={{ backgroundColor: initiatorMember.color, fontSize: 8 }}>{initiatorMember.displayName[0]}</AvatarFallback>
                              </Avatar>
                              <span style={{ fontSize: 11, color: "#e2e8f0", fontWeight: 600 }}>{initiatorMember.displayName}</span>
                            </div>
                          </div>
                        )}

                        {/* Participants */}
                        {shared.participants.length > 0 && (
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
                            {shared.participants.map(p => (
                              <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 4, background: "rgba(255,255,255,0.08)", borderRadius: 20, padding: "2px 8px 2px 3px" }}>
                                <Avatar className="h-4 w-4">
                                  <AvatarImage src={getAvatarUrl(p.member.activeSkinId, p.member.avatarUrl, (p.member as any).useCustomAvatar, (p.member as any).updatedAt)} />
                                  <AvatarFallback className="text-xs text-white font-bold" style={{ backgroundColor: p.member.color, fontSize: 8 }}>{p.member.displayName[0]}</AvatarFallback>
                                </Avatar>
                                <span style={{ fontSize: 11, color: "#e2e8f0", fontWeight: 600 }}>{p.member.displayName}</span>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Join Button */}
                        {!hasJoined ? (() => {
                          const totalParticipants = shared.participants.length + 2;
                          const pointsPerPerson = Math.ceil(((shared as any).originalPointsSpent ?? shared.reward.pointThreshold) / totalParticipants);
                          const myPoints = member?.totalPoints ?? 0;
                          const canAfford = myPoints >= pointsPerPerson;
                          return (
                            <div className="space-y-1.5">
                              {!canAfford && (
                                <p style={{ fontSize: 11, color: "#f87171", textAlign: "center", fontWeight: 600 }}>
                                  {`Nicht genug Punkte — du brauchst ${pointsPerPerson}, hast ${myPoints}.`}
                                </p>
                              )}
                              <Button
                                className="w-full gap-2 font-bold text-white"
                                onClick={() => {
                                  const idStr = String(shared.id);
                                  setJustJoinedIds(prev => new Set([...prev, idStr]));
                                  joinSharingMutation.mutate(shared.id);
                                }}
                                disabled={joinSharingMutation.isPending || !canAfford}
                                data-testid={`button-join-${shared.id}`}
                                style={{ height: 40, borderRadius: 12, background: canAfford ? "linear-gradient(135deg, #1d4ed8, #3b82f6)" : "rgba(100,100,120,0.4)", boxShadow: canAfford ? "0 4px 14px rgba(59,130,246,0.45)" : "none" }}
                              >
                                <UserPlus className="h-4 w-4" />
                                {canAfford ? t("kidDashboard.joinFree") : `${pointsPerPerson} Punkte nötig`}
                              </Button>
                            </div>
                          );
                        })() : (
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, background: "rgba(34,197,94,0.12)", border: "1px solid rgba(34,197,94,0.35)", borderRadius: 12, padding: "8px 12px" }}>
                            <CheckCircle2 style={{ width: 16, height: 16, color: "#4ade80" }} />
                            <span style={{ fontSize: 13, color: "#4ade80", fontWeight: 700 }}>{t("kidDashboard.shared")}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        )}

        {/* Rewards Section */}
        <div className="space-y-6 mb-4" id="section-rewards">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="h-24 w-24 flex items-center justify-center flex-shrink-0 -my-2">
                <img src="/nav-icons/shop.png" alt="" className="w-full h-full object-contain drop-shadow-sm" />
              </div>
              <h2 className="text-2xl font-bold text-white" style={{ fontFamily: "Fredoka, sans-serif", textShadow: "0 2px 4px rgba(0,0,0,0.8), 0 4px 12px rgba(0,0,0,0.6), 0 0 20px rgba(0,0,0,0.4)" }}>
                {t("kidDashboard.rewards")}
              </h2>
            </div>
            {activeRewards.length > 3 && (
              <Button variant="ghost" size="icon" asChild className="bg-card border-2 border-border shadow-sm text-foreground flex-shrink-0" data-testid="button-view-all-rewards-board">
                <Link href="/rewards-board" onClick={() => sessionStorage.setItem("dashboardScrollTarget", "section-rewards")}>
                  <ChevronRight className="h-5 w-5" />
                </Link>
              </Button>
            )}
          </div>

          {activeRewards.length === 0 ? (
            <Card className="p-8 text-center bg-card rounded-2xl">
              <Gift className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
              <p className="text-lg text-muted-foreground">{t("kidDashboard.noRewardsYet")}</p>
              <p className="text-sm text-muted-foreground mt-2">{t("kidDashboard.parentsCanCreate")}</p>
            </Card>
          ) : (
            <div className="space-y-4">
              {activeRewards.slice(0, 3).map((reward, index) => (
                <div key={reward.id}>
                  <RewardCard reward={reward} currentPoints={currentPoints} member={member} />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* My Redeemed Rewards Section */}
        {(myRedemptions.length > 0 || joinedSharedRewards.length > 0) && (
          <div className="space-y-4 mb-8" id="section-my-rewards">
            <div className="flex items-end justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="h-24 w-24 flex items-center justify-center flex-shrink-0 -my-2">
                  <img src="/nav-icons/chest.png" alt="" className="w-full h-full object-contain drop-shadow-sm" />
                </div>
                <h2 className="text-2xl font-bold text-white" style={{ fontFamily: "Fredoka, sans-serif", textShadow: "0 2px 4px rgba(0,0,0,0.8), 0 4px 12px rgba(0,0,0,0.6), 0 0 20px rgba(0,0,0,0.4)" }}>
                  {t("kidDashboard.myRewards")}
                </h2>
              </div>
              <Button variant="ghost" size="icon" asChild className="bg-card border-2 border-border shadow-sm text-foreground flex-shrink-0 mb-1" data-testid="button-view-all-rewards">
                <Link href="/my-rewards" onClick={() => sessionStorage.setItem("dashboardScrollTarget", "section-my-rewards")}>
                  <ChevronRight className="h-5 w-5" />
                </Link>
              </Button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {dashboardLastTwo.filter((r: any) => r._isOwn).map((redemption: any, index: number) => {
                const typed = redemption as RedemptionWithDetails;
                const participants: any[] = (typed as any).sharingParticipants || [];
                const isSharing = typed.sharingStatus === "sharing_active";
                const isFinalized = typed.sharingStatus === "sharing_finalized";
                const isOnTrialKd = !!(familyData?.trialEndsAt && new Date(familyData.trialEndsAt) > new Date());
                const canShare = typed.status !== "completed" && typed.sharingStatus === "not_shared" && (canUseSharedRewards(familyData?.subscriptionTier) || isOnTrialKd);
                const canFinalize = isSharing && participants.length > 0;
                const canCancelSharing = isSharing; // Can cancel anytime while sharing is active
                const canCancel = typed.status !== "completed" && typed.sharingStatus === "not_shared";

                const isCompleted = typed.status === "completed";
                const isApproved = typed.status === "approved";
                // All purchased rewards are always LEGENDARY (gold) — exact Schatztruhe intensity
                const rc = { glow: "rgba(251,191,36,0.35)", border: "rgba(251,191,36,0.55)", iconBg: "rgba(251,191,36,0.18)", textColor: "#fbbf24" };

                return (
                  <div
                    key={redemption.id}
                    className="rounded-2xl overflow-hidden"
                    style={{
                      background: "linear-gradient(160deg, rgba(30,20,10,0.92) 0%, rgba(20,15,8,0.97) 100%)",
                      border: `1.5px solid ${rc.border}`,
                      boxShadow: `0 0 0 1px rgba(255,255,255,0.04) inset, 0 8px 32px ${rc.glow.replace("0.35","0.28")}, 0 12px 48px ${rc.glow.replace("0.35","0.14")}, 0 4px 24px ${rc.glow}`,
                    }}
                  >
                    {/* Icon zone */}
                    <div className="flex justify-center pt-5 pb-3 relative">
                      <Sparkles className="absolute left-5 top-4 h-3.5 w-3.5 opacity-40" style={{ color: rc.textColor }} />
                      <Sparkles className="absolute right-5 top-5 h-3 w-3 opacity-30" style={{ color: rc.textColor }} />
                      <div
                        className="h-16 w-16 rounded-full flex items-center justify-center overflow-hidden"
                        style={{ background: rc.iconBg, boxShadow: `0 0 28px ${rc.glow}, 0 0 8px ${rc.glow}` }}
                      >
                        <RewardIconDisplay icon={typed.rewardIconEmoji} imgClassName="w-10 h-10 object-contain drop-shadow-sm" textClassName="text-3xl leading-none" />
                      </div>
                    </div>

                    {/* Content zone */}
                    <div className="px-4 pb-4 space-y-3">
                      <h3 className="font-black text-xl text-center text-white leading-tight" style={{ fontFamily: "Fredoka, sans-serif", textShadow: `0 1px 8px ${rc.glow}` }}>
                        {typed.rewardTitle || t("kidDashboard.reward")}
                      </h3>

                      {/* Stats chips */}
                      <div className="flex items-center justify-center gap-2 flex-wrap">
                        <div className="flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold" style={{ background: rc.iconBg, color: rc.textColor, border: `1px solid ${rc.border}` }}>
                          <Coins className="h-3.5 w-3.5" />
                          <span>{t("myRewards.pointsSpent", { count: typed.pointsSpent })}</span>
                        </div>
                        <div className="flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold bg-white/5 text-white/60 border border-white/10">
                          <span>{typed.redeemedAt ? new Date(typed.redeemedAt).toLocaleDateString() : "-"}</span>
                        </div>
                      </div>

                      {/* Status badges */}
                      <div className="flex items-center justify-center gap-2 flex-wrap">
                        <div
                          className="flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold"
                          data-testid={`badge-status-dashboard-${typed.id}`}
                          style={{ background: isCompleted ? "rgba(34,197,94,0.15)" : "rgba(255,255,255,0.08)", color: isCompleted ? "#4ade80" : "rgba(255,255,255,0.7)", border: isCompleted ? "1px solid rgba(34,197,94,0.4)" : "1px solid rgba(255,255,255,0.15)" }}
                        >
                          {isCompleted ? (
                            <><CheckCircle2 className="h-3.5 w-3.5" />{t("kidDashboard.fulfilled")}</>
                          ) : isApproved ? (
                            <><Clock className="h-3.5 w-3.5" />{t("kidDashboard.waiting")}</>
                          ) : (
                            <><Clock className="h-3.5 w-3.5" />{t("kidDashboard.pending")}</>
                          )}
                        </div>
                        {isSharing && (
                          <div className="flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold bg-violet-500/15 text-violet-300 border border-violet-400/30">
                            <Users className="h-3.5 w-3.5" />{t("kidDashboard.beingShared")}
                          </div>
                        )}
                        {isFinalized && (
                          <div className="flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold bg-white/5 text-white/60 border border-white/10">
                            <CheckCircle2 className="h-3.5 w-3.5" />{t("kidDashboard.shared")}
                          </div>
                        )}
                      </div>

                      {/* Participants */}
                      {participants.length > 0 && (
                        <div className="flex items-center gap-2 flex-wrap rounded-xl px-3 py-2 bg-white/5 border border-white/10">
                          <div className="flex items-center gap-1.5 text-xs text-white/50">
                            <Users className="h-3.5 w-3.5" />
                            <span>{t("kidDashboard.with")}:</span>
                          </div>
                          <div className="flex items-center gap-2 flex-wrap">
                            {participants.map((p: any) => (
                              <div key={p.id} className="flex items-center gap-1.5">
                                <Avatar className="h-6 w-6 border-2 border-white/20">
                                  <AvatarImage src={getAvatarUrl(p.activeSkinId, p.avatarUrl, p.useCustomAvatar, p.updatedAt)} />
                                  <AvatarFallback className="text-xs font-bold text-white" style={{ backgroundColor: p.color }}>{p.displayName[0]}</AvatarFallback>
                                </Avatar>
                                <span className="text-sm font-semibold text-white/80">{p.displayName}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Action buttons */}
                      {canCancel && (
                        <Button variant="outline" className="w-full gap-2 h-11 rounded-xl border-red-500/30 text-red-400 bg-red-500/10 font-bold" onClick={() => cancelRedemptionMutation.mutate(typed.id)} disabled={cancelRedemptionMutation.isPending} data-testid={`button-cancel-redemption-kid-${typed.id}`}>
                          <X className="h-4 w-4" />
                          {t("rewardsBoard.cancelRedemption")}
                        </Button>
                      )}
                      {(canShare || canFinalize || canCancelSharing) && (
                        <div className="flex flex-col gap-2">
                          {canShare && (
                            <Button className="w-full gap-2 h-11 rounded-xl font-bold" style={{ background: `linear-gradient(135deg, ${rc.textColor}33, ${rc.textColor}22)`, border: `1px solid ${rc.border}`, color: rc.textColor }} onClick={() => startSharingMutation.mutate(typed.id)} disabled={startSharingMutation.isPending} data-testid={`button-start-share-${typed.id}`}>
                              <Share2 className="h-4 w-4" />{t("kidDashboard.startSharing")}
                            </Button>
                          )}
                          {canCancelSharing && (
                            <Button variant="outline" className="w-full gap-2 h-11 rounded-xl border-white/20 text-white/70 font-bold" onClick={() => cancelSharingMutation.mutate(typed.id)} disabled={cancelSharingMutation.isPending} data-testid={`button-cancel-share-${typed.id}`}>
                              <X className="h-4 w-4" />{t("kidDashboard.cancelSharing")}
                            </Button>
                          )}
                          {canFinalize && (
                            <Button className="w-full gap-2 h-11 rounded-xl font-bold" onClick={() => finalizeSharingMutation.mutate(typed.id)} disabled={finalizeSharingMutation.isPending} data-testid={`button-finalize-${typed.id}`}>
                              <CheckCircle2 className="h-4 w-4" />{t("kidDashboard.finalize")}
                            </Button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}

              {/* Joined shared rewards (this member is a participant, not initiator) */}
              {dashboardLastTwo.filter((r: any) => !r._isOwn).map((joined: any, index: number) => {
                const myParticipation = joined.sharingParticipants?.find((p: any) => p.memberId === member?.id);
                const initiatorMember = familyMembers.find(m => m.id === joined.memberId);
                const isFinalized = joined.sharingStatus === "sharing_finalized";

                const jIsCompleted = joined.status === "completed";
                const jIsApproved = joined.status === "approved";
                // All joined shared rewards are always LEGENDARY (gold) — exact Schatztruhe intensity
                const jRc = { glow: "rgba(251,191,36,0.35)", border: "rgba(251,191,36,0.55)", iconBg: "rgba(251,191,36,0.18)", textColor: "#fbbf24" };

                return (
                  <div
                    key={`joined-${joined.id}`}
                    className="rounded-2xl overflow-hidden"
                    style={{
                      background: "linear-gradient(160deg, rgba(30,20,10,0.92) 0%, rgba(20,15,8,0.97) 100%)",
                      border: `1.5px solid ${jRc.border}`,
                      boxShadow: `0 0 0 1px rgba(255,255,255,0.04) inset, 0 8px 32px ${jRc.glow.replace("0.35","0.28")}, 0 12px 48px ${jRc.glow.replace("0.35","0.14")}, 0 4px 24px ${jRc.glow}`,
                    }}
                  >
                    {/* Icon zone */}
                    <div className="flex justify-center pt-5 pb-3 relative">
                      <Sparkles className="absolute left-5 top-4 h-3.5 w-3.5 opacity-40" style={{ color: jRc.textColor }} />
                      <Sparkles className="absolute right-5 top-5 h-3 w-3 opacity-30" style={{ color: jRc.textColor }} />
                      <div
                        className="h-16 w-16 rounded-full flex items-center justify-center overflow-hidden"
                        style={{ background: jRc.iconBg, boxShadow: `0 0 28px ${jRc.glow}, 0 0 8px ${jRc.glow}` }}
                      >
                        <RewardIconDisplay icon={joined.rewardIconEmoji} imgClassName="w-10 h-10 object-contain drop-shadow-sm" textClassName="text-3xl leading-none" />
                      </div>
                    </div>

                    {/* Content zone */}
                    <div className="px-4 pb-4 space-y-3">
                      <h3 className="font-black text-xl text-center text-white leading-tight" style={{ fontFamily: "Fredoka, sans-serif", textShadow: `0 1px 8px ${jRc.glow}` }}>
                        {joined.rewardTitle || t("kidDashboard.reward")}
                      </h3>

                      {/* Stats chips */}
                      <div className="flex items-center justify-center gap-2 flex-wrap">
                        {myParticipation && (
                          <div className="flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold" style={{ background: jRc.iconBg, color: jRc.textColor, border: `1px solid ${jRc.border}` }}>
                            <Coins className="h-3.5 w-3.5" />
                            <span>{t("myRewards.pointsSpent", { count: myParticipation.pointsContributed })}</span>
                          </div>
                        )}
                        <div className="flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold bg-violet-500/15 text-violet-300 border border-violet-400/30">
                          <Users className="h-3.5 w-3.5" />
                          <span>{isFinalized ? t("kidDashboard.shared") : t("kidDashboard.beingShared")}</span>
                        </div>
                      </div>

                      {/* Status badge */}
                      <div className="flex items-center justify-center gap-2 flex-wrap">
                        <div
                          className="flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold"
                          style={{ background: jIsCompleted ? "rgba(34,197,94,0.15)" : "rgba(255,255,255,0.08)", color: jIsCompleted ? "#4ade80" : "rgba(255,255,255,0.7)", border: jIsCompleted ? "1px solid rgba(34,197,94,0.4)" : "1px solid rgba(255,255,255,0.15)" }}
                        >
                          {jIsCompleted ? (
                            <><CheckCircle2 className="h-3.5 w-3.5" />{t("kidDashboard.fulfilled")}</>
                          ) : jIsApproved ? (
                            <><Clock className="h-3.5 w-3.5" />{t("kidDashboard.waiting")}</>
                          ) : (
                            <><Clock className="h-3.5 w-3.5" />{t("kidDashboard.pending")}</>
                          )}
                        </div>
                      </div>

                      {/* Leave button — only when sharing is still active (not yet finalized) */}
                      {!isFinalized && (
                        <Button
                          variant="outline"
                          className="w-full gap-2 rounded-xl font-bold border-red-500/40 text-red-400 bg-red-500/10 hover:bg-red-500/20"
                          onClick={() => leaveSharingMutation.mutate(joined.id)}
                          disabled={leaveSharingMutation.isPending}
                          data-testid={`button-leave-joined-${joined.id}`}
                        >
                          <LogOut className="h-4 w-4" />
                          {t("kidDashboard.leaveSharing")}
                        </Button>
                      )}

                      {/* All participants: initiator + other participants (excluding current member) */}
                      {initiatorMember && (
                        <div className="flex items-center gap-2 flex-wrap rounded-xl px-3 py-2 bg-white/5 border border-white/10">
                          <div className="flex items-center gap-1.5 text-xs text-white/50">
                            <Users className="h-3.5 w-3.5" />
                            <span>{t("kidDashboard.with")}:</span>
                          </div>
                          <div className="flex items-center gap-2 flex-wrap">
                            {/* Initiator */}
                            <div className="flex items-center gap-1.5">
                              <Avatar className="h-6 w-6 border-2 border-white/20">
                                <AvatarImage src={getAvatarUrl(initiatorMember.activeSkinId, initiatorMember.avatarUrl, (initiatorMember as any).useCustomAvatar, (initiatorMember as any).updatedAt)} />
                                <AvatarFallback className="text-xs font-bold text-white" style={{ backgroundColor: initiatorMember.color }}>{initiatorMember.displayName[0]}</AvatarFallback>
                              </Avatar>
                              <span className="text-sm font-semibold text-white/80">{initiatorMember.displayName}</span>
                            </div>
                            {/* Other participants (not the initiator — self is included) */}
                            {(joined.sharingParticipants || [])
                              .filter((p: any) => p.memberId !== joined.memberId)
                              .map((p: any) => {
                                const pm = familyMembers.find(m => m.id === p.memberId);
                                if (!pm) return null;
                                return (
                                  <div key={p.id} className="flex items-center gap-1.5">
                                    <Avatar className="h-6 w-6 border-2 border-white/20">
                                      <AvatarImage src={getAvatarUrl(pm.activeSkinId, pm.avatarUrl, (pm as any).useCustomAvatar, (pm as any).updatedAt)} />
                                      <AvatarFallback className="text-xs font-bold text-white" style={{ backgroundColor: pm.color }}>{pm.displayName[0]}</AvatarFallback>
                                    </Avatar>
                                    <span className="text-sm font-semibold text-white/80">{pm.displayName}</span>
                                  </div>
                                );
                              })}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Tasks Section */}
        <div className="space-y-6">
          {/* Title row: heading left, toggle right */}
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <div className="h-24 w-24 flex items-center justify-center flex-shrink-0 -my-2">
                <img src="/nav-icons/clipboard.png" alt="" className="w-full h-full object-contain drop-shadow-sm" />
              </div>
              <h2 className="text-2xl font-bold text-white" style={{ fontFamily: "Fredoka, sans-serif", textShadow: "0 2px 4px rgba(0,0,0,0.8), 0 4px 12px rgba(0,0,0,0.6), 0 0 20px rgba(0,0,0,0.4)" }}>
                {t("kidDashboard.tasks")}
              </h2>
            </div>
            <Button
              size="icon"
              variant="ghost"
              onClick={() => setKidDashboardView(kidDashboardView === "list" ? "grid" : "list")}
              className={`flex-shrink-0 bg-card border-2 border-border shadow-sm toggle-elevate${kidDashboardView === "grid" ? " toggle-elevated" : ""}`}
              data-testid="button-kid-view-toggle"
            >
              {kidDashboardView === "grid" ? <LayoutGrid className="h-4 w-4" /> : <LayoutList className="h-4 w-4" />}
            </Button>
          </div>

          {/* Filter tabs row */}
          <div className="flex items-center gap-2">
            <div className="flex gap-1 flex-wrap p-1.5 rounded-xl border border-border bg-card">
              <Button
                variant={kidTaskFilter === "daily" ? "default" : "ghost"}
                size="sm"
                onClick={() => setKidTaskFilter("daily")}
                className={`text-xs px-3 ${kidTaskFilter !== "daily" ? "text-white/80 hover:text-white hover:bg-white/15" : ""}`}
                data-testid="button-kid-filter-daily"
              >
                <RefreshCw className="h-3 w-3 mr-1" />
                {t("kidDashboard.filterDaily")}
              </Button>
              <Button
                variant={kidTaskFilter === "weekly" ? "default" : "ghost"}
                size="sm"
                onClick={() => setKidTaskFilter("weekly")}
                className={`text-xs px-3 ${kidTaskFilter !== "weekly" ? "text-white/80 hover:text-white hover:bg-white/15" : ""}`}
                data-testid="button-kid-filter-weekly"
              >
                {t("kidDashboard.filterWeekly")}
              </Button>
              <Button
                variant={kidTaskFilter === "monthly" ? "default" : "ghost"}
                size="sm"
                onClick={() => setKidTaskFilter("monthly")}
                className={`text-xs px-3 ${kidTaskFilter !== "monthly" ? "text-white/80 hover:text-white hover:bg-white/15" : ""}`}
                data-testid="button-kid-filter-monthly"
              >
                {t("kidDashboard.filterMonthly")}
              </Button>
              <Button
                variant={kidTaskFilter === "onetime" ? "default" : "ghost"}
                size="sm"
                onClick={() => setKidTaskFilter("onetime")}
                className={`text-xs px-3 ${kidTaskFilter !== "onetime" ? "text-white/80 hover:text-white hover:bg-white/15" : ""}`}
                data-testid="button-kid-filter-onetime"
              >
                <Target className="h-3 w-3 mr-1" />
                {t("kidDashboard.filterOneTime")}
              </Button>
              <Button
                variant={kidTaskFilter === "all" ? "default" : "ghost"}
                size="sm"
                onClick={() => setKidTaskFilter("all")}
                className={`text-xs px-3 ${kidTaskFilter !== "all" ? "text-white/80 hover:text-white hover:bg-white/15" : ""}`}
                data-testid="button-kid-filter-all"
              >
                {t("kidDashboard.filterAll")}
              </Button>
            </div>
          </div>

          {/* Pinned important tasks — collapsible, filter-independent */}
          {importantMyTasks.length > 0 && (
            <Collapsible
              open={!collapsedCategories.has("__important__")}
              onOpenChange={() => toggleCategory("__important__")}
              data-testid="section-important-tasks-kid"
              className="mb-4"
            >
              <div>
                <CollapsibleTrigger asChild>
                  <div className="px-4 py-2.5 flex items-center justify-between cursor-pointer transition-colors rounded-xl bg-white/8 border border-white/10 mb-1 hover-elevate">
                    <div className="flex items-center gap-3">
                      <Pin className="h-4 w-4 text-amber-400 fill-amber-400 flex-shrink-0" />
                      <span className="font-bold text-base px-2.5 py-0.5 rounded-md text-amber-300" style={{ fontFamily: "Fredoka, sans-serif", textShadow: "0 1px 3px rgba(0,0,0,0.8)" }}>
                        {t("dashboard.importantTasks", { defaultValue: "Wichtig" })}
                      </span>
                      <Badge variant="secondary" className="rounded-full">{importantMyTasks.length}</Badge>
                    </div>
                    <div className="p-1 bg-card border border-border rounded-lg flex-shrink-0">
                      <ChevronDown className={`h-4 w-4 transition-transform ${!collapsedCategories.has("__important__") ? "rotate-180" : ""}`} />
                    </div>
                  </div>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className={kidDashboardView === "grid" ? "grid grid-cols-2 gap-2 mt-2" : "grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-2"}>
                    {importantMyTasks.map((task, index) => (
                      <div key={task.id} className="min-w-0">
                        <TaskCard task={task} member={member} onOpenTaskDialog={handleOpenTaskDialog} compact={kidDashboardView === "grid"} />
                      </div>
                    ))}
                  </div>
                </CollapsibleContent>
              </div>
            </Collapsible>
          )}

          {filteredKidTasks.length === 0 ? (
            <Card className="p-8 text-center bg-card rounded-2xl">
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
                  <div>
                    <CollapsibleTrigger asChild>
                      <div className="px-4 py-2.5 flex items-center justify-between cursor-pointer transition-colors rounded-xl bg-white/8 border border-white/10 mb-1 hover-elevate">
                        <div className="flex items-center gap-3">
                          <span className="text-2xl">{getCategoryEmoji(category)}</span>
                          <span className="font-bold text-base bg-muted/80 px-2.5 py-0.5 rounded-md" style={{ fontFamily: "Fredoka, sans-serif" }}>
                            {getCategoryLabel(category)}
                          </span>
                          <Badge variant="secondary" className="rounded-full">
                            {categoryTasks.length}
                          </Badge>
                        </div>
                        <div className="p-1 bg-card border border-border rounded-lg flex-shrink-0">
                          <ChevronDown className={`h-4 w-4 transition-transform ${!collapsedCategories.has(category) ? "rotate-180" : ""}`} />
                        </div>
                      </div>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <div className={kidDashboardView === "grid" ? "grid grid-cols-2 gap-2 mt-2" : "grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-2"}>
                        {categoryTasks.map((task, index) => (
                          <div key={task.id} className="min-w-0">
                            <TaskCard task={task} member={member} onOpenTaskDialog={handleOpenTaskDialog} compact={kidDashboardView === "grid"} />
                          </div>
                        ))}
                      </div>
                    </CollapsibleContent>
                  </div>
                </Collapsible>
              ))}
            </div>
          ) : (
            <div className={kidDashboardView === "grid" ? "grid grid-cols-2 gap-2" : "grid sm:grid-cols-2 lg:grid-cols-3 gap-4"}>
              {filteredKidTasks.map((task, index) => (
                <div key={task.id} className="min-w-0">
                  <TaskCard task={task} member={member} onOpenTaskDialog={handleOpenTaskDialog} compact={kidDashboardView === "grid"} />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Family Goals Section */}
        {goals.filter(g => g.isActive).length > 0 && (
          <div className="space-y-6">
            <div className="flex items-center gap-3">
              <img src={familyGoalsIcon} alt="" className="h-32 w-32 object-contain flex-shrink-0 drop-shadow-sm -my-4" />
              <h2 className="text-2xl font-bold text-white" style={{ fontFamily: "Fredoka, sans-serif", textShadow: "0 2px 4px rgba(0,0,0,0.8), 0 4px 12px rgba(0,0,0,0.6), 0 0 20px rgba(0,0,0,0.4)" }}>
                {t("kidDashboard.familyGoals")}
              </h2>
            </div>

            {goals.filter(g => g.isActive).map((goal, index) => {
              const progress = calculateProgress(goal);
              const currentPeriod = getCurrentPeriod(goal.contributionPeriod);
              const isCompleted = goal.currentPoints >= goal.targetPoints;
              
              return (
                <div key={goal.id}>
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
                </div>
              );
            })}
          </div>
        )}

        {/* Pinboard Section — mobile only (desktop version is in right column) */}
        <div id="pinboard" className="lg:hidden space-y-2">
          <div className="flex items-center gap-3">
            <div className="h-24 w-24 flex items-center justify-center flex-shrink-0 -my-2">
              <img src="/nav-icons/pinboard.png" alt="" className="w-full h-full object-contain drop-shadow-sm" />
            </div>
            <h2 className="text-2xl font-bold text-white" style={{ fontFamily: "Fredoka, sans-serif", textShadow: "0 2px 4px rgba(0,0,0,0.8), 0 4px 12px rgba(0,0,0,0.6), 0 0 20px rgba(0,0,0,0.4)" }}>
              {t("pinboard.title")}
            </h2>
          </div>
          <Pinboard currentMemberId={member?.id ?? null} />
        </div>

        {/* Leaderboard Section — mobile only (desktop version is in right column) */}
        {familyData?.showLeaderboard && (
          <div className="lg:hidden space-y-6">
            <div className="flex items-center gap-3">
              <div className="h-24 w-24 flex items-center justify-center flex-shrink-0 -my-2">
                <img src="/nav-icons/trophy.png" alt="" className="w-full h-full object-contain drop-shadow-sm" />
              </div>
              <h2 className="text-2xl font-bold text-white" style={{ fontFamily: "Fredoka, sans-serif", textShadow: "0 2px 4px rgba(0,0,0,0.8), 0 4px 12px rgba(0,0,0,0.6), 0 0 20px rgba(0,0,0,0.4)" }}>
                {t("kidDashboard.leaderboard")}
              </h2>
            </div>
            {hasFeature(familyData?.subscriptionTier as SubscriptionTier || "free", "weeklyLeaderboard") && (
              <div className="mb-4">
                <Tabs value={leaderboardPeriod} onValueChange={(value) => setLeaderboardPeriod(value as "week" | "month")}>
                  <TabsList className="grid w-full grid-cols-2" data-testid="tabs-leaderboard-period">
                    <TabsTrigger value="week" data-testid="tab-leaderboard-week">{t("dashboard.weekly")}</TabsTrigger>
                    <TabsTrigger value="month" data-testid="tab-leaderboard-month">{t("dashboard.monthly")}</TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>
            )}
            <Leaderboard members={familyMembers} period={leaderboardPeriod} weeklyPrize={familyData?.weeklyPrize} monthlyPrize={familyData?.monthlyPrize} />
          </div>
        )}

      </div>{/* end left column */}

      {/* Right column — sticky (desktop only): pinboard + optional leaderboard */}
      <div className="hidden lg:flex lg:col-span-1 flex-col gap-4 self-start sticky" style={{ top: 'calc(var(--header-h) + var(--sat, env(safe-area-inset-top)) + 1rem)' }}>
        <Pinboard currentMemberId={member?.id ?? null} />
        {familyData?.showLeaderboard && (
          <div className="space-y-4">
            {hasFeature(familyData?.subscriptionTier as SubscriptionTier || "free", "weeklyLeaderboard") && (
              <Tabs value={leaderboardPeriod} onValueChange={(value) => setLeaderboardPeriod(value as "week" | "month")}>
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="week">{t("dashboard.weekly")}</TabsTrigger>
                  <TabsTrigger value="month">{t("dashboard.monthly")}</TabsTrigger>
                </TabsList>
              </Tabs>
            )}
            <Leaderboard members={familyMembers} period={leaderboardPeriod} weeklyPrize={familyData?.weeklyPrize} monthlyPrize={familyData?.monthlyPrize} />
          </div>
        )}
      </div>{/* end right column */}

      </div>{/* end grid */}
      </div>{/* end container */}
      </div>{/* end paddingTop wrapper */}

      {/* Navigation Bottom Bar — collapsible on all platforms */}
      <div
        className={`fixed bottom-0 left-0 right-0 z-50 overflow-x-hidden ${chatBarCollapsed ? 'pointer-events-none' : ''}`}
        style={{
          paddingBottom: 'calc(0.5rem + env(safe-area-inset-bottom))',
          paddingLeft: 'max(0.5rem, env(safe-area-inset-left))',
          paddingRight: 'max(0.5rem, env(safe-area-inset-right))',
          paddingTop: '0.5rem',
        }}
      >
        <div
          style={{
            transform: chatBarCollapsed ? 'translateX(calc(100% - 40px))' : 'translateX(0)',
            transition: 'transform 0.45s cubic-bezier(0.34, 1.56, 0.64, 1)',
          }}
        >
          <Card className="p-1.5 bg-gradient-to-r from-primary/30 via-purple-500/30 to-pink-500/30 border-2 border-primary/30 rounded-3xl shadow-2xl relative">
            <div className="flex items-center gap-1 sm:gap-2">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setChatBarCollapsed(c => !c)}
                className="flex-shrink-0 rounded-2xl h-14 w-10 pointer-events-auto"
                data-testid="button-chat-bar-toggle"
                aria-label={chatBarCollapsed ? t("chat.openChat", "Chat öffnen") : t("chat.closeChat", "Chat einklappen")}
              >
                {chatBarCollapsed ? <ChevronRight className="h-5 w-5" /> : <ChevronLeft className="h-5 w-5" />}
              </Button>
              <div className="flex-1 min-w-0">
                <Button
                  variant="ghost"
                  size="lg"
                  onClick={() => setRequestRewardDialogOpen(true)}
                  data-testid="button-nav-request-reward"
                  className="h-14 w-full px-3 sm:px-5 rounded-2xl"
                >
                  <Lightbulb className="h-5 w-5 sm:h-6 sm:w-6 mr-1.5 sm:mr-2 text-amber-500 flex-shrink-0" />
                  <span className="font-bold text-xs sm:text-sm leading-tight text-center whitespace-normal">{t("kidDashboard.requestNewReward")}</span>
                </Button>
              </div>
              <div className="flex-1 min-w-0 relative">
                <Button variant="ghost" size="lg" asChild data-testid="button-nav-chat" className="h-14 w-full px-3 sm:px-5 rounded-2xl">
                  <Link href="/chat">
                    <MessageCircle className="h-5 w-5 sm:h-6 sm:w-6 mr-1.5 sm:mr-2 text-blue-500 flex-shrink-0" />
                    <span className="font-bold text-xs sm:text-sm leading-tight text-center whitespace-normal">{t("nav.chat")}</span>
                  </Link>
                </Button>
                {!chatBarCollapsed && unreadChatData && unreadChatData.count > 0 && (
                  <span
                    className="absolute -top-1 -right-1 z-50 h-5 w-5 flex items-center justify-center rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold"
                    data-testid="badge-unread-chat-count"
                  >
                    {unreadChatData.count}
                  </span>
                )}
              </div>
              <div className="w-10 flex-shrink-0" />
            </div>
            {chatBarCollapsed && unreadChatData && unreadChatData.count > 0 && (
              <span
                className="absolute -top-1 left-1 z-50 h-5 w-5 flex items-center justify-center rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold"
                data-testid="badge-unread-chat-count-collapsed"
              >
                {unreadChatData.count}
              </span>
            )}
          </Card>
        </div>
      </div>

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

      {/* Parental Gate Dialog */}
      <Dialog open={parentalGateOpen} onOpenChange={setParentalGateOpen}>
        <DialogContent onOpenAutoFocus={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle>{t("parentalGate.title", "Frage für Erwachsene")}</DialogTitle>
            <DialogDescription>
              {t("parentalGate.description", "Bitte beantworte diese Frage, um fortzufahren.")}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <p className="text-center text-3xl font-bold tracking-wide">
              {parentalGateQ.question} = ?
            </p>
            <Input
              type="number"
              inputMode="numeric"
              value={parentalGateInput}
              onChange={(e) => { setParentalGateInput(e.target.value); setParentalGateError(false); }}
              onKeyDown={(e) => e.key === "Enter" && parentalGateInput && handleParentalGateSubmit()}
              onFocus={(e) => scrollFieldIntoView(e.currentTarget)}
              placeholder={t("parentalGate.placeholder", "Antwort eingeben…")}
              className={parentalGateError ? "border-destructive" : ""}
            />
            {parentalGateError && (
              <p className="text-destructive text-sm text-center">
                {t("parentalGate.wrong", "Falsche Antwort. Versuch es nochmal!")}
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setParentalGateOpen(false)}>
              {t("common.cancel", "Abbrechen")}
            </Button>
            <Button onClick={handleParentalGateSubmit} disabled={!parentalGateInput}>
              {t("parentalGate.confirm", "Bestätigen")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <GoalCompletedModal
        goal={completedGoal}
        onClose={() => setCompletedGoal(null)}
      />
    </div>
  );
}
