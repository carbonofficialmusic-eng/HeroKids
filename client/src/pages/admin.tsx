import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Capacitor } from "@capacitor/core";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectSeparator, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { 
  Shield, 
  Users, 
  Home, 
  ListTodo, 
  Gift, 
  Star, 
  Lock, 
  LogOut, 
  Eye, 
  Crown,
  ChevronRight,
  TrendingUp,
  RefreshCw,
  MessageSquare,
  Trash2,
  Palette,
  Send,
  UserMinus,
  BarChart3,
  PieChart,
  Plus,
  Database,
  Download,
  Upload,
  Loader2,
  Mail,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Link as LinkIcon,
  Unlink,
  KeyRound
} from "lucide-react";
import { getAvatarUrl } from "@/lib/skins";
import { queryClient } from "@/lib/queryClient";
import { scrollFieldIntoView } from "@/lib/keyboard-scroll";
import { TOTAL_HIDDEN_STARS } from "@shared/skin-config";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart as RechartsPieChart,
  Pie,
  Cell,
  LineChart,
  Line,
} from "recharts";

interface AdminStats {
  totalFamilies: number;
  totalMembers: number;
  totalTasks: number;
  totalRewards: number;
  totalPointsEarned: number;
  tierCounts: Record<string, number>;
}

interface FamilyWithStats {
  familyName: string;
  subscriptionTier: string;
  isAdminGranted?: boolean;
  memberCount: number;
  parentCount: number;
  childCount: number;
  taskCount: number;
  rewardCount: number;
  totalPointsEarned: number;
  createdAt: string;
  language?: string;
  timezone?: string;
}

interface RcPromoStatus {
  entitlement: string;
  expiresDate: string | null;
  isLifetime: boolean;
  productIdentifier: string;
}

interface FamilyMember {
  id: string;
  userId?: string | null;
  displayName: string;
  role: string;
  avatarUrl: string;
  activeSkinId: string | null;
  useCustomAvatar: boolean;
  totalEarned: number;
  totalPoints: number;
  weeklyPoints: number;
  monthlyPoints: number;
  account?: {
    email?: string | null;
    firstName?: string | null;
    lastName?: string | null;
    isEmailVerified?: boolean;
    isDisabled?: boolean;
    lastLoginAt?: string | null;
    createdAt?: string | null;
  } | null;
}

interface FamilyDetails {
  family: FamilyWithStats;
  members: FamilyMember[];
  taskCount: number;
  rewardCount: number;
  accountLinkRepairHistory: AccountLinkRepairEntry[];
  rcPromoStatus: RcPromoStatus | null;
}

interface AccountLinkRepairEntry {
  id: string;
  memberId?: string | null;
  memberDisplayName: string;
  action: "link" | "unlink" | "move_detach" | "move_link" | string;
  oldAccountEmail?: string | null;
  newAccountEmail?: string | null;
  repairedBy?: string | null;
  repairedAt: string;
}

interface ExistingLinkedMember {
  id: string;
  displayName: string;
  familyName: string;
  role: string;
}

class AccountLinkConflictError extends Error {
  existingMember: ExistingLinkedMember;

  constructor(message: string, existingMember: ExistingLinkedMember) {
    super(message);
    this.name = "AccountLinkConflictError";
    this.existingMember = existingMember;
  }
}

interface SkinStat {
  id: string;
  name: string;
  description: string | null;
  pointsRequired: number;
  bonusPoints: number;
  usageCount: number;
}

interface SkinStats {
  totalSkins: number;
  stats: SkinStat[];
}

interface AnalyticsData {
  weeklyRegistrations: { week: string; count: number }[];
  monthlyRegistrations: { month: string; count: number }[];
  activeFamilies: { name: string; completions: number }[];
  avgPointsPerChild: number;
  pointsByRole: { role: string; avgPoints: number; count: number }[];
  tierDistribution: { tier: string; count: number }[];
  totalChildren: number;
  totalParents: number;
}

interface AdminUser {
  id: string;
  email: string | null;
  isEmailVerified: boolean;
  isDisabled: boolean;
  createdAt: string | null;
  lastLoginAt: string | null;
  linkedMemberId: string | null;
  linkedMemberName: string | null;
  linkedMemberRole: string | null;
  linkedFamilyName: string | null;
}

interface EmailHealthResult {
  status: "healthy" | "warning" | "unhealthy";
  configured: boolean;
  provider: string | null;
  credentialSource: string | null;
  fromAddress: string;
  baseUrl: string | null;
  linksUseExpectedDomain: boolean;
  productionLinksUseExpectedDomain: boolean;
  expectedProductionBaseUrl: string;
  verificationUrlSample: string | null;
  passwordResetUrlSample: string | null;
  testSend: {
    attempted: boolean;
    succeeded: boolean;
    recipient?: string;
    provider?: string;
    issue?: string;
  };
  issues: string[];
}

interface EmailReadinessCheck {
  id: string;
  checkType: "readiness_check" | "test_send";
  status: "healthy" | "warning" | "unhealthy";
  configured: boolean;
  provider: string | null;
  credentialSource: string | null;
  fromAddress: string;
  baseUrl: string | null;
  expectedProductionBaseUrl: string;
  linksUseExpectedDomain: boolean;
  productionLinksUseExpectedDomain: boolean;
  testAttempted: boolean;
  testSucceeded: boolean;
  testRecipient: string | null;
  issueSummary: string | null;
  issues: string[];
  checkedAt: string;
}

const TIER_LABELS: Record<string, string> = {
  free: "Free",
  family: "Family",
  family_plus: "Family+",
  family_hero: "FamilyPro",
};

const TIER_COLORS: Record<string, string> = {
  free: "bg-gray-500",
  family: "bg-blue-500",
  family_plus: "bg-purple-500",
  family_hero: "bg-amber-500",
};

