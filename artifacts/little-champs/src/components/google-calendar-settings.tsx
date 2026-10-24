import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { CalendarDays, Check, ExternalLink, RefreshCw, Unlink, AlertTriangle } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
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
import { apiRequest, queryClient } from "@/lib/queryClient";
import { isNativePlatform } from "@/lib/platform";
import type { FamilyMember } from "@shared/schema";
import { hasFeature, type SubscriptionTierLegacy } from "@shared/tier-config";
import { Link } from "wouter";

type Calendar = { id: string; summary: string; primary?: boolean };
type Mapping = { calendarId: string; calendarName: string; memberId: string; defaultPoints: number };
type Status = { connected?: boolean; active?: boolean; email?: string; lastSyncAt?: string | null; lastError?: string | null; mappings?: Mapping[] };

export function GoogleCalendarSettings({ members, subscriptionTier = "free", onTrial = false }: { members: FamilyMember[]; subscriptionTier?: SubscriptionTierLegacy; onTrial?: boolean }) {
  const { t, i18n } = useTranslation();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);
  const [mappings, setMappings] = useState<Mapping[]>([]);
  const [conflictingFamilies, setConflictingFamilies] = useState<string[]>([]);
  const children = members.filter((member) => member.role === "child");
  const hasAccess = onTrial || hasFeature(subscriptionTier, "googleCalendar");
  const { data: status } = useQuery<Status>({ queryKey: ["/api/google-calendar/status"], enabled: hasAccess });
  const { data: calendars = [], refetch: loadCalendars, isFetching: loadingCalendars } = useQuery<Calendar[]>({
    queryKey: ["/api/google-calendar/calendars"],
    enabled: open && !!status?.connected && step >= 1,
  });

  useEffect(() => {
    if (!status?.mappings) return;
    setMappings(status.mappings);
  }, [status?.mappings]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const result = params.get("googleCalendar");
    if (!result) return;
    window.history.replaceState({}, "", window.location.pathname);
    setOpen(true);
    setStep(result === "connected" ? 1 : 0);
    queryClient.invalidateQueries({ queryKey: ["/api/google-calendar/status"] });
  }, []);

  const auth = useMutation({
    mutationFn: async () => (await (await apiRequest("GET", `/api/google-calendar/auth-url${isNativePlatform() ? "?native=1" : ""}`)).json()) as { url: string },
    onSuccess: async ({ url }) => {
      if (isNativePlatform()) {
        const { Browser } = await import("@capacitor/browser");
        await Browser.open({ url });
      } else {
        window.location.assign(url);
      }
    },
  });
  const save = useMutation({
    mutationFn: async () => apiRequest("PUT", "/api/google-calendar/config", { mappings, active: true }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/google-calendar/status"] });
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
      queryClient.invalidateQueries({ queryKey: ["/api/appointments"] });
      setStep(0);
    },
  });
  const checkConflicts = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/google-calendar/conflicts", {
        calendarIds: mappings.map(mapping => mapping.calendarId),
      });
      return response.json() as Promise<{ familyNames?: string[] }>;
    },
    onSuccess: ({ familyNames = [] }) => {
      if (familyNames.length) {
        setConflictingFamilies(familyNames);
      } else {
        setStep(2);
      }
    },
  });
  const sync = useMutation({
    mutationFn: async () => apiRequest("POST", "/api/google-calendar/sync"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/google-calendar/status"] });
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
      queryClient.invalidateQueries({ queryKey: ["/api/appointments"] });
    },
  });
  const disconnect = useMutation({
    mutationFn: async () => apiRequest("DELETE", "/api/google-calendar/connection"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/google-calendar/status"] });
      queryClient.invalidateQueries({ queryKey: ["/api/appointments"] });
      setMappings([]);
    },
  });
  const configuredMembers = useMemo(() => new Set(mappings.map((mapping) => mapping.memberId)), [mappings]);
  const updateMapping = (member: FamilyMember, calendarId: string) => {
    const calendar = calendars.find((item) => item.id === calendarId);
    if (!calendar) {
      setMappings((old) => old.filter((mapping) => mapping.memberId !== member.id));
      return;
    }
    setMappings((old) => [
      ...old.filter((mapping) => mapping.memberId !== member.id && mapping.calendarId !== calendar.id),
      { calendarId: calendar.id, calendarName: calendar.summary, memberId: member.id, defaultPoints: old.find((m) => m.memberId === member.id)?.defaultPoints ?? 10 },
    ]);
  };

  if (!hasAccess) {
    return (
      <Card data-testid="google-calendar-settings-locked">
        <CardHeader>
          <div className="flex items-start gap-3">
            <CalendarDays className="mt-1 h-5 w-5 text-primary" />
            <div className="min-w-0 flex-1">
              <CardTitle>{t("googleCalendar.title", "Google Calendar")}</CardTitle>
              <CardDescription>{t("googleCalendar.familyFeature", "Im Family-Paket enthalten: Termine automatisch als Aufgaben importieren.")}</CardDescription>
            </div>
            <Badge variant="secondary">Family</Badge>
          </div>
        </CardHeader>
        <CardContent>
          <Link href="/pricing">
            <Button>{t("googleCalendar.viewFamily", "Family-Paket ansehen")}</Button>
          </Link>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card data-testid="google-calendar-settings">
      <CardHeader>
        <div className="flex items-start gap-3">
          <CalendarDays className="mt-1 h-5 w-5 text-primary" />
          <div className="min-w-0 flex-1">
            <CardTitle>{t("googleCalendar.title", "Google Calendar")}</CardTitle>
            <CardDescription>{t("googleCalendar.compactDescription", "Importiere Termine automatisch als Aufgaben für deine Kinder.")}</CardDescription>
          </div>
          {status?.connected && <Badge variant={status.active ? "default" : "secondary"}>{status.active ? t("googleCalendar.active", "Aktiv") : t("googleCalendar.connected", "Verbunden")}</Badge>}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {!open ? (
          <>
            <p className="text-sm text-muted-foreground">{t("googleCalendar.oneWay", "Google → Little Champs, für die nächsten 90 Tage. Du entscheidest, welche Kalender zu welchem Kind gehören.")}</p>
            <Button onClick={() => setOpen(true)}>{status?.connected ? t("googleCalendar.manage", "Verwalten") : t("googleCalendar.start", "Einrichtung starten")}</Button>
          </>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>{t("googleCalendar.step", "Schritt {{current}} von {{total}}", { current: status?.connected ? step + 1 : 1, total: 4 })}</span>
              <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>{t("common.cancel", "Abbrechen")}</Button>
            </div>
            {!status?.connected ? (
              <div className="space-y-3">
                <h3 className="font-semibold">{t("googleCalendar.explainTitle", "Termine für deine Familie")}</h3>
                <p className="text-sm text-muted-foreground">{t("googleCalendar.explain", "Verbinde Google und wähle anschließend pro Kind einen Kalender. Nicht zugeordnete Kalender werden ignoriert. Little Champs schreibt nichts in Google.")}</p>
                <Button onClick={() => auth.mutate()} disabled={auth.isPending}><ExternalLink className="mr-2 h-4 w-4" />{t("googleCalendar.connect", "Mit Google verbinden")}</Button>
                {auth.isError && <p className="text-sm text-destructive">{t("googleCalendar.errorConnect", "Verbindung konnte nicht hergestellt werden.")}</p>}
              </div>
            ) : step === 1 ? (
              <div className="space-y-3">
                <h3 className="font-semibold">{t("googleCalendar.chooseCalendars", "Kalender zuordnen")}</h3>
                <p className="text-sm text-muted-foreground">{t("googleCalendar.chooseCalendarsDesc", "Ordne jedem gewünschten Kind genau einen Kalender zu.")}</p>
                {loadingCalendars ? <p className="text-sm text-muted-foreground">{t("common.loading", "Lädt...")}</p> : children.map((member) => {
                  const current = mappings.find((mapping) => mapping.memberId === member.id);
                  return <div className="grid gap-2 sm:grid-cols-[1fr_1fr_6rem] sm:items-center" key={member.id}>
                    <span className="font-medium">{member.displayName}</span>
                    <Select value={current?.calendarId ?? "none"} onValueChange={(value) => updateMapping(member, value)}>
                      <SelectTrigger><SelectValue placeholder={t("googleCalendar.notMapped", "Nicht zugeordnet")} /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">{t("googleCalendar.notMapped", "Nicht zugeordnet")}</SelectItem>
                        {calendars.map((calendar) => <SelectItem
                          key={calendar.id}
                          value={calendar.id}
                          disabled={mappings.some((mapping) => mapping.calendarId === calendar.id && mapping.memberId !== member.id)}
                        >{calendar.summary}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <Input type="number" min={0} max={1000} value={current?.defaultPoints ?? 10} disabled={!current} onChange={(event) => setMappings((old) => old.map((mapping) => mapping.memberId === member.id ? { ...mapping, defaultPoints: Math.max(0, Number(event.target.value) || 0) } : mapping))} aria-label={t("googleCalendar.points", "Punkte")} />
                  </div>;
                })}
                <div className="flex justify-between"><Button variant="outline" onClick={() => setStep(0)}>{t("common.back", "Zurück")}</Button><Button onClick={() => checkConflicts.mutate()} disabled={mappings.length === 0 || checkConflicts.isPending}>{t("common.next", "Weiter")}</Button></div>
                {checkConflicts.isError && <p className="text-sm text-destructive">{t("googleCalendar.conflictCheckError", "Die Kalenderverbindungen konnten nicht geprüft werden. Bitte versuche es erneut.")}</p>}
              </div>
            ) : step === 2 ? (
              <div className="space-y-3">
                <h3 className="font-semibold">{t("googleCalendar.review", "Prüfen und aktivieren")}</h3>
                <p className="text-sm text-muted-foreground">{t("googleCalendar.reviewDesc", "Diese Zuordnungen werden automatisch synchronisiert. Termine werden als feste Aufgaben mit Genehmigung angelegt.")}</p>
                {mappings.map((mapping) => <div className="flex items-center justify-between rounded-md border p-3 text-sm" key={mapping.memberId}><span>{children.find((m) => m.id === mapping.memberId)?.displayName}: {mapping.calendarName}</span><Badge variant="secondary">{mapping.defaultPoints} {t("common.points", "Punkte")}</Badge></div>)}
                <div className="flex justify-between"><Button variant="outline" onClick={() => setStep(1)}>{t("common.back", "Zurück")}</Button><Button onClick={() => save.mutate()} disabled={save.isPending}><Check className="mr-2 h-4 w-4" />{t("googleCalendar.activate", "Aktivieren")}</Button></div>
              </div>
            ) : null}
            {status?.connected && step === 0 && (
              <div className="space-y-3">
                <p className="text-sm">{status.email ? t("googleCalendar.connectedAs", "Verbunden als {{email}}", { email: status.email }) : t("googleCalendar.connected", "Google ist verbunden.")}</p>
                {status.lastError && <div className="flex gap-2 rounded-md border border-destructive/40 p-3 text-sm text-destructive"><AlertTriangle className="h-4 w-4 shrink-0" />{status.lastError}</div>}
                {status.lastSyncAt && <p className="text-xs text-muted-foreground">{t("googleCalendar.lastSync", "Letzte Synchronisierung")}: {new Date(status.lastSyncAt).toLocaleString(i18n.language)}</p>}
                <div className="flex flex-wrap gap-2"><Button onClick={() => sync.mutate()} disabled={sync.isPending}><RefreshCw className="mr-2 h-4 w-4" />{t("googleCalendar.sync", "Jetzt synchronisieren")}</Button><Button variant="outline" onClick={() => { setStep(1); loadCalendars(); }}>{t("googleCalendar.editMapping", "Zuordnung bearbeiten")}</Button><Button variant="destructive" onClick={() => disconnect.mutate()} disabled={disconnect.isPending}><Unlink className="mr-2 h-4 w-4" />{t("googleCalendar.disconnect", "Trennen")}</Button></div>
                {disconnect.isError && <p className="text-sm text-destructive">{t("googleCalendar.disconnectError", "Die Verbindung konnte nicht sicher getrennt werden. Bitte versuche es erneut.")}</p>}
              </div>
            )}
          </div>
        )}
      </CardContent>
      <AlertDialog open={conflictingFamilies.length > 0} onOpenChange={(nextOpen) => {
        if (!nextOpen) setConflictingFamilies([]);
      }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("googleCalendar.alreadyConnectedTitle", "Kalender bereits verbunden")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t(
                "googleCalendar.alreadyConnectedDescription",
                "Mindestens einer der ausgewählten Google-Kalender ist bereits mit {{families}} verbunden. Wenn du fortfährst, können Termine in beiden Familien als Aufgaben erscheinen. Punkte, Erledigungen und Genehmigungen bleiben getrennt.",
                { families: conflictingFamilies.map(name => `„${name}“`).join(", ") },
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel", "Abbrechen")}</AlertDialogCancel>
            <AlertDialogAction onClick={() => {
              setConflictingFamilies([]);
              setStep(2);
            }}>{t("googleCalendar.connectAnyway", "Trotzdem verbinden")}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}