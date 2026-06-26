import { useState, useEffect, useLayoutEffect, useRef } from "react";
import { clearPhotoUsed } from "@/lib/cameraUtils";
import { isNativePlatform } from "@/lib/platform";
import { filterTasksByDate as filterTasksByDateUtil } from "@/lib/task-filters";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/hooks/useAuth";
import { useWebSocket } from "@/hooks/useWebSocket";
import { useMidnightRefresh } from "@/hooks/useMidnightRefresh";
import { FamilySetup } from "@/components/family-setup";
import { TaskCard } from "@/components/task-card";
import { Leaderboard } from "@/components/leaderboard";
import { Pinboard } from "@/components/pinboard";
import { TaskDialog } from "@/components/task-dialog";
import { RewardDialog } from "@/components/reward-dialog";
import { RewardRequestDialog } from "@/components/reward-request-dialog";
import { EditMemberDialog } from "@/components/edit-member-dialog";
import { SwitchMemberDialog } from "@/components/switch-member-dialog";
import { MemberPauseDialog } from "@/components/member-pause-dialog";
import { TaskCompletionDialog } from "@/components/task-completion-dialog";
import { SuccessCelebration } from "@/components/success-celebration";
import { ProfileMenu } from "@/components/profile-menu";
import { OnboardingTour } from "@/components/onboarding-tour";
import { NotificationBell } from "@/components/notification-bell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
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
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Plus, Trophy, Gift, Star, Crown, BarChart3, Settings, Trash2, Pencil, Lightbulb, Check, X, MessageCircle, MessageSquare, ClipboardCheck, Target, Sparkles, Info, ChevronLeft, ChevronRight, ChevronDown, Calendar, Zap, RefreshCw, LayoutList, LayoutGrid, AlertTriangle, Pin, TrendingUp, CheckCircle2, Coins } from "lucide-react";
import { RewardIconDisplay } from "@/lib/reward-icon";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { isToday, isThisWeek, parseISO, startOfDay, addDays } from "date-fns";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { apiRequest, queryClient, getDevHeaders } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";
import type { FamilyMember, Task, Reward, RewardRequest, FamilyGoal, GoalContribution } from "@shared/schema";
import { getAvatarUrl } from "@/lib/skins";
import { TOTAL_HIDDEN_STARS } from "@shared/skin-config";
import { hasFeature } from "@shared/tier-config";
import type { SubscriptionTier } from "@shared/tier-config";
import { celebrateTaskCompletion } from "@/lib/confetti";
import logoUrl from "@assets/herokids_logo_neu.png";
import familyGoalsIcon from "@assets/family-goals-icon.png";

// Custom hook for sticky sidebar on desktop

// Scrollt die Pinnwand so, dass sie direkt unterhalb des fixen Headers erscheint
function scrollToPinboard(el: HTMLElement) {
  const root = document.getElementById("root") ?? document.documentElement;
  const header = document.querySelector("[data-app-header]") as HTMLElement | null;
  const headerBottom = header ? header.getBoundingClientRect().bottom : 72;
  const currentTop = el.getBoundingClientRect().top;
  const delta = currentTop - (headerBottom + 8);
  root.scrollTo({ top: root.scrollTop + delta, behavior: "smooth" });
}

function scrollToSection(id: string) {
  const root = document.getElementById("root") ?? document.documentElement;
  const el = document.getElementById(id);
  if (!el) return;
  const header = document.querySelector("[data-app-header]") as HTMLElement | null;
  const headerBottom = header ? header.getBoundingClientRect().bottom : 72;
  const currentTop = el.getBoundingClientRect().top;
  const delta = currentTop - (headerBottom + 16);
  root.scrollTo({ top: root.scrollTop + delta, behavior: "smooth" });
}

function useVisualViewport() {
  const getVV = () => ({
    height: window.visualViewport?.height ?? window.innerHeight,
    offsetTop: window.visualViewport?.offsetTop ?? 0,
  });
  const [vv, setVV] = useState(getVV);
  useEffect(() => {
    const vvEl = window.visualViewport;
    if (!vvEl) return;
    const update = () => setVV({ height: vvEl.height, offsetTop: vvEl.offsetTop });
    vvEl.addEventListener("resize", update);
    vvEl.addEventListener("scroll", update);
    return () => {
      vvEl.removeEventListener("resize", update);
      vvEl.removeEventListener("scroll", update);
    };
  }, []);
  return vv;
}

