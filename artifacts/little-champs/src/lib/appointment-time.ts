export function formatAppointmentDuration(minutes?: number | null): string | null {
  if (!minutes) return null;
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  if (!hours) return `${remainingMinutes} Min.`;
  if (!remainingMinutes) return `${hours} Std.`;
  return `${hours} Std. ${remainingMinutes} Min.`;
}

export function formatAppointmentTime(
  dueTime?: string | null,
  durationMinutes?: number | null,
  allDayLabel = "Ganztägig",
): string {
  const duration = formatAppointmentDuration(durationMinutes);
  return [dueTime || allDayLabel, duration].filter(Boolean).join(" · ");
}