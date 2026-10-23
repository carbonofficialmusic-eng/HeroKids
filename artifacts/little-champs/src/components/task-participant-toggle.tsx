import { ChevronDown } from "lucide-react";
import { useTranslation } from "react-i18next";

export function TaskParticipantToggle({
  total, expanded, onToggle, controls,
}: {
  total: number;
  expanded: boolean;
  onToggle: () => void;
  controls: string;
}) {
  const { t } = useTranslation();
  if (total <= 3) return null;
  const label = t(expanded ? "common.showLess" : "common.showMore");
  return (
    <button
      type="button"
      className="flex shrink-0 items-center gap-1 rounded px-1.5 min-h-8 text-xs text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      aria-label={`${t("tasks.participants")}: ${label}`}
      aria-expanded={expanded}
      aria-controls={controls}
      data-testid={`toggle-${controls}`}
      onClick={event => {
        event.stopPropagation();
        onToggle();
      }}
    >
      <span>{expanded ? label : `+${total - 3}`}</span>
      <ChevronDown className={`h-3.5 w-3.5 transition-transform ${expanded ? "rotate-180" : ""}`} />
    </button>
  );
}
