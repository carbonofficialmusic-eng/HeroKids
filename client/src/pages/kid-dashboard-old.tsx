import { useState } from "react";
import { Link } from "wouter";
import { motion } from "framer-motion";
import confetti from "canvas-confetti";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";
import {
  Home,
  Gift,
  Palette,
  MessageCircle,
  Sparkles,
  Star,
  Trophy,
  Flame,
  Info,
  IceCream,
  Gamepad2,
  Film,
  Bike,
  CircleDot,
  BookOpen,
  UtensilsCrossed,
  Trash2,
  ArrowLeft,
  Zap,
  Crown,
  Target,
  Users,
  Send,
  Medal,
  Loader2,
} from "lucide-react";
import type { User, FamilyMember, Reward, Task, Family, RewardRedemption } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

// View Models for Kid Dashboard
interface RewardCardModel {
  id: string;
  title: string;
  description: string | null;
  pointCost: number;
  iconEmoji: string | null;
  percentage: number;
  remaining: number;
  isReady: boolean;
}

interface TaskQuestModel {
  id: string;
  title: string;
  points: number;
  iconEmoji: string | null;
  isCompleted: boolean;
  requiresApproval: boolean;
}

interface PendingRedemptionModel {
  id: string;
  title: string;
  pointCost: number;
  status: string;
}

// Helper: Map Reward to Card Model
function mapRewardToCard(reward: Reward, currentPoints: number): RewardCardModel {
  const percentage = Math.min((currentPoints / reward.pointThreshold) * 100, 100);
  const remaining = Math.max(reward.pointThreshold - currentPoints, 0);
  const isReady = currentPoints >= reward.pointThreshold;
  
  return {
    id: reward.id,
    title: reward.title,
    description: reward.description,
    pointCost: reward.pointThreshold,
    iconEmoji: null,
    percentage,
    remaining,
    isReady,
  };
}

// Helper: Map Task to Quest Model
function mapTaskToQuest(task: Task, member: FamilyMember): TaskQuestModel {
  return {
    id: task.id,
    title: task.title,
    points: task.points,
    iconEmoji: task.iconEmoji,
    isCompleted: task.completedMembers?.includes(member.id) || false,
    requiresApproval: task.requiresApproval,
  };
}

// Mock data for visual prototype (NO REAL API CALLS)
const MOCK_DATA = {
  memberName: "Max",
  currentPoints: 1247,
  totalEarned: 1247,
  streak: 3,
  availableDiscoveryCards: 15,
  activeSkin: {
    name: "Fire Phoenix",
  },
  nextSkinUnlock: {
    name: "Dino Pack",
    pointsNeeded: 1400,
  },
  rewards: [
    {
      id: 1,
      title: "Ice Cream Trip",
      description: "Eis essen gehen im Eiscafé",
      pointCost: 500,
      Icon: IceCream,
      imageUrl: null,
    },
    {
      id: 2,
      title: "Neues PlayStation-Spiel",
      description: "Minecraft Legends",
      pointCost: 1500,
      Icon: Gamepad2,
      imageUrl: null,
    },
    {
      id: 3,
      title: "Kino-Besuch",
      description: "Film deiner Wahl + Popcorn",
      pointCost: 800,
      Icon: Film,
      imageUrl: null,
    },
    {
      id: 4,
      title: "Neues Fahrrad",
      description: "Cooles BMX-Rad",
      pointCost: 2500,
      Icon: Bike,
      imageUrl: null,
    },
  ],
  pendingRewards: [
    {
      id: 1,
      title: "Basketball",
      pointCost: 500,
      Icon: CircleDot,
      status: "pending" as const,
    },
  ],
  tasks: [
    {
      id: 1,
      title: "Zimmer aufräumen",
      points: 25,
      progress: 50,
      Icon: Trash2,
      completed: false,
    },
    {
      id: 2,
      title: "20 Minuten lesen",
      points: 30,
      progress: 100,
      Icon: BookOpen,
      completed: true,
    },
    {
      id: 3,
      title: "Geschirr spülen",
      points: 15,
      progress: 0,
      Icon: UtensilsCrossed,
      completed: false,
    },
  ],
  leaderboard: [
    {
      id: 1,
      name: "Max",
      points: 450,
      rank: 1,
      isMe: true,
      avatar: "M",
      color: "from-amber-400 to-orange-500",
    },
    {
      id: 2,
      name: "Sarah",
      points: 380,
      rank: 2,
      isMe: false,
      avatar: "S",
      color: "from-pink-400 to-purple-500",
    },
    {
      id: 3,
      name: "Papa",
      points: 220,
      rank: 3,
      isMe: false,
      avatar: "P",
      color: "from-blue-400 to-cyan-500",
    },
  ],
  familyGoals: [
    {
      id: 1,
      title: "Familienurlaub",
      description: "Gemeinsam 2000 Punkte sammeln für einen Ausflug!",
      targetPoints: 2000,
      currentPoints: 1450,
      pointsPerMember: 100,
      contributedThisWeek: true,
      Icon: Target,
    },
  ],
  sharedRewards: [
    {
      id: 1,
      title: "Pizza-Abend",
      description: "Mit Geschwistern teilen",
      totalCost: 300,
      myShare: 100,
      participants: 3,
      joined: false,
      Icon: Gift,
    },
  ],
  chatMessages: [
    {
      id: 1,
      sender: "Mama",
      message: "Toll gemacht beim Lesen heute! 📚",
      time: "vor 5 Min",
      isMe: false,
    },
    {
      id: 2,
      sender: "Max",
      message: "Danke Mama! 😊",
      time: "vor 3 Min",
      isMe: true,
    },
    {
      id: 3,
      sender: "Sarah",
      message: "Wer will heute Fußball spielen?",
      time: "vor 1 Min",
      isMe: false,
    },
  ],
};

