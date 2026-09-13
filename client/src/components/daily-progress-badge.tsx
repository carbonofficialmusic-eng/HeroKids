interface DailyProgressBadgeProps {
  displayName?: string;
  completed: number;
  total: number;
  testId?: string;
}

export function DailyProgressBadge({
  displayName,
  completed,
  total,
  testId,
}: DailyProgressBadgeProps) {
  const safeTotal = Math.max(1, Math.min(total, 3));
  const safeCompleted = Math.max(0, Math.min(completed, safeTotal));

  return (
    <div
      className="inline-flex max-w-full items-stretch overflow-hidden rounded-full border border-amber-300 bg-amber-100 shadow-sm dark:border-amber-500/70 dark:bg-amber-950/60"
      data-testid={testId}
      aria-label={`${displayName ? `${displayName}: ` : ""}${safeCompleted} von ${safeTotal} erledigt`}
    >
      {displayName && (
        <span className="flex items-center border-r border-amber-300 bg-white/80 px-2 py-1 text-xs font-bold text-slate-700 dark:border-amber-500/70 dark:bg-slate-800/95 dark:text-slate-100">
          {displayName}
        </span>
      )}
      <span className="flex">
        {Array.from({ length: safeTotal }, (_, index) => {
          const isDone = index < safeCompleted;
          return (
            <span
              key={index}
              className={`flex min-w-8 items-center justify-center px-2 py-1 text-xs font-extrabold ${
                index > 0 ? "border-l border-white/70 dark:border-slate-900/50" : ""
              } ${isDone
                ? "bg-emerald-500 text-white dark:bg-emerald-500"
                : "bg-amber-300 text-amber-950 dark:bg-amber-400 dark:text-amber-950"
              }`}
              aria-hidden="true"
            >
              {isDone ? "✓" : index + 1}
            </span>
          );
        })}
      </span>
    </div>
  );
}