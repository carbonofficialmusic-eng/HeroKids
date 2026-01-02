import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Trophy,
  ArrowLeft,
  Gift,
  Star,
  Flame,
  TrendingUp,
  Award,
  Sparkles,
} from "lucide-react";
import { Link } from "wouter";
import { useTranslation } from "react-i18next";
import type { User, FamilyMember } from "@shared/schema";

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

function getAchievementIcon(type: string) {
  switch (type) {
    case "first_weekly_finisher":
      return Star;
    case "perfect_week":
      return Award;
    case "weekly_leaderboard":
      return Trophy;
    case "lifetime_milestone":
      return TrendingUp;
    case "task_streak":
      return Flame;
    default:
      return Gift;
  }
}

function getAchievementColor(type: string) {
  switch (type) {
    case "first_weekly_finisher":
      return "from-amber-500/20 to-yellow-500/20 border-amber-500/30";
    case "perfect_week":
      return "from-green-500/20 to-emerald-500/20 border-green-500/30";
    case "weekly_leaderboard":
      return "from-purple-500/20 to-pink-500/20 border-purple-500/30";
    case "lifetime_milestone":
      return "from-blue-500/20 to-cyan-500/20 border-blue-500/30";
    case "task_streak":
      return "from-orange-500/20 to-red-500/20 border-orange-500/30";
    default:
      return "from-purple-500/20 to-pink-500/20 border-purple-500/30";
  }
}

function getIconColor(type: string) {
  switch (type) {
    case "first_weekly_finisher":
      return "text-amber-500 bg-amber-500/20";
    case "perfect_week":
      return "text-green-500 bg-green-500/20";
    case "weekly_leaderboard":
      return "text-purple-500 bg-purple-500/20";
    case "lifetime_milestone":
      return "text-blue-500 bg-blue-500/20";
    case "task_streak":
      return "text-orange-500 bg-orange-500/20";
    default:
      return "text-purple-500 bg-purple-500/20";
  }
}

export default function MyAchievements() {
  const { t } = useTranslation();

  const { data: authUser } = useQuery<User>({
    queryKey: ["/api/auth/user"],
  });

  const { data: member } = useQuery<FamilyMember>({
    queryKey: ["/api/family-members/current"],
    enabled: !!authUser,
  });

  const { data: achievements = [] } = useQuery<AchievementDefinition[]>({
    queryKey: ["/api/achievements"],
    enabled: !!member,
  });

  const activeAchievements = achievements
    .filter(a => a.isActive)
    .sort((a, b) => {
      const order: Record<string, number> = {
        "perfect_week": 0,
        "first_weekly_finisher": 1,
        "weekly_leaderboard": 2,
        "task_streak": 3,
        "lifetime_milestone": 4,
      };
      const orderDiff = (order[a.type] ?? 99) - (order[b.type] ?? 99);
      if (orderDiff !== 0) return orderDiff;
      return a.slug.localeCompare(b.slug);
    });

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 p-4 pb-20">
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="flex items-center gap-4">
          <Link href={member?.role === "parent" ? "/" : "/kid-dashboard"}>
            <button className="p-2 rounded-full bg-card/80 backdrop-blur-md" data-testid="button-back">
              <ArrowLeft className="h-6 w-6" />
            </button>
          </Link>
          <h1 className="text-2xl font-bold font-accent" style={{ fontFamily: "Fredoka, sans-serif" }}>
            {t("myAchievements.title")}
          </h1>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          <Card className="p-6 bg-gradient-to-br from-purple-500/10 to-pink-500/10 border border-purple-500/20 rounded-2xl">
            <div className="flex items-center gap-4">
              <div className="p-4 rounded-2xl bg-purple-500/20">
                <Trophy className="h-10 w-10 text-purple-500" />
              </div>
              <div>
                <h2 className="text-xl font-bold" style={{ fontFamily: "Fredoka, sans-serif" }}>
                  {t("myAchievements.allAchievements")}
                </h2>
                <p className="text-muted-foreground">
                  {t("myAchievements.achievementsCount", { count: activeAchievements.length })}
                </p>
              </div>
              <Sparkles className="h-6 w-6 text-purple-500 ml-auto animate-pulse" />
            </div>
          </Card>
        </motion.div>

        <div className="space-y-4">
          {activeAchievements.length === 0 ? (
            <Card className="p-8 text-center bg-card/80 backdrop-blur-md rounded-2xl">
              <Gift className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
              <p className="text-lg text-muted-foreground">{t("myAchievements.noAchievements")}</p>
            </Card>
          ) : (
            activeAchievements.map((achievement, index) => {
              const Icon = getAchievementIcon(achievement.type);
              const colorClass = getAchievementColor(achievement.type);
              const iconColorClass = getIconColor(achievement.type);
              
              return (
                <motion.div
                  key={achievement.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                >
                  <Card className={`p-5 bg-gradient-to-br ${colorClass} border rounded-2xl`}>
                    <div className="flex items-start gap-4">
                      <div className={`p-3 rounded-xl ${iconColorClass} flex-shrink-0`}>
                        <Icon className="h-7 w-7" />
                      </div>
                      <div className="flex-1 min-w-0 space-y-2">
                        <h3 className="font-bold text-lg" style={{ fontFamily: "Fredoka, sans-serif" }}>
                          {achievement.title}
                        </h3>
                        <p className="text-sm text-muted-foreground">
                          {t(`achievements.desc_${achievement.slug}`)}
                        </p>
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge variant="secondary" className="gap-1.5">
                            {achievement.rewardType === "custom" && achievement.customReward ? (
                              <>
                                <Gift className="h-3.5 w-3.5" />
                                {achievement.customReward}
                              </>
                            ) : (
                              <>
                                <Star className="h-3.5 w-3.5" />
                                +{achievement.bonusPoints} {t("points")}
                              </>
                            )}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  </Card>
                </motion.div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
