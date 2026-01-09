import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/hooks/useAuth";
import { useWebSocket } from "@/hooks/useWebSocket";
import { useMidnightRefresh } from "@/hooks/useMidnightRefresh";
import { FamilySetup } from "@/components/family-setup";
import { PointCounter } from "@/components/point-counter";
import { TaskCard } from "@/components/task-card";
import { Leaderboard } from "@/components/leaderboard";
import { TaskDialog } from "@/components/task-dialog";
import { RewardDialog } from "@/components/reward-dialog";
import { RewardRequestDialog } from "@/components/reward-request-dialog";
import { EditMemberDialog } from "@/components/edit-member-dialog";
import { SwitchMemberDialog } from "@/components/switch-member-dialog";
import { TaskCompletionDialog } from "@/components/task-completion-dialog";
import { SuccessCelebration } from "@/components/success-celebration";
import { ProfileMenu } from "@/components/profile-menu";
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
import { Plus, Trophy, Gift, Star, Crown, BarChart3, Settings, Trash2, Pencil, Lightbulb, Check, X, MessageCircle, ClipboardCheck, Target, Sparkles, Info, ChevronRight, ChevronDown, Calendar } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { isToday, isThisWeek, parseISO, startOfDay, addDays } from "date-fns";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";
import type { FamilyMember, Task, Reward, RewardRequest } from "@shared/schema";
import { getAvatarUrl } from "@/lib/skins";
import { hasFeature } from "@shared/tier-config";
import type { SubscriptionTier } from "@shared/tier-config";
import { celebrateTaskCompletion } from "@/lib/confetti";
import logoUrl from "@assets/ChatGPT Image 7. Nov. 2025, 19_19_07_1762539654932.png";

