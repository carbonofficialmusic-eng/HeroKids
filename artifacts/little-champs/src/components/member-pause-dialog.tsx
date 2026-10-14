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
import type { Family, FamilyMember } from "@shared/schema";
import { getLockedSelection, getSelectionScope } from "@shared/member-selection";
import { getAvatarUrl } from "@/lib/skins";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "react-i18next";
import { Link } from "wouter";

interface MemberPauseDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  members: (FamilyMember & { isOverLimit?: boolean })[];
  overLimitCount: number;
  maxMembersForTier: number;
  currentMemberId: string;
  family?: Family;
}

export function MemberPauseDialog({
  open,
  onOpenChange,
  members,
  overLimitCount,
  maxMembersForTier,
  currentMemberId,
  family,
}: MemberPauseDialogProps) {
  const { toast } = useToast();
  const { t } = useTranslation();
  const [pendingChanges, setPendingChanges] = useState<Record<string, boolean>>({});
  const [draftSelection, setDraftSelection] = useState<string[] | null>(null);
  const changeOpen = (nextOpen: boolean) => {
    if (!nextOpen) setDraftSelection(null);
    onOpenChange(nextOpen);
  };

  const pauseMutation = useMutation({
    mutationFn: async ({ memberId, isPaused }: { memberId: string; isPaused: boolean }) => {
      const res = await apiRequest("PATCH", `/api/family-members/${memberId}/pause`, { isPaused });
      return res.json();
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["/api/family-members"] }),
        queryClient.invalidateQueries({ queryKey: ["/api/families/current"] }),
      ]);
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
  const lockedSelection = family ? getLockedSelection(family) : null;
  const activeCount = members.filter(m => !m.isPaused && (!lockedSelection || lockedSelection.includes(m.id))).length;
  const autoBlockedCount = members.filter(m => !m.isPaused && m.isOverLimit).length;
  const needsToPause = overLimitCount;
  const needsSelection = !!family && !!getSelectionScope(family) &&
    members.length > maxMembersForTier && !lockedSelection;
  const defaultSelection = [
    ...sorted.filter(m => !m.isPaused).slice(0, maxMembersForTier),
    ...sorted.filter(m => m.isPaused),
  ].slice(0, maxMembersForTier).map(m => m.id);
  if (!defaultSelection.includes(currentMemberId) && defaultSelection.length === maxMembersForTier) {
    defaultSelection[defaultSelection.length - 1] = currentMemberId;
  }
  const chosen = draftSelection ?? defaultSelection;
  const toggleChoice = (id: string) => {
    if (id === currentMemberId) return;
    setDraftSelection(previous => {
      const ids = previous ?? defaultSelection;
      return ids.includes(id) ? ids.filter(value => value !== id) :
        ids.length < maxMembersForTier ? [...ids, id] : ids;
    });
  };

  const confirmMutation = useMutation({
    mutationFn: async (memberIds: string[]) => {
      const res = await apiRequest("POST", "/api/families/member-selection", { memberIds });
      return res.json();
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["/api/family-members"] }),
        queryClient.invalidateQueries({ queryKey: ["/api/families/current"] }),
        queryClient.invalidateQueries({ queryKey: ["/api/families/settings"] }),
      ]);
      changeOpen(false);
    },
    onError: (error: Error) => toast({ title: "Auswahl fehlgeschlagen", description: error.message, variant: "destructive" }),
  });

  return (
    <Dialog open={open} onOpenChange={changeOpen}>
      <DialogContent className="lc-member-pause sm:max-w-[480px] max-h-[90vh] flex flex-col" data-testid="dialog-member-pause">
        <DialogHeader className="lc-member-pause-header">
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            Mitglieder verwalten
          </DialogTitle>
          <DialogDescription>
            {needsSelection ? (
              <>Wähle genau <strong>{maxMembersForTier} Mitglieder</strong>, einschließlich deines eigenen Profils.
                {getSelectionScope(family!) === "trial"
                  ? " Nach der Bestätigung bleibt die Auswahl bis zum Ende des Trials fest."
                  : " Nach der Bestätigung bleibt die Auswahl 30 Tage fest."}
                {" "}Alle anderen Profile bleiben gespeichert, sind aber inaktiv.</>
            ) : lockedSelection ? (
              <>Die Auswahl ist bis zum {new Date(family!.memberSelectionLockedUntil!).toLocaleDateString("de-DE")} festgelegt.
                Nur diese {maxMembersForTier} Profile können in diesem Zeitraum aktiv sein.
                Pausierte ausgewählte Profile kannst du wieder aktivieren; die übrigen bleiben erhalten.</>
            ) : needsToPause > 0 ? (
              <>
                Dein aktueller Plan erlaubt <strong>{maxMembersForTier} aktive Mitglieder</strong>.
                Du kannst <strong>{needsToPause} Mitglied{needsToPause !== 1 ? "er" : ""}</strong> pausieren
                {maxMembersForTier === 3 ? " oder auf Family upgraden, damit bis zu 6 Mitglieder aktiv bleiben." : "."}
              </>
            ) : (
              <>
                Bis zu {maxMembersForTier} Mitglieder können aktiv sein.
                {activeCount < maxMembersForTier
                  ? " Pausierte Mitglieder können jetzt reaktiviert werden."
                  : " Pausiere zuerst ein anderes Mitglied oder upgrade, um jemanden zu reaktivieren."}
              </>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="lc-member-pause-list space-y-2 py-2 overflow-y-auto flex-1 min-h-0 pr-1">
          {sorted.map((member) => {
            const isCurrentUser = member.id === currentMemberId;
            const isAutoBlocked = !member.isPaused && !!member.isOverLimit;
            const isPending = !!pendingChanges[member.id];
            const isFounder = member.role === "parent" &&
              sorted.filter(m => m.role === "parent").findIndex(m => m.id === member.id) === 0;

            return (
              <div
                key={member.id}
                className={`lc-member-pause-card flex items-center gap-3 p-3 rounded-lg border ${
                  needsSelection
                    ? chosen.includes(member.id) ? "bg-card border-primary/50" : "bg-muted/50 border-border"
                    : member.isPaused
                    ? "lc-member-pause-card-paused bg-muted/50 border-border opacity-60"
                    : isAutoBlocked
                    ? "lc-member-pause-card-blocked bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800"
                    : "lc-member-pause-card-active bg-card border-border"
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

                {needsSelection ? (
                  <Button
                    size="sm"
                    variant={chosen.includes(member.id) ? "default" : "outline"}
                    onClick={() => toggleChoice(member.id)}
                    disabled={isCurrentUser || confirmMutation.isPending || (!chosen.includes(member.id) && chosen.length >= maxMembersForTier)}
                    data-testid={`button-select-member-${member.id}`}
                    className="shrink-0"
                  >
                    {chosen.includes(member.id) ? "Ausgewählt" : "Auswählen"}
                  </Button>
                ) : (
                <Button
                  size="sm"
                  variant={member.isPaused ? "default" : "outline"}
                  disabled={isCurrentUser || (isFounder && !member.isPaused) || isPending || pauseMutation.isPending || (!!member.isPaused && (activeCount >= maxMembersForTier || (!!lockedSelection && !lockedSelection.includes(member.id))))}
                  onClick={() => togglePause(member.id, !!member.isPaused)}
                  data-testid={`button-pause-member-${member.id}`}
                  title={member.isPaused && lockedSelection && !lockedSelection.includes(member.id)
                    ? `Dieser Platz ist bis ${new Date(family!.memberSelectionLockedUntil!).toLocaleDateString()} für ein anderes Profil reserviert`
                    : member.isPaused && activeCount >= maxMembersForTier ? "Zuerst ein anderes Mitglied pausieren" : undefined}
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
                )}
              </div>
            );
          })}
        </div>

        <DialogFooter className="lc-member-pause-footer flex-shrink-0">
          <div className="flex items-center justify-between w-full flex-wrap gap-2">
            <span className="text-xs text-muted-foreground">
              {needsSelection ? `${chosen.length} von ${maxMembersForTier} ausgewählt` :
                `${pausedCount} pausiert · ${autoBlockedCount} auto-blockiert`}
            </span>
            <div className="flex items-center gap-2">
              {needsSelection && (
                <Button
                  disabled={chosen.length !== maxMembersForTier || !chosen.includes(currentMemberId) || confirmMutation.isPending}
                  onClick={() => confirmMutation.mutate(chosen)}
                  data-testid="button-confirm-member-selection"
                >
                  {confirmMutation.isPending ? "Speichern…" : "Auswahl bestätigen"}
                </Button>
              )}
              {!needsSelection && (needsToPause > 0 || pausedCount > 0) && maxMembersForTier === 3 && (
                <Link href="/pricing">
                  <Button data-testid="button-upgrade-from-member-limit">{t("paywall.upgradeFamily")}</Button>
                </Link>
              )}
              <Button onClick={() => changeOpen(false)} data-testid="button-close-pause-dialog">
                Fertig
              </Button>
            </div>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
