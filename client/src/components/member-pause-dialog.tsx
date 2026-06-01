import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { User, PauseCircle, PlayCircle, AlertTriangle } from "lucide-react";
import type { FamilyMember } from "@shared/schema";
import { getAvatarUrl } from "@/lib/skins";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface MemberPauseDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  members: (FamilyMember & { isOverLimit?: boolean })[];
  overLimitCount: number;
  maxMembersForTier: number;
  currentMemberId: string;
}

export function MemberPauseDialog({
  open,
  onOpenChange,
  members,
  overLimitCount,
  maxMembersForTier,
  currentMemberId,
}: MemberPauseDialogProps) {
  const { toast } = useToast();
  const [pendingChanges, setPendingChanges] = useState<Record<string, boolean>>({});

  const pauseMutation = useMutation({
    mutationFn: async ({ memberId, isPaused }: { memberId: string; isPaused: boolean }) => {
      const res = await apiRequest("PATCH", `/api/family-members/${memberId}/pause`, { isPaused });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/family-members"] });
      queryClient.invalidateQueries({ queryKey: ["/api/families/current"] });
    },
    onError: (error: any) => {
      toast({
        title: "Fehler",
        description: error?.message || "Mitglied konnte nicht aktualisiert werden.",
        variant: "destructive",
      });
    },
  });

  const togglePause = (memberId: string, currentlyPaused: boolean) => {
    const newState = !currentlyPaused;
    setPendingChanges(prev => ({ ...prev, [memberId]: true }));
    pauseMutation.mutate(
      { memberId, isPaused: newState },
      { onSettled: () => setPendingChanges(prev => { const n = { ...prev }; delete n[memberId]; return n; }) }
    );
  };

  const sorted = [...members].sort((a, b) => {
    if (a.role === b.role) {
      return new Date(a.createdAt ?? 0).getTime() - new Date(b.createdAt ?? 0).getTime();
    }
    return a.role === "parent" ? -1 : 1;
  });

  const pausedCount = members.filter(m => m.isPaused).length;
  const autoBlockedCount = members.filter(m => !m.isPaused && m.isOverLimit).length;
  const needsToPause = overLimitCount;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px] max-h-[90vh] flex flex-col" data-testid="dialog-member-pause">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            Mitglieder verwalten
          </DialogTitle>
          <DialogDescription>
            {needsToPause > 0 ? (
              <>
                Dein aktueller Plan erlaubt <strong>{maxMembersForTier} aktive Mitglieder</strong>.
                Du musst noch <strong>{needsToPause} Mitglied{needsToPause !== 1 ? "er" : ""}</strong> pausieren.
              </>
            ) : (
              <>
                Alle Mitglieder sind innerhalb des Limits ({maxMembersForTier} aktiv).
                Pausierte Mitglieder können jederzeit reaktiviert werden.
              </>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2 py-2 overflow-y-auto flex-1 min-h-0 pr-1">
          {sorted.map((member) => {
            const isCurrentUser = member.id === currentMemberId;
            const isAutoBlocked = !member.isPaused && !!member.isOverLimit;
            const isPending = !!pendingChanges[member.id];
            const isFounder = member.role === "parent" &&
              sorted.filter(m => m.role === "parent").findIndex(m => m.id === member.id) === 0;

            return (
              <div
                key={member.id}
                className={`flex items-center gap-3 p-3 rounded-lg border ${
                  member.isPaused
                    ? "bg-muted/50 border-border opacity-60"
                    : isAutoBlocked
                    ? "bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800"
                    : "bg-card border-border"
                }`}
              >
                <Avatar
                  className="h-10 w-10 shrink-0"
                  style={{ borderWidth: "2px", borderStyle: "solid", borderColor: member.color }}
                >
                  <AvatarImage
                    src={getAvatarUrl(member.activeSkinId, member.avatarUrl, member.useCustomAvatar, member.updatedAt)}
                    alt={member.displayName}
                  />
                  <AvatarFallback style={{ backgroundColor: member.color }}>
                    <User className="h-4 w-4" />
                  </AvatarFallback>
                </Avatar>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`font-medium text-sm ${member.isPaused ? "line-through text-muted-foreground" : ""}`}>
                      {member.displayName}
                    </span>
                    {isFounder && (
                      <Badge variant="secondary" className="text-xs px-1.5 py-0">Gründer</Badge>
                    )}
                    {isCurrentUser && (
                      <Badge variant="outline" className="text-xs px-1.5 py-0">Du</Badge>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {member.isPaused
                      ? "Pausiert — kann keine Aufgaben erledigen"
                      : isAutoBlocked
                      ? "Automatisch blockiert — bitte pausieren"
                      : member.role === "parent"
                      ? "Elternteil · Aktiv"
                      : "Kind · Aktiv"}
                  </div>
                </div>

                <Button
                  size="sm"
                  variant={member.isPaused ? "default" : "outline"}
                  disabled={isCurrentUser || isFounder || isPending}
                  onClick={() => togglePause(member.id, !!member.isPaused)}
                  data-testid={`button-pause-member-${member.id}`}
                  className="shrink-0"
                >
                  {isPending ? (
                    <div className="h-3 w-3 rounded-full border-2 border-current border-t-transparent animate-spin" />
                  ) : member.isPaused ? (
                    <>
                      <PlayCircle className="h-3.5 w-3.5 mr-1" />
                      Reaktivieren
                    </>
                  ) : (
                    <>
                      <PauseCircle className="h-3.5 w-3.5 mr-1" />
                      Pausieren
                    </>
                  )}
                </Button>
              </div>
            );
          })}
        </div>

        <DialogFooter className="flex-shrink-0">
          <div className="flex items-center justify-between w-full flex-wrap gap-2">
            <span className="text-xs text-muted-foreground">
              {pausedCount} pausiert · {autoBlockedCount} auto-blockiert
            </span>
            <Button onClick={() => onOpenChange(false)} data-testid="button-close-pause-dialog">
              Fertig
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
