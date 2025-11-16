import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useWebSocket } from "@/hooks/useWebSocket";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { 
  Target, 
  Plus, 
  TrendingUp, 
  Users, 
  Calendar,
  CheckCircle2,
  Coins,
  Trash2
} from "lucide-react";
import { Link } from "wouter";
import type { FamilyGoal, GoalContribution, FamilyMember } from "@shared/schema";
import { FamilyGoalDialog } from "@/components/family-goal-dialog";

interface GoalWithContributions {
  goal: FamilyGoal;
  contributions: GoalContribution[];
  currentPeriod: string;
}

export default function FamilyGoals() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const { user } = useAuth();
  const [selectedGoal, setSelectedGoal] = useState<FamilyGoal | null>(null);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [goalToDelete, setGoalToDelete] = useState<FamilyGoal | null>(null);

  const { data: member } = useQuery<FamilyMember>({
    queryKey: ["/api/family-members/current"],
    enabled: !!user,
  });

  // Enable real-time WebSocket updates
  useWebSocket(member?.familyName || null);

  const { data: familyMembers = [] } = useQuery<FamilyMember[]>({
    queryKey: ["/api/family-members"],
    enabled: !!member,
  });

  const { data: goals = [], isLoading } = useQuery<FamilyGoal[]>({
    queryKey: ["/api/family-goals"],
    enabled: !!member,
  });

  const createGoalMutation = useMutation({
    mutationFn: async (data: any) => {
      return await apiRequest("POST", "/api/family-goals", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/family-goals"] });
      setCreateDialogOpen(false);
      toast({
        title: "Familienziel erstellt! 🎯",
        description: "Das neue Ziel ist jetzt für alle sichtbar.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Fehler",
        description: error.message || "Ziel konnte nicht erstellt werden",
        variant: "destructive",
      });
    },
  });

  const contributeMutation = useMutation({
    mutationFn: async (goalId: string) => {
      return await apiRequest("POST", `/api/family-goals/${goalId}/contribute`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/family-goals"] });
      queryClient.invalidateQueries({ queryKey: ["/api/family-members/current"] });
      toast({
        title: "Punkte eingezahlt! 🎯",
        description: "Dein Beitrag wurde zum Familienziel hinzugefügt.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Fehler",
        description: error.message || "Beitrag konnte nicht eingezahlt werden",
        variant: "destructive",
      });
    },
  });

  const deleteGoalMutation = useMutation({
    mutationFn: async (goalId: string) => {
      return await apiRequest("DELETE", `/api/family-goals/${goalId}`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/family-goals"] });
      queryClient.invalidateQueries({ queryKey: ["/api/family-members"] });
      queryClient.invalidateQueries({ queryKey: ["/api/family-members/current"] });
      setDeleteDialogOpen(false);
      setGoalToDelete(null);
      toast({
        title: "Familienziel gelöscht",
        description: "Das Ziel wurde gelöscht und alle eingezahlten Punkte wurden zurückerstattet.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Fehler",
        description: error.message || "Ziel konnte nicht gelöscht werden",
        variant: "destructive",
      });
    },
  });

  const getMemberById = (memberId: string) => {
    return familyMembers.find((m) => m.id === memberId);
  };

  const calculateProgress = (goal: FamilyGoal) => {
    return Math.min((goal.currentPoints / goal.targetPoints) * 100, 100);
  };

  const formatPeriod = (period: string, contributionPeriod: "weekly" | "monthly") => {
    if (contributionPeriod === "weekly") {
      const parts = period.split("-W");
      return `Woche ${parts[1]}/${parts[0]}`;
    } else {
      const parts = period.split("-");
      const monthNames = ["Jan", "Feb", "Mär", "Apr", "Mai", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Dez"];
      return `${monthNames[parseInt(parts[1]) - 1]} ${parts[0]}`;
    }
  };

  const getCurrentPeriod = (contributionPeriod: "weekly" | "monthly") => {
    const now = new Date();
    if (contributionPeriod === "weekly") {
      const weekNumber = Math.ceil((now.getTime() - new Date(now.getFullYear(), 0, 1).getTime()) / 604800000);
      return `${now.getFullYear()}-W${String(weekNumber).padStart(2, '0')}`;
    } else {
      return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg">Lädt Familienziele...</div>
      </div>
    );
  }

  const activeGoals = goals.filter((goal) => goal.isActive);
  const completedGoals = goals.filter((goal) => !goal.isActive && goal.completedAt);

  return (
    <div className="min-h-screen p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="mb-8">
          <Link href="/dashboard">
            <Button variant="outline" data-testid="button-back-dashboard" className="mb-4">
              {t("backToDashboard")}
            </Button>
          </Link>
          <h1 className="text-4xl font-black font-accent flex items-center gap-3">
            <Target className="h-10 w-10" />
            Familienziele
          </h1>
          <p className="text-muted-foreground mt-2">
            Arbeitet zusammen an gemeinsamen Zielen und verdient tolle Belohnungen!
          </p>
        </div>

        {member?.role === "parent" && (
          <Card className="p-6 bg-card border-2 border-primary/20">
            <div className="flex items-start gap-4">
              <div className="p-3 bg-primary/10 rounded-lg">
                <Plus className="h-6 w-6 text-primary" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-lg mb-1">Neues Familienziel erstellen</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Erstelle ein gemeinsames Ziel für die ganze Familie. Alle Mitglieder zahlen regelmäßig die gleiche Punktzahl ein.
                </p>
                <Button onClick={() => setCreateDialogOpen(true)} data-testid="button-create-goal">
                  <Plus className="h-4 w-4 mr-2" />
                  Ziel erstellen
                </Button>
              </div>
            </div>
          </Card>
        )}

        {activeGoals.length === 0 && (
          <Card className="p-12 text-center">
            <Target className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-xl font-semibold mb-2">Noch keine Familienziele</h3>
            <p className="text-muted-foreground mb-6">
              {member?.role === "parent" 
                ? "Erstelle ein Ziel, auf das die ganze Familie hinarbeiten kann!"
                : "Deine Eltern können Familienziele erstellen."}
            </p>
          </Card>
        )}

        <div className="space-y-6">
          {activeGoals.map((goal) => {
            const progress = calculateProgress(goal);
            const currentPeriod = getCurrentPeriod(goal.contributionPeriod);
            const isCompleted = goal.currentPoints >= goal.targetPoints;
            
            return (
              <Card key={goal.id} className="overflow-hidden relative" data-testid={`card-goal-${goal.id}`}>
                <div className="p-6">
                  {/* Delete Button - Fixed top right position */}
                  {member?.role === "parent" && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        setGoalToDelete(goal);
                        setDeleteDialogOpen(true);
                      }}
                      data-testid={`button-delete-goal-${goal.id}`}
                      className="absolute top-4 right-4 z-10"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                  
                  <div className="mb-4 pr-12">
                    <div className="flex items-start gap-3 sm:gap-4">
                      <div className="text-4xl sm:text-5xl flex-shrink-0">{goal.iconEmoji}</div>
                      <div className="flex-1 min-w-0">
                        <h3 className="text-xl sm:text-2xl font-bold mb-1">{goal.title}</h3>
                        {goal.description && (
                          <p className="text-muted-foreground text-sm">{goal.description}</p>
                        )}
                        {isCompleted && (
                          <Badge variant="default" className="gap-1 mt-2">
                            <CheckCircle2 className="h-3 w-3" />
                            Erreicht!
                          </Badge>
                        )}
                        <div className="flex flex-wrap items-center gap-2 mt-3">
                          <Badge variant="secondary" className="gap-1 text-xs">
                            <Calendar className="h-3 w-3" />
                            {goal.contributionPeriod === "weekly" ? "Wöchentlich" : "Monatlich"}
                          </Badge>
                          <Badge variant="secondary" className="gap-1 text-xs">
                            <Coins className="h-3 w-3" />
                            {goal.contributionAmount} Punkte
                          </Badge>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium">Fortschritt</span>
                        <span className="text-sm font-bold">
                          {goal.currentPoints} / {goal.targetPoints} Punkte
                        </span>
                      </div>
                      <Progress value={progress} className="h-3" />
                    </div>

                    <div className="flex items-center justify-between pt-4 border-t">
                      <div className="flex items-center gap-2">
                        <Users className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm text-muted-foreground">
                          {formatPeriod(currentPeriod, goal.contributionPeriod)}
                        </span>
                      </div>
                      {!isCompleted && member && (
                        <Button
                          onClick={() => contributeMutation.mutate(goal.id)}
                          disabled={contributeMutation.isPending || member.totalPoints < goal.contributionAmount}
                          data-testid={`button-contribute-${goal.id}`}
                        >
                          <TrendingUp className="h-4 w-4 mr-2" />
                          {goal.contributionAmount} Punkte einzahlen
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>

        {completedGoals.length > 0 && (
          <div className="mt-12">
            <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
              <CheckCircle2 className="h-6 w-6 text-green-500" />
              Erreichte Ziele
            </h2>
            <div className="grid gap-4">
              {completedGoals.map((goal) => (
                <Card key={goal.id} className="p-4 opacity-75" data-testid={`card-completed-goal-${goal.id}`}>
                  <div className="flex items-center gap-4">
                    <div className="text-3xl">{goal.iconEmoji}</div>
                    <div className="flex-1">
                      <h4 className="font-semibold">{goal.title}</h4>
                      <p className="text-sm text-muted-foreground">
                        Erreicht am {new Date(goal.completedAt!).toLocaleDateString("de-DE")}
                      </p>
                    </div>
                    <Badge variant="outline" className="gap-1">
                      <CheckCircle2 className="h-3 w-3" />
                      {goal.targetPoints} Punkte
                    </Badge>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        )}
      </div>

      {member && (
        <FamilyGoalDialog
          open={createDialogOpen}
          onOpenChange={setCreateDialogOpen}
          onSubmit={(data) => createGoalMutation.mutate(data)}
          isSubmitting={createGoalMutation.isPending}
          familyName={member.familyName}
        />
      )}

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent data-testid="dialog-delete-goal">
          <AlertDialogHeader>
            <AlertDialogTitle>Familienziel löschen?</AlertDialogTitle>
            <AlertDialogDescription>
              {goalToDelete && (
                <>
                  Möchtest du das Ziel <strong>"{goalToDelete.title}"</strong> wirklich löschen?
                  <br /><br />
                  {goalToDelete.currentPoints > 0 && (
                    <span className="text-primary font-semibold">
                      Alle eingezahlten {goalToDelete.currentPoints} Punkte werden automatisch an die Einzahler zurückerstattet.
                    </span>
                  )}
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">Abbrechen</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (goalToDelete) {
                  deleteGoalMutation.mutate(goalToDelete.id);
                }
              }}
              data-testid="button-confirm-delete"
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Löschen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