export default function Dashboard() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { toast } = useToast();
  const { height: vvHeight, offsetTop: vvOffsetTop } = useVisualViewport();
  const [taskDialogOpen, setTaskDialogOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [rewardDialogOpen, setRewardDialogOpen] = useState(false);
  const [selectedReward, setSelectedReward] = useState<Reward | null>(null);
  const [requestRewardDialogOpen, setRequestRewardDialogOpen] = useState(false);
  const [requestToEdit, setRequestToEdit] = useState<any>(null);
  const [editMemberDialogOpen, setEditMemberDialogOpen] = useState(false);
  const [switchMemberDialogOpen, setSwitchMemberDialogOpen] = useState(false);
  const [pauseMemberDialogOpen, setPauseMemberDialogOpen] = useState(false);
  const [memberToEdit, setMemberToEdit] = useState<FamilyMember | null>(null);
  const [completionDialogOpen, setCompletionDialogOpen] = useState(false);
  const [taskToComplete, setTaskToComplete] = useState<Task | null>(null);
  const [sendPointsOpen, setSendPointsOpen] = useState(false);
  const [showTour, setShowTour] = useState(false);
  const [chatBarCollapsed, setChatBarCollapsed] = useState(() => {
    try { return localStorage.getItem("herokids_chatbar_collapsed") === "true"; } catch { return false; }
  });

  // Show onboarding tour for parents who haven't completed it yet
  // NOTE: must live here, before any conditional returns (Rules of Hooks)
  const tourUser = user; // alias to avoid lint warning about conditional hook
  useEffect(() => {
    if (tourUser && !tourUser.onboardingCompletedAt) {
      const timer = setTimeout(() => setShowTour(true), 800);
      return () => clearTimeout(timer);
    }
  }, [tourUser?.id, tourUser?.onboardingCompletedAt]);

  useEffect(() => {
    const target = sessionStorage.getItem("dashboardScrollTarget");
    if (target) {
      sessionStorage.removeItem("dashboardScrollTarget");
      const timer = setTimeout(() => scrollToSection(target), 400);
      return () => clearTimeout(timer);
    }
  }, []);

  // Freeze #root scroll while any dialog is open, then restore exactly (iOS keyboard shifts viewport)
  const savedRootScrollRef = useRef(0);
  const anyDialogOpen = taskDialogOpen || rewardDialogOpen || requestRewardDialogOpen ||
    editMemberDialogOpen || switchMemberDialogOpen || completionDialogOpen || sendPointsOpen;
  const prevAnyDialogOpenRef = useRef(false);
  useLayoutEffect(() => {
    const root = document.getElementById('root');
    if (!root) return;
    if (anyDialogOpen) {
      savedRootScrollRef.current = root.scrollTop;
      root.style.overflowY = 'hidden';
      prevAnyDialogOpenRef.current = true;
    } else if (prevAnyDialogOpenRef.current) {
      // Only restore scroll when a dialog was actually just closed
      prevAnyDialogOpenRef.current = false;
      root.style.overflowY = 'auto';
      const target = savedRootScrollRef.current;
      root.scrollTop = target;
      const t1 = setTimeout(() => { root.scrollTop = target; }, 350);
      const t2 = setTimeout(() => { root.scrollTop = target; }, 700);
      return () => { clearTimeout(t1); clearTimeout(t2); };
    } else {
      // Initial mount: just ensure overflow is auto, don't touch scrollTop
      root.style.overflowY = 'auto';
    }
  }, [anyDialogOpen]);
  const [selectedPointsRecipients, setSelectedPointsRecipients] = useState<string[]>([]);
  const [pointsAmount, setPointsAmount] = useState("");
  const [celebration, setCelebration] = useState<{
    points: number;
    message: string;
  } | null>(null);
  const [childActiveTab, setChildActiveTab] = useState<string>("active");
  const [leaderboardPeriod, setLeaderboardPeriod] = useState<"week" | "month">("month");
  const [subscriptionProcessing, setSubscriptionProcessing] = useState(false);
  const [taskFilter, setTaskFilter] = useState<"daily" | "weekly" | "monthly" | "onetime" | "all">(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("herokids_task_filter");
      if (saved === "daily" || saved === "weekly" || saved === "monthly" || saved === "onetime" || saved === "all") return saved;
    }
    return "all";
  });
  const [dashboardView, setDashboardView] = useState<"list" | "grid">(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("herokids_dashboard_view");
      if (saved === "list" || saved === "grid") return saved;
    }
    return "list";
  });
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem("herokids_parent_collapsed_categories");
      return saved ? new Set<string>(JSON.parse(saved)) : new Set<string>();
    } catch {
      return new Set<string>();
    }
  });
  const [debugTapCount, setDebugTapCount] = useState(0);
  const [showDebugInfo, setShowDebugInfo] = useState(false);
  const debugTapTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  const containerRef = useRef<HTMLDivElement>(null);

  // Scroll to pinboard when navigated here from a pinboard_posted notification
  useEffect(() => {
    if (window.location.hash !== "#pinboard") return;
    const el = document.getElementById("pinboard");
    if (el) {
      setTimeout(() => scrollToPinboard(el), 300);
    }
  }, []);

  // Debug tap handler - 5 taps on logo shows viewport info
  const handleDebugTap = () => {
    setDebugTapCount(prev => {
      const newCount = prev + 1;
      if (newCount >= 5) {
        setShowDebugInfo(true);
        return 0;
      }
      return newCount;
    });
    // Reset tap count after 2 seconds of no taps
    if (debugTapTimeoutRef.current) clearTimeout(debugTapTimeoutRef.current);
    debugTapTimeoutRef.current = setTimeout(() => setDebugTapCount(0), 2000);
  };

  // Check for subscription=success in URL and verify checkout session
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const sessionId = params.get('session_id');
    
    if (params.get('subscription') === 'success' && sessionId) {
      setSubscriptionProcessing(true);
      
      // Remove query parameters from URL
      window.history.replaceState({}, '', window.location.pathname);
      
      // Verify the checkout session with backend
      apiRequest("POST", "/api/verify-checkout-session", { sessionId })
        .then((res) => res.json())
        .then((data) => {
          console.log("✅ Checkout session verified:", data);
          
          // Invalidate queries to fetch updated subscription
          queryClient.invalidateQueries({ queryKey: ["/api/families/current"] });
          queryClient.invalidateQueries({ queryKey: ["/api/family-members/current"] });
          
          setSubscriptionProcessing(false);
          
          toast({
            title: "✅ " + t('dashboard.subscription_activated'),
            description: t('dashboard.subscription_activated_desc'),
          });
        })
        .catch((error) => {
          console.error("❌ Error verifying checkout session:", error);
          setSubscriptionProcessing(false);
          
          toast({
            title: "❌ Error",
            description: "Failed to activate subscription. Please contact support.",
            variant: "destructive",
          });
        });
    }
  }, [toast, t]);

  // Fetch current family member (may be acting as someone)
  const { data: member, isLoading: memberLoading } = useQuery<FamilyMember>({
    queryKey: ["/api/family-members/current"],
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
  });

  // Fetch real user's member record (to determine permissions)
  const { data: realMember } = useQuery<FamilyMember>({
    queryKey: ["/api/family-members/real"],
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
  });

  // WebSocket connection for real-time updates
  useWebSocket(member?.familyName || null);

  // Automatic midnight refresh for recurring tasks
  useMidnightRefresh();

  // Fetch all family members
  const { data: familyMembers = [] } = useQuery<FamilyMember[]>({
    queryKey: ["/api/family-members"],
    enabled: !!member,
    staleTime: 5 * 60 * 1000,
  });

  // Fetch tasks
  const { data: tasks = [] } = useQuery<Task[]>({
    queryKey: ["/api/tasks"],
    enabled: !!member,
    staleTime: 5 * 60 * 1000,
  });

  // Fetch rewards
  const { data: rewards = [] } = useQuery<Reward[]>({
    queryKey: ["/api/rewards"],
    enabled: !!member,
    staleTime: 5 * 60 * 1000,
  });

  // Fetch star stats for star collection display
  const { data: starData } = useQuery<{
    starsFound: number;
    totalStars: number;
    earnedLegacySkinIds: string[];
  }>({
    queryKey: ["/api/stars"],
    enabled: !!member,
    staleTime: 5 * 60 * 1000,
  });
  
  // Log rewards data for debugging
  useEffect(() => {
    if (rewards && rewards.length > 0) {
      console.log('🎁 Rewards data received:', rewards);
      console.log('🔍 First reward structure:', rewards[0]);
      console.log('🔑 First reward keys:', Object.keys(rewards[0]));
    }
  }, [rewards]);

  // Fetch reward requests
  const { data: rewardRequests = [] } = useQuery<RewardRequest[]>({
    queryKey: ["/api/reward-requests"],
    enabled: !!member,
    staleTime: 5 * 60 * 1000,
  });

  // Fetch family subscription tier
  const { data: familyData } = useQuery<{
    familyName: string;
    subscriptionTier: string;
    memberCount: number;
    maxMembersForTier?: number;
    overLimitCount?: number;
    showLeaderboard?: boolean;
    singleDeviceMode?: boolean;
    weeklyPrize?: string | null;
    monthlyPrize?: string | null;
    yearlyPrize?: string | null;
    categoryNames?: { household?: string; school?: string; selfCare?: string; other?: string } | null;
    trialStartedAt?: string | null;
    trialEndsAt?: string | null;
  }>({
    queryKey: ["/api/families/current"],
    enabled: !!member,
    staleTime: 5 * 60 * 1000,
  });

  // Fetch unread chat message count
  const { data: unreadChatData } = useQuery<{ count: number }>({
    queryKey: ["/api/chat/unread-count"],
    enabled: !!member && (hasFeature(familyData?.subscriptionTier as SubscriptionTier || "free", "familyChat") || !!(familyData?.trialEndsAt && new Date(familyData.trialEndsAt) > new Date())),
    staleTime: 5 * 60 * 1000,
  });

  // Fetch pending approvals count (for parents)
  const { data: pendingApprovalsData } = useQuery<{ count: number }>({
    queryKey: ["/api/tasks/pending-count"],
    enabled: !!member && member?.role === "parent",
    staleTime: 5 * 60 * 1000,
  });

  // Fetch pending reward redemptions count (for parents)
  const { data: pendingRewardsData } = useQuery<{ count: number }>({
    queryKey: ["/api/reward-redemptions/pending-count"],
    enabled: !!member && member?.role === "parent",
    staleTime: 5 * 60 * 1000,
  });

  // Fetch achievement definitions for special rewards display
  const { data: achievements = [] } = useQuery<{
    id: string;
    familyName: string;
    type: string;
    slug: string;
    title: string;
    description: string;
    bonusPoints: number;
    rewardType: "points" | "custom";
    customReward: string | null;
    isActive: boolean;
  }[]>({
    queryKey: ["/api/achievements"],
    enabled: !!member,
    staleTime: 5 * 60 * 1000,
  });

  // Fetch family goals for parent dashboard widget
  type FamilyGoalWithContributions = FamilyGoal & { contributions: GoalContribution[]; currentPeriod: string };
  const { data: parentGoals = [] } = useQuery<FamilyGoalWithContributions[]>({
    queryKey: ["/api/family-goals"],
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

  // Reset child tab to "active" when leaderboard becomes unavailable
  useEffect(() => {
    const showLeaderboardToChild = familyData?.showLeaderboard !== false;
    if (!showLeaderboardToChild && childActiveTab === "leaderboard") {
      setChildActiveTab("active");
    }
  }, [familyData?.showLeaderboard, childActiveTab]);

  // Persist filter selection (must be before early returns to follow hooks rules)
  useEffect(() => {
    localStorage.setItem("herokids_task_filter", taskFilter);
  }, [taskFilter]);

  useEffect(() => {
    localStorage.setItem("herokids_dashboard_view", dashboardView);
  }, [dashboardView]);

  useEffect(() => {
    localStorage.setItem("herokids_chatbar_collapsed", String(chatBarCollapsed));
  }, [chatBarCollapsed]);

  // Setup family member
  const setupMutation = useMutation({
    mutationFn: async (data: any) => {
      return await apiRequest("POST", "/api/family-members", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/family-members/current"] });
      toast({
        title: t("auth.welcome"),
        description: t("toast.profileCreated"),
      });
    },
  });

  // Join family with join code
  const joinFamilyMutation = useMutation({
    mutationFn: async (data: any) => {
      return await apiRequest("POST", "/api/join-family", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/family-members/current"] });
      toast({
        title: t("toast.welcomeFamily"),
        description: t("toast.joinedFamily"),
      });
    },
    onError: (error: any) => {
      toast({
        title: t("toast.failedJoinFamily"),
        description: error.message || t("toast.invalidJoinCode"),
        variant: "destructive",
      });
    },
  });

  // Edit family member
  const editMemberMutation = useMutation({
    mutationFn: async ({ memberId, data }: { memberId: string; data: any }) => {
      return await apiRequest("PUT", `/api/family-members/${memberId}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/family-members"] });
      queryClient.invalidateQueries({ queryKey: ["/api/family-members/current"] });
      setEditMemberDialogOpen(false);
      setMemberToEdit(null);
      clearPhotoUsed();
    },
    onError: (error: any) => {
      toast({
        title: t("toast.failedUpdateProfile"),
        description: error.message || t("toast.unableUpdateProfile"),
        variant: "destructive",
      });
    },
  });

  // Switch member (parents only)
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

  // Family goals helpers for parent dashboard widget
  const getGoalCurrentPeriod = (contributionPeriod: "weekly" | "monthly") => {
    const now = new Date();
    if (contributionPeriod === "weekly") {
      const weekNumber = Math.ceil((now.getTime() - new Date(now.getFullYear(), 0, 1).getTime()) / 604800000);
      return `${now.getFullYear()}-W${String(weekNumber).padStart(2, '0')}`;
    }
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  };

  const getGoalNextContributionDate = (contributionPeriod: "weekly" | "monthly") => {
    const now = new Date();
    if (contributionPeriod === "weekly") {
      const daysUntilMonday = (8 - now.getDay()) % 7 || 7;
      const next = new Date(now);
      next.setDate(now.getDate() + daysUntilMonday);
      return next.toLocaleDateString();
    }
    return new Date(now.getFullYear(), now.getMonth() + 1, 1).toLocaleDateString();
  };

  const formatGoalPeriod = (period: string, contributionPeriod: "weekly" | "monthly") => {
    if (contributionPeriod === "weekly") {
      const parts = period.split("-W");
      return t("familyGoals.weekFormat", { week: parts[1], year: parts[0] });
    }
    const parts = period.split("-");
    const monthIndex = parseInt(parts[1]) - 1;
    return t("familyGoals.monthFormat", { month: t(`common.monthsShort.${monthIndex}`), year: parts[0] });
  };

  // Contribute to family goal (parent dashboard widget)
  const parentContributeMutation = useMutation({
    mutationFn: async (goalId: string) => {
      return await apiRequest("POST", `/api/family-goals/${goalId}/contribute`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/family-goals"] });
      queryClient.invalidateQueries({ queryKey: ["/api/family-members/current"] });
      toast({ title: t("familyGoals.pointsContributed"), description: t("familyGoals.pointsContributedDesc") });
    },
    onError: (error: any) => {
      toast({ title: t("errors.error"), description: error.message || t("familyGoals.errorContribute"), variant: "destructive" });
    },
  });

  // Handle task click
  const handleTaskClick = (task: Task) => {
    setSelectedTask(task);
    setTaskDialogOpen(true);
  };

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
      setSelectedTask(null);
    },
  });

  // Update task
  const updateTaskMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const taskData = {
        ...data,
        dueDate: data.dueDate && data.dueDate.trim() !== "" ? data.dueDate : undefined,
      };
      return await apiRequest("PUT", `/api/tasks/${id}`, taskData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
      setTaskDialogOpen(false);
      setSelectedTask(null);
    },
  });

  // Complete task
  const completeTaskMutation = useMutation({
    mutationFn: async ({ taskId, proofPhotoUrl }: { taskId: string; proofPhotoUrl?: string }) => {
      const res = await apiRequest("POST", `/api/tasks/${taskId}/complete`, { proofPhotoUrl });
      return await res.json();
    },
    onMutate: async ({ taskId }) => {
      await queryClient.cancelQueries({ queryKey: ["/api/tasks"] });
      const previousTasks = queryClient.getQueryData<Task[]>(["/api/tasks"]);
      queryClient.setQueryData<Task[]>(["/api/tasks"], (old) =>
        old ? old.map((t) => t.id === taskId ? { ...t, memberHasCompleted: true } : t) : old
      );
      return { previousTasks };
    },
    onError: (error: any, _vars: any, context: any) => {
      if (context?.previousTasks) {
        queryClient.setQueryData(["/api/tasks"], context.previousTasks);
      }
      const errorCode = error?.data?.code;
      let title = t("toast.error");
      let description = error.message || t("toast.taskError");
      if (errorCode === "TASK_NOT_YET_AVAILABLE") {
        title = t("tasks.dueDateNotYetTooltip");
      } else if (errorCode === "TASK_DEADLINE_EXPIRED") {
        title = t("tasks.dueDateExpiredTooltip");
      }
      toast({ variant: "destructive", title, description });
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"], refetchType: 'active' });
      queryClient.invalidateQueries({ queryKey: ["/api/family-members"], refetchType: 'active' });
      queryClient.invalidateQueries({ queryKey: ["/api/family-members/current"], refetchType: 'active' });
      queryClient.invalidateQueries({ queryKey: ["/api/tasks/completions/pending"], refetchType: 'active' });
      setCompletionDialogOpen(false);
      setTaskToComplete(null);
      clearPhotoUsed();
      if (data.autoApproved) {
        celebrateTaskCompletion();
        setCelebration({
          points: data.completion?.pointsEarned || 0,
          message: data.message || t("toast.greatJob"),
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
      setSelectedReward(null);
    },
  });

  // Update reward
  const updateRewardMutation = useMutation({
    mutationFn: async ({ rewardId, data }: { rewardId: string; data: any }) => {
      return await apiRequest("PUT", `/api/rewards/${rewardId}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/rewards"] });
      setRewardDialogOpen(false);
      setSelectedReward(null);
    },
  });

  // Redeem reward
  const redeemRewardMutation = useMutation({
    mutationFn: async (rewardId: string) => {
      console.log('🎯 Redeem mutation called with rewardId:', rewardId);
      
      if (!rewardId || rewardId === 'undefined') {
        console.error('❌ Invalid rewardId:', rewardId);
        throw new Error(`Invalid reward ID: ${rewardId}`);
      }
      
      console.log('📡 Sending POST request to:', `/api/rewards/${rewardId}/redeem`);
      
      const res = await fetch(`/api/rewards/${rewardId}/redeem`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getDevHeaders() },
        credentials: "include",
        body: JSON.stringify({}),
      });
      
      console.log('📥 Response status:', res.status, res.statusText);
      
      const text = await res.text();
      console.log('📄 Response text:', text);
      
      if (!res.ok) {
        let errorData: any;
        try {
          errorData = text ? JSON.parse(text) : { message: `HTTP ${res.status}` };
        } catch {
          errorData = { message: text || `HTTP ${res.status}` };
        }
        console.error('❌ Server error:', errorData);
        throw { status: res.status, data: errorData, message: errorData.message };
      }
      
      if (!text || text.trim() === '') {
        console.error('❌ Empty response from server');
        throw new Error('Empty response from server');
      }
      
      const data = JSON.parse(text);
      console.log('✅ Redemption successful:', data);
      return data;
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/family-members"] });
      queryClient.invalidateQueries({ queryKey: ["/api/family-members/current"] });
      queryClient.invalidateQueries({ queryKey: ["/api/reward-redemptions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/reward-redemptions/pending-count"] });
      queryClient.invalidateQueries({ queryKey: ["/api/rewards"] });
      
      const pointsSpent = data?.redemption?.pointsSpent || 0;
      const rewardTitle = data?.redemption?.rewardTitle || 'Reward';
      
      toast({
        title: t("toast.rewardRedeemed"),
        description: data?.message || `Successfully redeemed ${rewardTitle}!`,
      });
      
      setCelebration({
        points: -pointsSpent,
        message: `${rewardTitle} - ${pointsSpent} ${t("dashboard.pointsLabel")}`,
      });
    },
    onError: (error: any) => {
      const errorMessage = error?.data?.message || error?.message || t("rewards.notEnoughPoints");
      toast({
        title: t("toast.failedRedeem"),
        description: errorMessage,
        variant: "destructive",
      });
    },
  });

  // Delete reward
  const deleteRewardMutation = useMutation({
    mutationFn: async (rewardId: string) => {
      return await apiRequest("DELETE", `/api/rewards/${rewardId}`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/rewards"] });
    },
    onError: (error: any) => {
      toast({
        title: t("toast.failedDelete"),
        description: error.message || t("toast.couldNotDeleteReward"),
        variant: "destructive",
      });
    },
  });

  // Delete task
  const deleteTaskMutation = useMutation({
    mutationFn: async (taskId: string) => {
      return await apiRequest("DELETE", `/api/tasks/${taskId}`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
    },
    onError: (error: any) => {
      toast({
        title: t("toast.failedDelete"),
        description: error.message || t("toast.couldNotDeleteTask"),
        variant: "destructive",
      });
    },
  });

  // Create reward request
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
        title: t("toast.failedSendRequest"),
        description: error.message || t("toast.unableSendRequest"),
        variant: "destructive",
      });
    },
  });

  // Approve reward request
  const approveRewardRequestMutation = useMutation({
    mutationFn: async (requestId: string) => {
      return await apiRequest("PATCH", `/api/reward-requests/${requestId}/approve`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/reward-requests"] });
      queryClient.invalidateQueries({ queryKey: ["/api/rewards"] });
      toast({
        title: t("toast.requestApproved"),
        description: t("toast.requestApprovedDesc"),
      });
    },
    onError: (error: any) => {
      toast({
        title: t("toast.failedApprove"),
        description: error.message || t("toast.unableApprove"),
        variant: "destructive",
      });
    },
  });

  // Decline reward request
  const declineRewardRequestMutation = useMutation({
    mutationFn: async (requestId: string) => {
      return await apiRequest("PATCH", `/api/reward-requests/${requestId}/decline`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/reward-requests"] });
    },
    onError: (error: any) => {
      toast({
        title: t("toast.failedDecline"),
        description: error.message || t("toast.unableDecline"),
        variant: "destructive",
      });
    },
  });

  // Update reward request
  const updateRewardRequestMutation = useMutation({
    mutationFn: async ({ requestId, data }: { requestId: string; data: any }) => {
      return await apiRequest("PATCH", `/api/reward-requests/${requestId}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/reward-requests"] });
      setRequestRewardDialogOpen(false);
      setRequestToEdit(null);
    },
    onError: (error: any) => {
      toast({
        title: t("toast.failedUpdate"),
        description: error.message || t("toast.unableUpdate"),
        variant: "destructive",
      });
    },
  });

  const awardPointsMutation = useMutation({
    mutationFn: async ({ memberIds, points }: { memberIds: string[]; points: number }) => {
      return await apiRequest("POST", "/api/family/award-points", { memberIds, points });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/family-members"] });
      setSendPointsOpen(false);
      setSelectedPointsRecipients([]);
      setPointsAmount("");
      toast({
        title: t("dashboard.pointsSent", "Punkte gesendet!"),
        description: t("dashboard.pointsSentDesc", "Die Punkte wurden erfolgreich übertragen."),
      });
    },
    onError: (error: any) => {
      toast({
        title: t("dashboard.pointsSendFailed", "Fehler"),
        description: error.message || t("dashboard.pointsSendFailedDesc", "Punkte konnten nicht gesendet werden."),
        variant: "destructive",
      });
    },
  });

  if (memberLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto mb-4" />
          <p className="text-muted-foreground">{t("common.loading")}</p>
        </div>
      </div>
    );
  }

  if (!member) {
    return (
      <FamilySetup
        onComplete={(data) => setupMutation.mutate(data)}
        onJoin={(data) => joinFamilyMutation.mutate(data)}
        isSubmitting={setupMutation.isPending || joinFamilyMutation.isPending}
        initialDisplayName={[user?.firstName, user?.lastName].filter(Boolean).join(" ") || user?.email?.split("@")[0] || ""}
        initialFamilyName={user?.lastName ? `Familie ${user.lastName}` : user?.firstName ? `${user.firstName}s Familie` : ""}
      />
    );
  }

  // Use acting member's role to show correct view (parent/child)
  const isParent = member?.role === "parent";
  // Use real member's role to show parent-only UI elements (like switch button)
  const isRealParent = realMember?.role === "parent";
  // Show active tasks AND completed recurring tasks (they stay visible until nextAvailableDate passes)
  const activeTasks = tasks.filter((t) => 
    t.status === "active" || 
    (t.status === "completed" && t.nextAvailableDate !== null)
  );
  const activeRewards = rewards.filter((r) => r.isActive);

  // Task filter and grouping helpers
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
    const customNames = familyData?.categoryNames;
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

  // Filter tasks by date range (based on recurrence type and dueDate)
  const filterTasksByDate = (taskList: typeof activeTasks) =>
    filterTasksByDateUtil(taskList, taskFilter);

  // Sort tasks by type: regular < multi-assignment < shared, then by due date and title
  const sortTasksWithinCategory = (taskList: typeof activeTasks) => {
    return [...taskList].sort((a, b) => {
      // Task type priority: 0 = regular, 1 = multi-assignment, 2 = shared
      const getTaskTypePriority = (task: typeof activeTasks[0]) => {
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
  const groupTasksByCategory = (taskList: typeof activeTasks) => {
    const groups: Record<string, typeof activeTasks> = {};
    
    taskList.forEach(task => {
      const category = getTaskCategory(task.iconEmoji);
      if (!groups[category]) {
        groups[category] = [];
      }
      groups[category].push(task);
    });
    
    // Sort categories: household, school, selfCare, other
    const categoryOrder = ["household", "school", "selfCare", "other"];
    const sortedGroups: Record<string, typeof activeTasks> = {};
    
    categoryOrder.forEach(cat => {
      if (groups[cat] && groups[cat].length > 0) {
        // Sort tasks within each category
        sortedGroups[cat] = sortTasksWithinCategory(groups[cat]);
      }
    });
    
    return sortedGroups;
  };

  const importantActiveTasks = activeTasks.filter(t => (t as any).isImportant);
  const regularActiveTasks = activeTasks.filter(t => !(t as any).isImportant);
  const filteredTasks = filterTasksByDate(regularActiveTasks);
  const groupedTasks = groupTasksByCategory(filteredTasks);
  const hasMultipleCategories = Object.keys(groupedTasks).length > 1;

  // Toggle category collapse and persist to localStorage
  const toggleCategory = (category: string) => {
    setCollapsedCategories(prev => {
      const newSet = new Set(prev);
      if (newSet.has(category)) {
        newSet.delete(category);
      } else {
        newSet.add(category);
      }
      localStorage.setItem("herokids_parent_collapsed_categories", JSON.stringify([...newSet]));
      return newSet;
    });
  };

  return (
    <div className="min-h-screen overflow-x-clip">
      {/* Header — position:fixed so it never scrolls away in WKWebView */}
      <header
        data-app-header
        className="fixed top-0 left-0 right-0 z-40 w-full bg-background/70 backdrop-blur-md"
        style={{
          paddingTop: 'max(calc(var(--sat, env(safe-area-inset-top)) - 6px), 0px)',
          height: 'calc(var(--header-h) + max(calc(var(--sat, env(safe-area-inset-top)) - 6px), 0px))',
          minHeight: 'calc(var(--header-h) + max(calc(var(--sat, env(safe-area-inset-top)) - 6px), 0px))',
          maxHeight: 'calc(var(--header-h) + max(calc(var(--sat, env(safe-area-inset-top)) - 6px), 0px))',
        }}
      >
        <div className="container mx-auto max-w-7xl h-full flex items-center justify-between gap-4" style={{ paddingLeft: 'max(1rem, env(safe-area-inset-left))', paddingRight: 'max(1rem, env(safe-area-inset-right))' }}>
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div className="flex-shrink-0" data-testid="avatar-header-parent">
              <Avatar className="h-10 w-10 header-avatar" style={{ borderWidth: "3px", borderStyle: "solid", borderColor: member.color }}>
                <AvatarImage src={getAvatarUrl(member.activeSkinId, member.avatarUrl, member.useCustomAvatar)} />
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
              return <Link href="/pricing">{badge}</Link>;
            })()}
            <NotificationBell familyLanguage="en" memberRole={member.role} />
            <div data-tour="tour-profile-menu">
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
        </div>
      </header>

      <div
        className={`container mx-auto max-w-7xl py-8 overflow-x-clip ${isParent ? "pb-[calc(4.5rem+env(safe-area-inset-bottom))]" : ""}`}
        style={{ paddingTop: 'calc(var(--header-h) + var(--sat, env(safe-area-inset-top)) + 1rem)', paddingLeft: 'max(1rem, env(safe-area-inset-left))', paddingRight: 'max(1rem, env(safe-area-inset-right))' }}
      >
        {isParent ? (
          /* Parent View */
          <div ref={containerRef} className="grid grid-cols-1 lg:grid-cols-3 gap-8 relative">
            {/* Trial Banner — absolute on mobile (overlays logo, no layout push), static in grid on desktop */}
            {isParent && familyData?.trialEndsAt && familyData.subscriptionTier === "free" && (() => {
              const daysLeft = Math.ceil((new Date(familyData.trialEndsAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
              return daysLeft > 0 ? (
                <div className="absolute top-0 left-0 right-0 z-20 lg:static lg:col-span-3 lg:z-auto">
                  <Link href="/pricing">
                    <button
                      className="w-full flex items-center gap-3 p-4 rounded-lg bg-emerald-50/90 dark:bg-emerald-950/80 border border-emerald-300 dark:border-emerald-700 hover-elevate active-elevate-2 text-left backdrop-blur-sm"
                      data-testid="banner-trial"
                    >
                      <Sparkles className="h-5 w-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-sm text-emerald-900 dark:text-emerald-200">
                          {t("trial.bannerTitle", { days: daysLeft })}
                        </div>
                        <div className="text-xs text-emerald-700 dark:text-emerald-400 mt-0.5">
                          {t("trial.bannerSubtitle")}
                        </div>
                      </div>
                      <ChevronRight className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                    </button>
                  </Link>
                </div>
              ) : null;
            })()}

            {/* Over-limit Banner */}
            {isParent && (familyData?.overLimitCount ?? 0) > 0 && (
              <div className="lg:col-span-3">
                <button
                  onClick={() => setPauseMemberDialogOpen(true)}
                  className="w-full flex items-center gap-3 p-4 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-300 dark:border-amber-700 hover-elevate active-elevate-2 text-left"
                  data-testid="banner-over-limit"
                >
                  <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-sm text-amber-900 dark:text-amber-200">
                      {familyData?.overLimitCount} Mitglied{(familyData?.overLimitCount ?? 0) !== 1 ? "er" : ""} über dem Limit
                    </div>
                    <div className="text-xs text-amber-700 dark:text-amber-400 mt-0.5">
                      Dein Plan erlaubt max. {familyData?.maxMembersForTier} aktive Mitglieder. Tippe um auszuwählen wer pausiert wird.
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0" />
                </button>
              </div>
            )}
            {/* Main Content */}
            <div className="lg:col-span-2 space-y-6 min-w-0">
              {/* Logo and Profile Section */}
              <div>
                <div className="mb-4 flex justify-center">
                  <img 
                    src={logoUrl} 
                    alt="HeroKids Logo" 
                    className="h-36 w-auto object-contain cursor-pointer"
                    data-testid="img-dashboard-logo"
                    onClick={handleDebugTap}
                  />
                </div>
                <div className="flex items-center justify-between flex-wrap gap-5">
                  {/* Left: Avatar + Star counter */}
                  <div className="flex items-center gap-4">
                    <button
                      onClick={() => { setMemberToEdit(member); setEditMemberDialogOpen(true); }}
                      className="flex-shrink-0 rounded-full cursor-pointer hover-elevate"
                      data-testid="button-avatar-profile-large"
                    >
                      <Avatar className="h-16 w-16" style={{ borderWidth: "3px", borderStyle: "solid", borderColor: member.color }}>
                        <AvatarImage src={getAvatarUrl(member.activeSkinId, member.avatarUrl, member.useCustomAvatar, member.updatedAt)} />
                        <AvatarFallback style={{ backgroundColor: member.color }} className="text-2xl font-bold text-white">
                          {member.displayName[0]}
                        </AvatarFallback>
                      </Avatar>
                    </button>
                    <Link href="/skins" data-testid="link-stars-to-skins-parent" data-tour="tour-skins">
                      <div className="flex items-center gap-2 bg-muted/60 px-3 py-1.5 rounded-xl border border-border cursor-pointer hover-elevate">
                        <Star className="h-5 w-5 fill-yellow-400 text-yellow-400" />
                        <span className="text-base font-semibold" data-testid="text-parent-stars-header">
                          {(starData?.starsFound ?? member.starsFound) ?? 0}/{TOTAL_HIDDEN_STARS}
                        </span>
                      </div>
                    </Link>
                    <button
                      data-testid="button-scroll-to-pinboard"
                      data-tour="tour-pinboard"
                      className="flex items-center gap-2 bg-muted/60 px-3 py-1.5 rounded-xl border border-border cursor-pointer hover-elevate"
                      onClick={() => {
                        const el = document.getElementById("pinboard");
                        if (el) scrollToPinboard(el);
                      }}
                    >
                      <MessageSquare className="h-5 w-5" />
                    </button>
                  </div>
                  {/* Right: Points box */}
                  <div className="bg-card/80 p-4 rounded-2xl border min-w-[220px]">
                    <p className="text-xs text-muted-foreground mb-2 font-medium text-center">{t("kidDashboard.yourPoints")}</p>
                    <div className="space-y-2">
                      <div className="text-center pb-2 border-b border-border">
                        <p className="text-xs text-muted-foreground mb-0.5">{t("kidDashboard.totalEarned")}</p>
                        <div className="text-3xl font-bold" style={{ fontFamily: "Fredoka, sans-serif" }} data-testid="text-parent-total-earned">
                          {member.totalEarned.toLocaleString()}
                        </div>
                      </div>
                      <div className="flex items-center justify-between gap-4">
                        <span className="text-sm text-muted-foreground">{t("kidDashboard.available")}</span>
                        <span className="text-lg font-bold" data-testid="text-parent-available">
                          {member.totalPoints.toLocaleString()}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="grid grid-cols-2 gap-3">
                {/* Row 1: Approvals, Rewards Board */}
                <div className="relative w-full">
                  <Link href="/approvals" className="w-full block">
                    <Button variant="card" data-testid="button-approvals" data-tour="tour-approvals" className="w-full min-h-14 h-auto py-3 justify-start px-4 gap-3">
                      <span className="w-6 flex-shrink-0 flex justify-center">
                        <ClipboardCheck className="h-5 w-5" />
                      </span>
                      <span className="text-left flex-1 text-sm leading-snug">{t("dashboard.approvals")}</span>
                    </Button>
                  </Link>
                  {((pendingApprovalsData?.count || 0) + rewardRequests.filter((r: any) => r.status === "pending").length) > 0 && (
                    <span className="absolute top-2 right-2 z-50 h-5 w-5 flex items-center justify-center rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold" data-testid="badge-pending-approvals">
                      {(pendingApprovalsData?.count || 0) + rewardRequests.filter((r: any) => r.status === "pending").length}
                    </span>
                  )}
                </div>
                <div className="relative w-full">
                  <Link href="/rewards-board" className="w-full block">
                    <Button variant="card" data-testid="button-rewards-board" data-tour="tour-rewards-board" className="w-full min-h-14 h-auto py-3 justify-start px-4 gap-3">
                      <span className="w-6 flex-shrink-0 flex justify-center">
                        <Gift className="h-5 w-5" />
                      </span>
                      <span className="text-left flex-1 text-sm leading-snug">{t("dashboard.rewardsBoard")}</span>
                    </Button>
                  </Link>
                  {pendingRewardsData && pendingRewardsData.count > 0 && (
                    <span className="absolute top-2 right-2 z-50 h-5 w-5 flex items-center justify-center rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold" data-testid="badge-pending-rewards">
                      {pendingRewardsData.count}
                    </span>
                  )}
                </div>
                {/* Row 2: Family Goals, Send Points */}
                <Link href="/family-goals" className="w-full">
                  <Button variant="card" data-testid="button-family-goals" data-tour="tour-family-goals" className="w-full min-h-14 h-auto py-3 justify-start px-4 gap-3 whitespace-normal">
                    <span className="w-6 flex-shrink-0 flex justify-center">
                      <img src={familyGoalsIcon} alt="" className="h-6 w-6 object-contain" />
                    </span>
                    <span className="text-left flex-1 text-sm leading-snug">{t("dashboard.familyGoals")}</span>
                  </Button>
                </Link>
                <Button
                  variant="card"
                  data-testid="button-send-points"
                  data-tour="tour-send-points"
                  className="w-full min-h-14 h-auto py-3 justify-start px-4 gap-3 whitespace-normal"
                  onClick={() => {
                    setSelectedPointsRecipients([]);
                    setPointsAmount("");
                    setSendPointsOpen(true);
                  }}
                >
                  <span className="w-6 flex-shrink-0 flex justify-center">
                    <Zap className="h-5 w-5 text-amber-500" />
                  </span>
                  <span className="text-left flex-1 text-sm leading-snug">{t("dashboard.sendPoints", "Punkte senden")}</span>
                </Button>
                {/* Row 3: Add Task, Add Reward */}
                <Button
                  onClick={() => {
                    setSelectedTask(null);
                    setTaskDialogOpen(true);
                  }}
                  data-testid="button-add-task"
                  data-tour="tour-add-task"
                  className="w-full min-h-14 h-auto py-3 justify-start px-4 gap-3"
                >
                  <span className="w-6 flex-shrink-0 flex justify-center">
                    <Plus className="h-5 w-5" />
                  </span>
                  <span className="text-left flex-1 text-sm leading-snug">{t("dashboard.addTask")}</span>
                </Button>
                <Button
                  onClick={() => {
                    setSelectedReward(null);
                    setRewardDialogOpen(true);
                  }}
                  data-testid="button-add-reward"
                  data-tour="tour-add-reward"
                  className="w-full min-h-14 h-auto py-3 justify-start px-4 gap-3"
                >
                  <span className="w-6 flex-shrink-0 flex justify-center">
                    <Plus className="h-5 w-5" />
                  </span>
                  <span className="text-left flex-1 text-sm leading-snug">{t("dashboard.addReward")}</span>
                </Button>
              </div>

              {/* Task Filter Tabs */}
              {activeTasks.length > 0 && (
                <div className="flex items-center gap-2 mb-4 flex-wrap">
                  <div className="flex bg-muted rounded-lg p-1 gap-1 flex-wrap">
                    <Button
                      variant={taskFilter === "daily" ? "default" : "ghost"}
                      size="sm"
                      onClick={() => setTaskFilter("daily")}
                      className="text-xs px-2"
                      data-testid="button-filter-daily"
                    >
                      <RefreshCw className="h-3 w-3 mr-1 flex-shrink-0" />
                      {t("dashboard.filterDaily")}
                    </Button>
                    <Button
                      variant={taskFilter === "weekly" ? "default" : "ghost"}
                      size="sm"
                      onClick={() => setTaskFilter("weekly")}
                      className="text-xs px-2"
                      data-testid="button-filter-weekly"
                    >
                      {t("dashboard.filterWeekly")}
                    </Button>
                    <Button
                      variant={taskFilter === "monthly" ? "default" : "ghost"}
                      size="sm"
                      onClick={() => setTaskFilter("monthly")}
                      className="text-xs px-2"
                      data-testid="button-filter-monthly"
                    >
                      {t("dashboard.filterMonthly")}
                    </Button>
                    <Button
                      variant={taskFilter === "onetime" ? "default" : "ghost"}
                      size="sm"
                      onClick={() => setTaskFilter("onetime")}
                      className="text-xs px-2"
                      data-testid="button-filter-onetime"
                    >
                      <Target className="h-3 w-3 mr-1 flex-shrink-0" />
                      {t("dashboard.filterOneTime")}
                    </Button>
                    <Button
                      variant={taskFilter === "all" ? "default" : "ghost"}
                      size="sm"
                      onClick={() => setTaskFilter("all")}
                      className="text-xs px-2"
                      data-testid="button-filter-all"
                    >
                      {t("dashboard.filterAll")}
                    </Button>
                  </div>
                  <Button
                    size="icon"
                    variant="ghost"
                    className={`ml-auto bg-card border-2 border-border shadow-sm toggle-elevate${dashboardView === "grid" ? " toggle-elevated" : ""}`}
                    onClick={() => setDashboardView(dashboardView === "list" ? "grid" : "list")}
                    data-testid="button-toggle-dashboard-view"
                  >
                    {dashboardView === "grid" ? <LayoutGrid className="h-4 w-4" /> : <LayoutList className="h-4 w-4" />}
                  </Button>
                </div>
              )}

              {activeTasks.length === 0 ? (
                <Card className="p-12 text-center">
                  <Star className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
                  <h3 className="text-xl font-bold font-accent mb-2">{t("dashboard.noTasksYet")}</h3>
                  <p className="text-muted-foreground mb-6">
                    {t("dashboard.createFirstTask")}
                  </p>
                  <Button onClick={() => {
                    setSelectedTask(null);
                    setTaskDialogOpen(true);
                  }} data-testid="button-create-first-task">
                    <Plus className="h-4 w-4 mr-2" />
                    {t("dashboard.createTask")}
                  </Button>
                </Card>
              ) : (
                <div className="space-y-3">
                  {/* Pinned important tasks — collapsible, filter-independent */}
                  {importantActiveTasks.length > 0 && (
                    <Collapsible
                      open={!collapsedCategories.has("__important__")}
                      onOpenChange={() => toggleCategory("__important__")}
                      data-testid="section-important-tasks"
                    >
                      <CollapsibleTrigger asChild>
                        <Button
                          variant="ghost"
                          className="w-full justify-between p-3 h-auto hover-elevate"
                          data-testid="button-category-important"
                        >
                          <div className="flex items-center gap-2">
                            <Pin className="h-4 w-4 text-amber-500 fill-amber-500" />
                            <span className="font-semibold bg-muted px-2 py-0.5 rounded-md text-sm text-amber-600 dark:text-amber-400">
                              {t("dashboard.importantTasks", { defaultValue: "Wichtig" })}
                            </span>
                            <Badge variant="secondary" className="text-xs">{importantActiveTasks.length}</Badge>
                          </div>
                          <ChevronDown
                            className={`h-4 w-4 transition-transform ${
                              collapsedCategories.has("__important__") ? "-rotate-90" : ""
                            }`}
                          />
                        </Button>
                      </CollapsibleTrigger>
                      <CollapsibleContent className="pt-2">
                        <div className={dashboardView === "grid" ? "grid grid-cols-2 gap-2" : "grid md:grid-cols-2 gap-4"}>
                          {importantActiveTasks.map((task) => (
                            <div key={task.id} className={`relative min-w-0${dashboardView === "list" ? " group min-h-[140px]" : ""}`}>
                              <TaskCard
                                task={task}
                                showAssignee
                                compact={dashboardView === "grid"}
                                onClick={handleTaskClick}
                                onComplete={() => {
                                  if (task.requiresProof) { setTaskToComplete(task); setCompletionDialogOpen(true); }
                                  else { completeTaskMutation.mutate({ taskId: task.id }); }
                                }}
                                isCompleting={completeTaskMutation.isPending}
                                currentMemberId={member?.id}
                              />
                              {dashboardView === "list" && (
                                <div className="absolute top-2 left-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                  <Button variant="ghost" size="icon" className="h-8 w-8 bg-card/80 backdrop-blur-sm"
                                    onClick={(e) => { e.stopPropagation(); setSelectedTask(task); setTaskDialogOpen(true); }}
                                    data-testid={`button-edit-task-${task.id}`}>
                                    <Pencil className="h-4 w-4" />
                                  </Button>
                                  <Button variant="ghost" size="icon" className="h-8 w-8 bg-card/80 backdrop-blur-sm"
                                    onClick={(e) => { e.stopPropagation(); deleteTaskMutation.mutate(task.id); }}
                                    disabled={deleteTaskMutation.isPending}
                                    data-testid={`button-delete-task-${task.id}`}>
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </CollapsibleContent>
                    </Collapsible>
                  )}

                  {/* Regular tasks with filter */}
                  {regularActiveTasks.length > 0 && filteredTasks.length === 0 ? (
                    <Card className="p-8 text-center">
                      <Calendar className="h-12 w-12 mx-auto mb-3 text-muted-foreground" />
                      <h3 className="text-lg font-bold font-accent mb-2">
                        {taskFilter === "daily" ? t("dashboard.noTasksDaily") : taskFilter === "weekly" ? t("dashboard.noTasksWeekly") : taskFilter === "onetime" ? t("dashboard.noTasksOnetime") : t("dashboard.noTasksMonthly")}
                      </h3>
                      <Button variant="outline" size="sm" onClick={() => setTaskFilter("all")} data-testid="button-show-all-tasks">
                        {t("dashboard.filterAll")} ({activeTasks.length})
                      </Button>
                    </Card>
                  ) : filteredTasks.length > 0 ? (
                  <>
                  {Object.entries(groupedTasks).map(([category, categoryTasks]) => (
                    <Collapsible
                      key={category}
                      open={!collapsedCategories.has(category)}
                      onOpenChange={() => toggleCategory(category)}
                    >
                      <CollapsibleTrigger asChild>
                        <Button
                          variant="ghost"
                          className="w-full justify-between p-3 h-auto hover-elevate"
                          data-testid={`button-category-${category}`}
                        >
                          <div className="flex items-center gap-2">
                            <span className="text-lg">{getCategoryEmoji(category)}</span>
                            <span className="font-semibold bg-muted px-2 py-0.5 rounded-md text-sm">{getCategoryLabel(category)}</span>
                            <Badge variant="secondary" className="text-xs">
                              {categoryTasks.length}
                            </Badge>
                          </div>
                          <ChevronDown 
                            className={`h-4 w-4 transition-transform ${
                              collapsedCategories.has(category) ? "-rotate-90" : ""
                            }`} 
                          />
                        </Button>
                      </CollapsibleTrigger>
                      <CollapsibleContent className="pt-2">
                        <div className={dashboardView === "grid" ? "grid grid-cols-2 gap-2" : "grid md:grid-cols-2 gap-4"}>
                          {categoryTasks.map((task) => (
                            <div key={task.id} className={`relative min-w-0${dashboardView === "list" ? " group min-h-[140px]" : ""}`}>
                              <TaskCard
                                task={task}
                                showAssignee
                                compact={dashboardView === "grid"}
                                onClick={handleTaskClick}
                                onComplete={() => {
                                  if (task.requiresProof) { setTaskToComplete(task); setCompletionDialogOpen(true); }
                                  else { completeTaskMutation.mutate({ taskId: task.id }); }
                                }}
                                isCompleting={completeTaskMutation.isPending}
                                currentMemberId={member?.id}
                              />
                              {dashboardView === "list" && (
                                <div className="absolute top-2 left-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 bg-card/80 backdrop-blur-sm"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setSelectedTask(task);
                                      setTaskDialogOpen(true);
                                    }}
                                    data-testid={`button-edit-task-${task.id}`}
                                  >
                                    <Pencil className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 bg-card/80 backdrop-blur-sm"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      deleteTaskMutation.mutate(task.id);
                                    }}
                                    disabled={deleteTaskMutation.isPending}
                                    data-testid={`button-delete-task-${task.id}`}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </CollapsibleContent>
                    </Collapsible>
                  ))}
                  </>
                  ) : null}
                </div>
              )}

              {/* Rewards Section */}
              {activeRewards.length > 0 && (
                <div data-tour="tour-rewards" id="section-active-rewards">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-2xl font-bold font-accent">{t("dashboard.activeRewards")}</h2>
                    {activeRewards.length > 3 && (
                      <Button variant="ghost" size="icon" asChild className="bg-card border-2 border-border shadow-sm text-foreground flex-shrink-0" data-testid="button-view-all-rewards-parent">
                        <Link href="/active-rewards" onClick={() => sessionStorage.setItem("dashboardScrollTarget", "section-active-rewards")}>
                          <ChevronRight className="h-5 w-5" />
                        </Link>
                      </Button>
                    )}
                  </div>
                  <div className={dashboardView === "grid" ? "grid grid-cols-2 gap-2" : "grid md:grid-cols-2 gap-4"}>
                    {activeRewards.slice(0, 4).map((reward, rewardIndex) => (
                      <Card key={reward.id} className={`relative overflow-visible ${dashboardView === "grid" ? "p-2" : "p-6"}${dashboardView !== "grid" && rewardIndex === 3 ? " hidden md:block" : ""}`} data-testid={`card-reward-${reward.id}`}>
                        {isRealParent && dashboardView === "list" && (
                          <div className="absolute top-2 right-2 flex gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => {
                                setSelectedReward(reward);
                                setRewardDialogOpen(true);
                              }}
                              data-testid={`button-edit-reward-${reward.id}`}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => deleteRewardMutation.mutate(reward.id)}
                              disabled={deleteRewardMutation.isPending}
                              data-testid={`button-delete-reward-${reward.id}`}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        )}
                        {dashboardView === "grid" ? (
                          <div className="flex flex-col items-center text-center gap-1">
                            <div className="h-7 w-7 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 p-0.5">
                              <RewardIconDisplay icon={reward.iconEmoji} imgClassName="w-full h-full object-contain drop-shadow-sm" textClassName="text-base leading-none" />
                            </div>
                            <p className="font-semibold text-xs leading-tight line-clamp-1 w-full" data-testid={`text-reward-title-${reward.id}`}>{reward.title}</p>
                            <Badge variant={member.totalPoints >= reward.pointThreshold ? "default" : "secondary"} className="text-[10px] px-1.5 py-0" data-testid={`badge-reward-points-${reward.id}`}>
                              {reward.pointThreshold} {t("dashboard.pointsLabel")}
                            </Badge>
                            <Button
                              onClick={() => redeemRewardMutation.mutate(reward.id)}
                              disabled={member.totalPoints < reward.pointThreshold || redeemRewardMutation.isPending}
                              size="sm"
                              className="w-full text-[10px] h-7 px-1"
                              data-testid={`button-redeem-${reward.id}`}
                            >
                              {redeemRewardMutation.isPending ? t("dashboard.redeeming") : member.totalPoints >= reward.pointThreshold ? t("dashboard.redeemNow") : `${reward.pointThreshold - member.totalPoints} ${t("dashboard.pointsLabel")}`}
                            </Button>
                          </div>
                        ) : (
                          <div className="flex items-start gap-3">
                            <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center shrink-0 p-1.5">
                              <RewardIconDisplay icon={reward.iconEmoji} imgClassName="w-full h-full object-contain drop-shadow-sm" textClassName="text-4xl leading-none" />
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
                              <div className="flex items-center gap-2 mb-3">
                                <Badge
                                  variant={member.totalPoints >= reward.pointThreshold ? "default" : "secondary"}
                                  data-testid={`badge-reward-points-${reward.id}`}
                                >
                                  {reward.pointThreshold} {t("dashboard.pointsLabel")}
                                </Badge>
                                {member.totalPoints >= reward.pointThreshold && (
                                  <span className="text-xs font-semibold text-green-600">
                                    {t("dashboard.youCanClaim")}
                                  </span>
                                )}
                              </div>
                              <Button
                                onClick={() => redeemRewardMutation.mutate(reward.id)}
                                disabled={member.totalPoints < reward.pointThreshold || redeemRewardMutation.isPending}
                                size="sm"
                                className="w-full"
                                data-testid={`button-redeem-${reward.id}`}
                              >
                                {redeemRewardMutation.isPending ? (
                                  t("dashboard.redeeming")
                                ) : member.totalPoints >= reward.pointThreshold ? (
                                  t("dashboard.redeemNow")
                                ) : (
                                  t("dashboard.needMorePoints", { count: reward.pointThreshold - member.totalPoints })
                                )}
                              </Button>
                            </div>
                          </div>
                        )}
                      </Card>
                    ))}
                  </div>
                </div>
              )}

            </div>

            {/* Sidebar - sticky on desktop */}
            <div className="self-start sticky space-y-6" style={{ top: 'calc(var(--header-h) + var(--sat, env(safe-area-inset-top)) + 1rem)' }}>
              {/* Family Goals Widget - shown above pinboard like on kid dashboard */}
              {parentGoals.filter(g => g.isActive).length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <img src={familyGoalsIcon} alt="" className="h-8 w-8 object-contain flex-shrink-0" />
                    <h2 className="text-lg font-bold font-accent">{t("familyGoals.title")}</h2>
                  </div>
                  {parentGoals.filter(g => g.isActive).map((goal) => {
                    const progress = Math.min((goal.currentPoints / goal.targetPoints) * 100, 100);
                    const currentPeriod = goal.currentPeriod || getGoalCurrentPeriod(goal.contributionPeriod);
                    const isCompleted = goal.currentPoints >= goal.targetPoints;
                    const alreadyContributed = member ? goal.contributions?.some(c => c.memberId === member.id) : false;

                    return (
                      <Card key={goal.id} className="p-4 bg-gradient-to-br from-blue-500/10 to-cyan-500/10 border border-blue-500/30" data-testid={`card-parent-goal-${goal.id}`}>
                        <div className="space-y-3">
                          <div className="flex items-start gap-3">
                            <div className="text-3xl flex-shrink-0">{goal.iconEmoji}</div>
                            <div className="flex-1 min-w-0">
                              <h3 className="font-bold text-base leading-tight">{goal.title}</h3>
                              {isCompleted && (
                                <Badge variant="default" className="gap-1 mt-1 text-xs">
                                  <CheckCircle2 className="h-3 w-3" />
                                  {t("familyGoals.achieved")}
                                </Badge>
                              )}
                              <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                                <Badge variant="secondary" className="gap-1 text-xs">
                                  <Calendar className="h-3 w-3" />
                                  {goal.contributionPeriod === "weekly" ? t("familyGoals.weekly") : t("familyGoals.monthly")}
                                </Badge>
                                <Badge variant="secondary" className="gap-1 text-xs">
                                  <Coins className="h-3 w-3" />
                                  {goal.contributionAmount}
                                </Badge>
                              </div>
                            </div>
                          </div>

                          <div>
                            <div className="flex items-center justify-between mb-1.5">
                              <span className="text-xs font-medium text-muted-foreground">{t("familyGoals.progress")}</span>
                              <span className="text-xs font-bold">{goal.currentPoints} / {goal.targetPoints}</span>
                            </div>
                            <Progress value={progress} className="h-2" />
                          </div>

                          {goal.contributions && goal.contributions.length > 0 && (
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-muted-foreground">{t("familyGoals.contributedThisPeriod")}:</span>
                              <div className="flex -space-x-1.5">
                                {goal.contributions.map((c) => {
                                  const cm = familyMembers.find(m => m.id === c.memberId);
                                  return (
                                    <Avatar key={c.id} className="h-6 w-6 border-2 border-background" title={cm?.displayName}>
                                      <AvatarFallback className="text-white text-[10px] font-bold" style={{ backgroundColor: cm?.color || "#888" }}>
                                        {cm?.displayName?.charAt(0).toUpperCase() || "?"}
                                      </AvatarFallback>
                                    </Avatar>
                                  );
                                })}
                              </div>
                            </div>
                          )}

                          <div className="flex items-center justify-between pt-2 border-t">
                            <span className="text-xs text-muted-foreground">{formatGoalPeriod(currentPeriod, goal.contributionPeriod)}</span>
                            {!isCompleted && member && (
                              alreadyContributed ? (
                                <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-muted/50 border border-border/50">
                                  <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                                  <span className="text-xs text-muted-foreground">{getGoalNextContributionDate(goal.contributionPeriod)}</span>
                                </div>
                              ) : (
                                <Button
                                  size="sm"
                                  onClick={() => parentContributeMutation.mutate(goal.id)}
                                  disabled={parentContributeMutation.isPending || member.totalPoints < goal.contributionAmount}
                                  data-testid={`button-parent-contribute-${goal.id}`}
                                >
                                  <TrendingUp className="h-3.5 w-3.5 mr-1.5" />
                                  {t("familyGoals.contributePoints", { amount: goal.contributionAmount })}
                                </Button>
                              )
                            )}
                          </div>
                        </div>
                      </Card>
                    );
                  })}
                </div>
              )}

              {/* Pinboard */}
              <div id="pinboard" className="space-y-2">
                <div className="flex items-center gap-2">
                  <img src="/nav-icons/pinboard.png" alt="" className="w-6 h-6 object-contain drop-shadow-sm" />
                  <h2 className="text-lg font-bold font-accent">{t("pinboard.title")}</h2>
                </div>
                <Pinboard currentMemberId={member?.id ?? null} />
              </div>
              {/* Special Achievement Rewards Section */}
              {specialRewards.length > 0 && (
                <div className="space-y-3" data-tour="tour-bonus-rewards" id="section-bonus-rewards">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Trophy className="h-5 w-5 text-purple-500" />
                      <h2 className="text-lg font-bold font-accent">{t("dashboard.specialPrizes")}</h2>
                      <Sparkles className="h-4 w-4 text-purple-500" />
                    </div>
                    {specialRewards.length > 2 && (
                      <Button variant="ghost" size="icon" asChild className="bg-card border-2 border-border shadow-sm text-foreground flex-shrink-0" data-testid="button-view-all-achievements">
                        <Link href="/my-achievements" onClick={() => sessionStorage.setItem("dashboardScrollTarget", "section-bonus-rewards")}>
                          <ChevronRight className="h-5 w-5" />
                        </Link>
                      </Button>
                    )}
                  </div>
                  <div className="space-y-3">
                    {specialRewards.slice(0, 2).map((achievement) => (
                      <Card key={achievement.id} className="p-4 bg-gradient-to-br from-purple-500/10 to-pink-500/10 border border-purple-500/30">
                        <div className="flex items-center gap-3">
                          <div className="p-2 rounded-lg bg-purple-500/20 flex-shrink-0">
                            <Gift className="h-5 w-5 text-purple-500" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <h3 className="font-semibold text-sm truncate">{t(`achievements.title_${achievement.slug}`)}</h3>
                            <p className="text-sm text-purple-600 dark:text-purple-400 truncate">
                              {achievement.rewardType === "custom" && achievement.customReward
                                ? achievement.customReward
                                : `+${achievement.bonusPoints} ${t("points")}`}
                            </p>
                          </div>
                          <Popover>
                            <PopoverTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8 flex-shrink-0" data-testid={`button-info-${achievement.slug}`}>
                                <Info className="h-4 w-4 text-muted-foreground" />
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent side="left" className="max-w-[250px]">
                              <p className="text-sm">{t(`achievements.desc_${achievement.slug}`)}</p>
                            </PopoverContent>
                          </Popover>
                        </div>
                      </Card>
                    ))}
                  </div>
                </div>
              )}

              {/* Leaderboard with tier-gated period selector */}
              {hasFeature(familyData?.subscriptionTier as SubscriptionTier || "free", "weeklyLeaderboard") && (
                <div className="mb-4">
                  <Tabs value={leaderboardPeriod} onValueChange={(value) => setLeaderboardPeriod(value as "week" | "month")}>
                    <TabsList className="grid w-full grid-cols-2">
                      <TabsTrigger value="week" data-testid="tab-leaderboard-week">{t("dashboard.weekly")}</TabsTrigger>
                      <TabsTrigger value="month" data-testid="tab-leaderboard-month">{t("dashboard.monthly")}</TabsTrigger>
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
          </div>
        ) : (
          /* Child View */
          <div className="max-w-4xl mx-auto space-y-6">
            <div className="text-center">
              <div className="mb-4 flex justify-center">
                <img 
                  src={logoUrl} 
                  alt="HeroKids Logo" 
                  className="h-44 w-auto object-contain cursor-pointer"
                  data-testid="img-dashboard-logo-child"
                  onClick={handleDebugTap}
                />
              </div>
              <div className="space-y-3 mb-4">
                <p className={`text-sm font-bold ${member?.activeSkinId ? 'text-glow-white' : ''}`}>
                  {t("dashboard.availablePoints")}: {member.totalPoints}
                </p>
                <h1 className={`text-4xl font-black font-accent ${member?.activeSkinId ? 'text-glow-white' : ''}`} data-testid="text-child-welcome">
                  {t("dashboard.hi", { name: member.displayName })}
                </h1>
                <p className={`text-lg font-semibold ${member?.activeSkinId ? 'text-glow-white' : ''}`}>
                  {t("dashboard.completeTasksEarn")}
                </p>
                <p className={`text-sm font-bold ${member?.activeSkinId ? 'text-glow-white' : ''}`}>
                  {t("dashboard.weeklyPoints")}: {member.weeklyPoints}
                </p>
              </div>
            </div>

            <Tabs value={childActiveTab} onValueChange={setChildActiveTab} className="w-full">
              <TabsList className={`grid w-full ${familyData?.showLeaderboard !== false ? 'grid-cols-2' : 'grid-cols-1'}`}>
                <TabsTrigger value="active" data-testid="tab-active-tasks">{t("dashboard.activeTasks")}</TabsTrigger>
                {familyData?.showLeaderboard !== false && (
                  <TabsTrigger value="leaderboard" data-testid="tab-leaderboard">{t("nav.leaderboard")}</TabsTrigger>
                )}
              </TabsList>

              {/* Quick Action Buttons */}
              <div className="grid grid-cols-2 gap-3 mt-6">
                <Button
                  variant="card"
                  onClick={() => setRequestRewardDialogOpen(true)}
                  data-testid="button-request-reward"
                  className="w-full h-14 whitespace-normal leading-tight"
                >
                  <Lightbulb className="h-4 w-4 mr-2 flex-shrink-0" />
                  <span className="text-center">{t("dashboard.requestReward")}</span>
                </Button>
                <Link href="/rewards-board" className="w-full">
                  <Button variant="card" data-testid="button-rewards-board-child" className="w-full h-14 whitespace-normal leading-tight">
                    <Gift className="h-4 w-4 mr-2 flex-shrink-0" />
                    <span className="text-center">{t("dashboard.myRewards")}</span>
                  </Button>
                </Link>
                <Link href="/family-goals" className="w-full">
                  <Button variant="card" data-testid="button-family-goals-child" className="w-full h-14 whitespace-normal leading-tight">
                    <Target className="h-4 w-4 mr-2 flex-shrink-0" />
                    <span className="text-center">{t("dashboard.familyGoals")}</span>
                  </Button>
                </Link>
                {(hasFeature(familyData?.subscriptionTier as SubscriptionTier || "free", "familyChat") || !!(familyData?.trialEndsAt && new Date(familyData.trialEndsAt) > new Date())) && (
                  <Link href="/chat" className="w-full">
                    <Button variant="card" data-testid="button-chat-child" className="relative w-full h-14 whitespace-normal leading-tight">
                      <MessageCircle className="h-4 w-4 mr-2 flex-shrink-0" />
                      <span className="text-center">{t("nav.chat")}</span>
                      {unreadChatData && unreadChatData.count > 0 && (
                        <Badge variant="destructive" className="ml-2 h-5 min-w-5 px-1 flex-shrink-0" data-testid="badge-unread-count-child">
                          {unreadChatData.count}
                        </Badge>
                      )}
                    </Button>
                  </Link>
                )}
              </div>

              <TabsContent value="active" className="space-y-4 mt-6">
                {activeTasks.length === 0 ? (
                  <Card className="p-12 text-center">
                    <Star className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
                    <h3 className="text-xl font-bold font-accent mb-2">{t("dashboard.noTasksAvailable")}</h3>
                    <p className="text-muted-foreground">
                      {t("dashboard.askParents")}
                    </p>
                  </Card>
                ) : (
                  <div className="grid md:grid-cols-2 gap-4">
                    {activeTasks.map((task) => (
                      <TaskCard
                        key={task.id}
                        task={task}
                        onComplete={() => {
                          if (task.requiresProof) { setTaskToComplete(task); setCompletionDialogOpen(true); }
                          else { completeTaskMutation.mutate({ taskId: task.id }); }
                        }}
                        isCompleting={completeTaskMutation.isPending}
                        showAssignee={false}
                        currentMemberId={member?.id}
                      />
                    ))}
                  </div>
                )}
              </TabsContent>

              {familyData?.showLeaderboard !== false && (
                <TabsContent value="leaderboard" className="mt-6 space-y-4">
                  {hasFeature(familyData?.subscriptionTier as SubscriptionTier || "free", "weeklyLeaderboard") && (
                    <Tabs value={leaderboardPeriod} onValueChange={(value) => setLeaderboardPeriod(value as "week" | "month")}>
                      <TabsList className="grid w-full grid-cols-2">
                        <TabsTrigger value="week" data-testid="tab-leaderboard-period-week">{t("dashboard.weekly")}</TabsTrigger>
                        <TabsTrigger value="month" data-testid="tab-leaderboard-period-month">{t("dashboard.monthly")}</TabsTrigger>
                      </TabsList>
                    </Tabs>
                  )}
                  <Leaderboard 
                members={familyMembers} 
                period={leaderboardPeriod}
                weeklyPrize={familyData?.weeklyPrize}
                monthlyPrize={familyData?.monthlyPrize}
              />
                </TabsContent>
              )}
            </Tabs>

            {/* Available Rewards */}
            <div>
              <h2 className="text-2xl font-bold font-accent mb-4">{t("dashboard.rewardsYouCanEarn")}</h2>
              {activeRewards.length === 0 ? (
                <Card className="p-12 text-center">
                  <Gift className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
                  <h3 className="text-xl font-bold font-accent mb-2">{t("dashboard.noRewardsAvailable")}</h3>
                  <p className="text-muted-foreground mb-4">
                    {t("dashboard.requestRewardReview")}
                  </p>
                  <Button
                    variant="outline"
                    onClick={() => setRequestRewardDialogOpen(true)}
                    data-testid="button-request-reward-empty"
                  >
                    <Lightbulb className="h-4 w-4 mr-2" />
                    {t("dashboard.requestFirstReward")}
                  </Button>
                </Card>
              ) : (
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
                              {reward.pointThreshold} {t("dashboard.pointsLabel")}
                            </Badge>
                            {member.totalPoints >= reward.pointThreshold && (
                              <span className="text-xs font-semibold text-green-600">
                                {t("dashboard.youCanClaim")}
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
                              t("dashboard.redeeming")
                            ) : member.totalPoints >= reward.pointThreshold ? (
                              t("dashboard.redeemNow")
                            ) : (
                              t("dashboard.needMorePoints", { count: reward.pointThreshold - member.totalPoints })
                            )}
                          </Button>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Parent Bottom Navigation Bar */}
      {isParent && (isNativePlatform() ? (
        /* iOS native: collapsible right-anchored */
        <div
          className={`fixed bottom-0 right-0 z-50 overflow-x-hidden ${chatBarCollapsed ? 'pointer-events-none' : ''}`}
          style={{
            width: 'min(100vw, 44rem)',
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
            <Card className="p-1 bg-gradient-to-r from-primary/30 via-purple-500/30 to-pink-500/30 border-2 border-primary/30 rounded-3xl shadow-lg relative">
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setChatBarCollapsed(c => !c)}
                  className="flex-shrink-0 rounded-2xl pointer-events-auto"
                  data-testid="button-chat-bar-toggle"
                  aria-label={chatBarCollapsed ? t("chat.openChat", "Chat öffnen") : t("chat.closeChat", "Chat einklappen")}
                >
                  {chatBarCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
                </Button>
                <div className="flex-1 min-w-0 relative">
                  <Button variant="ghost" size="default" asChild data-testid="button-parent-nav-chat" data-tour="tour-family-chat" className="h-10 w-full px-3 sm:px-4 rounded-2xl">
                    <Link href="/chat">
                      <MessageCircle className="h-4 w-4 mr-1.5 text-blue-500 flex-shrink-0" />
                      <span className="font-medium text-sm truncate">{t("nav.chat")}</span>
                    </Link>
                  </Button>
                  {!chatBarCollapsed && unreadChatData && unreadChatData.count > 0 && (
                    <span
                      className="absolute -top-1 -right-1 z-50 h-5 w-5 flex items-center justify-center rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold"
                      data-testid="badge-parent-unread-chat"
                    >
                      {unreadChatData.count}
                    </span>
                  )}
                </div>
                <div className="w-9 flex-shrink-0" />
              </div>
              {chatBarCollapsed && unreadChatData && unreadChatData.count > 0 && (
                <span
                  className="absolute -top-1 left-1 z-50 h-5 w-5 flex items-center justify-center rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold"
                  data-testid="badge-parent-unread-chat-collapsed"
                >
                  {unreadChatData.count}
                </span>
              )}
            </Card>
          </div>
        </div>
      ) : (
        /* Web: centered bar, no collapse toggle */
        <div
          className="fixed bottom-0 left-0 right-0 z-50 flex justify-center pointer-events-none"
          style={{
            paddingBottom: 'calc(0.5rem + env(safe-area-inset-bottom))',
            paddingTop: '0.5rem',
            transform: 'translateZ(0)',
            backfaceVisibility: 'hidden',
            WebkitBackfaceVisibility: 'hidden' as React.CSSProperties['WebkitBackfaceVisibility'],
          }}
        >
          <div className="pointer-events-auto relative" style={{ width: 'min(calc(100vw - 1rem), 44rem)' }}>
            <Card className="p-1 bg-gradient-to-r from-primary/30 via-purple-500/30 to-pink-500/30 border-2 border-primary/30 rounded-3xl shadow-lg">
              <Button variant="ghost" size="default" asChild data-testid="button-parent-nav-chat" data-tour="tour-family-chat" className="h-10 w-full px-5 rounded-2xl">
                <Link href="/chat">
                  <MessageCircle className="h-4 w-4 mr-1.5 text-blue-500 flex-shrink-0" />
                  <span className="font-medium text-sm">{t("nav.chat")}</span>
                </Link>
              </Button>
            </Card>
            {unreadChatData && unreadChatData.count > 0 && (
              <span
                className="absolute -top-1 -right-1 z-50 h-5 w-5 flex items-center justify-center rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold"
                data-testid="badge-parent-unread-chat"
              >
                {unreadChatData.count}
              </span>
            )}
          </div>
        </div>
      ))}

      {/* Dialogs */}
      {isParent && member && (
        <>
          <TaskDialog
            open={taskDialogOpen}
            onOpenChange={(open) => {
              setTaskDialogOpen(open);
              if (!open) setSelectedTask(null);
            }}
            onSubmit={(data) => {
              if (selectedTask) {
                updateTaskMutation.mutate({ id: selectedTask.id, data });
              } else {
                createTaskMutation.mutate(data);
              }
            }}
            isSubmitting={createTaskMutation.isPending || updateTaskMutation.isPending}
            familyName={member.familyName}
            createdBy={member.id}
            editingTask={selectedTask}
            familyMembers={familyMembers}
            subscriptionTier={familyData?.subscriptionTier ?? "free"}
            trialEndsAt={familyData?.trialEndsAt}
            categoryNames={familyData?.categoryNames}
          />
          <RewardDialog
            open={rewardDialogOpen}
            onOpenChange={setRewardDialogOpen}
            onSubmit={(data) => {
              if (selectedReward) {
                updateRewardMutation.mutate({ rewardId: selectedReward.id, data });
              } else {
                createRewardMutation.mutate(data);
              }
            }}
            isSubmitting={createRewardMutation.isPending || updateRewardMutation.isPending}
            familyName={member.familyName}
            reward={selectedReward}
          />
        </>
      )}

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

      {/* Switch Member Dialog - Real parents only (always available even when acting as child) */}
      {member && isRealParent && (
        <SwitchMemberDialog
          open={switchMemberDialogOpen}
          onOpenChange={setSwitchMemberDialogOpen}
          members={familyMembers}
          currentMember={member}
          familyData={familyData}
          onSwitch={(params) => switchMemberMutation.mutate(params)}
          isSubmitting={switchMemberMutation.isPending}
        />
      )}

      {/* Member Pause Dialog - for managing downgrade overflow */}
      {member && isRealParent && (
        <MemberPauseDialog
          open={pauseMemberDialogOpen}
          onOpenChange={setPauseMemberDialogOpen}
          members={familyMembers as any}
          overLimitCount={familyData?.overLimitCount ?? 0}
          maxMembersForTier={familyData?.maxMembersForTier ?? 999}
          currentMemberId={member.id}
        />
      )}

      {/* Task Completion Dialog */}
      <TaskCompletionDialog
        open={completionDialogOpen}
        onOpenChange={setCompletionDialogOpen}
        task={taskToComplete}
        onComplete={(taskId, proofPhotoUrl) => completeTaskMutation.mutate({ taskId, proofPhotoUrl })}
        isSubmitting={completeTaskMutation.isPending}
      />

      {/* Reward Request Dialog - Children to create, Parents to edit */}
      {member && (
        <RewardRequestDialog
          open={requestRewardDialogOpen}
          onOpenChange={(open) => {
            setRequestRewardDialogOpen(open);
            if (!open) setRequestToEdit(null);
          }}
          onSubmit={(data) => {
            if (requestToEdit) {
              updateRewardRequestMutation.mutate({ requestId: requestToEdit.id, data });
            } else {
              createRewardRequestMutation.mutate(data);
            }
          }}
          isSubmitting={createRewardRequestMutation.isPending || updateRewardRequestMutation.isPending}
          familyName={member.familyName}
          request={requestToEdit}
        />
      )}

      {/* Subscription Processing Dialog */}
      <AlertDialog open={subscriptionProcessing} onOpenChange={() => {}}>
        <AlertDialogContent data-testid="dialog-subscription-processing">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary" />
              {t('dashboard.subscription_processing')}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t('dashboard.subscription_processing_desc')}
            </AlertDialogDescription>
          </AlertDialogHeader>
        </AlertDialogContent>
      </AlertDialog>

      {/* Celebration */}
      {celebration && (
        <SuccessCelebration
          points={celebration.points}
          message={celebration.message}
          onComplete={() => setCelebration(null)}
        />
      )}

      {/* Send Points Dialog */}
      {isParent && (
        <Dialog open={sendPointsOpen} onOpenChange={(open) => {
          setSendPointsOpen(open);
          if (!open) { setSelectedPointsRecipients([]); setPointsAmount(""); }
        }}>
          <DialogContent
            data-testid="dialog-send-points"
            className="max-w-sm"
            style={{
              position: "fixed",
              left: "50%",
              top: `${vvOffsetTop + vvHeight / 2}px`,
              transform: "translate(-50%, -50%)",
              maxHeight: `${vvHeight - 48}px`,
              overflowY: "auto",
              width: "min(calc(100vw - 2rem), 24rem)",
            }}
            onOpenAutoFocus={(e) => e.preventDefault()}
          >
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Zap className="h-5 w-5 text-amber-500" />
                {t("dashboard.sendPoints", "Punkte senden")}
              </DialogTitle>
              <DialogDescription>
                {t("dashboard.sendPointsDesc", "Wähle Familienmitglieder aus und sende ihnen Bonuspunkte.")}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-2">
              {/* Member Selection */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">
                  {t("dashboard.selectRecipients", "Empfänger")}
                </Label>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {familyMembers.filter((m) => m.id !== member?.id).map((fm) => {
                    const selected = selectedPointsRecipients.includes(fm.id);
                    return (
                      <button
                        key={fm.id}
                        type="button"
                        data-testid={`button-recipient-${fm.id}`}
                        onClick={() =>
                          setSelectedPointsRecipients((prev) =>
                            selected ? prev.filter((id) => id !== fm.id) : [...prev, fm.id]
                          )
                        }
                        className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg border text-left transition-colors ${selected ? "border-primary bg-primary/10" : "border-border bg-transparent hover-elevate"}`}
                      >
                        <Avatar className="h-8 w-8 flex-shrink-0" style={{ borderWidth: "2px", borderColor: fm.avatarColor || "#14b8a6" }}>
                          <AvatarImage src={getAvatarUrl(fm)} />
                          <AvatarFallback style={{ backgroundColor: fm.avatarColor || "#14b8a6" }} className="text-white text-xs">
                            {fm.displayName.slice(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{fm.displayName}</p>
                          <p className="text-xs text-muted-foreground">{fm.role === "child" ? t("common.child", "Kind") : t("common.parent", "Elternteil")} · {fm.totalPoints} {t("dashboard.pointsLabel")}</p>
                        </div>
                        {selected && <Check className="h-4 w-4 text-primary flex-shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Points Amount */}
              <div className="space-y-2">
                <Label htmlFor="points-amount" className="text-sm font-medium">
                  {t("dashboard.sendPointsAmount", "Anzahl Punkte")}
                </Label>
                <Input
                  id="points-amount"
                  type="number"
                  min="1"
                  max="1000"
                  placeholder="z. B. 50"
                  value={pointsAmount}
                  onChange={(e) => setPointsAmount(e.target.value)}
                  data-testid="input-points-amount"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  {t("dashboard.sendPointsMax", "Maximal 1.000 Punkte pro Übertragung")}
                </p>
              </div>
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setSendPointsOpen(false)}
                data-testid="button-cancel-send-points"
              >
                {t("common.cancel")}
              </Button>
              <Button
                onClick={() => {
                  const pts = parseInt(pointsAmount, 10);
                  if (selectedPointsRecipients.length === 0 || !pts || pts < 1 || pts > 1000) return;
                  awardPointsMutation.mutate({ memberIds: selectedPointsRecipients, points: pts });
                }}
                disabled={
                  selectedPointsRecipients.length === 0 ||
                  !pointsAmount ||
                  parseInt(pointsAmount, 10) < 1 ||
                  parseInt(pointsAmount, 10) > 1000 ||
                  awardPointsMutation.isPending
                }
                data-testid="button-confirm-send-points"
              >
                <Zap className="h-4 w-4 mr-2" />
                {awardPointsMutation.isPending
                  ? t("common.loading")
                  : t("dashboard.sendPointsConfirm", "Punkte senden")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Onboarding Tour */}
      {showTour && isParent && (
        <OnboardingTour onClose={() => setShowTour(false)} />
      )}


      {/* Debug Info Panel - activated by 5 taps on logo */}
      <AlertDialog open={showDebugInfo} onOpenChange={setShowDebugInfo}>
        <AlertDialogContent data-testid="dialog-debug-info">
          <AlertDialogHeader>
            <AlertDialogTitle>Viewport Debug Info</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-left font-mono text-xs">
                <p><strong>innerWidth:</strong> {typeof window !== 'undefined' ? window.innerWidth : 'N/A'}px</p>
                <p><strong>innerHeight:</strong> {typeof window !== 'undefined' ? window.innerHeight : 'N/A'}px</p>
                <p><strong>outerWidth:</strong> {typeof window !== 'undefined' ? window.outerWidth : 'N/A'}px</p>
                <p><strong>outerHeight:</strong> {typeof window !== 'undefined' ? window.outerHeight : 'N/A'}px</p>
                <p><strong>documentElement.clientWidth:</strong> {typeof document !== 'undefined' ? document.documentElement.clientWidth : 'N/A'}px</p>
                <p><strong>documentElement.clientHeight:</strong> {typeof document !== 'undefined' ? document.documentElement.clientHeight : 'N/A'}px</p>
                <p><strong>body.clientWidth:</strong> {typeof document !== 'undefined' ? document.body?.clientWidth : 'N/A'}px</p>
                <p><strong>body.scrollWidth:</strong> {typeof document !== 'undefined' ? document.body?.scrollWidth : 'N/A'}px</p>
                <p><strong>devicePixelRatio:</strong> {typeof window !== 'undefined' ? window.devicePixelRatio : 'N/A'}</p>
                <p><strong>User Agent:</strong> {typeof navigator !== 'undefined' ? navigator.userAgent.slice(0, 80) + '...' : 'N/A'}</p>
                <p className="text-muted-foreground mt-2">Wenn scrollWidth {'>'} clientWidth, gibt es horizontalen Overflow!</p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction data-testid="button-close-debug">Schließen</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
