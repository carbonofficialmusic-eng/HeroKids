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
} from "lucide-react";
import type { User, FamilyMember, Reward, Task, Family, RewardRedemption, FamilyGoal } from "@shared/schema";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { ProfileMenu } from "@/components/profile-menu";
import { EditMemberDialog } from "@/components/edit-member-dialog";
import { SwitchMemberDialog } from "@/components/switch-member-dialog";
import { TaskCompletionDialog } from "@/components/task-completion-dialog";
import { RewardRequestDialog } from "@/components/reward-request-dialog";
import { Leaderboard } from "@/components/leaderboard";
import { getAvatarUrl } from "@/lib/skins";
import { hasFeature, type SubscriptionTier } from "@shared/tier-config";
import logoUrl from "@assets/ChatGPT Image 7. Nov. 2025, 19_19_07_1762539654932.png";

// Extended Task type with metadata from API
interface TaskWithMeta extends Task {
  memberHasCompleted?: boolean;
  remainingSlots?: number | null;
  memberCompletionStatus?: "pending" | "approved" | "rejected" | null;
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

// Helper: Get ISO week number
function getWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}

// Helper: Format period for display
function formatPeriod(period: string, type: "weekly" | "monthly"): string {
  if (type === "weekly") {
    const match = period.match(/(\d{4})-W(\d{2})/);
    if (match) {
      return `Woche ${match[2]}, ${match[1]}`;
    }
  } else {
    const match = period.match(/(\d{4})-(\d{2})/);
    if (match) {
      const monthNames = ["Jan", "Feb", "Mär", "Apr", "Mai", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Dez"];
      return `${monthNames[parseInt(match[2]) - 1]} ${match[1]}`;
    }
  }
  return period;
}

// Get color based on progress percentage
function getProgressColor(percentage: number) {
  if (percentage >= 100) return "hsl(142 76% 36%)";
  if (percentage >= 71) return "hsl(142 69% 58%)";
  if (percentage >= 31) return "hsl(38 92% 50%)";
  return "hsl(0 72% 51%)";
}

// Reward Card Component
function RewardCard({ reward, currentPoints, member }: { reward: Reward; currentPoints: number; member: FamilyMember }) {
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
      toast({
        title: "Belohnung angefordert! 🎉",
        description: `Deine Anfrage für "${reward.title}" wartet auf Freigabe!`,
      });
    },
    onError: () => {
      toast({
        variant: "destructive",
        title: "Fehler",
        description: "Belohnung konnte nicht angefordert werden.",
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
                  Noch <span className="font-bold">{remaining} Punkte</span>!
                </p>
              )}
              {isReady && (
                <p className="text-sm font-bold text-green-500 flex items-center gap-1">
                  <Sparkles className="h-4 w-4" />
                  Bereit zum Anfragen!
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
                    Jetzt!
                  </>
                ) : (
                  <>
                    <Trophy className="h-4 w-4 mr-2" />
                    Sammeln
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
            <AlertDialogDescription className="space-y-4 pt-4">
              {reward.description && (
                <div className="text-base text-foreground">
                  <p className="font-semibold mb-1">Beschreibung:</p>
                  <p>{reward.description}</p>
                </div>
              )}
              
              <div className="space-y-2">
                <div className="flex justify-between items-center p-3 bg-muted/50 rounded-xl">
                  <span className="font-semibold">Benötigte Punkte:</span>
                  <Badge variant="secondary" className="text-lg font-bold px-3 py-1">
                    {reward.pointThreshold}
                  </Badge>
                </div>
                
                <div className="flex justify-between items-center p-3 bg-muted/50 rounded-xl">
                  <span className="font-semibold">Dein Fortschritt:</span>
                  <span className="font-bold" style={{ color: progressColor }}>
                    {Math.round(percentage)}%
                  </span>
                </div>
              </div>
              
              {!isReady && (
                <div className="p-3 bg-amber-50 dark:bg-amber-950/30 rounded-xl border border-amber-200 dark:border-amber-800">
                  <p className="text-base font-bold flex items-center gap-2">
                    <Zap className="h-5 w-5 text-amber-500" />
                    Noch {remaining} Punkte bis zur Belohnung!
                  </p>
                </div>
              )}
              
              {isReady && (
                <div className="p-3 bg-green-50 dark:bg-green-950/30 rounded-xl border border-green-200 dark:border-green-800">
                  <p className="text-base font-bold flex items-center gap-2 text-green-600 dark:text-green-400">
                    <Sparkles className="h-5 w-5" />
                    Du kannst diese Belohnung jetzt anfragen!
                  </p>
                </div>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction data-testid="button-close-details">Schließen</AlertDialogAction>
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
  const { toast } = useToast();
  
  // Determine task state based on memberCompletionStatus
  const completionStatus = task.memberCompletionStatus;
  const isPending = completionStatus === "pending";
  const isApproved = completionStatus === "approved";
  const isRejected = completionStatus === "rejected";
  const neverAttempted = completionStatus === null;
  const hasNoSlots = task.remainingSlots !== null && task.remainingSlots !== undefined && task.remainingSlots <= 0;
  const isInactive = task.status !== "active";
  
  // Fallback check: if memberHasCompleted is true but status is null, treat as completed
  // This handles edge cases where status might be missing due to data inconsistency
  const hasCompletedWithoutStatus = task.memberHasCompleted && neverAttempted;
  
  // Task is actionable ONLY if:
  // 1. Never attempted (completionStatus === null AND !memberHasCompleted) OR rejected (can retry)
  // 2. Task status is active
  // 3. Has available slots (or no slot limit)
  // NOT actionable if: pending, approved, has completion without status, inactive, or no slots
  const isActionable = (neverAttempted && !hasCompletedWithoutStatus || isRejected) && !isInactive && !hasNoSlots;
  
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
        title: "Aufgabe abgeschlossen! 🎉",
        description: task.requiresApproval 
          ? "Wartet auf Freigabe von deinen Eltern!"
          : `Du hast ${task.points} Punkte verdient!`,
      });
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Fehler",
        description: error.message || "Aufgabe konnte nicht abgeschlossen werden.",
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
    statusMessage = "Wartet auf Freigabe";
    statusColor = "text-amber-600 dark:text-amber-400";
  } else if (isApproved) {
    statusMessage = "Abgeschlossen & Genehmigt";
    statusColor = "text-green-600 dark:text-green-400";
  } else if (isRejected) {
    statusMessage = "Nochmal versuchen";
    statusColor = "text-blue-600 dark:text-blue-400";
  } else if (hasNoSlots) {
    statusMessage = "Alle Plätze belegt";
    statusColor = "text-amber-600 dark:text-amber-400";
  } else if (isInactive) {
    statusMessage = "Nicht verfügbar";
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
                {task.points} Punkte
              </p>
            </div>
          ) : (
            <Badge 
              variant="default" 
              className="text-base px-3 py-1 font-bold rounded-xl"
            >
              +{task.points} Punkte
            </Badge>
          )}
          
          {hasNoSlots && task.remainingSlots === 0 && (
            <p className="text-xs text-amber-600 dark:text-amber-400 font-medium">
              Keine Plätze mehr verfügbar
            </p>
          )}
        </div>
      </Card>
    </motion.div>
  );
}

