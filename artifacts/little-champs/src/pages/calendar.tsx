import { useMemo, useState } from "react";
import { Link } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { CalendarDays, ChevronLeft, Clock, Pencil, Users } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TaskDialog } from "@/components/task-dialog";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest } from "@/lib/queryClient";
import { getLocalDateKey, isFixedAppointment, sortFixedAppointments } from "@shared/due-date-policy";
import { isTaskAssignedToMember } from "@shared/task-assignment-visibility";
import type { FamilyMember, Task } from "@shared/schema";
import { formatAppointmentTime } from "@/lib/appointment-time";

type AppointmentTask = Task & { isGoogleCalendarEvent?: boolean };

export default function CalendarPage() {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [editingTask, setEditingTask] = useState<AppointmentTask | null>(null);
  const { data: member } = useQuery<FamilyMember>({ queryKey: ["/api/family-members/current"], enabled: !!user });
  const { data: familyMembers = [] } = useQuery<FamilyMember[]>({ queryKey: ["/api/family-members"], enabled: !!member });
  const { data: familyData } = useQuery<any>({ queryKey: ["/api/families/current"], enabled: member?.role === "parent" });
  const { data: tasks = [], isLoading } = useQuery<AppointmentTask[]>({ queryKey: ["/api/appointments"], enabled: !!member });
  const updateTaskMutation = useMutation({
    mutationFn: async ({ task, data }: { task: AppointmentTask; data: any }) => {
      const editableData = task.isGoogleCalendarEvent
        ? {
            ...data,
            title: task.title,
            description: task.description,
            recurrence: task.recurrence,
            recurrenceDays: task.recurrenceDays,
            dueDate: task.dueDate,
            dueTime: task.dueTime,
            durationMinutes: task.durationMinutes,
            iconEmoji: task.iconEmoji,
          }
        : data;
      return apiRequest("PUT", `/api/tasks/${task.id}`, editableData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
      queryClient.invalidateQueries({ queryKey: ["/api/appointments"] });
      setEditingTask(null);
    },
  });
  const appointments = useMemo(() => {
    const visible = member?.role === "child" ? tasks.filter((task: any) => isTaskAssignedToMember(task, member.id)) : tasks;
    return sortFixedAppointments(visible.filter(isFixedAppointment))
      .filter((task) => String(task.dueDate).slice(0, 10) >= getLocalDateKey());
  }, [member, tasks]);
  const dateFormatter = new Intl.DateTimeFormat(i18n.language, { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  const getAssigneeNames = (task: AppointmentTask) => {
    const enrichedTask = task as AppointmentTask & {
      assignedMemberCompletions?: Array<{ memberId: string; displayName: string }>;
      sharedMemberCompletions?: Array<{ memberId: string; displayName: string }>;
    };
    const completionMembers = enrichedTask.assignedMemberCompletions?.length
      ? enrichedTask.assignedMemberCompletions
      : enrichedTask.sharedMemberCompletions;
    const names = completionMembers?.map(assigned => assigned.displayName)
      ?? familyMembers
        .filter(candidate => task.sharedMemberIds?.includes(candidate.id))
        .map(candidate => candidate.displayName);
    return names.length ? names.join(" & ") : t("chat.allMembers", { defaultValue: "Alle" });
  };

  return <div
    className="lc-calendar-page min-h-screen p-4 sm:p-6 lg:p-8"
    style={{
      paddingTop: "calc(1rem + env(safe-area-inset-top))",
      paddingLeft: "max(1rem, env(safe-area-inset-left))",
      paddingRight: "max(1rem, env(safe-area-inset-right))",
    }}
  >
    <div className="mx-auto max-w-3xl space-y-5">
      <div className="lc-calendar-heading flex items-center gap-3">
        <Link href={member?.role === "child" ? "/kid-dashboard" : "/dashboard"} className="lc-calendar-back flex h-10 w-10 items-center justify-center rounded-md border" aria-label={t("common.back", "Zurück")}><ChevronLeft className="h-5 w-5" /></Link>
        <div><p className="lc-calendar-eyebrow">{t("calendar.upcoming", "Kommende Termine")}</p><h1 className="text-3xl font-bold tracking-tight">{t("calendar.title", "Termine")}</h1><p className="text-muted-foreground">{t("calendar.subtitle", "Alle kommenden Termine deiner Familie")}</p></div>
      </div>
      <Card className="lc-calendar-card">
        <CardHeader className="lc-calendar-card-header"><CardTitle className="flex items-center gap-3"><span className="lc-calendar-title-icon"><CalendarDays className="h-5 w-5" /></span><span>{t("calendar.upcoming", "Kommende Termine")}</span><span className="lc-calendar-count ml-auto">{appointments.length}</span></CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {isLoading ? <div className="space-y-3" aria-label={t("common.loading", "Lädt...")}><div className="lc-calendar-skeleton h-20 rounded-xl" /><div className="lc-calendar-skeleton h-20 rounded-xl" /></div> : appointments.length === 0 ? <div className="lc-calendar-empty py-10 text-center"><CalendarDays className="mx-auto mb-3 h-10 w-10" /><p className="font-semibold">{t("calendar.empty", "Keine kommenden Termine.")}</p><p className="mt-1 text-sm text-muted-foreground">{t("calendar.subtitle", "Alle kommenden Termine deiner Familie")}</p></div> : appointments.map((task: AppointmentTask, index) => <div className="lc-calendar-appointment flex items-start gap-3 rounded-xl p-4" key={task.id}>
            <div className="lc-calendar-appointment-icon rounded-xl p-2.5"><CalendarDays className="h-5 w-5" /></div>
             <div className="min-w-0 flex-1">
               <div className="mb-1 flex items-center gap-2"><span className="lc-calendar-index">{String(index + 1).padStart(2, "0")}</span><p className="font-semibold">{task.title}</p></div>
               <p className="flex min-w-0 items-center gap-1.5 text-sm font-medium text-cyan-200" data-testid={`text-appointment-assignees-${task.id}`}>
                 <Users className="h-3.5 w-3.5 shrink-0" />
                 <span className="truncate">{getAssigneeNames(task)}</span>
               </p>
               <p className="mt-1 flex flex-wrap items-center gap-1 text-sm text-muted-foreground"><Clock className="h-3.5 w-3.5" />{dateFormatter.format(new Date(`${String(task.dueDate).slice(0, 10)}T12:00:00`))}<span aria-hidden="true">·</span>{formatAppointmentTime(task.dueTime, task.durationMinutes, t("calendar.allDay", "Ganztägig"))}</p>
             </div>
             <div className="flex shrink-0 flex-col items-end gap-2">
               <Badge className="lc-calendar-points" variant="secondary">{task.points} {t("common.points", "Punkte")}</Badge>
               {member?.role === "parent" && (
                 <Button
                   type="button"
                   variant="ghost"
                   size="icon"
                   className="h-9 w-9"
                   onClick={() => setEditingTask(task)}
                   aria-label={t("tasks.editTask", "Termin bearbeiten")}
                   data-testid={`button-edit-appointment-${task.id}`}
                 >
                   <Pencil className="h-4 w-4" />
                 </Button>
               )}
             </div>
          </div>)}
        </CardContent>
      </Card>
    </div>
    {member?.role === "parent" && editingTask && (
      <TaskDialog
        open={Boolean(editingTask)}
        onOpenChange={(open) => { if (!open) setEditingTask(null); }}
        onSubmit={(data) => updateTaskMutation.mutate({ task: editingTask, data })}
        isSubmitting={updateTaskMutation.isPending}
        familyName={member.familyName}
        createdBy={member.id}
        editingTask={editingTask}
        familyMembers={familyMembers}
        subscriptionTier={familyData?.subscriptionTier ?? "free"}
        trialEndsAt={familyData?.trialEndsAt}
        categoryNames={familyData?.categoryNames}
        calendarDetailsReadOnly={editingTask.isGoogleCalendarEvent}
      />
    )}
  </div>;
}