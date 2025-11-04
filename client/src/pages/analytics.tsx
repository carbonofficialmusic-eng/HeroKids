import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Link } from "wouter";
import { ArrowLeft, TrendingUp, Award, CheckCircle, Star } from "lucide-react";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import type { FamilyMember, Task } from "@shared/schema";
import { getAvatarUrl } from "@/lib/skins";

export default function Analytics() {
  const { user } = useAuth();

  // Fetch family members
  const { data: members = [] } = useQuery<FamilyMember[]>({
    queryKey: ["/api/family-members"],
    enabled: !!user,
  });

  // Fetch tasks
  const { data: tasks = [] } = useQuery<Task[]>({
    queryKey: ["/api/tasks"],
    enabled: !!user,
  });

  if (!members.length) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Loading analytics...</p>
      </div>
    );
  }

  // Calculate statistics
  const completedTasks = tasks.filter((t) => t.status === "completed").length;
  const activeTasks = tasks.filter((t) => t.status === "active").length;
  const totalTasks = tasks.length;
  const completionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  // Points leaderboard
  const leaderboard = [...members]
    .sort((a, b) => b.weeklyPoints - a.weeklyPoints)
    .map((m, index) => ({
      ...m,
      rank: index + 1,
    }));

  // Member performance data (based on points earned)
  const memberStats = members.map((member) => {
    return {
      name: member.displayName,
      weeklyPoints: member.weeklyPoints,
      monthlyPoints: member.monthlyPoints,
      totalPoints: member.totalPoints,
    };
  });

  // Current week data (only showing current snapshot)
  const currentWeekData = members.map((m) => ({
    name: m.displayName,
    points: m.weeklyPoints,
  }));

  const colors = ["#6366f1", "#8b5cf6", "#ec4899", "#f59e0b", "#10b981", "#06b6d4"];

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="border-b sticky top-0 backdrop-blur-md z-40">
        <div className="container mx-auto px-4 h-16 flex items-center gap-4">
          <Link href="/">
            <Button variant="ghost" size="icon" data-testid="button-back">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-xl font-bold" data-testid="text-page-title">
              Family Analytics
            </h1>
            <p className="text-sm text-muted-foreground">Track progress and performance</p>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        {/* Overview Stats */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Tasks</CardTitle>
              <CheckCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="text-total-tasks">{totalTasks}</div>
              <p className="text-xs text-muted-foreground">
                {activeTasks} active, {completedTasks} completed
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Completion Rate</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="text-completion-rate">{completionRate}%</div>
              <p className="text-xs text-muted-foreground">
                Tasks completed successfully
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Family Members</CardTitle>
              <Award className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="text-member-count">{members.length}</div>
              <p className="text-xs text-muted-foreground">
                Active participants
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Points</CardTitle>
              <Star className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="text-total-points">
                {members.reduce((sum, m) => sum + m.weeklyPoints, 0)}
              </div>
              <p className="text-xs text-muted-foreground">
                Earned this week
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Charts and Details */}
        <Tabs defaultValue="leaderboard" className="space-y-6">
          <TabsList>
            <TabsTrigger value="leaderboard" data-testid="tab-leaderboard">Leaderboard</TabsTrigger>
            <TabsTrigger value="trends" data-testid="tab-trends">Points Trends</TabsTrigger>
            <TabsTrigger value="performance" data-testid="tab-performance">Performance</TabsTrigger>
          </TabsList>

          {/* Leaderboard Tab */}
          <TabsContent value="leaderboard" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Weekly Leaderboard</CardTitle>
                <CardDescription>Top performers this week</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {leaderboard.map((member, index) => (
                    <div
                      key={member.id}
                      className="flex items-center gap-4 p-4 rounded-lg bg-muted/50"
                      data-testid={`leaderboard-item-${index}`}
                    >
                      <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary text-primary-foreground font-bold text-sm">
                        {member.rank}
                      </div>
                      <Avatar className="h-10 w-10">
                        <AvatarImage src={getAvatarUrl(member.activeSkinId, member.avatarUrl)} />
                        <AvatarFallback>{member.displayName.substring(0, 2).toUpperCase()}</AvatarFallback>
                      </Avatar>
                      <div className="flex-1">
                        <div className="font-semibold">{member.displayName}</div>
                        <div className="text-sm text-muted-foreground capitalize">{member.role}</div>
                      </div>
                      <div className="text-right">
                        <div className="font-bold text-lg">{member.weeklyPoints}</div>
                        <div className="text-xs text-muted-foreground">points</div>
                      </div>
                      {index === 0 && (
                        <Badge variant="default" className="ml-2">
                          <Star className="h-3 w-3 mr-1" />
                          Top Performer
                        </Badge>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Trends Tab */}
          <TabsContent value="trends" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Current Weekly Points</CardTitle>
                <CardDescription>Points earned this week per member</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={currentWeekData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="points" fill="#6366f1" name="Weekly Points" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Task Status Overview</CardTitle>
                <CardDescription>Current task distribution across the family</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
                    <div className="flex items-center gap-3">
                      <div className="h-3 w-3 rounded-full bg-green-500" />
                      <span className="font-medium">Completed Tasks</span>
                    </div>
                    <span className="text-2xl font-bold">{completedTasks}</span>
                  </div>
                  <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
                    <div className="flex items-center gap-3">
                      <div className="h-3 w-3 rounded-full bg-blue-500" />
                      <span className="font-medium">Active Tasks</span>
                    </div>
                    <span className="text-2xl font-bold">{activeTasks}</span>
                  </div>
                  <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
                    <div className="flex items-center gap-3">
                      <div className="h-3 w-3 rounded-full bg-primary" />
                      <span className="font-medium">Total Tasks</span>
                    </div>
                    <span className="text-2xl font-bold">{totalTasks}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Performance Tab */}
          <TabsContent value="performance" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Member Performance</CardTitle>
                <CardDescription>Detailed statistics for each family member</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  {memberStats.map((stat, index) => (
                    <div key={index} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold">{stat.name}</span>
                        <Badge variant="secondary">{stat.totalPoints} total points</Badge>
                      </div>
                      <div className="grid grid-cols-3 gap-4">
                        <Card className="p-3">
                          <div className="text-xs text-muted-foreground">Weekly</div>
                          <div className="text-xl font-bold">{stat.weeklyPoints}</div>
                        </Card>
                        <Card className="p-3">
                          <div className="text-xs text-muted-foreground">Monthly</div>
                          <div className="text-xl font-bold">{stat.monthlyPoints}</div>
                        </Card>
                        <Card className="p-3">
                          <div className="text-xs text-muted-foreground">Total</div>
                          <div className="text-xl font-bold">{stat.totalPoints}</div>
                        </Card>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-6">
                  <h3 className="font-semibold mb-4">Points Comparison</h3>
                  <ResponsiveContainer width="100%" height={250}>
                    <BarChart data={memberStats}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="weeklyPoints" fill="#6366f1" name="Weekly Points" />
                      <Bar dataKey="monthlyPoints" fill="#8b5cf6" name="Monthly Points" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