// Custom hook for sticky sidebar on desktop
function useStickyPanel(isDesktop: boolean) {
  const containerRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [stickyStyle, setStickyStyle] = useState<React.CSSProperties>({});

  useEffect(() => {
    if (!isDesktop) {
      setStickyStyle({});
      return;
    }

    const handleScroll = () => {
      if (!containerRef.current || !panelRef.current) return;
      
      const containerRect = containerRef.current.getBoundingClientRect();
      const panelHeight = panelRef.current.offsetHeight;
      const topOffset = 16;
      
      if (containerRect.top < topOffset) {
        const maxScroll = containerRect.height - panelHeight;
        const currentScroll = topOffset - containerRect.top;
        
        if (currentScroll < maxScroll) {
          setStickyStyle({
            position: 'fixed',
            top: `${topOffset}px`,
            width: `${panelRef.current.offsetWidth}px`,
          });
        } else {
          setStickyStyle({
            position: 'absolute',
            bottom: '0',
            top: 'auto',
          });
        }
      } else {
        setStickyStyle({});
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('resize', handleScroll, { passive: true });
    handleScroll();

    return () => {
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', handleScroll);
    };
  }, [isDesktop]);

  return { containerRef, panelRef, stickyStyle };
}

export default function Dashboard() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { toast } = useToast();
  const [taskDialogOpen, setTaskDialogOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [rewardDialogOpen, setRewardDialogOpen] = useState(false);
  const [selectedReward, setSelectedReward] = useState<Reward | null>(null);
  const [requestRewardDialogOpen, setRequestRewardDialogOpen] = useState(false);
  const [requestToEdit, setRequestToEdit] = useState<any>(null);
  const [editMemberDialogOpen, setEditMemberDialogOpen] = useState(false);
  const [switchMemberDialogOpen, setSwitchMemberDialogOpen] = useState(false);
  const [memberToEdit, setMemberToEdit] = useState<FamilyMember | null>(null);
  const [completionDialogOpen, setCompletionDialogOpen] = useState(false);
  const [taskToComplete, setTaskToComplete] = useState<Task | null>(null);
  const [celebration, setCelebration] = useState<{
    points: number;
    message: string;
  } | null>(null);
  const [childActiveTab, setChildActiveTab] = useState<string>("active");
  const [leaderboardPeriod, setLeaderboardPeriod] = useState<"week" | "month">("month");
  const [subscriptionProcessing, setSubscriptionProcessing] = useState(false);
  const [taskFilter, setTaskFilter] = useState<"today" | "week" | "all">(() => {
    if (typeof window !== "undefined") {
      return (localStorage.getItem("herokids_task_filter") as "today" | "week" | "all") || "all";
    }
    return "all";
  });
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(new Set());
  const [debugTapCount, setDebugTapCount] = useState(0);
  const [showDebugInfo, setShowDebugInfo] = useState(false);
  const debugTapTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // Detect desktop for sticky sidebar (lg breakpoint = 1024px)
  const [isDesktop, setIsDesktop] = useState(false);
  useEffect(() => {
    const checkDesktop = () => setIsDesktop(window.innerWidth >= 1024);
    checkDesktop();
    window.addEventListener('resize', checkDesktop);
    return () => window.removeEventListener('resize', checkDesktop);
  }, []);
  
  const { containerRef, panelRef, stickyStyle } = useStickyPanel(isDesktop);

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
  });

  // Fetch real user's member record (to determine permissions)
  const { data: realMember } = useQuery<FamilyMember>({
    queryKey: ["/api/family-members/real"],
    enabled: !!user,
  });

  // WebSocket connection for real-time updates
  useWebSocket(member?.familyName || null);

  // Automatic midnight refresh for recurring tasks
  useMidnightRefresh();

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

  // Fetch star stats for star collection display
  const { data: starData } = useQuery<{
    starsFound: number;
    totalStars: number;
    earnedLegacySkinIds: string[];
  }>({
    queryKey: ["/api/stars"],
    enabled: !!member,
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
  });

  // Fetch family subscription tier
  const { data: familyData } = useQuery<{
    familyName: string;
    subscriptionTier: string;
    memberCount: number;
    showLeaderboard?: boolean;
    singleDeviceMode?: boolean;
    weeklyPrize?: string | null;
    monthlyPrize?: string | null;
    yearlyPrize?: string | null;
  }>({
    queryKey: ["/api/families/current"],
    enabled: !!member,
  });

  // Fetch unread chat message count
  const { data: unreadChatData } = useQuery<{ count: number }>({
    queryKey: ["/api/chat/unread-count"],
    enabled: !!member && hasFeature(familyData?.subscriptionTier as SubscriptionTier || "free", "familyChat"),
    refetchInterval: 10000, // Refetch every 10 seconds
  });

  // Fetch pending approvals count (for parents)
  const { data: pendingApprovalsData } = useQuery<{ count: number }>({
    queryKey: ["/api/tasks/pending-count"],
    enabled: !!member && member?.role === "parent",
    refetchInterval: 10000, // Refetch every 10 seconds
  });

  // Fetch pending reward redemptions count (for parents)
  const { data: pendingRewardsData } = useQuery<{ count: number }>({
    queryKey: ["/api/reward-redemptions/pending-count"],
    enabled: !!member && member?.role === "parent",
    refetchInterval: 10000, // Refetch every 10 seconds
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

  // Switch member (parents only)
  const switchMemberMutation = useMutation({
    mutationFn: async (params: { memberId: string | null; pinCode?: string }) => {
      const response = await apiRequest("POST", "/api/family-members/switch", params);
      return await response.json();
    },
    onSuccess: (data: any) => {
      // Clear entire query cache before navigation to prevent stale data issues
      queryClient.clear();
      
      // Navigate immediately - dialog will be gone when new page loads
      // Don't close dialog first to avoid animation flash during navigation
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
      toast({
        title: t("tasks.taskCreated"),
        description: t("toast.taskAdded"),
      });
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
      toast({
        title: t("tasks.taskUpdated"),
        description: t("toast.taskUpdatedDesc"),
      });
    },
  });

  // Complete task
  const completeTaskMutation = useMutation({
    mutationFn: async ({ taskId, proofPhotoUrl }: { taskId: string; proofPhotoUrl?: string }) => {
      const res = await apiRequest("POST", `/api/tasks/${taskId}/complete`, { proofPhotoUrl });
      return await res.json();
    },
    onSuccess: (data: any) => {
      // Aggressive cache invalidation - force refetch
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"], refetchType: 'active' });
      queryClient.invalidateQueries({ queryKey: ["/api/family-members"], refetchType: 'active' });
      queryClient.invalidateQueries({ queryKey: ["/api/family-members/current"], refetchType: 'active' });
      queryClient.invalidateQueries({ queryKey: ["/api/tasks/completions/pending"], refetchType: 'active' });
      setCompletionDialogOpen(false);
      setTaskToComplete(null);
      
      // Show celebration for auto-approved tasks
      if (data.autoApproved) {
        celebrateTaskCompletion();
        setCelebration({
          points: data.completion?.pointsEarned || 0,
          message: data.message || t("toast.greatJob"),
        });
      }
      
      // Show success message
      toast({
        title: data.autoApproved ? t("toast.taskCompletedCelebration") : t("toast.taskSubmitted"),
        description: data.message || t("toast.awaitingApproval"),
      });
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
      toast({
        title: t("toast.rewardCreated"),
        description: t("toast.rewardAvailable"),
      });
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
      toast({
        title: t("toast.rewardUpdated"),
        description: t("toast.rewardUpdatedDesc"),
      });
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
        headers: { "Content-Type": "application/json" },
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
      toast({
        title: t("toast.rewardDeleted"),
        description: t("toast.rewardDeletedDesc"),
      });
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
      toast({
        title: t("tasks.taskDeleted"),
        description: t("toast.taskDeletedDesc"),
      });
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
      toast({
        title: t("toast.requestSent"),
        description: t("toast.requestSentDesc"),
      });
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
      toast({
        title: t("toast.requestDeclined"),
        description: t("toast.requestDeclinedDesc"),
      });
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
      toast({
        title: t("toast.requestUpdated"),
        description: t("toast.requestUpdatedDesc"),
      });
    },
    onError: (error: any) => {
      toast({
        title: t("toast.failedUpdate"),
        description: error.message || t("toast.unableUpdate"),
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

  // Filter tasks by date range (based on recurrence type)
  const filterTasksByDate = (taskList: typeof activeTasks) => {
    return taskList.filter(task => {
      if (taskFilter === "all") return true;
      
      // For "today" filter, show only daily recurring tasks or one-time tasks
      if (taskFilter === "today") {
        return task.recurrence === "daily" || task.recurrence === "none";
      }
      
      // For "week" filter, show daily and weekly recurring tasks
      if (taskFilter === "week") {
        return task.recurrence === "daily" || task.recurrence === "weekly" || task.recurrence === "none";
      }
      
      return true;
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
    
    // Sort categories: household, school, selfCare, pets, other
    const categoryOrder = ["household", "school", "selfCare", "pets", "other"];
    const sortedGroups: Record<string, typeof activeTasks> = {};
    
    categoryOrder.forEach(cat => {
      if (groups[cat] && groups[cat].length > 0) {
        sortedGroups[cat] = groups[cat];
      }
    });
    
    return sortedGroups;
  };

  const filteredTasks = filterTasksByDate(activeTasks);
  const groupedTasks = groupTasksByCategory(filteredTasks);
  const hasMultipleCategories = Object.keys(groupedTasks).length > 1;

  // Toggle category collapse
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
    <div className="min-h-screen">
      {/* Header */}
      <header className="border-b sticky top-0 backdrop-blur-md z-40">
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
            <PointCounter
              points={member.totalEarned}
              size="compact"
              showAnimation
              data-testid="point-counter-total-earned"
            />
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

      <div className="container mx-auto max-w-7xl px-4 py-8 overflow-x-hidden">
        {isParent ? (
          /* Parent View */
          <div ref={containerRef} className="grid grid-cols-1 lg:grid-cols-3 gap-8 relative">
            {/* Main Content */}
            <div className="lg:col-span-2 space-y-6 min-w-0">
              {/* Logo and Stats Section */}
              <div className="text-center">
                <div className="mb-4 flex justify-center">
                  <img 
                    src={logoUrl} 
                    alt="HeroKids Logo" 
                    className="h-32 w-auto object-contain cursor-pointer"
                    data-testid="img-dashboard-logo"
                    onClick={handleDebugTap}
                  />
                </div>
                <div className="space-y-3 mb-4">
                  <p className={`text-sm font-bold ${member?.activeSkinId ? 'text-glow-white' : ''}`}>
                    {t("dashboard.availablePoints")}: {member.totalPoints}
                  </p>
                  <h1 className={`text-4xl font-black font-accent ${member?.activeSkinId ? 'text-glow-white' : ''}`} data-testid="text-page-title">
                    {t("dashboard.hi", { name: member.displayName })}
                  </h1>
                  <p className={`text-lg font-semibold ${member?.activeSkinId ? 'text-glow-white' : ''}`}>
                    {t("dashboard.manageFamily")}
                  </p>
                  <p className={`text-sm font-bold ${member?.activeSkinId ? 'text-glow-white' : ''}`}>
                    {t("dashboard.weeklyPoints")}: {member.weeklyPoints}
                  </p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="grid grid-cols-2 gap-3">
                {/* Row 1: Approvals, Rewards Board */}
                <div className="relative w-full">
                  <Link href="/approvals" className="w-full block">
                    <Button variant="card" data-testid="button-approvals" className="w-full h-14 justify-start px-4 gap-3">
                      <span className="w-6 flex-shrink-0 flex justify-center">
                        <ClipboardCheck className="h-5 w-5" />
                      </span>
                      <span className="text-left flex-1">{t("dashboard.approvals")}</span>
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
                    <Button variant="card" data-testid="button-rewards-board" className="w-full h-14 justify-start px-4 gap-3">
                      <span className="w-6 flex-shrink-0 flex justify-center">
                        <Gift className="h-5 w-5" />
                      </span>
                      <span className="text-left flex-1">{t("dashboard.rewardsBoard")}</span>
                    </Button>
                  </Link>
                  {pendingRewardsData && pendingRewardsData.count > 0 && (
                    <span className="absolute top-2 right-2 z-50 h-5 w-5 flex items-center justify-center rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold" data-testid="badge-pending-rewards">
                      {pendingRewardsData.count}
                    </span>
                  )}
                </div>
                {/* Row 2: Family Goals, Family Chat */}
                <Link href="/family-goals" className="w-full">
                  <Button variant="card" data-testid="button-family-goals" className="w-full h-14 justify-start px-4 gap-3">
                    <span className="w-6 flex-shrink-0 flex justify-center">
                      <Target className="h-5 w-5" />
                    </span>
                    <span className="text-left flex-1">{t("dashboard.familyGoals")}</span>
                  </Button>
                </Link>
                <div className="relative w-full">
                  <Link href="/chat" className="w-full block">
                    <Button variant="card" data-testid="button-chat" className="w-full h-14 justify-start px-4 gap-3">
                      <span className="w-6 flex-shrink-0 flex justify-center">
                        <MessageCircle className="h-5 w-5" />
                      </span>
                      <span className="text-left flex-1">{t("nav.chat")}</span>
                    </Button>
                  </Link>
                  {unreadChatData && unreadChatData.count > 0 && (
                    <span className="absolute top-2 right-2 z-50 h-5 w-5 flex items-center justify-center rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold" data-testid="badge-unread-count">
                      {unreadChatData.count}
                    </span>
                  )}
                </div>
                {/* Row 3: Add Task, Add Reward */}
                <Button
                  onClick={() => {
                    setSelectedTask(null);
                    setTaskDialogOpen(true);
                  }}
                  data-testid="button-add-task"
                  className="w-full h-14 justify-start px-4 gap-3"
                >
                  <span className="w-6 flex-shrink-0 flex justify-center">
                    <Plus className="h-5 w-5" />
                  </span>
                  <span className="text-left flex-1">{t("dashboard.addTask")}</span>
                </Button>
                <Button
                  onClick={() => {
                    setSelectedReward(null);
                    setRewardDialogOpen(true);
                  }}
                  data-testid="button-add-reward"
                  className="w-full h-14 justify-start px-4 gap-3"
                >
                  <span className="w-6 flex-shrink-0 flex justify-center">
                    <Plus className="h-5 w-5" />
                  </span>
                  <span className="text-left flex-1">{t("dashboard.addReward")}</span>
                </Button>
              </div>

              {/* Task Filter Tabs */}
              {activeTasks.length > 0 && (
                <div className="flex items-center gap-2 mb-4">
                  <div className="flex bg-muted rounded-lg p-1 gap-1">
                    <Button
                      variant={taskFilter === "today" ? "default" : "ghost"}
                      size="sm"
                      onClick={() => setTaskFilter("today")}
                      className="text-xs px-3"
                      data-testid="button-filter-today"
                    >
                      <Calendar className="h-3 w-3 mr-1" />
                      {t("dashboard.filterToday")}
                    </Button>
                    <Button
                      variant={taskFilter === "week" ? "default" : "ghost"}
                      size="sm"
                      onClick={() => setTaskFilter("week")}
                      className="text-xs px-3"
                      data-testid="button-filter-week"
                    >
                      {t("dashboard.filterThisWeek")}
                    </Button>
                    <Button
                      variant={taskFilter === "all" ? "default" : "ghost"}
                      size="sm"
                      onClick={() => setTaskFilter("all")}
                      className="text-xs px-3"
                      data-testid="button-filter-all"
                    >
                      {t("dashboard.filterAll")}
                    </Button>
                  </div>
                  {filteredTasks.length > 0 && (
                    <Badge variant="secondary" className="text-xs">
                      {filteredTasks.length}
                    </Badge>
                  )}
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
              ) : filteredTasks.length === 0 ? (
                <Card className="p-8 text-center">
                  <Calendar className="h-12 w-12 mx-auto mb-3 text-muted-foreground" />
                  <h3 className="text-lg font-bold font-accent mb-2">
                    {taskFilter === "today" ? t("dashboard.noTasksToday") : t("dashboard.noTasksThisWeek")}
                  </h3>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => setTaskFilter("all")}
                    data-testid="button-show-all-tasks"
                  >
                    {t("dashboard.filterAll")} ({activeTasks.length})
                  </Button>
                </Card>
              ) : hasMultipleCategories ? (
                <div className="space-y-3">
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
                            <span className="font-semibold">{getCategoryLabel(category)}</span>
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
                        <div className="grid md:grid-cols-2 gap-4">
                          {categoryTasks.map((task) => (
                            <div key={task.id} className="relative group min-h-[140px] min-w-0">
                              <TaskCard
                                task={task}
                                showAssignee
                                onClick={handleTaskClick}
                                onComplete={() => {
                                  setTaskToComplete(task);
                                  setCompletionDialogOpen(true);
                                }}
                                isCompleting={completeTaskMutation.isPending}
                                currentMemberId={member?.id}
                              />
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
                            </div>
                          ))}
                        </div>
                      </CollapsibleContent>
                    </Collapsible>
                  ))}
                </div>
              ) : (
                <div className="grid md:grid-cols-2 gap-4">
                  {filteredTasks.map((task) => (
                    <div key={task.id} className="relative group min-h-[140px] min-w-0">
                      <TaskCard
                        task={task}
                        showAssignee
                        onClick={handleTaskClick}
                        onComplete={() => {
                          setTaskToComplete(task);
                          setCompletionDialogOpen(true);
                        }}
                        isCompleting={completeTaskMutation.isPending}
                        currentMemberId={member?.id}
                      />
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
                    </div>
                  ))}
                </div>
              )}

              {/* Rewards Section */}
              {activeRewards.length > 0 && (
                <div>
                  <h2 className="text-2xl font-bold font-accent mb-4">{t("dashboard.activeRewards")}</h2>
                  <div className="grid md:grid-cols-2 gap-4">
                    {activeRewards.map((reward) => (
                      <Card key={reward.id} className="p-6 relative overflow-visible" data-testid={`card-reward-${reward.id}`}>
                        {isRealParent && (
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
                            <div className="flex items-center gap-2 mb-3">
                              <Badge
                                variant={
                                  member.totalPoints >= reward.pointThreshold
                                    ? "default"
                                    : "secondary"
                                }
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
                </div>
              )}

            </div>

            {/* Sidebar - sticky on desktop */}
            <div className="relative">
              <div ref={panelRef} style={stickyStyle} className="space-y-6">
              {/* Star Collection Progress */}
              {starData && starData.totalStars > 0 && (
                <Card className="p-4 bg-gradient-to-br from-yellow-500/10 to-orange-500/10 border border-yellow-500/30">
                  <Link href="/skins">
                    <div className="flex items-center justify-between cursor-pointer hover:opacity-80 transition-opacity">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-yellow-500/20">
                          <Star className="h-5 w-5 fill-yellow-400 text-yellow-400" />
                        </div>
                        <div>
                          <h3 className="font-semibold text-sm">{t("skins.starCollection")}</h3>
                          <p className="text-xs text-muted-foreground">
                            {starData.earnedLegacySkinIds.length}/8 Legacy Avatars
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="text-2xl font-bold text-yellow-500" data-testid="text-parent-stars">
                          {starData.starsFound}/{starData.totalStars}
                        </span>
                        <p className="text-xs text-muted-foreground">{t("common.stars")}</p>
                      </div>
                    </div>
                  </Link>
                </Card>
              )}

              {/* Special Achievement Rewards Section */}
              {specialRewards.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Trophy className="h-5 w-5 text-purple-500" />
                      <h2 className="text-lg font-bold font-accent">{t("dashboard.specialPrizes")}</h2>
                      <Sparkles className="h-4 w-4 text-purple-500" />
                    </div>
                    {specialRewards.length > 2 && (
                      <Button variant="ghost" size="sm" asChild data-testid="button-view-all-achievements">
                        <Link href="/my-achievements">
                          {t("dashboard.viewAll")}
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
          </div>
        ) : (
          /* Child View */
          <div className="max-w-4xl mx-auto space-y-6">
            <div className="text-center">
              <div className="mb-4 flex justify-center">
                <img 
                  src={logoUrl} 
                  alt="HeroKids Logo" 
                  className="h-40 w-auto object-contain cursor-pointer"
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
                {hasFeature(familyData?.subscriptionTier as SubscriptionTier || "free", "familyChat") && (
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
                          setTaskToComplete(task);
                          setCompletionDialogOpen(true);
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