// Helper: Get generic icon for rewards (fallback until iconEmoji is implemented)
function getRewardIcon(title: string) {
  const lowerTitle = title.toLowerCase();
  if (lowerTitle.includes("eis") || lowerTitle.includes("ice")) return IceCream;
  if (lowerTitle.includes("spiel") || lowerTitle.includes("game")) return Gamepad2;
  if (lowerTitle.includes("kino") || lowerTitle.includes("film") || lowerTitle.includes("movie")) return Film;
  if (lowerTitle.includes("fahrrad") || lowerTitle.includes("bike")) return Bike;
  return Gift; // Default icon
}

// Get color based on progress percentage
function getProgressColor(percentage: number) {
  if (percentage >= 100) return "hsl(142 76% 36%)"; // Green
  if (percentage >= 71) return "hsl(142 69% 58%)"; // Light green
  if (percentage >= 31) return "hsl(38 92% 50%)"; // Orange
  return "hsl(0 72% 51%)"; // Red
}

function RewardCard({
  reward,
  currentPoints,
  onComingSoon,
}: {
  reward: typeof MOCK_DATA.rewards[0];
  currentPoints: number;
  onComingSoon: () => void;
}) {
  const [showDetails, setShowDetails] = useState(false);
  const { percentage, remaining, isReady } = getRewardProgress(currentPoints, reward.pointCost);
  const progressColor = getProgressColor(percentage);
  const RewardIcon = reward.Icon;

  const handleRequestClick = () => {
    if (isReady) {
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 }
      });
    }
    onComingSoon();
  };

  return (
    <>
      <motion.div
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        transition={{ type: "spring", stiffness: 300, damping: 20 }}
      >
        <Card className={`p-4 transition-all bg-card/80 backdrop-blur-md border-2 rounded-2xl ${
          isReady ? "ring-4 ring-primary shadow-2xl border-primary" : "border-border"
        }`}>
          <div className="flex items-center gap-4">
            <div className={`flex-shrink-0 p-3 rounded-2xl ${
              isReady ? "bg-primary/20" : "bg-primary/10"
            }`}>
              <RewardIcon className="h-12 w-12 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-2">
                <h3 className="font-bold text-xl" style={{ fontFamily: "Fredoka, sans-serif" }}>
                  {reward.title}
                </h3>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setShowDetails(true)}
                  className="h-8 w-8 rounded-full"
                  data-testid={`button-info-reward-${reward.id}`}
                >
                  <Info className="h-5 w-5 text-primary" />
                </Button>
              </div>
              
              <Progress value={percentage} className="h-5 rounded-full mb-1" />
              
              {!isReady && (
                <p className="text-sm text-muted-foreground flex items-center gap-1">
                  <Zap className="h-4 w-4 text-amber-500" />
                  Noch <span className="font-bold">{remaining} Punkte</span>!
                </p>
              )}
              {isReady && (
                <p className="text-sm font-bold text-green-500 flex items-center gap-1">
                  <Sparkles className="h-4 w-4" />
                  Bereit zum Anfragen!
                </p>
              )}
            </div>
            <div className="flex-shrink-0">
              <Button
                variant={isReady ? "default" : "outline"}
                size="default"
                onClick={handleRequestClick}
                className="h-11 px-5 text-base font-bold rounded-2xl"
                data-testid={`button-request-reward-${reward.id}`}
              >
                {isReady ? (
                  <>
                    <Gift className="h-5 w-5 mr-2" />
                    Jetzt!
                  </>
                ) : (
                  <>
                    <Trophy className="h-4 w-4 mr-2" />
                    Sammeln
                  </>
                )}
              </Button>
            </div>
          </div>
        </Card>
      </motion.div>

      {/* Details Dialog */}
      <AlertDialog open={showDetails} onOpenChange={setShowDetails}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-3 text-2xl" style={{ fontFamily: "Fredoka, sans-serif" }}>
              <div className="p-3 bg-primary/10 rounded-2xl">
                <RewardIcon className="h-10 w-10 text-primary" />
              </div>
              {reward.title}
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-4 pt-4">
              {reward.description && (
                <div className="text-base text-foreground">
                  <p className="font-semibold mb-1">Beschreibung:</p>
                  <p>{reward.description}</p>
                </div>
              )}
              
              <div className="space-y-2">
                <div className="flex justify-between items-center p-3 bg-muted/50 rounded-xl">
                  <span className="font-semibold">Benötigte Punkte:</span>
                  <Badge variant="secondary" className="text-lg font-bold px-3 py-1">
                    {reward.pointCost}
                  </Badge>
                </div>
                
                <div className="flex justify-between items-center p-3 bg-muted/50 rounded-xl">
                  <span className="font-semibold">Deine Punkte:</span>
                  <Badge variant="secondary" className="text-lg font-bold px-3 py-1">
                    {currentPoints}
                  </Badge>
                </div>
                
                <div className="p-3 bg-muted/50 rounded-xl">
                  <div className="flex justify-between items-center mb-2">
                    <span className="font-semibold">Fortschritt:</span>
                    <span className="text-lg font-bold" style={{ color: progressColor }}>
                      {Math.round(percentage)}%
                    </span>
                  </div>
                  <Progress value={percentage} className="h-4 rounded-full" />
                </div>
                
                {!isReady && (
                  <div className="p-3 bg-amber-50 dark:bg-amber-950/30 rounded-xl border border-amber-200 dark:border-amber-800">
                    <p className="text-base font-bold flex items-center gap-2">
                      <Zap className="h-5 w-5 text-amber-500" />
                      Noch {remaining} Punkte bis zur Belohnung!
                    </p>
                  </div>
                )}
                
                {isReady && (
                  <div className="p-3 bg-green-50 dark:bg-green-950/30 rounded-xl border border-green-200 dark:border-green-800">
                    <p className="text-base font-bold flex items-center gap-2 text-green-600 dark:text-green-400">
                      <Sparkles className="h-5 w-5" />
                      Du kannst diese Belohnung jetzt anfragen!
                    </p>
                  </div>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction data-testid="button-close-details">Schließen</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function RewardRunway({
  rewards,
  currentPoints,
  pendingRewards,
  onComingSoon,
}: {
  rewards: typeof MOCK_DATA.rewards;
  currentPoints: number;
  pendingRewards: typeof MOCK_DATA.pendingRewards;
  onComingSoon: () => void;
}) {
  // Sort rewards: ready first, then by proximity
  const sortedRewards = [...rewards].sort((a, b) => {
    const aProgress = getRewardProgress(currentPoints, a.pointCost);
    const bProgress = getRewardProgress(currentPoints, b.pointCost);

    // Ready rewards first
    if (aProgress.isReady && !bProgress.isReady) return -1;
    if (!aProgress.isReady && bProgress.isReady) return 1;

    // Then by proximity (least remaining points first)
    return aProgress.remaining - bProgress.remaining;
  });

  const topRewards = sortedRewards.slice(0, 3);
  const hasMore = sortedRewards.length > 3;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-3 bg-gradient-to-br from-amber-400 to-orange-500 rounded-2xl">
          <Trophy className="h-8 w-8 text-white" />
        </div>
        <h2 className="text-4xl font-bold" style={{ fontFamily: "Fredoka, sans-serif" }}>
          Deine Belohnungen!
        </h2>
        <Sparkles className="h-6 w-6 text-amber-500 animate-pulse" />
      </div>

      <div className="space-y-4">
        {topRewards.map((reward, index) => (
          <motion.div
            key={reward.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
          >
            <RewardCard reward={reward} currentPoints={currentPoints} onComingSoon={onComingSoon} />
          </motion.div>
        ))}
      </div>

      {hasMore && (
        <Button
          variant="outline"
          size="lg"
          className="w-full h-14 text-lg font-bold rounded-2xl"
          onClick={onComingSoon}
          data-testid="button-show-all-rewards"
        >
          Alle Belohnungen anzeigen ({sortedRewards.length - 3} weitere)
        </Button>
      )}

      {pendingRewards.length > 0 && (
        <Card className="p-6 bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/30 backdrop-blur-md rounded-2xl border-2 border-amber-300">
          <h3 className="font-bold text-xl mb-4 flex items-center gap-2" style={{ fontFamily: "Fredoka, sans-serif" }}>
            <Trophy className="h-6 w-6 text-amber-500 animate-bounce" />
            Wartet auf Freigabe
          </h3>
          <div className="space-y-3">
            {pendingRewards.map((pending) => {
              const PendingIcon = pending.Icon;
              return (
                <div key={pending.id} className="flex items-center gap-3 text-base bg-white/50 dark:bg-black/20 p-3 rounded-xl">
                  <PendingIcon className="h-6 w-6" />
                  <span className="font-bold">{pending.title}</span>
                  <span className="text-muted-foreground">({pending.pointCost} Punkte)</span>
                  <Badge variant="secondary" className="ml-auto text-sm font-bold">
                    ⏳ Wartet
                  </Badge>
                </div>
              );
            })}
          </div>
        </Card>
      )}
    </div>
  );
}

function StyleBonusPanel({
  activeSkin,
  availableCards,
  nextUnlock,
  currentPoints,
  onComingSoon,
}: {
  activeSkin: typeof MOCK_DATA.activeSkin;
  availableCards: number;
  nextUnlock: typeof MOCK_DATA.nextSkinUnlock;
  currentPoints: number;
  onComingSoon: () => void;
}) {
  const remaining = Math.max(nextUnlock.pointsNeeded - currentPoints, 0);

  return (
    <Card className="p-4 bg-card/80 backdrop-blur-md border-2 rounded-2xl">
      <h3 className="font-bold text-xl mb-3 flex items-center gap-2" style={{ fontFamily: "Fredoka, sans-serif" }}>
        <div className="p-2 bg-gradient-to-br from-pink-400 to-purple-500 rounded-xl">
          <Palette className="h-5 w-5 text-white" />
        </div>
        Style Bonus
      </h3>
      <div className="space-y-3">
        <div className="flex items-center gap-2 p-2 bg-gradient-to-r from-orange-50 to-red-50 dark:from-orange-950/30 dark:to-red-950/30 rounded-xl border border-orange-200 dark:border-orange-800">
          <motion.div
            animate={{ rotate: [0, 10, -10, 0] }}
            transition={{ repeat: Infinity, duration: 2 }}
          >
            <Flame className="h-8 w-8 text-orange-500" />
          </motion.div>
          <div>
            <p className="font-bold text-sm">Aktueller Skin:</p>
            <p className="text-base font-bold text-primary">{activeSkin.name}</p>
          </div>
        </div>
        <div className="flex items-center justify-between p-3 bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-950/30 dark:to-purple-950/30 rounded-xl border border-blue-200 dark:border-blue-800">
          <span className="font-bold text-sm">Discovery-Karten</span>
          <Badge variant="secondary" className="text-base px-3 py-1 font-bold rounded-xl">
            {availableCards}
          </Badge>
        </div>
        <div className="p-3 bg-muted/50 rounded-xl border-2 border-dashed border-primary/30">
          <p className="text-sm mb-1">
            Nächstes Unlock: <span className="font-bold text-primary">{nextUnlock.name}</span>
          </p>
          <p className="text-xs text-muted-foreground flex items-center gap-1">
            <Zap className="h-3 w-3 text-amber-500" />
            bei {nextUnlock.pointsNeeded} Punkten ({remaining} fehlen noch)
          </p>
        </div>
        <Button
          variant="outline"
          size="default"
          className="w-full h-10 text-sm font-bold rounded-xl"
          onClick={onComingSoon}
          data-testid="button-browse-skins"
        >
          <Palette className="h-4 w-4 mr-2" />
          Skins durchstöbern
        </Button>
      </div>
    </Card>
  );
}

function KidQuestTrack({ tasks, onComingSoon }: { tasks: typeof MOCK_DATA.tasks; onComingSoon: () => void }) {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-3 bg-gradient-to-br from-blue-400 to-purple-500 rounded-2xl">
          <Star className="h-8 w-8 text-white" />
        </div>
        <h2 className="text-4xl font-bold" style={{ fontFamily: "Fredoka, sans-serif" }}>
          Meine Aufgaben
        </h2>
        <Zap className="h-6 w-6 text-yellow-500 animate-pulse" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {tasks.map((task, index) => {
          const TaskIcon = task.Icon;
          return (
            <motion.div
              key={task.id}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: index * 0.1 }}
              whileHover={{ scale: 1.05, rotate: task.completed ? 0 : 2 }}
              whileTap={{ scale: 0.95 }}
            >
              <Card
                className={`p-4 transition-all cursor-pointer bg-card/80 backdrop-blur-md border-2 rounded-2xl ${
                  task.completed ? "opacity-60 border-green-500" : "border-border hover:border-primary"
                }`}
                data-testid={`task-card-${task.id}`}
                onClick={onComingSoon}
              >
                <div className="text-center space-y-3">
                  <div className={`flex justify-center p-3 rounded-2xl mx-auto w-fit ${
                    task.completed ? "bg-green-500/20" : "bg-primary/10"
                  }`}>
                    <TaskIcon className={`h-12 w-12 ${task.completed ? "text-green-500" : "text-primary"}`} />
                  </div>
                  <h3 className="font-bold text-lg" style={{ fontFamily: "Fredoka, sans-serif" }}>
                    {task.title}
                  </h3>
                  <Badge 
                    variant={task.completed ? "secondary" : "default"} 
                    className="text-base px-3 py-1 font-bold rounded-xl"
                  >
                    {task.completed ? "✓ Fertig" : "+"} {task.points} Punkte
                  </Badge>
                </div>
              </Card>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

function KidLeaderboard({ leaderboard, onComingSoon }: { leaderboard: typeof MOCK_DATA.leaderboard; onComingSoon: () => void }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="p-3 bg-gradient-to-br from-amber-500 to-yellow-500 rounded-2xl">
          <Trophy className="h-8 w-8 text-white" />
        </div>
        <h2 className="text-3xl font-bold" style={{ fontFamily: "Fredoka, sans-serif" }}>
          Bestenliste
        </h2>
      </div>
      <Card className="p-4 bg-card/80 backdrop-blur-md border-2 rounded-2xl">
        <div className="space-y-3">
          {leaderboard.map((entry, index) => (
            <motion.div
              key={entry.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.1 }}
              whileHover={{ scale: 1.02 }}
            >
              <div className={`flex items-center gap-3 p-3 rounded-xl ${
                entry.isMe 
                  ? "bg-gradient-to-r from-primary/20 to-purple-500/20 border-2 border-primary" 
                  : "bg-muted/50"
              }`}>
                <div className="flex-shrink-0 w-8 text-center">
                  {entry.rank === 1 && <Trophy className="h-7 w-7 text-amber-500 fill-amber-500 inline" />}
                  {entry.rank === 2 && <Medal className="h-7 w-7 text-gray-400 inline" />}
                  {entry.rank === 3 && <Medal className="h-7 w-7 text-amber-700 inline" />}
                  {entry.rank > 3 && <span className="text-xl font-bold">{entry.rank}</span>}
                </div>
                <Avatar className="h-12 w-12 border-2 border-primary">
                  <AvatarFallback className={`text-lg font-bold bg-gradient-to-br ${entry.color}`}>
                    {entry.avatar}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-base truncate">{entry.name}</p>
                  {entry.isMe && <p className="text-xs text-primary font-bold">Das bist du!</p>}
                </div>
                <Badge variant="secondary" className="text-base px-3 py-1 font-bold">
                  {entry.points}
                </Badge>
              </div>
            </motion.div>
          ))}
        </div>
      </Card>
    </div>
  );
}

function KidFamilyGoals({ goals, onComingSoon }: { goals: typeof MOCK_DATA.familyGoals; onComingSoon: () => void }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="p-3 bg-gradient-to-br from-green-500 to-emerald-500 rounded-2xl">
          <Target className="h-8 w-8 text-white" />
        </div>
        <h2 className="text-3xl font-bold" style={{ fontFamily: "Fredoka, sans-serif" }}>
          Familienziele
        </h2>
      </div>
      {goals.map((goal, index) => {
        const GoalIcon = goal.Icon;
        const percentage = Math.min((goal.currentPoints / goal.targetPoints) * 100, 100);
        const progressColor = getProgressColor(percentage);
        
        return (
          <motion.div
            key={goal.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            whileHover={{ scale: 1.02 }}
          >
            <Card className="p-4 bg-card/80 backdrop-blur-md border-2 rounded-2xl">
              <div className="flex items-center gap-4 mb-3">
                <div className="flex-shrink-0 p-3 rounded-2xl bg-green-500/10">
                  <GoalIcon className="h-12 w-12 text-green-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-bold text-xl mb-1" style={{ fontFamily: "Fredoka, sans-serif" }}>
                    {goal.title}
                  </h3>
                  <p className="text-sm text-muted-foreground">{goal.description}</p>
                </div>
              </div>
              
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-bold">
                    {goal.currentPoints} / {goal.targetPoints} Punkte
                  </span>
                  <span className="font-bold" style={{ color: progressColor }}>
                    {Math.round(percentage)}%
                  </span>
                </div>
                <Progress value={percentage} className="h-5 rounded-full" />
                
                <div className="flex items-center justify-between pt-2">
                  {goal.contributedThisWeek ? (
                    <Badge variant="secondary" className="text-sm">
                      ✓ Diese Woche beigetragen
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-sm">
                      {goal.pointsPerMember} Punkte pro Woche
                    </Badge>
                  )}
                  <Button
                    size="default"
                    variant={goal.contributedThisWeek ? "outline" : "default"}
                    disabled={goal.contributedThisWeek}
                    onClick={onComingSoon}
                    className="h-9 px-4 text-sm font-bold rounded-xl"
                  >
                    {goal.contributedThisWeek ? "Beigetragen" : "Beitragen"}
                  </Button>
                </div>
              </div>
            </Card>
          </motion.div>
        );
      })}
    </div>
  );
}

function KidSharedRewards({ rewards, onComingSoon }: { rewards: typeof MOCK_DATA.sharedRewards; onComingSoon: () => void }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="p-3 bg-gradient-to-br from-pink-500 to-rose-500 rounded-2xl">
          <Users className="h-8 w-8 text-white" />
        </div>
        <h2 className="text-3xl font-bold" style={{ fontFamily: "Fredoka, sans-serif" }}>
          Geteilte Belohnungen
        </h2>
      </div>
      {rewards.map((reward, index) => {
        const RewardIcon = reward.Icon;
        
        return (
          <motion.div
            key={reward.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            whileHover={{ scale: 1.02 }}
          >
            <Card className="p-4 bg-card/80 backdrop-blur-md border-2 rounded-2xl border-pink-500/30">
              <div className="flex items-center gap-4">
                <div className="flex-shrink-0 p-3 rounded-2xl bg-pink-500/10">
                  <RewardIcon className="h-12 w-12 text-pink-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-bold text-xl mb-1" style={{ fontFamily: "Fredoka, sans-serif" }}>
                    {reward.title}
                  </h3>
                  <p className="text-sm text-muted-foreground mb-2">{reward.description}</p>
                  <div className="flex items-center gap-3 flex-wrap">
                    <Badge variant="secondary" className="text-sm">
                      <Users className="h-3 w-3 mr-1" />
                      {reward.participants} Teilnehmer
                    </Badge>
                    <Badge variant="secondary" className="text-sm">
                      Dein Anteil: {reward.myShare} Punkte
                    </Badge>
                  </div>
                </div>
                <div className="flex-shrink-0">
                  <Button
                    size="default"
                    variant={reward.joined ? "outline" : "default"}
                    onClick={onComingSoon}
                    className="h-11 px-5 text-base font-bold rounded-2xl"
                  >
                    {reward.joined ? "Beigetreten" : "Mitmachen"}
                  </Button>
                </div>
              </div>
            </Card>
          </motion.div>
        );
      })}
    </div>
  );
}

function KidChat({ messages, onComingSoon }: { messages: typeof MOCK_DATA.chatMessages; onComingSoon: () => void }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="p-3 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-2xl">
          <MessageCircle className="h-8 w-8 text-white" />
        </div>
        <h2 className="text-3xl font-bold" style={{ fontFamily: "Fredoka, sans-serif" }}>
          Familien-Chat
        </h2>
      </div>
      <Card className="p-4 bg-card/80 backdrop-blur-md border-2 rounded-2xl">
        <div className="space-y-3 mb-4 max-h-96 overflow-y-auto">
          {messages.map((msg, index) => (
            <motion.div
              key={msg.id}
              initial={{ opacity: 0, x: msg.isMe ? 20 : -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.05 }}
              className={`flex ${msg.isMe ? "justify-end" : "justify-start"}`}
            >
              <div className={`max-w-[80%] ${msg.isMe ? "order-2" : "order-1"}`}>
                <div className={`p-3 rounded-2xl ${
                  msg.isMe 
                    ? "bg-primary text-primary-foreground" 
                    : "bg-muted"
                }`}>
                  {!msg.isMe && (
                    <p className="text-xs font-bold mb-1">{msg.sender}</p>
                  )}
                  <p className="text-sm">{msg.message}</p>
                  <p className={`text-xs mt-1 ${msg.isMe ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
                    {msg.time}
                  </p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="Nachricht schreiben..."
            className="flex-1 px-4 py-2 rounded-xl bg-muted border-2 border-border focus:border-primary focus:outline-none text-base"
            onClick={onComingSoon}
            readOnly
          />
          <Button size="icon" onClick={onComingSoon} className="h-10 w-10 rounded-xl">
            <Send className="h-5 w-5" />
          </Button>
        </div>
      </Card>
    </div>
  );
}

export default function KidDashboard() {
  const [showComingSoon, setShowComingSoon] = useState(false);

  // Load user and member data
  const { data: user, isLoading: userLoading } = useQuery<User>({
    queryKey: ["/api/auth/user"],
  });

  const { data: member, isLoading: memberLoading } = useQuery<FamilyMember>({
    queryKey: ["/api/family-members/current"],
    enabled: !!user,
  });

  const { data: familyData } = useQuery<Family>({
    queryKey: ["/api/families/current"],
    enabled: !!member,
  });

  const { data: familyMembers = [] } = useQuery<FamilyMember[]>({
    queryKey: ["/api/family-members"],
    enabled: !!member,
  });

  const { data: tasks = [] } = useQuery<Task[]>({
    queryKey: ["/api/tasks"],
    enabled: !!member,
  });

  const { data: rewards = [] } = useQuery<Reward[]>({
    queryKey: ["/api/rewards"],
    enabled: !!member,
  });

  // Show loading state
  if (userLoading || memberLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // If not logged in, redirect to dashboard
  if (!user || !member) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Card className="p-8 text-center">
          <p className="text-lg mb-4">Bitte melde dich an, um das Kinder-Dashboard zu sehen.</p>
          <Button asChild>
            <Link href="/dashboard">Zum Dashboard</Link>
          </Button>
        </Card>
      </div>
    );
  }

  // Get current points and stats
  const currentPoints = member.totalPoints || 0;
  const totalEarned = member.totalEarned || 0;
  
  // Calculate streak (simplified - would need backend support for real streak tracking)
  const streak = 0;

  return (
    <div className="min-h-screen pb-20">
      {/* Back to Dashboard Button */}
      <div className="mx-4 mt-4 mb-2">
        <Button variant="outline" size="default" asChild data-testid="button-back-to-dashboard" className="rounded-xl">
          <Link href="/dashboard">
            <ArrowLeft className="h-5 w-5 mr-2" />
            Zurück
          </Link>
        </Button>
      </div>

      <div className="container mx-auto px-4 max-w-6xl space-y-8">
        {/* Hero Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <Card className="p-8 bg-gradient-to-br from-primary/10 via-card/80 to-purple-500/10 backdrop-blur-md border-2 border-primary/30 rounded-3xl shadow-xl">
            <div className="flex items-center justify-between flex-wrap gap-6">
              <div className="flex items-center gap-6">
                <motion.div
                  whileHover={{ scale: 1.1, rotate: 5 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <Avatar className="h-24 w-24 border-4 border-primary shadow-lg">
                    <AvatarImage src={member.avatarUrl || ""} />
                    <AvatarFallback className="text-4xl font-bold bg-gradient-to-br from-amber-400 to-orange-500">
                      {member.displayName[0]}
                    </AvatarFallback>
                  </Avatar>
                </motion.div>
                <div>
                  <h1 className="text-5xl font-bold mb-2" style={{ fontFamily: "Fredoka, sans-serif" }}>
                    {member.displayName}
                  </h1>
                  {streak > 0 && (
                    <div className="flex items-center gap-3 mt-2">
                      <motion.div
                        animate={{ scale: [1, 1.2, 1] }}
                        transition={{ repeat: Infinity, duration: 1.5 }}
                      >
                        <Flame className="h-7 w-7 text-orange-500" />
                      </motion.div>
                      <span className="text-lg font-bold">{streak}-Tage-Serie!</span>
                      <div className="flex gap-1">
                        {[...Array(Math.min(streak, 3))].map((_, i) => (
                          <motion.div
                            key={i}
                            initial={{ opacity: 0, scale: 0 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ delay: i * 0.1 + 0.3 }}
                          >
                            <Star className="h-6 w-6 text-amber-500 fill-amber-500" />
                          </motion.div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
              <div className="text-right bg-card/80 backdrop-blur-sm p-6 rounded-2xl border-2 border-primary/30">
                <p className="text-base text-muted-foreground mb-2 font-medium">Du hast:</p>
                <motion.div
                  className="text-6xl font-bold bg-gradient-to-r from-amber-500 to-orange-500 bg-clip-text text-transparent"
                  animate={{ scale: [1, 1.05, 1] }}
                  transition={{ repeat: Infinity, duration: 2 }}
                  style={{ fontFamily: "Fredoka, sans-serif" }}
                >
                  {currentPoints.toLocaleString()}
                </motion.div>
                <p className="text-lg font-bold text-primary mt-1">Punkte</p>
              </div>
            </div>
          </Card>
        </motion.div>

        {/* Reward Runway - PRIMARY FOCUS */}
        <RewardRunway
          rewards={rewards}
          currentPoints={currentPoints}
          member={member}
        />

        {/* Quest Track */}
        <KidQuestTrack tasks={tasks} member={member} />

        {/* Simplified Navigation - Playful Bottom Bar */}
        <motion.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.5, type: "spring" }}
        >
          <Card className="p-2 sticky bottom-4 bg-gradient-to-r from-primary/20 via-purple-500/20 to-pink-500/20 backdrop-blur-md border-2 border-primary/30 rounded-3xl shadow-2xl">
            <div className="flex justify-around gap-2">
              <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}>
                <Button variant="ghost" size="lg" asChild data-testid="button-nav-home" className="h-16 px-6 rounded-2xl">
                  <Link href="/dashboard">
                    <Home className="h-7 w-7 mr-2" />
                    <span className="font-bold text-base">Home</span>
                  </Link>
                </Button>
              </motion.div>
              <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}>
                <Button
                  variant="ghost"
                  size="lg"
                  onClick={() => setShowComingSoon(true)}
                  data-testid="button-nav-tasks"
                  className="h-16 px-6 rounded-2xl"
                >
                  <Star className="h-7 w-7 mr-2 text-amber-500" />
                  <span className="font-bold text-base">Aufgaben</span>
                </Button>
              </motion.div>
              <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}>
                <Button
                  variant="ghost"
                  size="lg"
                  onClick={() => setShowComingSoon(true)}
                  data-testid="button-nav-rewards"
                  className="h-16 px-6 rounded-2xl"
                >
                  <Gift className="h-7 w-7 mr-2 text-pink-500" />
                  <span className="font-bold text-base">Belohnungen</span>
                </Button>
              </motion.div>
              <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}>
                <Button
                  variant="ghost"
                  size="lg"
                  onClick={() => setShowComingSoon(true)}
                  data-testid="button-nav-chat"
                  className="h-16 px-6 rounded-2xl"
                >
                  <MessageCircle className="h-7 w-7 mr-2 text-blue-500" />
                  <span className="font-bold text-base">Chat</span>
                </Button>
              </motion.div>
            </div>
          </Card>
        </motion.div>
      </div>

      {/* Coming Soon Dialog */}
      <AlertDialog open={showComingSoon} onOpenChange={setShowComingSoon}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              Kommt bald!
            </AlertDialogTitle>
            <AlertDialogDescription>
              Diese Funktion ist noch nicht verfügbar. Dies ist nur eine Vorschau des neuen Kinder-Dashboards. Teile
              deine Ideen und Feedback mit den Entwicklern!
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction data-testid="button-close-coming-soon">Verstanden</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
