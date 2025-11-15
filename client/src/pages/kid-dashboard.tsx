import { useState } from "react";
import { Link } from "wouter";
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
} from "lucide-react";

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
};

// Calculate reward progress
function getRewardProgress(currentPoints: number, pointCost: number) {
  const percentage = Math.min((currentPoints / pointCost) * 100, 100);
  const remaining = Math.max(pointCost - currentPoints, 0);
  const isReady = currentPoints >= pointCost;
  return { percentage, remaining, isReady };
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
  const { percentage, remaining, isReady } = getRewardProgress(currentPoints, reward.pointCost);
  const progressColor = getProgressColor(percentage);
  const RewardIcon = reward.Icon;

  return (
    <Card className={`p-4 transition-all ${isReady ? "ring-2 ring-primary shadow-lg" : ""}`}>
      <div className="flex gap-4">
        <div className="flex-shrink-0 p-3 bg-primary/10 rounded-lg">
          <RewardIcon className="h-10 w-10 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-bold text-lg mb-1">{reward.title}</h3>
          <p className="text-sm text-muted-foreground mb-3">{reward.description}</p>

          <div className="mb-2">
            <div className="flex justify-between items-center mb-1">
              <span className="text-sm font-medium">
                {currentPoints}/{reward.pointCost} Punkte
              </span>
              <span className="text-sm font-bold" style={{ color: progressColor }}>
                {Math.round(percentage)}%
              </span>
            </div>
            <Progress value={percentage} className="h-3" style={{ backgroundColor: "hsl(var(--muted))" }} />
          </div>

          {isReady ? (
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary animate-pulse" />
              <span className="text-sm font-bold text-primary">BEREIT! Du kannst es anfragen!</span>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Noch <span className="font-bold">{remaining} Punkte</span>!
            </p>
          )}
        </div>
        <div className="flex-shrink-0">
          <Button
            variant={isReady ? "default" : "outline"}
            size="sm"
            onClick={onComingSoon}
            data-testid={`button-request-reward-${reward.id}`}
          >
            {isReady ? (
              <>
                <Gift className="h-4 w-4 mr-1" />
                Anfragen!
              </>
            ) : (
              <>
                <Trophy className="h-4 w-4 mr-1" />
                Weiter sammeln
              </>
            )}
          </Button>
        </div>
      </div>
    </Card>
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
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Trophy className="h-6 w-6 text-primary" />
        <h2 className="text-2xl font-bold">Deine Belohnungen - So nah dran!</h2>
      </div>

      <div className="space-y-3">
        {topRewards.map((reward) => (
          <RewardCard key={reward.id} reward={reward} currentPoints={currentPoints} onComingSoon={onComingSoon} />
        ))}
      </div>

      {hasMore && (
        <Button
          variant="outline"
          className="w-full"
          onClick={onComingSoon}
          data-testid="button-show-all-rewards"
        >
          Alle Belohnungen anzeigen ({sortedRewards.length - 3} weitere)
        </Button>
      )}

      {pendingRewards.length > 0 && (
        <Card className="p-4 bg-muted/50">
          <h3 className="font-semibold mb-2 flex items-center gap-2">
            <Trophy className="h-5 w-5 text-amber-500" />
            Angefragt & Warte auf Freigabe
          </h3>
          <div className="space-y-2">
            {pendingRewards.map((pending) => {
              const PendingIcon = pending.Icon;
              return (
                <div key={pending.id} className="flex items-center gap-2 text-sm">
                  <PendingIcon className="h-4 w-4" />
                  <span className="font-medium">{pending.title}</span>
                  <span className="text-muted-foreground">({pending.pointCost} Punkte)</span>
                  <Badge variant="outline" className="ml-auto">
                    Wartet auf Freigabe
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
    <Card className="p-4">
      <h3 className="font-semibold mb-3 flex items-center gap-2">
        <Palette className="h-5 w-5 text-primary" />
        Style Bonus (Nebenbei)
      </h3>
      <div className="space-y-2 text-sm">
        <div className="flex items-center gap-2">
          <Flame className="h-8 w-8 text-orange-500" />
          <div>
            <p className="font-medium">Aktueller Skin:</p>
            <p className="text-muted-foreground">{activeSkin.name}</p>
          </div>
        </div>
        <div className="flex items-center justify-between p-2 bg-muted/50 rounded-md">
          <span>Discovery-Karten verfügbar</span>
          <Badge variant="secondary" className="text-base font-bold">
            {availableCards}
          </Badge>
        </div>
        <div className="p-2 bg-muted/50 rounded-md">
          <p className="text-muted-foreground">
            Nächstes Unlock: <span className="font-medium">{nextUnlock.name}</span>
          </p>
          <p className="text-xs text-muted-foreground">
            bei {nextUnlock.pointsNeeded} Punkten ({remaining} fehlen noch)
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="w-full"
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
    <div className="space-y-4">
      <h2 className="text-2xl font-bold flex items-center gap-2">
        <Star className="h-6 w-6 text-primary" />
        Meine Aufgaben
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {tasks.map((task) => {
          const TaskIcon = task.Icon;
          return (
            <Card
              key={task.id}
              className={`p-4 transition-all hover-elevate cursor-pointer ${task.completed ? "opacity-60" : ""}`}
              data-testid={`task-card-${task.id}`}
              onClick={onComingSoon}
            >
              <div className="text-center">
                <div className="flex justify-center mb-2">
                  <TaskIcon className="h-12 w-12 text-primary" />
                </div>
                <h3 className="font-bold text-lg mb-2">{task.title}</h3>
                <div className="mb-3">
                  <Progress value={task.progress} className="h-2 mb-1" />
                  <span className="text-sm text-muted-foreground">{task.progress}%</span>
                </div>
                <Badge variant={task.completed ? "secondary" : "default"} className="text-base">
                  {task.completed ? "Fertig" : "+"} {task.points} Punkte
                </Badge>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

export default function KidDashboard() {
  const [showComingSoon, setShowComingSoon] = useState(false);

  return (
    <div className="min-h-screen pb-20">
      {/* Preview Banner */}
      <Alert className="mb-4 mx-4 mt-4 border-primary bg-primary/10">
        <Info className="h-4 w-4" />
        <AlertDescription>
          <strong>Kinder-Vorschau</strong> - Dies ist eine visuelle Vorschau des neuen Kinder-Dashboards. Die
          Funktionen sind noch nicht aktiv. Nur zum Anschauen!
        </AlertDescription>
      </Alert>

      <div className="container mx-auto px-4 max-w-6xl space-y-6">
        {/* Hero Header */}
        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Avatar className="h-16 w-16 border-4 border-primary">
                <AvatarImage src="" />
                <AvatarFallback className="text-2xl font-bold">{MOCK_DATA.memberName[0]}</AvatarFallback>
              </Avatar>
              <div>
                <h1 className="text-3xl font-bold">{MOCK_DATA.memberName}</h1>
                <div className="flex items-center gap-2 mt-1">
                  <Flame className="h-5 w-5 text-orange-500" />
                  <span className="text-sm font-medium">{MOCK_DATA.streak}-Tage-Serie!</span>
                  <div className="flex gap-1">
                    <Star className="h-4 w-4 text-amber-500 fill-amber-500" />
                    <Star className="h-4 w-4 text-amber-500 fill-amber-500" />
                    <Star className="h-4 w-4 text-amber-500 fill-amber-500" />
                  </div>
                </div>
              </div>
            </div>
            <div className="text-right">
              <p className="text-sm text-muted-foreground mb-1">Du hast:</p>
              <div className="text-4xl font-bold text-primary">{MOCK_DATA.currentPoints.toLocaleString()} Punkte</div>
            </div>
          </div>
        </Card>

        {/* Reward Runway - PRIMARY FOCUS */}
        <RewardRunway
          rewards={MOCK_DATA.rewards}
          currentPoints={MOCK_DATA.currentPoints}
          pendingRewards={MOCK_DATA.pendingRewards}
          onComingSoon={() => setShowComingSoon(true)}
        />

        {/* Style Bonus Panel - Secondary */}
        <StyleBonusPanel
          activeSkin={MOCK_DATA.activeSkin}
          availableCards={MOCK_DATA.availableDiscoveryCards}
          nextUnlock={MOCK_DATA.nextSkinUnlock}
          currentPoints={MOCK_DATA.currentPoints}
          onComingSoon={() => setShowComingSoon(true)}
        />

        {/* Quest Track */}
        <KidQuestTrack tasks={MOCK_DATA.tasks} onComingSoon={() => setShowComingSoon(true)} />

        {/* Simplified Navigation */}
        <Card className="p-4 sticky bottom-4 bg-card/95 backdrop-blur-sm">
          <div className="flex justify-around gap-2">
            <Button variant="ghost" size="sm" asChild data-testid="button-nav-home">
              <Link href="/dashboard">
                <Home className="h-5 w-5 mr-1" />
                Home
              </Link>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowComingSoon(true)}
              data-testid="button-nav-tasks"
            >
              <Star className="h-5 w-5 mr-1" />
              Aufgaben
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowComingSoon(true)}
              data-testid="button-nav-rewards"
            >
              <Gift className="h-5 w-5 mr-1" />
              Belohnungen
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowComingSoon(true)}
              data-testid="button-nav-chat"
            >
              <MessageCircle className="h-5 w-5 mr-1" />
              Chat
            </Button>
          </div>
        </Card>
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
