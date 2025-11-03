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
import { RewardRequestDialog } from "@/components/reward-request-dialog";
import { AddMemberDialog } from "@/components/add-member-dialog";
import { EditMemberDialog } from "@/components/edit-member-dialog";
import { SwitchMemberDialog } from "@/components/switch-member-dialog";
import { TaskCompletionDialog } from "@/components/task-completion-dialog";
import { SuccessCelebration } from "@/components/success-celebration";
import { ThemeToggle } from "@/components/theme-toggle";
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
import { Plus, LogOut, Trophy, Gift, Star, Crown, BarChart3, UserPlus, Settings, User2, Trash2, Pencil, Lightbulb, Check, X } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";
import type { FamilyMember, Task, Reward, RewardRequest } from "@shared/schema";

export default function Dashboard() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [taskDialogOpen, setTaskDialogOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [rewardDialogOpen, setRewardDialogOpen] = useState(false);
  const [selectedReward, setSelectedReward] = useState<Reward | null>(null);
  const [requestRewardDialogOpen, setRequestRewardDialogOpen] = useState(false);
  const [requestToEdit, setRequestToEdit] = useState<any>(null);
  const [addMemberDialogOpen, setAddMemberDialogOpen] = useState(false);
  const [editMemberDialogOpen, setEditMemberDialogOpen] = useState(false);
  const [switchMemberDialogOpen, setSwitchMemberDialogOpen] = useState(false);
  const [memberToEdit, setMemberToEdit] = useState<FamilyMember | null>(null);
  const [completionDialogOpen, setCompletionDialogOpen] = useState(false);
  const [taskToComplete, setTaskToComplete] = useState<Task | null>(null);
  const [newMemberJoinCode, setNewMemberJoinCode] = useState<string | null>(null);
  const [celebration, setCelebration] = useState<{
    points: number;
    message: string;
  } | null>(null);

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

  // Join family with join code
  const joinFamilyMutation = useMutation({
    mutationFn: async (data: any) => {
      return await apiRequest("POST", "/api/join-family", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/family-members/current"] });
      toast({
        title: "Welcome to the family!",
        description: "You've successfully joined your family.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to join family",
        description: error.message || "Invalid join code or the code has already been used.",
        variant: "destructive",
      });
    },
  });

  // Add family member
  const addMemberMutation = useMutation({
    mutationFn: async (data: any) => {
      return await apiRequest("POST", "/api/family-members", data);
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/family-members"] });
      queryClient.invalidateQueries({ queryKey: ["/api/families/current"] });
      setAddMemberDialogOpen(false);
      
      // Show join code if member was created with one
      if (data.joinCode) {
        setNewMemberJoinCode(data.joinCode);
      }
      
      toast({
        title: "Member added!",
        description: data.joinCode 
          ? "Share the join code with them to access their profile." 
          : "The new family member can now join and earn points.",
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
        title: "Profile updated!",
        description: "Your profile has been updated successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to update profile",
        description: error.message || "Unable to update profile.",
        variant: "destructive",
      });
    },
  });

  // Delete family member (parents only)
  const deleteMemberMutation = useMutation({
    mutationFn: async (memberId: string) => {
      return await apiRequest("DELETE", `/api/family-members/${memberId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/family-members"] });
      toast({
        title: "Member deleted",
        description: "Family member has been removed successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to delete member",
        description: error.message || "Unable to delete member.",
        variant: "destructive",
      });
    },
  });

  // Switch member (parents only)
  const switchMemberMutation = useMutation({
    mutationFn: async (memberId: string | null) => {
      return await apiRequest("POST", "/api/family-members/switch", { memberId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/family-members/current"] });
      setSwitchMemberDialogOpen(false);
      toast({
        title: "Switched member!",
        description: "You are now acting as a different family member.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to switch member",
        description: error.message || "Unable to switch member.",
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
        title: "Task created!",
        description: "The task has been added to the list.",
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
        title: "Task updated!",
        description: "The task has been updated successfully.",
      });
    },
  });

  // Complete task
  const completeTaskMutation = useMutation({
    mutationFn: async ({ taskId, proofPhotoUrl }: { taskId: string; proofPhotoUrl?: string }) => {
      return await apiRequest("POST", `/api/tasks/${taskId}/complete`, { proofPhotoUrl });
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
      queryClient.invalidateQueries({ queryKey: ["/api/family-members"] });
      queryClient.invalidateQueries({ queryKey: ["/api/family-members/current"] });
      setCompletionDialogOpen(false);
      setTaskToComplete(null);
      
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
      setSelectedReward(null);
      toast({
        title: "Reward created!",
        description: "The reward is now available to earn.",
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
        title: "Reward updated!",
        description: "The reward has been successfully updated.",
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
      queryClient.invalidateQueries({ queryKey: ["/api/reward-redemptions"] });
      console.log("Redemption response data:", data);
      console.log("Redemption object:", data.redemption);
      toast({
        title: "Reward redeemed!",
        description: data.message,
      });
      const pointsSpent = data.redemption?.pointsSpent || 0;
      const rewardTitle = data.redemption?.rewardTitle || 'Reward';
      console.log("Points spent:", pointsSpent, "Reward title:", rewardTitle);
      setCelebration({
        points: -pointsSpent,
        message: `${rewardTitle} - ${pointsSpent} points`,
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

  // Delete reward
  const deleteRewardMutation = useMutation({
    mutationFn: async (rewardId: string) => {
      return await apiRequest("DELETE", `/api/rewards/${rewardId}`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/rewards"] });
      toast({
        title: "Reward deleted",
        description: "The reward has been deleted successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to delete",
        description: error.message || "Could not delete reward",
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
        title: "Request sent!",
        description: "Your reward request has been sent to your parents for review.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to send request",
        description: error.message || "Unable to send reward request.",
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
        title: "Request approved!",
        description: "The reward has been added and is now available to earn.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to approve",
        description: error.message || "Unable to approve request.",
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
        title: "Request declined",
        description: "The reward request has been declined.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to decline",
        description: error.message || "Unable to decline request.",
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
        title: "Request updated!",
        description: "The reward request has been updated successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to update",
        description: error.message || "Unable to update request.",
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
        onJoin={(data) => joinFamilyMutation.mutate(data)}
        isSubmitting={setupMutation.isPending || joinFamilyMutation.isPending}
      />
    );
  }

  // Use acting member's role to show correct view (parent/child)
  const isParent = member?.role === "parent";
  // Use real member's role to show parent-only UI elements (like switch button)
  const isRealParent = realMember?.role === "parent";
  const activeTasks = tasks.filter((t) => t.status === "active");
  const activeRewards = rewards.filter((r) => r.isActive);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b sticky top-0 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 z-40">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Avatar className="h-10 w-10">
              <AvatarImage src={member.avatarUrl || undefined} />
              <AvatarFallback style={{ backgroundColor: member.color }} className="text-white">
                {member.displayName[0]}
              </AvatarFallback>
            </Avatar>
            <div>
              <div className="text-sm text-muted-foreground">{member.familyName}</div>
              <div className="font-semibold" data-testid="text-user-name">
                {member.displayName}
              </div>
            </div>
            {isRealParent && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setSwitchMemberDialogOpen(true)}
                data-testid="button-switch-member"
                aria-label="Switch member"
              >
                <User2 className="h-5 w-5" />
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => {
                setMemberToEdit(member);
                setEditMemberDialogOpen(true);
              }}
              data-testid="button-edit-profile"
              aria-label="Edit profile"
            >
              <Settings className="h-5 w-5" />
            </Button>
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
              {/* Stats Section */}
              <div className="text-center">
                <div className="mb-2">
                  <PointCounter points={member.totalEarned} size="hero" showAnimation />
                </div>
                <p className="text-sm font-semibold text-muted-foreground mb-1">
                  Total Earned
                </p>
                <p className="text-sm text-muted-foreground mb-4">
                  Available Points: {member.totalPoints}
                </p>
                <h1 className="text-3xl font-black font-accent mb-2" data-testid="text-page-title">
                  Hi, {member.displayName}!
                </h1>
                <p className="text-muted-foreground mb-2">
                  Manage your family's tasks and rewards
                </p>
                <p className="text-sm text-muted-foreground">
                  Weekly Points: {member.weeklyPoints}
                </p>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-center flex-wrap gap-2">
                <Link href="/analytics">
                  <Button variant="outline" data-testid="button-analytics">
                    <BarChart3 className="h-4 w-4 mr-2" />
                    Analytics
                  </Button>
                </Link>
                <Link href="/rewards-board">
                  <Button variant="outline" data-testid="button-rewards-board">
                    <Gift className="h-4 w-4 mr-2" />
                    Rewards Board
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
                  onClick={() => {
                    setSelectedReward(null);
                    setRewardDialogOpen(true);
                  }}
                  variant="outline"
                  data-testid="button-add-reward"
                >
                  <Gift className="h-4 w-4 mr-2" />
                  Add Reward
                </Button>
                <Button
                  onClick={() => {
                    setSelectedTask(null);
                    setTaskDialogOpen(true);
                  }}
                  data-testid="button-add-task"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Task
                </Button>
              </div>

              {activeTasks.length === 0 ? (
                <Card className="p-12 text-center">
                  <Star className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
                  <h3 className="text-xl font-bold font-accent mb-2">No tasks yet</h3>
                  <p className="text-muted-foreground mb-6">
                    Create your first task to get started!
                  </p>
                  <Button onClick={() => {
                    setSelectedTask(null);
                    setTaskDialogOpen(true);
                  }} data-testid="button-create-first-task">
                    <Plus className="h-4 w-4 mr-2" />
                    Create Task
                  </Button>
                </Card>
              ) : (
                <div className="grid md:grid-cols-2 gap-4">
                  {activeTasks.map((task) => (
                    <TaskCard
                      key={task.id}
                      task={task}
                      showAssignee
                      onClick={handleTaskClick}
                      onComplete={() => {
                        setTaskToComplete(task);
                        setCompletionDialogOpen(true);
                      }}
                      isCompleting={completeTaskMutation.isPending}
                    />
                  ))}
                </div>
              )}

              {/* Pending Reward Requests Section */}
              {isRealParent && rewardRequests.filter(r => r.status === "pending").length > 0 && (
                <div>
                  <h2 className="text-2xl font-bold font-accent mb-4">Pending Reward Requests</h2>
                  <div className="grid md:grid-cols-2 gap-4">
                    {rewardRequests
                      .filter(r => r.status === "pending")
                      .map((request) => {
                        const requester = familyMembers.find(m => m.id === request.requestedBy);
                        return (
                          <Card key={request.id} className="p-6" data-testid={`card-request-${request.id}`}>
                            <div className="flex items-start gap-3 mb-4">
                              <Avatar className="h-10 w-10">
                                <AvatarImage src={requester?.avatarUrl || undefined} />
                                <AvatarFallback style={{ backgroundColor: requester?.color }} className="text-white">
                                  {requester?.displayName[0] || '?'}
                                </AvatarFallback>
                              </Avatar>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                  <h3 className="font-bold">{request.title}</h3>
                                  <Badge variant="secondary">
                                    {request.pointThreshold} pts
                                  </Badge>
                                </div>
                                <p className="text-xs text-muted-foreground mb-1">
                                  Requested by {requester?.displayName || 'Unknown'}
                                </p>
                                {request.description && (
                                  <p className="text-sm text-muted-foreground">
                                    {request.description}
                                  </p>
                                )}
                              </div>
                            </div>
                            <div className="flex gap-2">
                              <Button
                                onClick={() => {
                                  setRequestToEdit(request);
                                  setRequestRewardDialogOpen(true);
                                }}
                                variant="outline"
                                size="sm"
                                data-testid={`button-edit-request-${request.id}`}
                              >
                                <Pencil className="h-4 w-4 mr-1" />
                                Edit
                              </Button>
                              <Button
                                onClick={() => approveRewardRequestMutation.mutate(request.id)}
                                disabled={approveRewardRequestMutation.isPending || declineRewardRequestMutation.isPending}
                                size="sm"
                                data-testid={`button-approve-request-${request.id}`}
                              >
                                <Check className="h-4 w-4 mr-1" />
                                Approve
                              </Button>
                              <Button
                                onClick={() => declineRewardRequestMutation.mutate(request.id)}
                                disabled={approveRewardRequestMutation.isPending || declineRewardRequestMutation.isPending}
                                variant="outline"
                                size="sm"
                                data-testid={`button-decline-request-${request.id}`}
                              >
                                <X className="h-4 w-4 mr-1" />
                                Decline
                              </Button>
                            </div>
                          </Card>
                        );
                      })}
                  </div>
                </div>
              )}

              {/* Rewards Section */}
              {activeRewards.length > 0 && (
                <div>
                  <h2 className="text-2xl font-bold font-accent mb-4">Active Rewards</h2>
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

            {/* Sidebar */}
            <div className="space-y-6">
              {/* Family Members Management */}
              {isRealParent && (
                <Card className="p-6">
                  <h2 className="text-2xl font-bold font-accent mb-4">Family Members</h2>
                  <div className="space-y-3">
                    {familyMembers.map((familyMember) => (
                      <div
                        key={familyMember.id}
                        className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 relative"
                        data-testid={`member-card-${familyMember.id}`}
                      >
                        <Avatar className="h-10 w-10" style={{ borderWidth: "3px", borderColor: familyMember.color }}>
                          <AvatarImage src={familyMember.avatarUrl || undefined} />
                          <AvatarFallback style={{ backgroundColor: familyMember.color }} className="text-white">
                            {familyMember.displayName[0]}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <div className="font-semibold" data-testid={`text-member-name-${familyMember.id}`}>
                            {familyMember.displayName}
                          </div>
                          <div className="text-xs text-muted-foreground capitalize">
                            {familyMember.role}
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => deleteMemberMutation.mutate(familyMember.id)}
                          disabled={deleteMemberMutation.isPending}
                          data-testid={`button-delete-member-${familyMember.id}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </Card>
              )}
              
              <Leaderboard members={familyMembers} period="week" />
            </div>
          </div>
        ) : (
          /* Child View */
          <div className="max-w-4xl mx-auto space-y-6">
            <div className="text-center">
              <div className="mb-2">
                <PointCounter points={member.totalEarned} size="hero" showAnimation />
              </div>
              <p className="text-sm font-semibold text-muted-foreground mb-1">
                Total Earned
              </p>
              <p className="text-sm text-muted-foreground mb-4">
                Available Points: {member.totalPoints}
              </p>
              <h1 className="text-3xl font-black font-accent mb-2" data-testid="text-child-welcome">
                Hi, {member.displayName}!
              </h1>
              <p className="text-muted-foreground mb-2">
                Complete tasks to earn points and climb the leaderboard
              </p>
              <p className="text-sm text-muted-foreground">
                Weekly Points: {member.weeklyPoints}
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
                        onComplete={() => {
                          setTaskToComplete(task);
                          setCompletionDialogOpen(true);
                        }}
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
            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-2xl font-bold font-accent">Rewards You Can Earn</h2>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setRequestRewardDialogOpen(true)}
                    data-testid="button-request-reward"
                  >
                    <Lightbulb className="h-4 w-4 mr-2" />
                    Request Reward
                  </Button>
                  <Link href="/rewards-board">
                    <Button variant="outline" size="sm" data-testid="button-rewards-board-child">
                      <Gift className="h-4 w-4 mr-2" />
                      My Rewards
                    </Button>
                  </Link>
                </div>
              </div>
              {activeRewards.length === 0 ? (
                <Card className="p-12 text-center">
                  <Gift className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
                  <h3 className="text-xl font-bold font-accent mb-2">No rewards available</h3>
                  <p className="text-muted-foreground mb-4">
                    Request a reward and your parents will review it!
                  </p>
                  <Button
                    variant="outline"
                    onClick={() => setRequestRewardDialogOpen(true)}
                    data-testid="button-request-reward-empty"
                  >
                    <Lightbulb className="h-4 w-4 mr-2" />
                    Request Your First Reward
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
          <AddMemberDialog
            open={addMemberDialogOpen}
            onOpenChange={setAddMemberDialogOpen}
            onSubmit={(data) => addMemberMutation.mutate(data)}
            isSubmitting={addMemberMutation.isPending}
            familyName={member.familyName}
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
          onSwitch={(memberId) => switchMemberMutation.mutate(memberId)}
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

      {/* Join Code Dialog */}
      <AlertDialog open={!!newMemberJoinCode} onOpenChange={() => setNewMemberJoinCode(null)}>
        <AlertDialogContent data-testid="dialog-join-code">
          <AlertDialogHeader>
            <AlertDialogTitle>Family Member Added!</AlertDialogTitle>
            <AlertDialogDescription>
              Share this join code with the new member so they can access their profile and start earning points!
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="bg-muted p-6 rounded-lg text-center my-4">
            <div className="text-sm text-muted-foreground mb-2">Join Code</div>
            <div className="text-4xl font-black font-accent tracking-wider" data-testid="text-join-code">
              {newMemberJoinCode}
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogAction onClick={() => setNewMemberJoinCode(null)} data-testid="button-close-join-code">
              Got it!
            </AlertDialogAction>
          </AlertDialogFooter>
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
    </div>
  );
}
