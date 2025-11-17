import { useState } from "react";
import { Link } from "wouter";
import { motion } from "framer-motion";
import confetti from "canvas-confetti";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/hooks/useAuth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
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
} from "lucide-react";
import type { User, FamilyMember, Reward, Task, Family } from "@shared/schema";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { ProfileMenu } from "@/components/profile-menu";
import { EditMemberDialog } from "@/components/edit-member-dialog";
import { SwitchMemberDialog } from "@/components/switch-member-dialog";
import { TaskCompletionDialog } from "@/components/task-completion-dialog";
import { RewardRequestDialog } from "@/components/reward-request-dialog";
import { getAvatarUrl } from "@/lib/skins";

// Extended Task type with metadata from API
interface TaskWithMeta extends Task {
  memberHasCompleted?: boolean;
  remainingSlots?: number | null;
  memberCompletionStatus?: "pending" | "approved" | "rejected" | null;
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

  // Load user and member data
  const { data: authUser, isLoading: userLoading } = useQuery<User>({
    queryKey: ["/api/auth/user"],
  });

  const { data: member, isLoading: memberLoading } = useQuery<FamilyMember>({
    queryKey: ["/api/family-members/current"],
    enabled: !!authUser,
  });

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
              <AvatarImage src={getAvatarUrl(member.activeSkinId, member.avatarUrl)} />
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

      <div className="container mx-auto px-4 max-w-6xl space-y-8">
        {/* Hero Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <Card className="p-8 bg-gradient-to-br from-primary/10 via-card/80 to-purple-500/10 backdrop-blur-md border-2 border-primary/30 rounded-3xl shadow-xl">
            <div className="flex items-center justify-between flex-wrap gap-6">
              <div className="flex items-center gap-6">
                <motion.div
                  whileHover={{ scale: 1.1, rotate: 5 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <Avatar className="h-24 w-24 border-4 border-primary shadow-lg">
                    <AvatarImage src={getAvatarUrl(member.activeSkinId, member.avatarUrl)} />
                    <AvatarFallback style={{ backgroundColor: member.color }} className="text-4xl font-bold text-white">
                      {member.displayName[0]}
                    </AvatarFallback>
                  </Avatar>
                </motion.div>
                <div>
                  <h1 className="text-5xl font-bold mb-2" style={{ fontFamily: "Fredoka, sans-serif" }}>
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
              <div className="text-right bg-card/80 backdrop-blur-sm p-6 rounded-2xl border-2 border-primary/30">
                <p className="text-base text-muted-foreground mb-2 font-medium">Du hast:</p>
                <motion.div
                  className="text-6xl font-bold bg-gradient-to-r from-amber-500 to-orange-500 bg-clip-text text-transparent"
                  animate={{ scale: [1, 1.05, 1] }}
                  transition={{ repeat: Infinity, duration: 2 }}
                  style={{ fontFamily: "Fredoka, sans-serif" }}
                >
                  {currentPoints.toLocaleString()}
                </motion.div>
                <p className="text-lg font-bold text-primary mt-1">Punkte</p>
              </div>
            </div>
          </Card>
        </motion.div>

        {/* Rewards Section */}
        <div className="space-y-6">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-gradient-to-br from-amber-400 to-orange-500 rounded-2xl">
              <Trophy className="h-8 w-8 text-white" />
            </div>
            <h2 className="text-4xl font-bold" style={{ fontFamily: "Fredoka, sans-serif" }}>
              Deine Belohnungen!
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
              {activeRewards.slice(0, 3).map((reward, index) => (
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

        {/* Simplified Navigation - Playful Bottom Bar */}
        <motion.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.5, type: "spring" }}
        >
          <Card className="p-2 sticky bottom-4 bg-gradient-to-r from-primary/20 via-purple-500/20 to-pink-500/20 backdrop-blur-md border-2 border-primary/30 rounded-3xl shadow-2xl">
            <div className="flex justify-around gap-2">
              <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}>
                <Button 
                  variant="ghost" 
                  size="lg" 
                  onClick={() => setRequestRewardDialogOpen(true)}
                  data-testid="button-nav-request-reward" 
                  className="h-16 px-6 rounded-2xl"
                >
                  <Lightbulb className="h-7 w-7 mr-2 text-amber-500" />
                  <span className="font-bold text-base">Wunsch</span>
                </Button>
              </motion.div>
              <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}>
                <Button variant="ghost" size="lg" asChild data-testid="button-nav-chat" className="h-16 px-6 rounded-2xl">
                  <Link href="/chat">
                    <MessageCircle className="h-7 w-7 mr-2 text-blue-500" />
                    <span className="font-bold text-base">{t("nav.chat")}</span>
                  </Link>
                </Button>
              </motion.div>
            </div>
          </Card>
        </motion.div>
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
          member={member}
        />
      )}
    </div>
  );
}