function formatEmailCheckTime(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function getEmailCheckLabel(check: EmailReadinessCheck) {
  return check.checkType === "test_send" ? "Test send" : "Readiness check";
}

function getAccountLinkRepairActionLabel(action: string) {
  if (action === "link") return "Linked";
  if (action === "unlink") return "Unlinked";
  if (action === "move_detach") return "Moved away";
  if (action === "move_link") return "Moved here";
  return action;
}

export default function AdminPageImpl() {
  const [token, setToken] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [magicLinkSent, setMagicLinkSent] = useState(false);
  const [selectedFamily, setSelectedFamily] = useState<string | null>(null);
  const [messageToSend, setMessageToSend] = useState("");
  const [messageSubject, setMessageSubject] = useState("");
  const [memberToRemove, setMemberToRemove] = useState<{ id: string; name: string; familyName: string } | null>(null);
  const [memberToAddPoints, setMemberToAddPoints] = useState<{ id: string; name: string } | null>(null);
  const [memberToLinkAccount, setMemberToLinkAccount] = useState<{ id: string; name: string; familyName: string } | null>(null);
  const [accountEmailToLink, setAccountEmailToLink] = useState("");
  const [accountMoveConfirmation, setAccountMoveConfirmation] = useState<{
    familyName: string;
    memberId: string;
    memberName: string;
    email: string;
    existingMember: ExistingLinkedMember;
  } | null>(null);
  const [adminActor, setAdminActor] = useState(() => (typeof window !== "undefined" ? localStorage.getItem("admin_actor") : null) || "");
  const [pointsToAdd, setPointsToAdd] = useState("");
  const [selectedFamilies, setSelectedFamilies] = useState<Set<string>>(new Set());
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [emailTestRecipient, setEmailTestRecipient] = useState("");
  const [repairHistorySearch, setRepairHistorySearch] = useState("");
  const [userSearch, setUserSearch] = useState("");
  const [userToDelete, setUserToDelete] = useState<{ id: string; email: string | null; name: string | null } | null>(null);
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [changePwCurrent, setChangePwCurrent] = useState("");
  const [changePwNew, setChangePwNew] = useState("");
  const [changePwConfirm, setChangePwConfirm] = useState("");
  const [promoDialogFamily, setPromoDialogFamily] = useState<string | null>(null);
  const [promoDuration, setPromoDuration] = useState("monthly");
  const [promoEntitlement, setPromoEntitlement] = useState("family_pro");
  const [emergencyTierConfirm, setEmergencyTierConfirm] = useState<{ familyName: string; tier: string } | null>(null);
  const lastEmailAlertKeyRef = useRef<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    const stored = localStorage.getItem("admin_token");
    if (stored) {
      setToken(stored);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem("admin_actor", adminActor);
  }, [adminActor]);

  useEffect(() => {
    setRepairHistorySearch("");
  }, [selectedFamily]);

  const loginMutation = useMutation({
    mutationFn: async (password: string) => {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (!res.ok) throw new Error("Invalid password");
      return res.json();
    },
    onSuccess: (data) => {
      setToken(data.token);
      localStorage.setItem("admin_token", data.token);
      toast({ title: "Logged in successfully" });
    },
    onError: () => {
      toast({ title: "Invalid password", variant: "destructive" });
    },
  });

  // Handle magic token from URL on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const magicToken = params.get("magic_token");
    if (magicToken) {
      // Remove token from URL immediately
      const url = new URL(window.location.href);
      url.searchParams.delete("magic_token");
      window.history.replaceState({}, "", url.toString());
      // Exchange for admin session
      fetch("/api/admin/magic-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: magicToken }),
      }).then(async (res) => {
        if (res.ok) {
          const data = await res.json();
          setToken(data.token);
          localStorage.setItem("admin_token", data.token);
          toast({ title: "Eingeloggt via Magic Link" });
        } else {
          toast({ title: "Magic Link abgelaufen oder ungültig", variant: "destructive" });
        }
      }).catch(() => {
        toast({ title: "Login fehlgeschlagen", variant: "destructive" });
      });
    }
  }, []);

  const requestMagicLinkMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/admin/request-magic-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || "Fehler");
      }
      return res.json();
    },
    onSuccess: () => {
      setMagicLinkSent(true);
    },
    onError: (err: Error) => {
      toast({ title: err.message || "Magic Link konnte nicht gesendet werden", variant: "destructive" });
    },
  });

  const deleteUserMutation = useMutation({
    mutationFn: async (userId: string) => {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to delete user");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      setUserToDelete(null);
      toast({ title: "Account deleted", description: "The login account has been removed." });
    },
    onError: () => {
      toast({ title: "Failed to delete account", variant: "destructive" });
    },
  });

  const changePasswordMutation = useMutation({
    mutationFn: async ({ newPassword }: { newPassword: string }) => {
      const res = await fetch("/api/admin/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ newPassword }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || "Failed to change password");
      }
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Password changed", description: "Your admin password has been updated." });
      setShowChangePassword(false);
      setChangePwCurrent("");
      setChangePwNew("");
      setChangePwConfirm("");
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to change password", variant: "destructive" });
    },
  });

  const logout = () => {
    setToken(null);
    localStorage.removeItem("admin_token");
  };

  const { data: stats, isLoading: statsLoading, refetch: refetchStats } = useQuery<AdminStats>({
    queryKey: ["/api/admin/stats"],
    queryFn: async () => {
      const res = await fetch("/api/admin/stats", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to fetch stats");
      return res.json();
    },
    enabled: !!token,
    staleTime: 5 * 60 * 1000,
  });

  const { data: families, isLoading: familiesLoading, refetch: refetchFamilies } = useQuery<FamilyWithStats[]>({
    queryKey: ["/api/admin/families"],
    queryFn: async () => {
      const res = await fetch("/api/admin/families", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to fetch families");
      return res.json();
    },
    enabled: !!token,
    staleTime: 5 * 60 * 1000,
  });

  const { data: familyDetails, isLoading: detailsLoading, refetch: refetchDetails } = useQuery<FamilyDetails>({
    queryKey: ["/api/admin/families", selectedFamily],
    queryFn: async () => {
      const res = await fetch(`/api/admin/families/${encodeURIComponent(selectedFamily!)}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to fetch family details");
      return res.json();
    },
    enabled: !!token && !!selectedFamily,
    staleTime: 5 * 60 * 1000,
  });

  const { data: skinStats, isLoading: skinsLoading, refetch: refetchSkins } = useQuery<SkinStats>({
    queryKey: ["/api/admin/skins/stats"],
    queryFn: async () => {
      const res = await fetch("/api/admin/skins/stats", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to fetch skin stats");
      return res.json();
    },
    enabled: !!token,
    staleTime: 5 * 60 * 1000,
  });

  const { data: analytics, isLoading: analyticsLoading, refetch: refetchAnalytics } = useQuery<AnalyticsData>({
    queryKey: ["/api/admin/analytics"],
    queryFn: async () => {
      const res = await fetch("/api/admin/analytics", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to fetch analytics");
      return res.json();
    },
    enabled: !!token,
    staleTime: 5 * 60 * 1000,
  });

  const { data: adminUsers, isLoading: usersLoading, refetch: refetchUsers } = useQuery<AdminUser[]>({
    queryKey: ["/api/admin/users"],
    queryFn: async () => {
      const res = await fetch("/api/admin/users", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to fetch users");
      return res.json();
    },
    enabled: !!token,
    staleTime: 2 * 60 * 1000,
  });

  const { data: featureFlags, refetch: refetchFeatureFlags } = useQuery<{ review_prompt_enabled: boolean }>({
    queryKey: ["/api/admin/feature-flags"],
    queryFn: async () => {
      const res = await fetch("/api/admin/feature-flags", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to fetch feature flags");
      return res.json();
    },
    enabled: !!token,
    staleTime: 60 * 1000,
  });

  const featureFlagMutation = useMutation({
    mutationFn: async (flags: { review_prompt_enabled: boolean }) => {
      const res = await fetch("/api/admin/feature-flags", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(flags),
      });
      if (!res.ok) throw new Error("Failed to update feature flags");
      return res.json();
    },
    onSuccess: () => {
      refetchFeatureFlags();
      toast({ title: "Feature flags updated" });
    },
    onError: () => {
      toast({ title: "Failed to update feature flags", variant: "destructive" });
    },
  });

  const { data: emailHealth, isLoading: emailHealthLoading, refetch: refetchEmailHealth } = useQuery<EmailHealthResult>({
    queryKey: ["/api/admin/email-health"],
    queryFn: async () => {
      const res = await fetch("/api/admin/email-health", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to fetch email health");
      return res.json();
    },
    enabled: !!token,
    refetchInterval: 5 * 60 * 1000,
    refetchIntervalInBackground: true,
    staleTime: 30 * 1000,
  });

  const { data: emailHistory, isLoading: emailHistoryLoading, refetch: refetchEmailHistory } = useQuery<EmailReadinessCheck[]>({
    queryKey: ["/api/admin/email-health/history"],
    queryFn: async () => {
      const res = await fetch("/api/admin/email-health/history", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to fetch email health history");
      return res.json();
    },
    enabled: !!token,
    staleTime: 5 * 60 * 1000,
  });

  useEffect(() => {
    if (token && emailHealth) {
      refetchEmailHistory();
    }
  }, [token, emailHealth, refetchEmailHistory]);

  const CHART_COLORS = ["#8884d8", "#82ca9d", "#ffc658", "#ff7c43", "#a855f7"];

  const updateTierMutation = useMutation({
    mutationFn: async ({ familyName, tier, force }: { familyName: string; tier: string; force?: boolean }) => {
      const res = await fetch(`/api/admin/families/${encodeURIComponent(familyName)}/tier`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ tier, force }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw Object.assign(new Error("Failed to update tier"), { code: body.message, status: res.status });
      }
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Subscription tier updated" });
      refetchFamilies();
    },
    onError: (err: any) => {
      if (err.code === "RC_ACTIVE") {
        toast({
          title: "Aktives Apple-Abo vorhanden",
          description: "Diese Familie hat ein aktives RevenueCat-Abo. Kündige es zuerst im RC-Dashboard oder warte bis die Laufzeit endet — sonst stellt RC den Tier sofort wieder her.",
          variant: "destructive",
        });
      } else {
        toast({ title: "Failed to update tier", variant: "destructive" });
      }
    },
  });

  const grantPromoMutation = useMutation({
    mutationFn: async ({ familyName, entitlement, duration }: { familyName: string; entitlement: string; duration: string }) => {
      const res = await fetch(`/api/admin/families/${encodeURIComponent(familyName)}/promo-entitlement`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ entitlement, duration }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw Object.assign(new Error(body.message || "Failed to grant promo"), { code: body.message });
      }
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "✓ Promotional Zugang gewährt", description: "RC Promotional Entitlement wurde erfolgreich gesetzt." });
      setPromoDialogFamily(null);
      refetchFamilies();
      refetchDetails();
    },
    onError: (err: any) => {
      toast({ title: "Fehler beim Gewähren des Promo-Zugangs", description: err.message, variant: "destructive" });
    },
  });

  const sendMessageMutation = useMutation({
    mutationFn: async ({ familyName, message, subject }: { familyName: string; message: string; subject: string }) => {
      const res = await fetch(`/api/admin/families/${encodeURIComponent(familyName)}/message`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ message, subject }),
      });
      if (!res.ok) throw new Error("Failed to send message");
      return res.json();
    },
    onSuccess: (data) => {
      const emailInfo = data.emailsSent > 0
        ? ` — ${data.emailsSent} email${data.emailsSent > 1 ? "s" : ""} sent`
        : " — no verified parent emails found";
      toast({ title: `Message sent${emailInfo}` });
      setMessageToSend("");
      setMessageSubject("");
    },
    onError: () => {
      toast({ title: "Failed to send message", variant: "destructive" });
    },
  });

  const removeMemberMutation = useMutation({
    mutationFn: async ({ familyName, memberId }: { familyName: string; memberId: string }) => {
      const res = await fetch(`/api/admin/families/${encodeURIComponent(familyName)}/members/${memberId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || "Failed to remove member");
      }
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Member removed from family" });
      setMemberToRemove(null);
      refetchDetails();
      refetchFamilies();
      refetchStats();
    },
    onError: (error: Error) => {
      toast({ title: error.message, variant: "destructive" });
    },
  });

  const addPointsMutation = useMutation({
    mutationFn: async ({ memberId, points }: { memberId: string; points: number }) => {
      const res = await fetch(`/api/admin/members/${memberId}/points`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ points }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || "Failed to add points");
      }
      return res.json();
    },
    onSuccess: (data) => {
      toast({ title: `Punkte hinzugefügt! Neuer Stand: ${data.newTotalPoints}` });
      setMemberToAddPoints(null);
      setPointsToAdd("");
      refetchDetails();
    },
    onError: (error: Error) => {
      toast({ title: error.message, variant: "destructive" });
    },
  });

  const updateMemberAccountMutation = useMutation({
    mutationFn: async ({
      familyName,
      memberId,
      action,
      email,
      detachExisting,
      adminActor,
      memberName,
    }: {
      familyName: string;
      memberId: string;
      action: "link" | "unlink";
      email?: string;
      detachExisting?: boolean;
      adminActor?: string;
      memberName?: string;
    }) => {
      const res = await fetch(`/api/admin/families/${encodeURIComponent(familyName)}/members/${memberId}/account`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ action, email, detachExisting, adminActor }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 409 && data.existingMember && action === "link" && !detachExisting) {
          throw new AccountLinkConflictError(data.message || "Account is already linked to another member", data.existingMember);
        }
        throw new Error(data.message || "Failed to update account link");
      }
      return data;
    },
    onSuccess: (data) => {
      toast({ title: data.message || "Account link updated" });
      setMemberToLinkAccount(null);
      setAccountEmailToLink("");
      setAccountMoveConfirmation(null);
      refetchDetails();
    },
    onError: (error: Error, variables) => {
      if (error instanceof AccountLinkConflictError) {
        setAccountMoveConfirmation({
          familyName: variables.familyName,
          memberId: variables.memberId,
          memberName: variables.memberName || memberToLinkAccount?.name || "this member",
          email: variables.email || accountEmailToLink.trim(),
          existingMember: error.existingMember,
        });
        return;
      }
      toast({ title: error.message, variant: "destructive" });
    },
  });

  const deleteSkinMutation = useMutation({
    mutationFn: async (skinId: string) => {
      const res = await fetch(`/api/admin/skins/${skinId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to delete skin");
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Skin deleted" });
      refetchSkins();
    },
    onError: () => {
      toast({ title: "Failed to delete skin", variant: "destructive" });
    },
  });

  const fixStarsMutation = useMutation({
    mutationFn: async (memberId: string) => {
      const res = await fetch(`/api/admin/fix-stars/${memberId}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to fix stars");
      return res.json();
    },
    onSuccess: (data) => {
      toast({ title: data.message });
    },
    onError: () => {
      toast({ title: "Failed to fix stars", variant: "destructive" });
    },
  });

  const sendEmailHealthTestMutation = useMutation({
    mutationFn: async (recipient: string) => {
      const res = await fetch("/api/admin/email-health/test", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ recipient }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to send test email");
      return data as EmailHealthResult;
    },
    onSuccess: (data) => {
      queryClient.setQueryData(["/api/admin/email-health"], data);
      queryClient.invalidateQueries({ queryKey: ["/api/admin/email-health/history"] });
      refetchEmailHistory();
      if (data.testSend.succeeded) {
        toast({ title: "Test email sent", description: `Delivered to ${data.testSend.recipient}` });
        setEmailTestRecipient("");
      } else {
        toast({
          title: "Test email failed",
          description: data.testSend.issue || data.issues[0] || "The email provider rejected the test send.",
          variant: "destructive",
        });
      }
    },
    onError: (error: Error) => {
      toast({ title: "Test email failed", description: error.message, variant: "destructive" });
    },
  });

  const emailStatusLabel = emailHealth?.status === "healthy" ? "Ready" : emailHealth?.status === "warning" ? "Needs test" : "Not ready";
  const EmailStatusIcon = emailHealth?.status === "healthy" ? CheckCircle2 : emailHealth?.status === "warning" ? AlertTriangle : XCircle;
  const emailHealthAlertIssue =
    emailHealth?.issues[0] ||
    (emailHealth?.status === "warning" ? "Run a test email to confirm delivery before launch." : "Check the transactional email provider and launch domain settings.");
  const sanitizedAdminActor = adminActor.replace(/[\u0000-\u001F\u007F]/g, " ").replace(/\s+/g, " ").trim();
  const hasRepairAuditName = sanitizedAdminActor.length > 0 && !["admin", "administrator"].includes(sanitizedAdminActor.toLowerCase());
  const accountLinkRepairHistory = familyDetails?.accountLinkRepairHistory || [];
  const repairHistorySearchTerm = repairHistorySearch.trim().toLowerCase();
  const filteredAccountLinkRepairHistory = repairHistorySearchTerm
    ? accountLinkRepairHistory.filter((entry) => {
        const searchableValues = [
          entry.memberDisplayName,
          getAccountLinkRepairActionLabel(entry.action),
          entry.action,
          entry.oldAccountEmail,
          entry.newAccountEmail,
          entry.repairedBy,
          formatEmailCheckTime(entry.repairedAt),
        ];
        return searchableValues.some((value) => (value || "").toLowerCase().includes(repairHistorySearchTerm));
      })
    : accountLinkRepairHistory;

  useEffect(() => {
    if (!emailHealth || emailHealth.status === "healthy") {
      lastEmailAlertKeyRef.current = null;
      return;
    }

    const alertKey = `${emailHealth.status}:${emailHealthAlertIssue}`;
    if (lastEmailAlertKeyRef.current === alertKey) {
      return;
    }

    lastEmailAlertKeyRef.current = alertKey;
    toast({
      title: "Email readiness needs attention",
      description: emailHealthAlertIssue,
      variant: emailHealth.status === "unhealthy" ? "destructive" : undefined,
    });
  }, [emailHealth, emailHealthAlertIssue, toast]);

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
              <Shield className="h-8 w-8 text-primary" />
            </div>
            <CardTitle className="text-2xl">Admin Dashboard</CardTitle>
            <CardDescription>
              {showForgotPassword ? "Magic Link anfordern" : "Enter your admin password to continue"}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {!showForgotPassword ? (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  loginMutation.mutate(password);
                }}
                className="space-y-4"
              >
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    type="text"
                    placeholder="Admin Password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onPaste={(e) => {
                      e.stopPropagation();
                      const text = e.clipboardData.getData('text');
                      setPassword(text);
                    }}
                    className="pl-10"
                    autoComplete="off"
                    autoCorrect="off"
                    autoCapitalize="off"
                    spellCheck={false}
                    data-testid="input-admin-password"
                    style={{ WebkitTextSecurity: 'disc' } as any}
                  />
                </div>
                <Button
                  type="submit"
                  className="w-full"
                  disabled={loginMutation.isPending}
                  data-testid="button-admin-login"
                >
                  {loginMutation.isPending ? "Logging in..." : "Login"}
                </Button>
                <div className="text-center">
                  <button
                    type="button"
                    className="text-sm text-muted-foreground underline underline-offset-4"
                    onClick={() => setShowForgotPassword(true)}
                    data-testid="button-admin-forgot-password"
                  >
                    Passwort vergessen? Magic Link anfordern
                  </button>
                </div>
              </form>
            ) : magicLinkSent ? (
              <div className="space-y-4 text-center">
                <div className="mx-auto h-12 w-12 rounded-full bg-green-100 flex items-center justify-center">
                  <CheckCircle2 className="h-6 w-6 text-green-600" />
                </div>
                <p className="text-sm text-muted-foreground">
                  Magic Link wurde an die konfigurierte Admin-E-Mail gesendet. Bitte prüfe dein Postfach — der Link ist 15 Minuten gültig.
                </p>
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => { setShowForgotPassword(false); setMagicLinkSent(false); }}
                >
                  Zurück zum Login
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground text-center">
                  Ein Magic Login Link wird an die hinterlegte Admin-E-Mail gesendet.
                </p>
                <Button
                  className="w-full"
                  onClick={() => requestMagicLinkMutation.mutate()}
                  disabled={requestMagicLinkMutation.isPending}
                  data-testid="button-admin-send-magic-link"
                >
                  {requestMagicLinkMutation.isPending ? (
                    <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Senden...</>
                  ) : (
                    <><Mail className="h-4 w-4 mr-2" />Magic Link senden</>
                  )}
                </Button>
                <div className="text-center">
                  <button
                    type="button"
                    className="text-sm text-muted-foreground underline underline-offset-4"
                    onClick={() => setShowForgotPassword(false)}
                  >
                    Zurück zum Passwort-Login
                  </button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Shield className="h-6 w-6 text-primary" />
            <h1 className="text-xl font-bold">Little Champs Admin</h1>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="space-y-1">
              <Input
                value={adminActor}
                onChange={(event) => setAdminActor(event.target.value)}
                placeholder="Repair audit name"
                className="w-48"
                maxLength={120}
                data-testid="input-admin-actor"
                aria-label="Repair audit name"
              />
              <p className="max-w-64 text-xs text-muted-foreground" data-testid="text-admin-actor-help">
                Enter your name before account repairs. It will be saved with repair history.
              </p>
            </div>
            <Button
              variant="ghost"
              onClick={() => {
                refetchStats();
                refetchFamilies();
                refetchSkins();
                refetchAnalytics();
                refetchEmailHealth();
                refetchEmailHistory();
              }}
              data-testid="button-refresh-data"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
            <Button variant="outline" onClick={() => setShowChangePassword(true)} data-testid="button-change-admin-password">
              <KeyRound className="h-4 w-4 mr-2" />
              Change Password
            </Button>
            <Button variant="outline" onClick={logout} data-testid="button-admin-logout">
              <LogOut className="h-4 w-4 mr-2" />
              Logout
            </Button>
          </div>
        </div>
      </header>

      <Dialog open={showChangePassword} onOpenChange={(open) => {
        setShowChangePassword(open);
        if (!open) { setChangePwCurrent(""); setChangePwNew(""); setChangePwConfirm(""); }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change Admin Password</DialogTitle>
            <DialogDescription>Wähle ein neues Admin-Passwort (min. 8 Zeichen).</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1">
              <label className="text-sm font-medium">New Password</label>
              <Input
                type="password"
                value={changePwNew}
                onChange={(e) => setChangePwNew(e.target.value)}
                autoComplete="new-password"
                data-testid="input-new-password"
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Confirm New Password</label>
              <Input
                type="password"
                value={changePwConfirm}
                onChange={(e) => setChangePwConfirm(e.target.value)}
                autoComplete="new-password"
                data-testid="input-confirm-password"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowChangePassword(false)}>Cancel</Button>
            <Button
              onClick={() => {
                if (changePwNew !== changePwConfirm) {
                  toast({ title: "Passwords don't match", description: "New password and confirmation must be identical.", variant: "destructive" });
                  return;
                }
                changePasswordMutation.mutate({ newPassword: changePwNew });
              }}
              disabled={changePasswordMutation.isPending || !changePwNew || !changePwConfirm}
              data-testid="button-confirm-change-password"
            >
              {changePasswordMutation.isPending ? "Saving..." : "Save Password"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <main className="container mx-auto px-4 py-6">
        {emailHealth && emailHealth.status !== "healthy" && (
          <Alert
            variant={emailHealth.status === "unhealthy" ? "destructive" : "default"}
            className="mb-6"
            data-testid="alert-email-health-monitoring"
          >
            <EmailStatusIcon className="h-4 w-4" />
            <AlertTitle>Transactional email needs attention</AlertTitle>
            <AlertDescription>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="space-y-1">
                  <p data-testid="text-email-health-alert-status">Status: {emailStatusLabel}</p>
                  <p data-testid="text-email-health-alert-issue">{emailHealthAlertIssue}</p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => refetchEmailHealth()}
                  data-testid="button-refresh-email-health-alert"
                >
                  Refresh email status
                </Button>
              </div>
            </AlertDescription>
          </Alert>
        )}

        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList className="grid w-full grid-cols-4 md:grid-cols-7 h-auto max-w-4xl">
            <TabsTrigger value="overview" data-testid="tab-overview">
              <TrendingUp className="h-4 w-4 mr-2" />
              Overview
            </TabsTrigger>
            <TabsTrigger value="analytics" data-testid="tab-analytics">
              <BarChart3 className="h-4 w-4 mr-2" />
              Analytics
            </TabsTrigger>
            <TabsTrigger value="families" data-testid="tab-families">
              <Home className="h-4 w-4 mr-2" />
              Families
            </TabsTrigger>
            <TabsTrigger value="users" data-testid="tab-users">
              <Users className="h-4 w-4 mr-2" />
              Users
            </TabsTrigger>
            <TabsTrigger value="skins" data-testid="tab-skins">
              <Palette className="h-4 w-4 mr-2" />
              Skins
            </TabsTrigger>
            <TabsTrigger value="email" data-testid="tab-email">
              <Mail className="h-4 w-4 mr-2" />
              Email
            </TabsTrigger>
            <TabsTrigger value="migration" data-testid="tab-migration">
              <Database className="h-4 w-4 mr-2" />
              Migration
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            {statsLoading ? (
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                {[...Array(6)].map((_, i) => (
                  <Card key={i} className="animate-pulse">
                    <CardContent className="p-4">
                      <div className="h-4 bg-muted rounded w-1/2 mb-2" />
                      <div className="h-8 bg-muted rounded" />
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : stats ? (
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
                      <Home className="h-4 w-4" />
                      Families
                    </div>
                    <p className="text-2xl font-bold" data-testid="text-total-families">{stats.totalFamilies}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
                      <Users className="h-4 w-4" />
                      Members
                    </div>
                    <p className="text-2xl font-bold" data-testid="text-total-members">{stats.totalMembers}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
                      <ListTodo className="h-4 w-4" />
                      Tasks
                    </div>
                    <p className="text-2xl font-bold" data-testid="text-total-tasks">{stats.totalTasks}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
                      <Gift className="h-4 w-4" />
                      Rewards
                    </div>
                    <p className="text-2xl font-bold" data-testid="text-total-rewards">{stats.totalRewards}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
                      <Star className="h-4 w-4" />
                      Points
                    </div>
                    <p className="text-2xl font-bold" data-testid="text-total-points">{stats.totalPointsEarned.toLocaleString()}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
                      <Crown className="h-4 w-4" />
                      Paid
                    </div>
                    <p className="text-2xl font-bold" data-testid="text-paid-families">
                      {(stats.tierCounts.family || 0) + (stats.tierCounts.family_plus || 0) + (stats.tierCounts.family_hero || 0)}
                    </p>
                  </CardContent>
                </Card>
              </div>
            ) : null}

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5" />
                  Subscription Distribution
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-4">
                  {stats && Object.entries(stats.tierCounts).map(([tier, count]) => (
                    <div key={tier} className="flex items-center gap-2">
                      <Badge className={TIER_COLORS[tier]}>{TIER_LABELS[tier]}</Badge>
                      <span className="font-semibold">{count}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between gap-3">
                  <span className="flex items-center gap-2">
                    <Mail className="h-5 w-5" />
                    Email Launch Readiness
                  </span>
                  {emailHealth && (
                    <Badge
                      variant={emailHealth.status === "healthy" ? "default" : emailHealth.status === "warning" ? "secondary" : "destructive"}
                      data-testid="badge-email-health-status"
                    >
                      {emailStatusLabel}
                    </Badge>
                  )}
                </CardTitle>
                <CardDescription>Transactional account emails and launch links</CardDescription>
              </CardHeader>
              <CardContent>
                {emailHealthLoading ? (
                  <div className="h-20 bg-muted rounded animate-pulse" />
                ) : emailHealth ? (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <p className="text-sm text-muted-foreground">Provider</p>
                      <p className="font-semibold" data-testid="text-email-provider">{emailHealth.provider || "Not configured"}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Sender</p>
                      <p className="font-semibold break-all" data-testid="text-email-sender">{emailHealth.fromAddress}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Link domain</p>
                      <p className="font-semibold" data-testid="text-email-link-domain">
                        {emailHealth.linksUseExpectedDomain ? "Matches launch domain" : "Needs attention"}
                      </p>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">Email status is unavailable.</p>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="h-5 w-5" />
                  Feature Flags
                </CardTitle>
                <CardDescription>Enable or disable features without a code deployment</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between py-1">
                  <div>
                    <p className="font-medium text-sm">In-App-Review-Prompt</p>
                    <p className="text-xs text-muted-foreground">
                      Fordert iOS-Nutzer nach 30 Tagen Paid-Abo auf, die App zu bewerten
                    </p>
                  </div>
                  <Switch
                    checked={featureFlags?.review_prompt_enabled ?? false}
                    disabled={featureFlagMutation.isPending}
                    onCheckedChange={(checked) =>
                      featureFlagMutation.mutate({ review_prompt_enabled: checked })
                    }
                    data-testid="switch-review-prompt"
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="email" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex flex-wrap items-center justify-between gap-3">
                  <span className="flex items-center gap-2">
                    <Mail className="h-5 w-5" />
                    Transactional Email Status
                  </span>
                  {emailHealth && (
                    <Badge
                      variant={emailHealth.status === "healthy" ? "default" : emailHealth.status === "warning" ? "secondary" : "destructive"}
                      data-testid="badge-email-status-detail"
                    >
                      <EmailStatusIcon className="h-3 w-3 mr-1" />
                      {emailStatusLabel}
                    </Badge>
                  )}
                </CardTitle>
                <CardDescription>Confirm provider setup, launch link domains, and test real delivery.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {emailHealthLoading ? (
                  <div className="space-y-3">
                    <div className="h-6 bg-muted rounded w-1/3 animate-pulse" />
                    <div className="h-24 bg-muted rounded animate-pulse" />
                  </div>
                ) : emailHealth ? (
                  <>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                      <div className="p-4 rounded-lg bg-muted/50">
                        <p className="text-sm text-muted-foreground">Provider</p>
                        <p className="font-semibold capitalize" data-testid="text-email-detail-provider">{emailHealth.provider || "Not configured"}</p>
                        <p className="text-xs text-muted-foreground" data-testid="text-email-credential-source">
                          {emailHealth.credentialSource === "replit_connection" ? "Connected provider" : emailHealth.credentialSource === "environment_secret" ? "Environment secret" : "No credentials"}
                        </p>
                      </div>
                      <div className="p-4 rounded-lg bg-muted/50">
                        <p className="text-sm text-muted-foreground">Sender address</p>
                        <p className="font-semibold break-all" data-testid="text-email-detail-sender">{emailHealth.fromAddress}</p>
                      </div>
                      <div className="p-4 rounded-lg bg-muted/50">
                        <p className="text-sm text-muted-foreground">Configured</p>
                        <p className="font-semibold" data-testid="text-email-configured">{emailHealth.configured ? "Yes" : "No"}</p>
                      </div>
                      <div className="p-4 rounded-lg bg-muted/50">
                        <p className="text-sm text-muted-foreground">Last test send</p>
                        <p className="font-semibold" data-testid="text-email-last-test">
                          {emailHealth.testSend.attempted ? (emailHealth.testSend.succeeded ? "Succeeded" : "Failed") : "Not run"}
                        </p>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <h3 className="font-semibold">Launch link domain</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="p-4 rounded-lg bg-muted/50">
                          <p className="text-sm text-muted-foreground">Expected production URL</p>
                          <p className="font-semibold break-all" data-testid="text-email-expected-domain">{emailHealth.expectedProductionBaseUrl}</p>
                        </div>
                        <div className="p-4 rounded-lg bg-muted/50">
                          <p className="text-sm text-muted-foreground">Current email base URL</p>
                          <p className="font-semibold break-all" data-testid="text-email-current-domain">{emailHealth.baseUrl || "Unavailable"}</p>
                        </div>
                      </div>
                      <Badge
                        variant={emailHealth.linksUseExpectedDomain ? "default" : "destructive"}
                        data-testid="badge-email-domain-status"
                      >
                        {emailHealth.linksUseExpectedDomain ? "Links use the expected launch domain" : "Links do not match the expected launch domain"}
                      </Badge>
                    </div>

                    {emailHealth.issues.length > 0 && (
                      <div className="space-y-2 p-4 rounded-lg bg-destructive/10 text-destructive" data-testid="status-email-issues">
                        <h3 className="font-semibold">Issues to resolve</h3>
                        <ul className="list-disc list-inside space-y-1 text-sm">
                          {emailHealth.issues.map((issue, index) => (
                            <li key={`${issue}-${index}`} data-testid={`text-email-issue-${index}`}>{issue}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    <div className="space-y-3">
                      <h3 className="font-semibold">Send test email</h3>
                      <div className="flex flex-wrap items-center gap-2">
                        <Input
                          type="email"
                          placeholder="recipient@example.com"
                          value={emailTestRecipient}
                          onChange={(e) => setEmailTestRecipient(e.target.value)}
                          className="max-w-sm"
                          data-testid="input-email-test-recipient"
                        />
                        <Button
                          onClick={() => sendEmailHealthTestMutation.mutate(emailTestRecipient.trim())}
                          disabled={!emailTestRecipient.trim() || sendEmailHealthTestMutation.isPending}
                          data-testid="button-send-email-health-test"
                        >
                          {sendEmailHealthTestMutation.isPending ? (
                            <>
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                              Sending...
                            </>
                          ) : (
                            <>
                              <Send className="h-4 w-4 mr-2" />
                              Send test
                            </>
                          )}
                        </Button>
                      </div>
                      {emailHealth.testSend.attempted && (
                        <p className="text-sm text-muted-foreground" data-testid="text-email-test-result">
                          Test to {emailHealth.testSend.recipient}: {emailHealth.testSend.succeeded ? "succeeded" : emailHealth.testSend.issue || "failed"}
                        </p>
                      )}
                    </div>
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground">Email status is unavailable.</p>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="flex flex-wrap items-center justify-between gap-3">
                  <span className="flex items-center gap-2">
                    <Mail className="h-5 w-5" />
                    Recent Email Checks
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => refetchEmailHistory()}
                    data-testid="button-refresh-email-history"
                  >
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Refresh history
                  </Button>
                </CardTitle>
                <CardDescription>Saved readiness checks and real test-send results without provider secrets.</CardDescription>
              </CardHeader>
              <CardContent>
                {emailHistoryLoading ? (
                  <div className="space-y-3">
                    {[...Array(3)].map((_, index) => (
                      <div key={index} className="h-20 rounded-md bg-muted animate-pulse" />
                    ))}
                  </div>
                ) : emailHistory && emailHistory.length > 0 ? (
                  <div className="space-y-3" data-testid="list-email-check-history">
                    {emailHistory.map((check) => {
                      const CheckIcon = check.status === "healthy" ? CheckCircle2 : check.status === "warning" ? AlertTriangle : XCircle;
                      const resultText = check.testAttempted
                        ? check.testSucceeded
                          ? "Test send succeeded"
                          : "Test send failed"
                        : check.status === "healthy"
                          ? "Ready"
                          : check.status === "warning"
                            ? "Needs test"
                            : "Not ready";

                      return (
                        <div
                          key={check.id}
                          className="rounded-md bg-muted/50 p-4"
                          data-testid={`card-email-check-${check.id}`}
                        >
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div className="space-y-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <p className="font-semibold" data-testid={`text-email-check-type-${check.id}`}>{getEmailCheckLabel(check)}</p>
                                <Badge
                                  variant={check.status === "healthy" ? "default" : check.status === "warning" ? "secondary" : "destructive"}
                                  data-testid={`badge-email-check-status-${check.id}`}
                                >
                                  <CheckIcon className="h-3 w-3 mr-1" />
                                  {resultText}
                                </Badge>
                              </div>
                              <p className="text-sm text-muted-foreground" data-testid={`text-email-check-time-${check.id}`}>
                                {formatEmailCheckTime(check.checkedAt)}
                              </p>
                            </div>
                            <div className="text-sm text-muted-foreground text-left md:text-right">
                              <p data-testid={`text-email-check-provider-${check.id}`}>{check.provider || "No provider"}</p>
                              {check.testRecipient && (
                                <p className="break-all" data-testid={`text-email-check-recipient-${check.id}`}>To {check.testRecipient}</p>
                              )}
                            </div>
                          </div>
                          <div className="mt-3 grid grid-cols-1 gap-2 text-sm md:grid-cols-3">
                            <p data-testid={`text-email-check-configured-${check.id}`}>Configured: {check.configured ? "Yes" : "No"}</p>
                            <p data-testid={`text-email-check-domain-${check.id}`}>Launch domain: {check.linksUseExpectedDomain ? "Matched" : "Needs attention"}</p>
                            <p data-testid={`text-email-check-production-domain-${check.id}`}>Production links: {check.productionLinksUseExpectedDomain ? "Ready" : "Needs attention"}</p>
                          </div>
                          {check.issueSummary && (
                            <p className="mt-3 text-sm text-destructive" data-testid={`text-email-check-issue-${check.id}`}>
                              {check.issueSummary}
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground" data-testid="text-email-history-empty">
                    No saved readiness checks yet. Refresh the email status or send a test email to create the first record.
                  </p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="analytics" className="space-y-6">
            {analyticsLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {[...Array(4)].map((_, i) => (
                  <Card key={i} className="animate-pulse">
                    <CardHeader>
                      <div className="h-4 bg-muted rounded w-1/2" />
                    </CardHeader>
                    <CardContent>
                      <div className="h-64 bg-muted rounded" />
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : analytics ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Users className="h-5 w-5" />
                      Neue Registrierungen pro Woche
                    </CardTitle>
                    <CardDescription>Letzte 12 Wochen</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={250}>
                      <LineChart data={analytics.weeklyRegistrations}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="week" fontSize={12} />
                        <YAxis fontSize={12} />
                        <Tooltip />
                        <Line 
                          type="monotone" 
                          dataKey="count" 
                          stroke="#8884d8" 
                          strokeWidth={2}
                          name="Neue Mitglieder"
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <TrendingUp className="h-5 w-5" />
                      Neue Registrierungen pro Monat
                    </CardTitle>
                    <CardDescription>Letzte 6 Monate</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={250}>
                      <BarChart data={analytics.monthlyRegistrations}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="month" fontSize={12} />
                        <YAxis fontSize={12} />
                        <Tooltip />
                        <Bar dataKey="count" fill="#82ca9d" name="Neue Mitglieder" />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <ListTodo className="h-5 w-5" />
                      Aktivste Familien
                    </CardTitle>
                    <CardDescription>Top 10 nach erledigten Aufgaben</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={250}>
                      <BarChart data={analytics.activeFamilies} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis type="number" fontSize={12} />
                        <YAxis dataKey="name" type="category" width={100} fontSize={11} />
                        <Tooltip />
                        <Bar dataKey="completions" fill="#ffc658" name="Erledigte Aufgaben" />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Star className="h-5 w-5" />
                      Durchschnittliche Punkte
                    </CardTitle>
                    <CardDescription>Nach Rolle (Kinder vs. Eltern)</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-col gap-4">
                      <div className="text-center p-4 bg-muted/50 rounded-lg">
                        <p className="text-3xl font-bold text-primary">{analytics.avgPointsPerChild}</p>
                        <p className="text-sm text-muted-foreground">Ø Punkte pro Kind</p>
                      </div>
                      <ResponsiveContainer width="100%" height={150}>
                        <BarChart data={analytics.pointsByRole}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="role" fontSize={12} />
                          <YAxis fontSize={12} />
                          <Tooltip formatter={(value, name) => [value, name === "avgPoints" ? "Ø Punkte" : name]} />
                          <Bar dataKey="avgPoints" fill="#a855f7" name="Ø Punkte" />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>

                <Card className="md:col-span-2">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Crown className="h-5 w-5" />
                      Abo-Verteilung
                    </CardTitle>
                    <CardDescription>Aktuelle Verteilung der Abonnement-Tiers</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-col md:flex-row gap-6 items-center">
                      <ResponsiveContainer width="100%" height={250}>
                        <RechartsPieChart>
                          <Pie
                            data={analytics.tierDistribution}
                            cx="50%"
                            cy="50%"
                            labelLine={false}
                            label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                            outerRadius={80}
                            fill="#8884d8"
                            dataKey="count"
                            nameKey="tier"
                          >
                            {analytics.tierDistribution.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip />
                          <Legend />
                        </RechartsPieChart>
                      </ResponsiveContainer>
                      <div className="flex flex-col gap-2 min-w-[200px]">
                        {analytics.tierDistribution.map((tier, index) => (
                          <div key={tier.tier} className="flex items-center justify-between p-2 border rounded">
                            <div className="flex items-center gap-2">
                              <div 
                                className="w-3 h-3 rounded-full" 
                                style={{ backgroundColor: CHART_COLORS[index % CHART_COLORS.length] }} 
                              />
                              <span>{tier.tier}</span>
                            </div>
                            <Badge variant="secondary">{tier.count}</Badge>
                          </div>
                        ))}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            ) : null}
          </TabsContent>

          <TabsContent value="families" className="space-y-6">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Home className="h-5 w-5" />
                      Families
                    </CardTitle>
                    <CardDescription>
                      All registered families and their statistics
                    </CardDescription>
                  </div>
                  {selectedFamilies.size > 0 && (
                    <Button 
                      variant="destructive" 
                      onClick={() => setShowDeleteConfirm(true)}
                      data-testid="button-delete-selected"
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete {selectedFamilies.size} Familie{selectedFamilies.size > 1 ? 'n' : ''}
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {familiesLoading ? (
                  <div className="space-y-2">
                    {[...Array(5)].map((_, i) => (
                      <div key={i} className="h-16 bg-muted rounded animate-pulse" />
                    ))}
                  </div>
                ) : families && families.length > 0 ? (
                  <div className="space-y-2">
                    {/* Select All */}
                    <div className="flex items-center gap-3 p-2 border-b mb-2">
                      <Checkbox
                        id="select-all"
                        checked={selectedFamilies.size === families.length && families.length > 0}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setSelectedFamilies(new Set(families.map(f => f.familyName)));
                          } else {
                            setSelectedFamilies(new Set());
                          }
                        }}
                        data-testid="checkbox-select-all"
                      />
                      <label htmlFor="select-all" className="text-sm text-muted-foreground cursor-pointer">
                        Alle auswählen ({families.length})
                      </label>
                    </div>
                    {families.map((family) => (
                      <div
                        key={family.familyName}
                        className="flex items-center justify-between p-3 sm:p-4 gap-2 border rounded-lg hover-elevate overflow-hidden"
                        data-testid={`card-family-${family.familyName}`}
                      >
                        <div className="flex items-center gap-2 sm:gap-4 min-w-0 flex-1">
                          <Checkbox
                            checked={selectedFamilies.has(family.familyName)}
                            onCheckedChange={(checked) => {
                              const newSet = new Set(selectedFamilies);
                              if (checked) {
                                newSet.add(family.familyName);
                              } else {
                                newSet.delete(family.familyName);
                              }
                              setSelectedFamilies(newSet);
                            }}
                            onClick={(e) => e.stopPropagation()}
                            data-testid={`checkbox-family-${family.familyName}`}
                          />
                          <div 
                            className="cursor-pointer"
                            onClick={() => setSelectedFamily(family.familyName)}
                          >
                            <p className="font-semibold">{family.familyName}</p>
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              <Users className="h-3 w-3" />
                              {family.memberCount} members
                              <span className="text-xs">
                                ({family.parentCount}P / {family.childCount}C)
                              </span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 sm:gap-4 flex-shrink-0">
                          <div className="text-right text-sm hidden sm:block">
                            <p>{family.taskCount} tasks</p>
                            <p className="text-muted-foreground">{family.rewardCount} rewards</p>
                          </div>
                          <div className="flex items-center gap-1 sm:gap-1.5" onClick={(e) => e.stopPropagation()}>
                            {!Capacitor.isNativePlatform() && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-8 px-2 text-xs border-amber-400 text-amber-700 hover:bg-amber-50"
                                onClick={() => {
                                  setPromoDialogFamily(family.familyName);
                                  setPromoEntitlement("family_pro");
                                  setPromoDuration("monthly");
                                }}
                              >
                                <Gift className="h-3 w-3 mr-1" />
                                Promo
                              </Button>
                            )}
                            <Select
                              value={family.subscriptionTier}
                              onValueChange={(tier) => {
                                if (tier === "free") {
                                  updateTierMutation.mutate({ familyName: family.familyName, tier });
                                } else {
                                  setEmergencyTierConfirm({ familyName: family.familyName, tier });
                                }
                              }}
                            >
                              <SelectTrigger className="w-24 sm:w-32">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="free">⬇ Free (Reset)</SelectItem>
                                {!Capacitor.isNativePlatform() && (
                                  <>
                                    <SelectSeparator />
                                    <SelectGroup>
                                      <SelectLabel className="text-destructive text-xs">⚠ Nur Notfall</SelectLabel>
                                      <SelectItem value="family">Family (DB direkt)</SelectItem>
                                      <SelectItem value="family_hero">FamilyPro (DB direkt)</SelectItem>
                                    </SelectGroup>
                                  </>
                                )}
                              </SelectContent>
                            </Select>
                          </div>
                          <ChevronRight 
                            className="h-5 w-5 text-muted-foreground cursor-pointer" 
                            onClick={() => setSelectedFamily(family.familyName)}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-center text-muted-foreground py-8">No families registered yet</p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="skins" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Palette className="h-5 w-5" />
                  Skin Statistics
                </CardTitle>
                <CardDescription>
                  Most popular character skins by usage
                </CardDescription>
              </CardHeader>
              <CardContent>
                {skinsLoading ? (
                  <div className="space-y-2">
                    {[...Array(5)].map((_, i) => (
                      <div key={i} className="h-12 bg-muted rounded animate-pulse" />
                    ))}
                  </div>
                ) : skinStats ? (
                  <div className="space-y-4">
                    <div className="text-sm text-muted-foreground mb-4">
                      Total skins: <span className="font-semibold">{skinStats.totalSkins}</span>
                    </div>
                    <div className="space-y-2">
                      {skinStats.stats.slice(0, 20).map((skin, index) => (
                        <div
                          key={skin.id}
                          className="flex items-center justify-between p-3 border rounded-lg"
                          data-testid={`card-skin-${skin.id}`}
                        >
                          <div className="flex items-center gap-3">
                            <span className="text-muted-foreground w-6 text-right">#{index + 1}</span>
                            <div>
                              <p className="font-medium">{skin.name}</p>
                              <p className="text-xs text-muted-foreground">
                                {skin.pointsRequired} pts required • {skin.bonusPoints} bonus pts
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-4">
                            <Badge variant={skin.usageCount > 0 ? "default" : "secondary"}>
                              {skin.usageCount} users
                            </Badge>
                            {skin.id.startsWith('custom_') && (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => deleteSkinMutation.mutate(skin.id)}
                                disabled={deleteSkinMutation.isPending}
                                data-testid={`button-delete-skin-${skin.id}`}
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Users Tab */}
          <TabsContent value="users" className="space-y-6">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Users className="h-5 w-5" />
                      Registered Users
                    </CardTitle>
                    <CardDescription>
                      All accounts registered in the system — {adminUsers?.length ?? 0} total
                    </CardDescription>
                  </div>
                  <Button size="icon" variant="outline" onClick={() => refetchUsers()} data-testid="button-refresh-users">
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <Input
                  placeholder="Search by email or family..."
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                  data-testid="input-user-search"
                />
                {usersLoading ? (
                  <div className="space-y-2">
                    {[...Array(5)].map((_, i) => (
                      <div key={i} className="h-12 rounded-md bg-muted animate-pulse" />
                    ))}
                  </div>
                ) : (
                  <div className="rounded-md border overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-muted/50">
                        <tr>
                          <th className="text-left px-4 py-2 font-medium text-muted-foreground">Email</th>
                          <th className="text-left px-4 py-2 font-medium text-muted-foreground">Status</th>
                          <th className="text-left px-4 py-2 font-medium text-muted-foreground">Linked Member</th>
                          <th className="text-left px-4 py-2 font-medium text-muted-foreground">Family</th>
                          <th className="text-left px-4 py-2 font-medium text-muted-foreground">Registered</th>
                          <th className="text-left px-4 py-2 font-medium text-muted-foreground">Last Login</th>
                          <th className="px-4 py-2 font-medium text-muted-foreground">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(adminUsers ?? [])
                          .filter((u) => {
                            const q = userSearch.toLowerCase();
                            if (!q) return true;
                            return (
                              u.email?.toLowerCase().includes(q) ||
                              u.linkedFamilyName?.toLowerCase().includes(q) ||
                              u.linkedMemberName?.toLowerCase().includes(q)
                            );
                          })
                          .map((u, idx) => (
                            <tr
                              key={u.id}
                              className={idx % 2 === 0 ? "bg-background" : "bg-muted/20"}
                              data-testid={`row-user-${u.id}`}
                            >
                              <td className="px-4 py-2.5">
                                <div className="flex items-center gap-2">
                                  {u.isDisabled && (
                                    <Badge variant="destructive" className="text-xs shrink-0">Disabled</Badge>
                                  )}
                                  <span className="font-mono text-xs truncate max-w-[220px]">{u.email ?? "—"}</span>
                                </div>
                              </td>
                              <td className="px-4 py-2.5">
                                {u.isEmailVerified ? (
                                  <Badge variant="secondary" className="text-xs gap-1">
                                    <CheckCircle2 className="h-3 w-3" /> Verified
                                  </Badge>
                                ) : (
                                  <Badge variant="outline" className="text-xs gap-1 text-muted-foreground">
                                    <AlertTriangle className="h-3 w-3" /> Unverified
                                  </Badge>
                                )}
                              </td>
                              <td className="px-4 py-2.5">
                                {u.linkedMemberName ? (
                                  <div className="flex items-center gap-1.5">
                                    <span className="text-sm">{u.linkedMemberName}</span>
                                    <Badge variant="outline" className="text-xs capitalize">{u.linkedMemberRole}</Badge>
                                  </div>
                                ) : (
                                  <span className="text-muted-foreground text-xs">No member linked</span>
                                )}
                              </td>
                              <td className="px-4 py-2.5 text-sm">
                                {u.linkedFamilyName ?? <span className="text-muted-foreground text-xs">—</span>}
                              </td>
                              <td className="px-4 py-2.5 text-xs text-muted-foreground">
                                {u.createdAt ? new Date(u.createdAt).toLocaleDateString() : "—"}
                              </td>
                              <td className="px-4 py-2.5 text-xs text-muted-foreground">
                                {u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleDateString() : "Never"}
                              </td>
                              <td className="px-4 py-2.5 text-right">
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  onClick={() => setUserToDelete({ id: u.id, email: u.email, name: u.linkedMemberName ?? null })}
                                  data-testid={`button-delete-user-${u.id}`}
                                >
                                  <Trash2 className="h-4 w-4 text-destructive" />
                                </Button>
                              </td>
                            </tr>
                          ))}
                        {(adminUsers ?? []).filter((u) => {
                          const q = userSearch.toLowerCase();
                          if (!q) return true;
                          return (
                            u.email?.toLowerCase().includes(q) ||
                            u.linkedFamilyName?.toLowerCase().includes(q) ||
                            u.linkedMemberName?.toLowerCase().includes(q)
                          );
                        }).length === 0 && (
                          <tr>
                            <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground text-sm">
                              No users found
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <AlertDialog open={!!userToDelete} onOpenChange={(open) => { if (!open && !deleteUserMutation.isPending) setUserToDelete(null); }}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete Login Account</AlertDialogTitle>
                <AlertDialogDescription asChild>
                  <div>
                    {userToDelete?.name && (
                      <p className="mb-1">
                        <span className="font-semibold">{userToDelete.name}</span>
                        {" — "}
                        <span className="font-mono">{userToDelete.email ?? "—"}</span>
                      </p>
                    )}
                    {!userToDelete?.name && userToDelete?.email && (
                      <p className="mb-1 font-mono font-semibold">{userToDelete.email}</p>
                    )}
                    <p>
                      This will permanently delete the login account. The linked family member record and the family itself will remain untouched. This action cannot be undone.
                    </p>
                  </div>
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={deleteUserMutation.isPending}>Cancel</AlertDialogCancel>
                <Button
                  variant="destructive"
                  disabled={deleteUserMutation.isPending}
                  onClick={(e) => {
                    e.preventDefault();
                    if (userToDelete) deleteUserMutation.mutate(userToDelete.id);
                  }}
                  data-testid="button-confirm-delete-user"
                >
                  {deleteUserMutation.isPending ? (
                    <><Loader2 className="h-4 w-4 animate-spin mr-2" />Deleting…</>
                  ) : "Delete Account"}
                </Button>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          {/* Data Migration Tab */}
          <TabsContent value="migration" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Database className="h-5 w-5" />
                  Data Migration
                </CardTitle>
                <CardDescription>
                  Export data from development and import to production database
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid md:grid-cols-2 gap-6">
                  {/* Export Section */}
                  <div className="space-y-4 p-4 border rounded-lg">
                    <h3 className="font-semibold flex items-center gap-2">
                      <Download className="h-4 w-4" />
                      Export Data
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      Download all data from the current database as JSON.
                    </p>
                    <Button 
                      onClick={async () => {
                        try {
                          const res = await fetch("/api/admin/export", {
                            headers: { Authorization: `Bearer ${sessionStorage.getItem("adminToken")}` }
                          });
                          const data = await res.json();
                          const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
                          const url = URL.createObjectURL(blob);
                          const a = document.createElement("a");
                          a.href = url;
                          a.download = `herokids-export-${new Date().toISOString().split("T")[0]}.json`;
                          a.click();
                          URL.revokeObjectURL(url);
                          toast({ title: "Export successful", description: "Data downloaded as JSON file" });
                        } catch (err) {
                          toast({ title: "Export failed", description: "Could not export data", variant: "destructive" });
                        }
                      }}
                      data-testid="button-export-data"
                    >
                      <Download className="h-4 w-4 mr-2" />
                      Export All Data
                    </Button>
                  </div>

                  {/* Import Section */}
                  <div className="space-y-4 p-4 border rounded-lg">
                    <h3 className="font-semibold flex items-center gap-2">
                      <Upload className="h-4 w-4" />
                      Import Data
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      Upload a JSON export file to restore data.
                    </p>
                    <input
                      type="file"
                      accept=".json"
                      id="import-file"
                      className="hidden"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        
                        try {
                          const text = await file.text();
                          const data = JSON.parse(text);
                          
                          const res = await fetch("/api/admin/import", {
                            method: "POST",
                            headers: { 
                              "Content-Type": "application/json",
                              Authorization: `Bearer ${sessionStorage.getItem("adminToken")}` 
                            },
                            body: JSON.stringify({ data, skipExisting: true })
                          });
                          
                          const result = await res.json();
                          if (res.ok) {
                            toast({ 
                              title: "Import successful", 
                              description: `Imported: ${JSON.stringify(result.imported)}` 
                            });
                            refetchStats();
                            refetchFamilies();
                          } else {
                            throw new Error(result.message);
                          }
                        } catch (err: any) {
                          toast({ 
                            title: "Import failed", 
                            description: err.message || "Could not import data", 
                            variant: "destructive" 
                          });
                        }
                        e.target.value = "";
                      }}
                    />
                    <Button 
                      onClick={() => document.getElementById("import-file")?.click()}
                      variant="outline"
                      data-testid="button-import-data"
                    >
                      <Upload className="h-4 w-4 mr-2" />
                      Import from JSON
                    </Button>
                  </div>
                </div>

                <Separator />

                <div className="bg-muted/50 p-4 rounded-lg">
                  <h4 className="font-semibold mb-2">Migration Instructions</h4>
                  <ol className="text-sm text-muted-foreground space-y-2 list-decimal list-inside">
                    <li>Go to the <strong>Development</strong> environment and click "Export All Data"</li>
                    <li>Save the JSON file to your computer</li>
                    <li>Go to the <strong>Production</strong> app (littlechamps.net/admin)</li>
                    <li>Login to admin and click "Import from JSON"</li>
                    <li>Select the exported JSON file - all families will be restored</li>
                  </ol>
                </div>

                <Separator />

                {/* Star Reinitialization for Test Families */}
                <div className="space-y-4 p-4 border rounded-lg border-amber-500/50 bg-amber-50/50 dark:bg-amber-950/20">
                  <h3 className="font-semibold flex items-center gap-2">
                    <Star className="h-4 w-4 text-amber-500" />
                    Fix Stars for Test Families
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    For members who already discovered skins but have 0/{TOTAL_HIDDEN_STARS} stars, this will place {TOTAL_HIDDEN_STARS} new stars on their discovered skin cards.
                  </p>
                  <Button 
                    onClick={async () => {
                      try {
                        const res = await fetch("/api/admin/reinitialize-stars", {
                          method: "POST",
                          headers: { 
                            "Content-Type": "application/json",
                            Authorization: `Bearer ${sessionStorage.getItem("adminToken")}` 
                          },
                          body: JSON.stringify({})
                        });
                        const result = await res.json();
                        if (res.ok) {
                          toast({ 
                            title: "Stars reinitialized", 
                            description: `${result.results?.length || 0} members updated` 
                          });
                        } else {
                          throw new Error(result.message);
                        }
                      } catch (err: any) {
                        toast({ 
                          title: "Failed", 
                          description: err.message || "Could not reinitialize stars", 
                          variant: "destructive" 
                        });
                      }
                    }}
                    variant="outline"
                    className="border-amber-500 text-amber-700 dark:text-amber-400"
                    data-testid="button-reinitialize-stars"
                  >
                    <Star className="h-4 w-4 mr-2" />
                    Reinitialize Stars for All Members
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <Dialog open={!!selectedFamily} onOpenChange={(open) => !open && setSelectedFamily(null)}>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Eye className="h-5 w-5" />
                {selectedFamily}
              </DialogTitle>
              <DialogDescription>Family details and member management</DialogDescription>
            </DialogHeader>

            {detailsLoading ? (
              <div className="space-y-4">
                <div className="h-20 bg-muted rounded animate-pulse" />
                <div className="h-40 bg-muted rounded animate-pulse" />
              </div>
            ) : familyDetails ? (
              <div className="space-y-6">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="text-center p-3 bg-muted/50 rounded-lg">
                    <p className="text-2xl font-bold">{familyDetails.members.length}</p>
                    <p className="text-sm text-muted-foreground">Members</p>
                  </div>
                  <div className="text-center p-3 bg-muted/50 rounded-lg">
                    <p className="text-2xl font-bold">{familyDetails.taskCount}</p>
                    <p className="text-sm text-muted-foreground">Tasks</p>
                  </div>
                  <div className="text-center p-3 bg-muted/50 rounded-lg">
                    <p className="text-2xl font-bold">{familyDetails.rewardCount}</p>
                    <p className="text-sm text-muted-foreground">Rewards</p>
                  </div>
                  <div className="text-center p-3 bg-muted/50 rounded-lg">
                    <Badge className={TIER_COLORS[familyDetails.family.subscriptionTier]}>
                      {TIER_LABELS[familyDetails.family.subscriptionTier]}
                    </Badge>
                    <p className="text-sm text-muted-foreground mt-1">Tier</p>
                  </div>
                </div>

                <Separator />

                <div>
                  <h3 className="font-semibold mb-3 flex items-center gap-2">
                    <MessageSquare className="h-4 w-4" />
                    Send Email to Family
                  </h3>
                  <p className="text-xs text-muted-foreground mb-3">Sends an email to all verified parent accounts in this family.</p>
                  <div className="flex flex-col gap-2">
                    <input
                      type="text"
                      placeholder="Subject (optional)"
                      value={messageSubject}
                      onChange={(e) => setMessageSubject(e.target.value)}
                      className="w-full px-3 py-2 text-sm rounded-md border border-input bg-background"
                      data-testid="input-admin-message-subject"
                    />
                    <div className="flex gap-2">
                      <Textarea
                        placeholder="Write a message to this family..."
                        value={messageToSend}
                        onChange={(e) => setMessageToSend(e.target.value)}
                        className="flex-1"
                        data-testid="input-admin-message"
                      />
                      <Button
                        onClick={() => {
                          if (messageToSend.trim() && selectedFamily) {
                            sendMessageMutation.mutate({ 
                              familyName: selectedFamily, 
                              message: messageToSend.trim(),
                              subject: messageSubject.trim(),
                            });
                          }
                        }}
                        disabled={!messageToSend.trim() || sendMessageMutation.isPending}
                        data-testid="button-send-message"
                      >
                        <Send className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>

                <Separator />

                <div>
                  <h3 className="font-semibold mb-3 flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    Members
                  </h3>
                  <div className="space-y-2">
                    {familyDetails.members.map((member) => (
                      <div
                        key={member.id}
                        className="flex items-center justify-between p-3 border rounded-lg"
                        data-testid={`card-member-${member.id}`}
                      >
                        <div className="flex items-center gap-3">
                          <Avatar className="h-10 w-10">
                            <AvatarImage src={getAvatarUrl(member.activeSkinId, member.avatarUrl, member.useCustomAvatar)} />
                            <AvatarFallback>{member.displayName[0]}</AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-medium">{member.displayName}</p>
                            <div className="flex flex-wrap items-center gap-2 mt-1">
                              <Badge variant={member.role === "parent" ? "default" : "secondary"} className="text-xs">
                                {member.role}
                              </Badge>
                              {member.account?.email && (
                                <Badge variant="outline" className="text-xs" data-testid={`badge-account-email-${member.id}`}>
                                  {member.account.email}
                                </Badge>
                              )}
                              {member.account && (
                                <Badge
                                  variant={member.account.isEmailVerified ? "default" : "secondary"}
                                  className="text-xs"
                                  data-testid={`badge-account-status-${member.id}`}
                                >
                                  {member.account.isEmailVerified ? "Verified" : "Unverified"}
                                </Badge>
                              )}
                              {member.account?.isDisabled && (
                                <Badge variant="destructive" className="text-xs" data-testid={`badge-account-disabled-${member.id}`}>
                                  Disabled
                                </Badge>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="text-right">
                            <p className="font-semibold">{member.totalPoints} pts</p>
                            <p className="text-xs text-muted-foreground">
                              Total earned: {member.totalEarned}
                            </p>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setMemberToAddPoints({ 
                              id: member.id, 
                              name: member.displayName 
                            })}
                            data-testid={`button-add-points-${member.id}`}
                            title="Add points"
                          >
                            <Plus className="h-4 w-4 text-green-600" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => fixStarsMutation.mutate(member.id)}
                            disabled={fixStarsMutation.isPending}
                            data-testid={`button-fix-stars-${member.id}`}
                            title="Fix missing stars (add to 48)"
                          >
                            <Star className="h-4 w-4 text-yellow-500" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              if (member.userId) {
                                updateMemberAccountMutation.mutate({
                                  familyName: selectedFamily!,
                                  memberId: member.id,
                                  action: "unlink",
                                  adminActor: sanitizedAdminActor,
                                });
                              } else {
                                setMemberToLinkAccount({
                                  id: member.id,
                                  name: member.displayName,
                                  familyName: selectedFamily!,
                                });
                              }
                            }}
                            disabled={updateMemberAccountMutation.isPending || !hasRepairAuditName}
                            data-testid={`button-${member.userId ? "unlink" : "link"}-account-${member.id}`}
                            title={!hasRepairAuditName ? "Enter a named repair audit name first" : member.userId ? "Unlink account from member" : "Link account by email"}
                          >
                            {member.userId ? (
                              <Unlink className="h-4 w-4 text-orange-600" />
                            ) : (
                              <LinkIcon className="h-4 w-4 text-blue-600" />
                            )}
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setMemberToRemove({ 
                              id: member.id, 
                              name: member.displayName, 
                              familyName: selectedFamily! 
                            })}
                            data-testid={`button-remove-member-${member.id}`}
                            title="Remove member"
                          >
                            <UserMinus className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <Separator />

                <div>
                  <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
                    <h3 className="font-semibold flex items-center gap-2">
                      <LinkIcon className="h-4 w-4" />
                      Recent Account-Link Repairs
                    </h3>
                    {accountLinkRepairHistory.length > 0 ? (
                      <div className="w-full sm:max-w-xs">
                        <Input
                          type="search"
                          placeholder="Search member, action, or email"
                          value={repairHistorySearch}
                          onChange={(event) => setRepairHistorySearch(event.target.value)}
                          data-testid="input-account-link-repair-search"
                        />
                      </div>
                    ) : null}
                  </div>
                  {accountLinkRepairHistory.length > 0 ? (
                    <div className="space-y-2">
                      <p className="text-sm text-muted-foreground" data-testid="text-account-link-repair-filter-count">
                        Showing {filteredAccountLinkRepairHistory.length} of {accountLinkRepairHistory.length} repairs
                      </p>
                      {filteredAccountLinkRepairHistory.length > 0 ? (
                        <div className="space-y-2" data-testid="list-account-link-repair-history">
                          {filteredAccountLinkRepairHistory.map((entry) => (
                            <div
                              key={entry.id}
                              className="rounded-md bg-muted/50 p-3"
                              data-testid={`card-account-link-repair-${entry.id}`}
                            >
                              <div className="flex flex-wrap items-start justify-between gap-3">
                                <div className="space-y-1">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <Badge variant="outline" data-testid={`badge-account-link-action-${entry.id}`}>
                                      {getAccountLinkRepairActionLabel(entry.action)}
                                    </Badge>
                                    <p className="font-medium" data-testid={`text-account-link-member-${entry.id}`}>
                                      {entry.memberDisplayName}
                                    </p>
                                  </div>
                                  <p className="text-sm text-muted-foreground break-all" data-testid={`text-account-link-accounts-${entry.id}`}>
                                    Old: {entry.oldAccountEmail || "None"} · New: {entry.newAccountEmail || "None"}
                                  </p>
                                  {entry.repairedBy ? (
                                    <p className="text-sm text-muted-foreground" data-testid={`text-account-link-actor-${entry.id}`}>
                                      Repaired by: {entry.repairedBy}
                                    </p>
                                  ) : null}
                                </div>
                                <p className="text-sm text-muted-foreground" data-testid={`text-account-link-time-${entry.id}`}>
                                  {formatEmailCheckTime(entry.repairedAt)}
                                </p>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground" data-testid="text-account-link-history-no-results">
                          No account-link repairs match this search.
                        </p>
                      )}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground" data-testid="text-account-link-history-empty">
                      No account-link repairs recorded yet.
                    </p>
                  )}
                </div>

                {/* RC Promotional Entitlement status */}
                {familyDetails.rcPromoStatus && (
                  <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm">
                    <p className="font-medium text-amber-800 flex items-center gap-1.5">
                      <Gift className="h-4 w-4" />
                      RC Promotional Entitlement aktiv
                    </p>
                    <p className="text-amber-700 mt-1">
                      Entitlement: <span className="font-mono">{familyDetails.rcPromoStatus.entitlement}</span>
                      {" · "}
                      {familyDetails.rcPromoStatus.isLifetime
                        ? "Unbefristet (Lifetime)"
                        : `Läuft ab: ${new Date(familyDetails.rcPromoStatus.expiresDate!).toLocaleDateString()}`}
                    </p>
                    <p className="text-amber-600 text-xs mt-0.5 font-mono">{familyDetails.rcPromoStatus.productIdentifier}</p>
                  </div>
                )}

                {familyDetails.family.language && (
                  <div className="text-sm text-muted-foreground">
                    Language: {familyDetails.family.language} | Timezone: {familyDetails.family.timezone || "Not set"}
                  </div>
                )}
              </div>
            ) : null}
          </DialogContent>
        </Dialog>

        {/* Grant Promotional Entitlement dialog */}
        <Dialog open={!!promoDialogFamily} onOpenChange={(open) => !open && setPromoDialogFamily(null)}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Gift className="h-5 w-5 text-amber-600" />
                Promotional Zugang gewähren
              </DialogTitle>
              <DialogDescription>
                Setzt ein RC Promotional Entitlement für{" "}
                <span className="font-semibold">{promoDialogFamily}</span>.
                RC trackt den Zugang — cancel-sync und Webhooks respektieren ihn.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Entitlement (Tier)</label>
                <Select value={promoEntitlement} onValueChange={setPromoEntitlement}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="family">Family</SelectItem>
                    <SelectItem value="family_pro">FamilyPro</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Laufzeit</label>
                <Select value={promoDuration} onValueChange={setPromoDuration}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="monthly">30 Tage (monatlich)</SelectItem>
                    <SelectItem value="three_month">90 Tage (3 Monate)</SelectItem>
                    <SelectItem value="yearly">365 Tage (jährlich)</SelectItem>
                    <SelectItem value="lifetime">Unbefristet (Lifetime)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setPromoDialogFamily(null)}>
                Abbrechen
              </Button>
              <Button
                className="bg-amber-600 hover:bg-amber-700 text-white"
                disabled={grantPromoMutation.isPending}
                onClick={() => {
                  if (promoDialogFamily) {
                    grantPromoMutation.mutate({
                      familyName: promoDialogFamily,
                      entitlement: promoEntitlement,
                      duration: promoDuration,
                    });
                  }
                }}
              >
                {grantPromoMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-1" />
                ) : (
                  <Gift className="h-4 w-4 mr-1" />
                )}
                Gewähren via RC
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Emergency direct-DB tier override confirmation */}
        <AlertDialog open={!!emergencyTierConfirm} onOpenChange={(open) => !open && setEmergencyTierConfirm(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2 text-destructive">
                <AlertTriangle className="h-5 w-5" />
                ⚠️ Notfall-Override — nur wenn RC nicht erreichbar ist
              </AlertDialogTitle>
              <AlertDialogDescription className="space-y-2">
                <span className="block">
                  Du bist dabei, den Tier für{" "}
                  <span className="font-semibold">{emergencyTierConfirm?.familyName}</span> direkt in der Datenbank
                  auf <span className="font-semibold">{TIER_LABELS[emergencyTierConfirm?.tier ?? ""] ?? emergencyTierConfirm?.tier}</span> zu setzen
                  — <strong>ohne RevenueCat zu informieren</strong>.
                </span>
                <span className="block text-destructive font-medium">
                  RC wird diesen Wert beim nächsten Abo-Sync überschreiben!
                  Nutze stattdessen den „Promo"-Button, um einen sicheren RC Promotional Entitlement zu setzen.
                </span>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setEmergencyTierConfirm(null)}>
                Abbrechen
              </AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive hover:bg-destructive/90"
                onClick={() => {
                  if (emergencyTierConfirm) {
                    updateTierMutation.mutate({ familyName: emergencyTierConfirm.familyName, tier: emergencyTierConfirm.tier });
                    setEmergencyTierConfirm(null);
                  }
                }}
              >
                Trotzdem direkt setzen (Notfall)
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <Dialog open={!!memberToLinkAccount} onOpenChange={(open) => { if (!open) { setMemberToLinkAccount(null); setAccountEmailToLink(""); setAccountMoveConfirmation(null); } }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Link account</DialogTitle>
              <DialogDescription>
                Link an existing login account to <strong>{memberToLinkAccount?.name}</strong>. If that account is already linked to another member, you will be asked to confirm moving it.
              </DialogDescription>
            </DialogHeader>
            <div className="py-4 space-y-3">
              <Input
                type="email"
                placeholder="parent@example.com"
                value={accountEmailToLink}
                onChange={(event) => setAccountEmailToLink(event.target.value)}
                onFocus={(e) => scrollFieldIntoView(e.currentTarget)}
                data-testid="input-link-account-email"
              />
              <p className="text-sm text-muted-foreground" data-testid="text-link-account-audit-help">
                This is for admin repair only. Double-check the member name and email before linking. Your repair audit name will be saved with the repair history.
              </p>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => { setMemberToLinkAccount(null); setAccountEmailToLink(""); }}>
                Cancel
              </Button>
              <Button
                onClick={() => {
                  if (memberToLinkAccount && accountEmailToLink.trim()) {
                    updateMemberAccountMutation.mutate({
                      familyName: memberToLinkAccount.familyName,
                      memberId: memberToLinkAccount.id,
                      action: "link",
                      email: accountEmailToLink.trim(),
                      adminActor: sanitizedAdminActor,
                      memberName: memberToLinkAccount.name,
                    });
                  }
                }}
                disabled={updateMemberAccountMutation.isPending || !accountEmailToLink.trim() || !hasRepairAuditName}
                data-testid="button-confirm-link-account"
              >
                {updateMemberAccountMutation.isPending ? "Linking..." : "Link account"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <AlertDialog open={!!accountMoveConfirmation} onOpenChange={(open) => !open && setAccountMoveConfirmation(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Move linked account?</AlertDialogTitle>
              <AlertDialogDescription className="space-y-3">
                <span className="block" data-testid="text-account-move-warning">
                  The account <strong>{accountMoveConfirmation?.email}</strong> is currently linked to{" "}
                  <strong>{accountMoveConfirmation?.existingMember.displayName}</strong>
                  {" "}in {accountMoveConfirmation?.existingMember.familyName}.
                </span>
                <span className="block" data-testid="text-account-move-target">
                  Confirming will detach it from that member and link it to{" "}
                  <strong>{accountMoveConfirmation?.memberName}</strong>. Both repair history entries will be recorded.
                </span>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel
                disabled={updateMemberAccountMutation.isPending}
                data-testid="button-cancel-move-account"
              >
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction
                disabled={updateMemberAccountMutation.isPending || !accountMoveConfirmation || !hasRepairAuditName}
                onClick={(event) => {
                  event.preventDefault();
                  if (accountMoveConfirmation) {
                    updateMemberAccountMutation.mutate({
                      familyName: accountMoveConfirmation.familyName,
                      memberId: accountMoveConfirmation.memberId,
                      action: "link",
                      email: accountMoveConfirmation.email,
                      detachExisting: true,
                      adminActor: sanitizedAdminActor,
                      memberName: accountMoveConfirmation.memberName,
                    });
                  }
                }}
                data-testid="button-confirm-move-account"
              >
                {updateMemberAccountMutation.isPending ? "Moving..." : "Move account"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <Dialog open={!!memberToRemove} onOpenChange={(open) => !open && setMemberToRemove(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Remove Member</DialogTitle>
              <DialogDescription>
                Are you sure you want to remove <strong>{memberToRemove?.name}</strong> from the family?
                This action cannot be undone.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setMemberToRemove(null)}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={() => {
                  if (memberToRemove) {
                    removeMemberMutation.mutate({
                      familyName: memberToRemove.familyName,
                      memberId: memberToRemove.id,
                    });
                  }
                }}
                disabled={removeMemberMutation.isPending}
                data-testid="button-confirm-remove"
              >
                {removeMemberMutation.isPending ? "Removing..." : "Remove"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={!!memberToAddPoints} onOpenChange={(open) => { if (!open) { setMemberToAddPoints(null); setPointsToAdd(""); } }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Punkte hinzufügen</DialogTitle>
              <DialogDescription>
                Punkte für <strong>{memberToAddPoints?.name}</strong> hinzufügen (für Testzwecke)
              </DialogDescription>
            </DialogHeader>
            <div className="py-4">
              <Input
                type="number"
                placeholder="Anzahl Punkte (z.B. 100, 500, 1000)"
                value={pointsToAdd}
                onChange={(e) => setPointsToAdd(e.target.value)}
                onFocus={(e) => scrollFieldIntoView(e.currentTarget)}
                min="1"
                data-testid="input-points-amount"
              />
              <div className="flex gap-2 mt-3">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPointsToAdd("100")}
                >
                  +100
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPointsToAdd("500")}
                >
                  +500
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPointsToAdd("1000")}
                >
                  +1000
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPointsToAdd("5000")}
                >
                  +5000
                </Button>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => { setMemberToAddPoints(null); setPointsToAdd(""); }}>
                Abbrechen
              </Button>
              <Button
                onClick={() => {
                  const points = parseInt(pointsToAdd);
                  if (memberToAddPoints && points > 0) {
                    addPointsMutation.mutate({
                      memberId: memberToAddPoints.id,
                      points,
                    });
                  }
                }}
                disabled={addPointsMutation.isPending || !pointsToAdd || parseInt(pointsToAdd) <= 0}
                data-testid="button-confirm-add-points"
              >
                {addPointsMutation.isPending ? "Wird hinzugefügt..." : "Punkte hinzufügen"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Families Confirmation Dialog */}
        <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2 text-destructive">
                <Trash2 className="h-5 w-5" />
                {selectedFamilies.size} Familie{selectedFamilies.size > 1 ? 'n' : ''} löschen?
              </AlertDialogTitle>
              <AlertDialogDescription className="space-y-2">
                <p>Diese Aktion kann nicht rückgängig gemacht werden. Folgende Daten werden gelöscht:</p>
                <ul className="list-disc list-inside text-sm space-y-1">
                  <li>Alle Familienmitglieder und ihre Punkte</li>
                  <li>Alle Aufgaben und Belohnungen</li>
                  <li>Alle Chat-Nachrichten und Achievements</li>
                  <li>Alle Stern-Platzierungen</li>
                </ul>
                <div className="mt-4 max-h-32 overflow-y-auto text-xs bg-muted p-2 rounded">
                  {Array.from(selectedFamilies).join(", ")}
                </div>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={isDeleting}>Abbrechen</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                disabled={isDeleting}
                onClick={async () => {
                  setIsDeleting(true);
                  try {
                    const res = await fetch("/api/admin/delete-families", {
                      method: "POST",
                      headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${sessionStorage.getItem("adminToken") || token}`
                      },
                      body: JSON.stringify({ familyNames: Array.from(selectedFamilies) })
                    });
                    const result = await res.json();
                    if (res.ok) {
                      toast({
                        title: "Familien gelöscht",
                        description: `${result.deleted} Familie(n) erfolgreich gelöscht`
                      });
                      setSelectedFamilies(new Set());
                      refetchFamilies();
                      refetchStats();
                    } else {
                      throw new Error(result.message);
                    }
                  } catch (err: any) {
                    toast({
                      title: "Fehler beim Löschen",
                      description: err.message || "Konnte Familien nicht löschen",
                      variant: "destructive"
                    });
                  } finally {
                    setIsDeleting(false);
                    setShowDeleteConfirm(false);
                  }
                }}
                data-testid="button-confirm-delete-families"
              >
                {isDeleting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Löschen...
                  </>
                ) : (
                  "Endgültig löschen"
                )}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </main>
    </div>
  );
}