export default function KidDashboard() {
  const { t } = useTranslation();
  const { toast } = useToast();
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
        title: "Punkte eingezahlt! 🎯",
        description: "Dein Beitrag wurde zum Familienziel hinzugefügt.",
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
        description: error.message || "Beitrag konnte nicht eingezahlt werden",
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
        title: "Wunsch gesendet! 💡",
        description: "Deine Eltern können deinen Wunsch jetzt sehen.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Fehler",
        description: error.message || "Wunsch konnte nicht gesendet werden",
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
        title: "Teilen gestartet! 🤝",
        description: "Andere können jetzt beitreten.",
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
        title: "Erfolgreich beigetreten! 🎉",
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

  // Load user and member data
  const { data: authUser, isLoading: userLoading } = useQuery<User>({
    queryKey: ["/api/auth/user"],
  });

  const { data: member, isLoading: memberLoading } = useQuery<FamilyMember>({
    queryKey: ["/api/family-members/current"],
    enabled: !!authUser,
  });

  // WebSocket connection for real-time updates
  useWebSocket(member?.familyName || null);

  const { data: realMember } = useQuery<FamilyMember>({
    queryKey: ["/api/family-members/real"],
    enabled: !!authUser,
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
      return await apiRequest("PATCH", `/api/family-members/${memberId}`, data);
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
        title: "Aufgabe abgeschlossen! 🎉",
        description: selectedTask?.requiresApproval 
          ? "Wartet auf Freigabe von deinen Eltern!"
          : `Du hast ${selectedTask?.points} Punkte verdient!`,
      });
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Fehler",
        description: error.message || "Aufgabe konnte nicht abgeschlossen werden.",
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
  if (userLoading || memberLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // If not logged in
  if (!authUser || !member) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Card className="p-8 text-center">
          <p className="text-lg mb-4">Bitte melde dich an, um das Kinder-Dashboard zu sehen.</p>
          <Button asChild>
            <Link href="/dashboard">Zum Dashboard</Link>
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

  // Filter tasks: show incomplete tasks or recurring tasks
  const myTasks = tasks.filter(t => 
    !t.memberHasCompleted || t.recurrence !== "none"
  );

  return (
    <div className="min-h-screen pb-20">
      {/* Header - Like Dashboard */}
      <header className="border-b sticky top-0 backdrop-blur-md z-40 bg-background/80">
        <div className="container mx-auto max-w-7xl px-4 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <Avatar className="h-10 w-10 flex-shrink-0">
              <AvatarImage src={getAvatarUrl(member.activeSkinId, member.avatarUrl, member.useCustomAvatar)} />
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
                    <AvatarImage src={getAvatarUrl(member.activeSkinId, member.avatarUrl, member.useCustomAvatar)} />
                    <AvatarFallback style={{ backgroundColor: member.color }} className="text-3xl font-bold text-white">
                      {member.displayName[0]}
                    </AvatarFallback>
                  </Avatar>
                </motion.div>
                <div>
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
                      <span className="text-lg font-bold">{streak}-Tage-Serie!</span>
                    </div>
                  )}
                </div>
              </div>
              <div className="bg-card/80 backdrop-blur-sm p-5 rounded-2xl border-2 border-primary/30 min-w-[260px]">
                <p className="text-sm text-muted-foreground mb-3 font-medium text-center">Deine Punkte:</p>
                <div className="space-y-3">
                  {/* Total Earned - Prominent Display */}
                  <div className="text-center pb-3 border-b border-border">
                    <p className="text-xs text-muted-foreground mb-1">Total verdient</p>
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
                      <span className="font-semibold text-sm">Verfügbar:</span>
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

        {/* Rewards Section */}
        <div className="space-y-6 mb-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-gradient-to-br from-amber-400 to-orange-500 rounded-2xl">
              <Trophy className="h-8 w-8 text-white" />
            </div>
            <h2 className="text-4xl font-bold" style={{ fontFamily: "Fredoka, sans-serif" }}>
              Belohnungen
            </h2>
            <Sparkles className="h-6 w-6 text-amber-500 animate-pulse" />
          </div>

          {activeRewards.length === 0 ? (
            <Card className="p-8 text-center bg-card/80 backdrop-blur-md rounded-2xl">
              <Gift className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
              <p className="text-lg text-muted-foreground">Noch keine Belohnungen verfügbar.</p>
              <p className="text-sm text-muted-foreground mt-2">Deine Eltern können Belohnungen für dich erstellen!</p>
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
                  Meine Belohnungen
                </h2>
              </div>
              <Button variant="ghost" size="sm" asChild data-testid="button-view-all-rewards">
                <Link href="/my-rewards">
                  Alle ansehen →
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
                            {redemption.rewardTitle || "Belohnung"}
                          </h3>
                          <div className="flex flex-wrap gap-1.5 justify-center">
                            <Badge 
                              variant={redemption.status === "completed" ? "default" : "secondary"}
                              className="text-sm"
                            >
                              {redemption.status === "completed" ? "✓ Erfüllt" : 
                               redemption.status === "approved" ? "⏳ Warte" : 
                               "⏸️ Ausstehend"}
                            </Badge>
                            {isSharing && (
                              <Badge variant="secondary" className="gap-1.5 text-xs">
                                <Users className="h-3 w-3" />
                                Wird geteilt
                              </Badge>
                            )}
                            {isFinalized && (
                              <Badge variant="secondary" className="gap-1.5 text-xs">
                                <CheckCircle2 className="h-3 w-3" />
                                Geteilt
                              </Badge>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {typed.pointsSpent} Punkte {isFinalized && `(war ${typed.originalPointsSpent})`}
                          </p>
                        </div>

                        {/* Participants */}
                        {participants.length > 0 && (
                          <div className="flex items-center justify-center gap-1 flex-wrap">
                            <p className="text-xs text-muted-foreground mr-1">Mit:</p>
                            {participants.map(p => (
                              <Avatar key={p.id} className="h-6 w-6 border-2 border-background">
                                <AvatarImage src={getAvatarUrl(p.member.activeSkinId, p.member.avatarUrl, (p.member as any).useCustomAvatar)} />
                                <AvatarFallback className="text-xs">
                                  {p.member.displayName[0]}
                                </AvatarFallback>
                              </Avatar>
                            ))}
                          </div>
                        )}

                        {/* Sharing Actions */}
                        <div className="flex gap-2 pt-2 border-t border-green-500/20">
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
                      </div>
                    </Card>
                  </motion.div>
                );
              })}
            </div>
          </div>
        )}

        {/* Active Shared Rewards Section - From other family members */}
        {sharedRewards.filter(sr => sr.memberId !== member?.id).length > 0 && (
          <div className="space-y-4 mb-8">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-2xl bg-blue-500/20">
                <Users className="h-7 w-7 text-blue-500" />
              </div>
              <h2 className="text-3xl font-bold" style={{ fontFamily: "Fredoka, sans-serif" }}>
                Teilen & Sparen 🤝
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
                              {shared.reward?.title || "Belohnung"}
                            </h3>
                            <div className="flex flex-col items-center gap-1.5">
                              <div className="flex items-center gap-2">
                                {initiatorMember && (
                                  <Avatar className="h-6 w-6 border-2 border-background">
                                    <AvatarImage src={getAvatarUrl(initiatorMember.activeSkinId, initiatorMember.avatarUrl, (initiatorMember as any).useCustomAvatar)} />
                                    <AvatarFallback className="text-xs">
                                      {initiatorMember.displayName[0]}
                                    </AvatarFallback>
                                  </Avatar>
                                )}
                                <p className="text-sm text-muted-foreground">
                                  {initiatorMember?.displayName} teilt
                                </p>
                              </div>
                              <Badge variant="secondary" className="gap-1.5 text-xs">
                                <Users className="h-3 w-3" />
                                {shared.participants.length + 1} {shared.participants.length === 0 ? "Person" : "Personen"}
                              </Badge>
                            </div>
                            <p className="text-xs text-muted-foreground">
                              Original: {shared.originalPointsSpent} Punkte
                            </p>
                          </div>

                          {/* Participants */}
                          {shared.participants.length > 0 && (
                            <div className="flex items-center justify-center gap-1 flex-wrap">
                              <p className="text-xs text-muted-foreground mr-1">Dabei:</p>
                              {shared.participants.map(p => (
                                <Avatar key={p.id} className="h-6 w-6 border-2 border-background">
                                  <AvatarImage src={getAvatarUrl(p.member.activeSkinId, p.member.avatarUrl, (p.member as any).useCustomAvatar)} />
                                  <AvatarFallback className="text-xs">
                                    {p.member.displayName[0]}
                                  </AvatarFallback>
                                </Avatar>
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
                                Mitmachen
                              </Button>
                            ) : (
                              <Badge variant="secondary" className="w-full gap-1 justify-center">
                                <CheckCircle2 className="h-3 w-3" />
                                Du nimmst teil
                              </Badge>
                            )}
                          </div>
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
              Deine Aufgaben
            </h2>
          </div>

          {myTasks.length === 0 ? (
            <Card className="p-8 text-center bg-card/80 backdrop-blur-md rounded-2xl">
              <CheckCircle2 className="h-16 w-16 mx-auto mb-4 text-green-500" />
              <p className="text-lg font-bold text-green-500">Alle Aufgaben erledigt!</p>
              <p className="text-sm text-muted-foreground mt-2">Super gemacht! 🎉</p>
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
                Familienziele 🎯
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
                              Erreicht!
                            </Badge>
                          )}
                          <div className="flex flex-wrap items-center gap-2 mt-2">
                            <Badge variant="secondary" className="gap-1 text-xs">
                              <Calendar className="h-3 w-3" />
                              {goal.contributionPeriod === "weekly" ? "Wöchentlich" : "Monatlich"}
                            </Badge>
                            <Badge variant="secondary" className="gap-1 text-xs">
                              <Coins className="h-3 w-3" />
                              {goal.contributionAmount} Punkte
                            </Badge>
                          </div>
                        </div>
                      </div>

                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-medium">Fortschritt</span>
                          <span className="text-sm font-bold">
                            {goal.currentPoints} / {goal.targetPoints} Punkte
                          </span>
                        </div>
                        <Progress value={progress} className="h-3" />
                      </div>

                      <div className="flex items-center justify-between pt-4 border-t">
                        <div className="text-sm text-muted-foreground">
                          {formatPeriod(currentPeriod, goal.contributionPeriod)}
                        </div>
                        {!isCompleted && member && (
                          <Button
                            onClick={() => contributeMutation.mutate(goal.id)}
                            disabled={contributeMutation.isPending || member.totalPoints < goal.contributionAmount}
                            data-testid={`button-contribute-${goal.id}`}
                            className="font-bold"
                          >
                            <TrendingUp className="h-4 w-4 mr-2" />
                            {goal.contributionAmount} Punkte einzahlen
                          </Button>
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
                Bestenliste 🏆
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
        <Card className="p-1.5 bg-gradient-to-r from-primary/20 via-purple-500/20 to-pink-500/20 backdrop-blur-md border-2 border-primary/30 rounded-3xl shadow-2xl max-w-2xl mx-auto">
          <div className="flex justify-around gap-2">
            <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}>
              <Button 
                variant="ghost" 
                size="lg" 
                onClick={() => setRequestRewardDialogOpen(true)}
                data-testid="button-nav-request-reward" 
                className="h-14 px-5 rounded-2xl"
              >
                <Lightbulb className="h-6 w-6 mr-2 text-amber-500" />
                <span className="font-bold text-base">Wunsch</span>
              </Button>
            </motion.div>
            <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}>
              <Button variant="ghost" size="lg" asChild data-testid="button-nav-chat" className="h-14 px-5 rounded-2xl">
                <Link href="/chat">
                  <MessageCircle className="h-6 w-6 mr-2 text-blue-500" />
                  <span className="font-bold text-base">{t("nav.chat")}</span>
                </Link>
              </Button>
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
