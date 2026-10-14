import { Link } from "wouter";
import { useTranslation } from "react-i18next";
import { CalendarDays, ChevronRight } from "lucide-react";
import type { FamilyMember, Task } from "@shared/schema";
import { formatAppointmentTime } from "@/lib/appointment-time";

const dateColors = ["#6ACAFE", "#75DF8E", "#9482FD"];

export function UpcomingAppointments({
  appointments,
  onAppointmentClick,
  compact = false,
  members = [],
}: {
  appointments: Task[];
  onAppointmentClick: (task: Task) => void;
  compact?: boolean;
  members?: FamilyMember[];
}) {
  const { t, i18n } = useTranslation();
  if (!appointments.length) return null;
  const dateFormatter = new Intl.DateTimeFormat(i18n.language, {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
  });

  return <section
    className="lc-appointments-compact h-full min-w-0 overflow-hidden rounded-2xl p-3.5 shadow-lg"
    data-testid="card-more-appointments"
  >
    {compact ? (
      <Link href="/calendar" className="lc-appointments-view-all mb-3 flex w-full min-w-0 items-center rounded-lg px-2 py-2 text-sm font-semibold transition-colors">
        <CalendarDays className="mr-2 h-4 w-4 shrink-0" />
        <span className="min-w-0 truncate">{t("calendar.allAppointmentsShort", "Alle Termine")}</span>
        <ChevronRight className="ml-auto h-4 w-4 shrink-0" />
      </Link>
    ) : (
      <h3 className="lc-appointments-compact-title mb-3 flex items-center gap-2 text-base font-bold">
        <span className="lc-appointments-calendar-icon"><CalendarDays className="h-5 w-5" /></span>
        {t("calendar.moreAppointments", "Weitere Termine")}
      </h3>
    )}
    <div className="space-y-1.5">
      {appointments.slice(0, compact ? 1 : 3).map((appointment, index) => {
        const date = new Date(`${String(appointment.dueDate).slice(0, 10)}T12:00:00`);
        const enrichedTask = appointment as Task & {
          assignedMemberCompletions?: Array<{ memberId: string; displayName: string }>;
          sharedMemberCompletions?: Array<{ memberId: string; displayName: string }>;
        };
        const completionMembers = enrichedTask.assignedMemberCompletions?.length
          ? enrichedTask.assignedMemberCompletions
          : enrichedTask.sharedMemberCompletions;
        const assignedNames = completionMembers?.map(member => member.displayName)
          ?? members
            .filter(member => appointment.sharedMemberIds?.includes(member.id))
            .map(member => member.displayName);
        const assigneeName = assignedNames.length ? assignedNames.join(" & ") : "–";
        return <button
          type="button"
          key={appointment.id}
          onClick={() => onAppointmentClick(appointment)}
          className={`lc-appointment-row grid w-full items-center gap-2 rounded-lg p-1.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 ${
            compact
              ? "grid-cols-[4.8rem_3.8rem_minmax(0,1fr)]"
              : "grid-cols-[6.2rem_3.5rem_minmax(0,1fr)]"
          }`}
          data-testid={`button-more-appointment-${appointment.id}`}
        >
          <span
            className={`lc-appointment-date min-w-0 truncate rounded-md py-1 text-center text-xs font-bold ${
              compact ? "px-1" : "px-2"
            }`}
            style={{ backgroundColor: dateColors[index] }}
          >
            {dateFormatter.format(date)}
          </span>
          <span className="lc-appointment-assignee min-w-0 truncate text-sm">{assigneeName}</span>
          <span className="lc-appointment-name flex min-w-0 items-center gap-2 text-sm font-medium">
            <span aria-hidden="true">{appointment.iconEmoji || "📅"}</span>
            <span className="min-w-0">
              <span className="block truncate">{appointment.title}</span>
              {(appointment.dueTime || appointment.durationMinutes) && (
                <span className="block truncate text-xs opacity-70">
                  {formatAppointmentTime(appointment.dueTime, appointment.durationMinutes, t("calendar.allDay", "Ganztägig"))}
                </span>
              )}
            </span>
          </span>
        </button>;
      })}
    </div>
    {!compact && (
      <Link href="/calendar" className="lc-appointments-view-all mt-3 flex w-full items-center justify-center rounded-lg px-4 py-2 text-sm font-semibold transition-colors">
        {t("calendar.viewAllAppointments", "Alle Termine ansehen")}<ChevronRight className="ml-1 h-4 w-4" />
      </Link>
    )}
  </section>;
}