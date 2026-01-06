import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
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
  Loader2
} from "lucide-react";
import { getAvatarUrl } from "@/lib/skins";
import { queryClient } from "@/lib/queryClient";
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

interface FamilyMember {
  id: string;
  displayName: string;
  role: string;
  avatarUrl: string;
  activeSkinId: string | null;
  useCustomAvatar: boolean;
  totalEarned: number;
  totalPoints: number;
  weeklyPoints: number;
  monthlyPoints: number;
}

interface FamilyDetails {
  family: FamilyWithStats;
  members: FamilyMember[];
  taskCount: number;
  rewardCount: number;
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

const TIER_LABELS: Record<string, string> = {
  free: "Free",
  family: "Family",
  family_plus: "Family+",
  family_hero: "Family Hero",
};

const TIER_COLORS: Record<string, string> = {
  free: "bg-gray-500",
  family: "bg-blue-500",
  family_plus: "bg-purple-500",
  family_hero: "bg-amber-500",
};

export default function AdminPage() {
  const [token, setToken] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [selectedFamily, setSelectedFamily] = useState<string | null>(null);
  const [messageToSend, setMessageToSend] = useState("");
  const [memberToRemove, setMemberToRemove] = useState<{ id: string; name: string; familyName: string } | null>(null);
  const [memberToAddPoints, setMemberToAddPoints] = useState<{ id: string; name: string } | null>(null);
  const [pointsToAdd, setPointsToAdd] = useState("");
  const [selectedFamilies, setSelectedFamilies] = useState<Set<string>>(new Set());
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    const stored = localStorage.getItem("admin_token");
    if (stored) {
      setToken(stored);
    }
  }, []);

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
  });

  const CHART_COLORS = ["#8884d8", "#82ca9d", "#ffc658", "#ff7c43", "#a855f7"];

  const updateTierMutation = useMutation({
    mutationFn: async ({ familyName, tier }: { familyName: string; tier: string }) => {
      const res = await fetch(`/api/admin/families/${encodeURIComponent(familyName)}/tier`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ tier }),
      });
      if (!res.ok) throw new Error("Failed to update tier");
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Subscription tier updated" });
      refetchFamilies();
    },
    onError: () => {
      toast({ title: "Failed to update tier", variant: "destructive" });
    },
  });

  const sendMessageMutation = useMutation({
    mutationFn: async ({ familyName, message }: { familyName: string; message: string }) => {
      const res = await fetch(`/api/admin/families/${encodeURIComponent(familyName)}/message`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ message }),
      });
      if (!res.ok) throw new Error("Failed to send message");
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Message sent to family" });
      setMessageToSend("");
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

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
              <Shield className="h-8 w-8 text-primary" />
            </div>
            <CardTitle className="text-2xl">Admin Dashboard</CardTitle>
            <CardDescription>Enter your admin password to continue</CardDescription>
          </CardHeader>
          <CardContent>
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
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Shield className="h-6 w-6 text-primary" />
            <h1 className="text-xl font-bold">HeroKids Admin</h1>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                refetchStats();
                refetchFamilies();
                refetchSkins();
                refetchAnalytics();
              }}
              data-testid="button-refresh-data"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
            <Button variant="outline" size="sm" onClick={logout} data-testid="button-admin-logout">
              <LogOut className="h-4 w-4 mr-2" />
              Logout
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6">
        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList className="grid w-full grid-cols-5 max-w-2xl">
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
            <TabsTrigger value="skins" data-testid="tab-skins">
              <Palette className="h-4 w-4 mr-2" />
              Skins
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
                        className="flex items-center justify-between p-4 border rounded-lg hover-elevate"
                        data-testid={`card-family-${family.familyName}`}
                      >
                        <div className="flex items-center gap-4">
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
                        <div className="flex items-center gap-4">
                          <div className="text-right text-sm">
                            <p>{family.taskCount} tasks</p>
                            <p className="text-muted-foreground">{family.rewardCount} rewards</p>
                          </div>
                          <Select
                            value={family.subscriptionTier}
                            onValueChange={(tier) => {
                              updateTierMutation.mutate({ familyName: family.familyName, tier });
                            }}
                          >
                            <SelectTrigger className="w-36" onClick={(e) => e.stopPropagation()}>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="free">Free</SelectItem>
                              <SelectItem value="family">Family (2€)</SelectItem>
                              <SelectItem value="family_hero">Family Hero (12€)</SelectItem>
                            </SelectContent>
                          </Select>
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
                    <li>Go to the <strong>Production</strong> app (herokids.replit.app/admin)</li>
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
                    For members who already discovered skins but have 0/32 stars, this will place 32 new stars on their discovered skin cards.
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
                    Send Message to Family
                  </h3>
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
                            message: messageToSend.trim() 
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
                            <Badge variant={member.role === "parent" ? "default" : "secondary"} className="text-xs">
                              {member.role}
                            </Badge>
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
                          >
                            <Plus className="h-4 w-4 text-green-600" />
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
                          >
                            <UserMinus className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {familyDetails.family.language && (
                  <div className="text-sm text-muted-foreground">
                    Language: {familyDetails.family.language} | Timezone: {familyDetails.family.timezone || "Not set"}
                  </div>
                )}
              </div>
            ) : null}
          </DialogContent>
        </Dialog>

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
