import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
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
  RefreshCw
} from "lucide-react";
import { getAvatarUrl } from "@/lib/skins";

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

  const { data: familyDetails, isLoading: detailsLoading } = useQuery<FamilyDetails>({
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

      <main className="container mx-auto px-4 py-6 space-y-6">
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
            <CardTitle className="flex items-center gap-2">
              <Home className="h-5 w-5" />
              Families
            </CardTitle>
            <CardDescription>
              All registered families and their statistics
            </CardDescription>
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
                {families.map((family) => (
                  <div
                    key={family.familyName}
                    className="flex items-center justify-between p-4 border rounded-lg hover-elevate cursor-pointer"
                    onClick={() => setSelectedFamily(family.familyName)}
                    data-testid={`card-family-${family.familyName}`}
                  >
                    <div className="flex items-center gap-4">
                      <div>
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
                        <SelectTrigger className="w-32" onClick={(e) => e.stopPropagation()}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="free">Free</SelectItem>
                          <SelectItem value="family">Family (2€)</SelectItem>
                          <SelectItem value="family_hero">Family Hero (12€)</SelectItem>
                        </SelectContent>
                      </Select>
                      <ChevronRight className="h-5 w-5 text-muted-foreground" />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-center text-muted-foreground py-8">No families registered yet</p>
            )}
          </CardContent>
        </Card>

        <Dialog open={!!selectedFamily} onOpenChange={(open) => !open && setSelectedFamily(null)}>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Eye className="h-5 w-5" />
                {selectedFamily}
              </DialogTitle>
              <DialogDescription>Family details and member overview</DialogDescription>
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
                        <div className="text-right">
                          <p className="font-semibold">{member.totalPoints} pts</p>
                          <p className="text-xs text-muted-foreground">
                            Total earned: {member.totalEarned}
                          </p>
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
      </main>
    </div>
  );
}
