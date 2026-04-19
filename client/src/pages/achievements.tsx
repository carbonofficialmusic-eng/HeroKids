import { useState, useEffect, useRef, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { ChevronLeft, Trophy, Star, Award, TrendingUp, Flame, History, Sparkles, Gift, Coins } from "lucide-react";
import { useLocation } from "wouter";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import type { FamilyMember } from "@shared/schema";

// Debounced input component for text fields
function DebouncedInput({ 
  value, 
  onChange, 
  delay = 800,
  ...props 
}: { 
  value: string; 
  onChange: (value: string) => void; 
  delay?: number;
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange'>) {
  const [localValue, setLocalValue] = useState(value);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setLocalValue(newValue);
    
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    
    timeoutRef.current = setTimeout(() => {
      onChange(newValue);
    }, delay);
  }, [onChange, delay]);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return <Input value={localValue} onChange={handleChange} {...props} />;
}

// Debounced number input component
function DebouncedNumberInput({ 
  value, 
  onChange, 
  delay = 800,
  ...props 
}: { 
  value: number; 
  onChange: (value: number) => void; 
  delay?: number;
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value'>) {
  const [localValue, setLocalValue] = useState(String(value));
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    setLocalValue(String(value));
  }, [value]);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setLocalValue(newValue);
    
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    
    timeoutRef.current = setTimeout(() => {
      const numValue = parseInt(newValue) || 0;
      onChange(numValue);
    }, delay);
  }, [onChange, delay]);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return <Input type="number" value={localValue} onChange={handleChange} {...props} />;
}

interface AchievementDefinition {
  id: string;
  familyName: string;
  type: "first_weekly_finisher" | "weekly_leaderboard" | "perfect_week" | "lifetime_milestone" | "task_streak";
  slug: string;
  title: string;
  description: string;
  bonusPoints: number;
  rewardType: "points" | "custom";
  customReward: string | null;
  isActive: boolean;
  config: Record<string, any>;
}

interface AchievementAward {
  id: string;
  achievementDefinitionId: string;
  memberId: string;
  bonusPoints: number;
  rewardType: "points" | "custom";
  customReward: string | null;
  awardedAt: Date;
  achievementDefinition: AchievementDefinition;
  member: {
    displayName: string;
    color: string;
  };
}

