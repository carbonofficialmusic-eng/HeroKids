import { createElement } from "react";
import { Clock } from "lucide-react";

export function KidAvailabilityBadge({ taskId, text, compact = false }: {
  taskId: string;
  text: string | null;
  compact?: boolean;
}) {
  if (!text) return null;
  return createElement("div", {
    className: compact
      ? "mt-2 rounded-lg border border-white/30 bg-black/40 px-2 py-1.5 text-xs font-bold leading-snug text-white"
      : "flex items-center justify-center gap-2 rounded-full border border-white/30 bg-black/40 px-4 py-2 text-sm font-bold text-white shadow-md",
    "data-testid": `badge-available-again-${taskId}`,
  },
    createElement(Clock, { className: compact ? "mr-1 inline h-3.5 w-3.5 align-middle" : "h-4 w-4 shrink-0 text-white/80" }),
    createElement("span", null, text),
  );
}