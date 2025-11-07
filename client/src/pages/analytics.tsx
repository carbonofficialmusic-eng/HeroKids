import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { TrendingUp, Users, Trophy, CheckCircle2, Lock, ArrowLeft } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { Link } from "wouter";

interface AnalyticsData {
  completionRate: number;
  pointsTrend: Array<{ date: string; points: number }>;
  topPerformers: Array<{
    id: string;
    name: string;
    monthlyPoints: number;
    totalPoints: number;
    color: string;
  }>;
  recentActivity: Array<{
    memberName: string;
    pointsEarned: number;
    completedAt: Date;
  }>;
  stats: {
    totalPoints: number;
    totalMembers: number;
    totalTasksCompleted: number;
    totalTasksAssigned: number;
  };
}

export default function Analytics() {
  const { user } = useAuth();
  const { toast } = useToast();

  const { data: analytics, isLoading, error } = useQuery<AnalyticsData>({
    queryKey: ["/api/analytics"],
    enabled: !!user,
  });

  if (isLoading) {
    return (
      <div className="container mx-auto p-6">
        <Link href="/">
          <Button variant="ghost" size="sm" className="mb-4" data-testid="button-back-dashboard">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Dashboard
          </Button>
        </Link>
        <div className="flex items-center justify-center min-h-[60vh]" data-testid="loading-analytics">
          <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
        </div>
      </div>
    );
  }

  if (error) {
    const errorMessage = (error as any)?.message || "Unknown error";
    
    // Check if it's a tier restriction error
    if (errorMessage.includes("Family tier")) {
      return (
        <div className="container mx-auto p-6 max-w-4xl">
          <Link href="/">
            <Button variant="ghost" size="sm" className="mb-4" data-testid="button-back-dashboard">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Dashboard
            </Button>
          </Link>
          <Card className="border-2" data-testid="card-upgrade-prompt">
            <CardHeader className="text-center">
              <div className="mx-auto mb-4 w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                <Lock className="w-8 h-8 text-primary" />
              </div>
              <CardTitle className="text-2xl">Analytics Dashboard</CardTitle>
              <CardDescription>
                Track your family's progress with detailed analytics
              </CardDescription>
            </CardHeader>
            <CardContent className="text-center space-y-4">
              <p className="text-muted-foreground">
                Analytics is available for Family tier and above. Upgrade to unlock:
              </p>
              <ul className="text-left inline-block space-y-2">
                <li className="flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-primary" />
                  <span>Points trends over time</span>
                </li>
                <li className="flex items-center gap-2">
                  <Trophy className="w-4 h-4 text-primary" />
                  <span>Top performers leaderboard</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-primary" />
                  <span>Task completion rates</span>
                </li>
                <li className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-primary" />
                  <span>Family performance insights</span>
                </li>
              </ul>
              <div className="pt-4">
                <p className="text-sm text-muted-foreground mb-2">
                  Upgrade to <strong>Family tier ($3/month)</strong> or higher
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      );
    }

    // Other errors - show error state
    return (
      <div className="container mx-auto p-6">
        <Link href="/">
          <Button variant="ghost" size="sm" className="mb-4" data-testid="button-back-dashboard">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Dashboard
          </Button>
        </Link>
        <Card className="border-destructive">
          <CardHeader>
            <CardTitle>Error Loading Analytics</CardTitle>
            <CardDescription>{errorMessage}</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  if (!analytics) {
    return null;
  }

  return (
    <div className="container mx-auto p-6 space-y-6" data-testid="page-analytics">
      <div>
        <Link href="/">
          <Button variant="ghost" size="sm" className="mb-4" data-testid="button-back-dashboard">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Dashboard
          </Button>
        </Link>
        <h1 className="text-3xl font-bold mb-2" data-testid="heading-analytics">
          Analytics Dashboard
        </h1>
        <p className="text-muted-foreground">
          Track your family's performance and progress
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card data-testid="card-total-points">
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Points Earned</CardTitle>
            <Trophy className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-total-points">
              {analytics.stats.totalPoints.toLocaleString()}
            </div>
          </CardContent>
        </Card>

        <Card data-testid="card-completion-rate">
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completion Rate</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-completion-rate">
              {analytics.completionRate}%
            </div>
            <p className="text-xs text-muted-foreground">
              {analytics.stats.totalTasksCompleted} of {analytics.stats.totalTasksAssigned} tasks
            </p>
          </CardContent>
        </Card>

        <Card data-testid="card-tasks-completed">
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tasks Completed</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-tasks-completed">
              {analytics.stats.totalTasksCompleted}
            </div>
          </CardContent>
        </Card>

        <Card data-testid="card-family-members">
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Family Members</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-family-members">
              {analytics.stats.totalMembers}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Points Trend Chart */}
      <Card data-testid="card-points-trend">
        <CardHeader>
          <CardTitle>Points Earned Over Time</CardTitle>
          <CardDescription>Daily points earned by your family (last 30 days)</CardDescription>
        </CardHeader>
        <CardContent>
          {analytics.pointsTrend.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={analytics.pointsTrend}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis 
                  dataKey="date" 
                  tickFormatter={(date) => format(new Date(date), "MMM d")}
                  className="text-xs"
                />
                <YAxis className="text-xs" />
                <Tooltip 
                  labelFormatter={(date) => format(new Date(date as string), "MMM d, yyyy")}
                  formatter={(value) => [`${value} points`, "Points"]}
                />
                <Line 
                  type="monotone" 
                  dataKey="points" 
                  stroke="hsl(var(--primary))" 
                  strokeWidth={2}
                  dot={{ fill: "hsl(var(--primary))" }}
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[300px] flex items-center justify-center text-muted-foreground">
              <p>No activity data yet. Complete tasks to see trends!</p>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Top Performers */}
        <Card data-testid="card-top-performers">
          <CardHeader>
            <CardTitle>Top Performers This Month</CardTitle>
            <CardDescription>Family members ranked by monthly points</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {analytics.topPerformers.slice(0, 5).map((member, index) => (
                <div 
                  key={member.id} 
                  className="flex items-center gap-4"
                  data-testid={`performer-${index}`}
                >
                  <div className="flex items-center justify-center w-8 h-8 rounded-full bg-muted text-sm font-bold">
                    {index + 1}
                  </div>
                  <div 
                    className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold"
                    style={{ backgroundColor: member.color }}
                  >
                    {member.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1">
                    <p className="font-medium" data-testid={`text-performer-name-${index}`}>
                      {member.name}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {member.monthlyPoints} points this month
                    </p>
                  </div>
                  {index === 0 && (
                    <Badge variant="default" data-testid="badge-top-performer">
                      <Trophy className="w-3 h-3 mr-1" />
                      #1
                    </Badge>
                  )}
                </div>
              ))}
              {analytics.topPerformers.length === 0 && (
                <p className="text-center text-muted-foreground py-8">
                  No activity yet this month
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <Card data-testid="card-recent-activity">
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
            <CardDescription>Latest task completions</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {analytics.recentActivity.map((activity, index) => (
                <div 
                  key={index} 
                  className="flex items-center justify-between"
                  data-testid={`activity-${index}`}
                >
                  <div className="flex items-center gap-3">
                    <CheckCircle2 className="w-4 h-4 text-green-500" />
                    <div>
                      <p className="font-medium text-sm" data-testid={`text-activity-member-${index}`}>
                        {activity.memberName}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(activity.completedAt), "MMM d, h:mm a")}
                      </p>
                    </div>
                  </div>
                  <Badge variant="secondary" data-testid={`badge-activity-points-${index}`}>
                    +{activity.pointsEarned} pts
                  </Badge>
                </div>
              ))}
              {analytics.recentActivity.length === 0 && (
                <p className="text-center text-muted-foreground py-8">
                  No recent activity
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