export default function Achievements() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  // Fetch current family member
  const { data: member } = useQuery<FamilyMember>({
    queryKey: ["/api/family-members/current"],
    enabled: !!user,
  });

  // Fetch real user's member record (to determine permissions)
  const { data: realMember } = useQuery<FamilyMember>({
    queryKey: ["/api/family-members/real"],
    enabled: !!user,
  });

  // Fetch achievement definitions
  const { data: achievements = [], isLoading } = useQuery<AchievementDefinition[]>({
    queryKey: ["/api/achievements"],
    enabled: !!member,
  });

  // Fetch achievement awards
  const { data: awards = [], isLoading: awardsLoading } = useQuery<AchievementAward[]>({
    queryKey: ["/api/achievements/awards"],
    enabled: !!member,
  });

  // Seed default achievements mutation
  const seedAchievementsMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("POST", "/api/achievements/seed", {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/achievements"] });
      toast({
        title: t("achievements.seeded"),
        description: t("achievements.seededSuccessfully"),
      });
    },
    onError: (error: any) => {
      toast({
        title: t("error"),
        description: error?.message || t("achievements.failedToSeed"),
        variant: "destructive",
      });
    },
  });

  // Update achievement mutation with optimistic updates for instant UI response
  const updateAchievementMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<AchievementDefinition> }) => {
      return await apiRequest("PATCH", `/api/achievements/${id}`, data);
    },
    onMutate: async ({ id, data }) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: ["/api/achievements"] });
      
      // Snapshot previous value
      const previousAchievements = queryClient.getQueryData<AchievementDefinition[]>(["/api/achievements"]);
      
      // Optimistically update the cache immediately
      queryClient.setQueryData<AchievementDefinition[]>(["/api/achievements"], (old) => {
        if (!old) return old;
        return old.map((achievement) =>
          achievement.id === id ? { ...achievement, ...data } : achievement
        );
      });
      
      return { previousAchievements };
    },
    onError: (_error, _variables, context) => {
      // Rollback on error
      if (context?.previousAchievements) {
        queryClient.setQueryData(["/api/achievements"], context.previousAchievements);
      }
      toast({
        title: t("error"),
        description: t("achievements.failedToUpdate"),
        variant: "destructive",
      });
    },
    onSettled: () => {
      // Refetch after mutation settles to ensure sync
      queryClient.invalidateQueries({ queryKey: ["/api/achievements"] });
    },
  });

  const isParent = realMember?.role === "parent";

  if (!isParent) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardHeader>
            <CardTitle>{t("achievements.accessDenied")}</CardTitle>
            <CardDescription>
              {t("achievements.onlyParents")}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => setLocation("/dashboard")} className="w-full" data-testid="button-back">
              {t("goBack")}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const getAchievementIcon = (type: string) => {
    switch (type) {
      case "first_weekly_finisher":
        return <Star className="h-5 w-5" />;
      case "weekly_leaderboard":
        return <Trophy className="h-5 w-5" />;
      case "perfect_week":
        return <Award className="h-5 w-5" />;
      case "lifetime_milestone":
        return <TrendingUp className="h-5 w-5" />;
      case "task_streak":
        return <Flame className="h-5 w-5" />;
      default:
        return <Trophy className="h-5 w-5" />;
    }
  };

  return (
    <div className="min-h-screen p-4 md:p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button
            variant="outline"
            size="icon"
            onClick={() => setLocation("/")}
            data-testid="button-back"
            className="bg-card/90 backdrop-blur-sm border-border"
          >
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <Trophy className="h-8 w-8 text-primary" />
              {t("achievements.title")}
            </h1>
            <p className="text-muted-foreground">
              {t("achievements.subtitle")}
            </p>
          </div>
        </div>

        {/* Tabs for Configuration and History */}
        <Tabs defaultValue="configure" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="configure" data-testid="tab-configure">
              <Trophy className="h-4 w-4 mr-2" />
              {t("achievements.configure")}
            </TabsTrigger>
            <TabsTrigger value="history" data-testid="tab-history">
              <History className="h-4 w-4 mr-2" />
              {t("achievements.awardHistory")}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="configure" className="space-y-4 mt-6">
            {isLoading ? (
              <div className="text-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
              </div>
            ) : (
              <div className="space-y-4">
            {[...achievements].sort((a, b) => {
              const typeOrder: Record<string, number> = {
                "perfect_week": 0,
                "weekly_leaderboard": 1,
                "first_weekly_finisher": 2,
                "lifetime_milestone": 3,
                "task_streak": 4,
              };
              const typeDiff = (typeOrder[a.type] ?? 99) - (typeOrder[b.type] ?? 99);
              if (typeDiff !== 0) return typeDiff;
              // For lifetime_milestone: sort by threshold ascending (500, 1000, 2000)
              if (a.type === "lifetime_milestone" && b.type === "lifetime_milestone") {
                const aThreshold = (a.config as any)?.threshold ?? 0;
                const bThreshold = (b.config as any)?.threshold ?? 0;
                return aThreshold - bThreshold;
              }
              // For task_streak: sort by days ascending (7, 14, 30)
              if (a.type === "task_streak" && b.type === "task_streak") {
                const aDays = (a.config as any)?.days ?? 0;
                const bDays = (b.config as any)?.days ?? 0;
                return aDays - bDays;
              }
              return a.slug.localeCompare(b.slug);
            }).map((achievement) => (
              <Card 
                key={achievement.id} 
                data-testid={`achievement-card-${achievement.slug}`}
                className={!achievement.isActive ? "opacity-60" : ""}
              >
                <CardHeader>
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3 flex-1">
                      <div className="p-3 rounded-lg bg-primary/10 text-primary mt-1 flex-shrink-0">
                        {getAchievementIcon(achievement.type)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2">
                          <CardTitle className="text-lg">{t(`achievements.title_${achievement.slug}`)}</CardTitle>
                          {!achievement.isActive && (
                            <Badge variant="secondary" className="text-xs">
                              {t("achievements.inactive")}
                            </Badge>
                          )}
                        </div>
                        <CardDescription className="mt-1">
                          {t(`achievements.desc_${achievement.slug}`)}
                        </CardDescription>
                      </div>
                    </div>
                    <Switch
                      checked={achievement.isActive}
                      onCheckedChange={(checked) => {
                        updateAchievementMutation.mutate({
                          id: achievement.id,
                          data: { isActive: checked },
                        });
                      }}
                      data-testid={`switch-${achievement.slug}-active`}
                    />
                  </div>
                </CardHeader>
                <CardContent className="min-h-[140px]">
                  <div className="space-y-4">
                    {/* Reward Type Selection */}
                    <div>
                      <Label className="text-sm font-medium mb-3 block">
                        {t("achievements.rewardType")}
                      </Label>
                      <RadioGroup
                        value={achievement.rewardType || "points"}
                        onValueChange={(value: "points" | "custom") => {
                          updateAchievementMutation.mutate({
                            id: achievement.id,
                            data: { rewardType: value },
                          });
                        }}
                        disabled={!achievement.isActive}
                        className="flex gap-4"
                        data-testid={`radio-${achievement.slug}-reward-type`}
                      >
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="points" id={`points-${achievement.id}`} />
                          <Label htmlFor={`points-${achievement.id}`} className="flex items-center gap-1 cursor-pointer">
                            <Coins className="h-4 w-4 text-primary" />
                            {t("achievements.rewardTypePoints")}
                          </Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="custom" id={`custom-${achievement.id}`} />
                          <Label htmlFor={`custom-${achievement.id}`} className="flex items-center gap-1 cursor-pointer">
                            <Gift className="h-4 w-4 text-primary" />
                            {t("achievements.rewardTypeCustom")}
                          </Label>
                        </div>
                      </RadioGroup>
                    </div>

                    {/* Points Input (shown when reward type is points) */}
                    {(achievement.rewardType === "points" || !achievement.rewardType) && (
                      <div className="flex items-center gap-4">
                        <div className="flex-1">
                          <Label htmlFor={`bonus-${achievement.id}`} className="text-sm font-medium">
                            {t("achievements.bonusPoints")}
                          </Label>
                          <div className="flex items-center gap-2 mt-2">
                            <DebouncedNumberInput
                              id={`bonus-${achievement.id}`}
                              min={0}
                              step={10}
                              value={achievement.bonusPoints}
                              onChange={(value) => {
                                updateAchievementMutation.mutate({
                                  id: achievement.id,
                                  data: { bonusPoints: value },
                                });
                              }}
                              disabled={!achievement.isActive}
                              className="w-32"
                              data-testid={`input-${achievement.slug}-bonus`}
                            />
                            <span className="text-sm text-muted-foreground">{t("points")}</span>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-3xl font-bold text-primary">+{achievement.bonusPoints}</div>
                          <div className="text-xs text-muted-foreground uppercase tracking-wide mt-1">
                            {t("achievements.reward")}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Custom Reward Input (shown when reward type is custom) */}
                    {achievement.rewardType === "custom" && (
                      <div className="flex items-center gap-4">
                        <div className="flex-1">
                          <Label htmlFor={`custom-reward-${achievement.id}`} className="text-sm font-medium">
                            {t("achievements.customRewardLabel")}
                          </Label>
                          <DebouncedInput
                            id={`custom-reward-${achievement.id}`}
                            type="text"
                            placeholder={t("achievements.customRewardPlaceholder")}
                            value={achievement.customReward || ""}
                            delay={2000}
                            onChange={(value) => {
                              updateAchievementMutation.mutate({
                                id: achievement.id,
                                data: { customReward: value },
                              });
                            }}
                            disabled={!achievement.isActive}
                            className="mt-2"
                            data-testid={`input-${achievement.slug}-custom-reward`}
                          />
                        </div>
                        <div className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Gift className="h-6 w-6 text-primary" />
                          </div>
                          <div className="text-xs text-muted-foreground uppercase tracking-wide mt-1">
                            {t("achievements.customReward")}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}

                {achievements.length === 0 && (
                  <Card>
                    <CardContent className="py-12 text-center space-y-6">
                      <div className="flex justify-center">
                        <div className="rounded-full bg-primary/10 p-6">
                          <Sparkles className="h-12 w-12 text-primary" />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <h3 className="text-xl font-semibold">{t("achievements.noAchievements")}</h3>
                        <p className="text-muted-foreground max-w-md mx-auto">
                          {t("achievements.startWithDefaults")}
                        </p>
                      </div>
                      <Button 
                        onClick={() => seedAchievementsMutation.mutate()}
                        disabled={seedAchievementsMutation.isPending}
                        size="lg"
                        data-testid="button-seed-achievements"
                        className="mx-auto"
                      >
                        {seedAchievementsMutation.isPending ? (
                          <>
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-background mr-2"></div>
                            {t("achievements.creating")}
                          </>
                        ) : (
                          <>
                            <Sparkles className="h-4 w-4 mr-2" />
                            {t("achievements.createDefaults")}
                          </>
                        )}
                      </Button>
                    </CardContent>
                  </Card>
                )}
              </div>
            )}
          </TabsContent>

          <TabsContent value="history" className="space-y-4 mt-6">
            {awardsLoading ? (
              <div className="text-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
              </div>
            ) : awards.length > 0 ? (
              <div className="space-y-2">
                {awards.map((award) => (
                  <Card key={award.id} data-testid={`award-${award.id}`}>
                    <CardContent className="py-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="p-2 rounded-lg bg-primary/10 text-primary">
                            {award.rewardType === "custom" ? <Gift className="h-5 w-5" /> : <Trophy className="h-5 w-5" />}
                          </div>
                          <div>
                            <div className="font-medium">{award.achievementDefinition.title}</div>
                            <div className="text-sm text-muted-foreground">
                              {t("achievements.earnedBy")} <span className="font-medium" style={{ color: award.member.color }}>{award.member.displayName}</span>
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          {award.rewardType === "custom" && award.customReward ? (
                            <div className="text-sm font-medium text-primary flex items-center gap-1 justify-end">
                              <Gift className="h-4 w-4" />
                              {award.customReward}
                            </div>
                          ) : (
                            <div className="text-lg font-bold text-primary">+{award.bonusPoints}</div>
                          )}
                          <div className="text-xs text-muted-foreground">
                            {format(new Date(award.awardedAt), "MMM d, yyyy")}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <Card>
                <CardContent className="py-12 text-center">
                  <History className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">{t("achievements.noAwards")}</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>

        {/* Info Card */}
        <Card className="bg-muted/50">
          <CardHeader>
            <CardTitle className="text-base">{t("achievements.howItWorks")}</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-2">
            <p>
              {t("achievements.howItWorksDesc")}
            </p>
            <ul className="list-disc list-inside space-y-1 mt-2">
              <li>{t("achievements.firstWeeklyFinisher")}</li>
              <li>{t("achievements.weeklyLeaderboard")}</li>
              <li>{t("achievements.perfectWeek")}</li>
              <li>{t("achievements.lifetimeMilestones")}</li>
              <li>{t("achievements.taskStreaks")}</li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
