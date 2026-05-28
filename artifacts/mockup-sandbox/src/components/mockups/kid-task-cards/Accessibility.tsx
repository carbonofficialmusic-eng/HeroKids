import { Star, Broom, CheckCircle2, Clock, BookOpen, Music, Leaf, Trash2, RotateCcw, AlertTriangle } from "lucide-react";

type TaskState = "actionable" | "pending" | "approved" | "rejected" | "locked";

interface MockTask {
  title: string;
  points: number;
  icon: React.ComponentType<{ className?: string }>;
  state: TaskState;
  stateLabel: string;
  stateEmoji: string;
}

const tasks: MockTask[] = [
  { title: "Zimmer aufräumen", points: 20, icon: Broom, state: "actionable", stateLabel: "Tippen zum Erledigen", stateEmoji: "👆" },
  { title: "Hausaufgaben machen", points: 30, icon: BookOpen, state: "pending", stateLabel: "Mama/Papa prüft es", stateEmoji: "⏳" },
  { title: "Klavier üben", points: 15, icon: Music, state: "approved", stateLabel: "Fertig — Super!", stateEmoji: "🎉" },
  { title: "Müll rausbringen", points: 10, icon: Trash2, state: "rejected", stateLabel: "Noch einmal versuchen", stateEmoji: "🔄" },
  { title: "Pflanzen gießen", points: 8, icon: Leaf, state: "locked", stateLabel: "Morgen wieder verfügbar", stateEmoji: "🔒" },
];

const stateStyle: Record<TaskState, {
  cardBg: string;
  cardBorder: string;
  statusBg: string;
  statusText: string;
  iconBg: string;
  pointsBg: string;
  pointsText: string;
}> = {
  actionable: {
    cardBg: "bg-white",
    cardBorder: "border-violet-500",
    statusBg: "bg-violet-600",
    statusText: "text-white",
    iconBg: "bg-violet-100",
    pointsBg: "bg-violet-600",
    pointsText: "text-white",
  },
  pending: {
    cardBg: "bg-amber-50",
    cardBorder: "border-amber-500",
    statusBg: "bg-amber-500",
    statusText: "text-white",
    iconBg: "bg-amber-100",
    pointsBg: "bg-amber-500",
    pointsText: "text-white",
  },
  approved: {
    cardBg: "bg-emerald-50",
    cardBorder: "border-emerald-500",
    statusBg: "bg-emerald-600",
    statusText: "text-white",
    iconBg: "bg-emerald-100",
    pointsBg: "bg-emerald-600",
    pointsText: "text-white",
  },
  rejected: {
    cardBg: "bg-blue-50",
    cardBorder: "border-blue-500",
    statusBg: "bg-blue-600",
    statusText: "text-white",
    iconBg: "bg-blue-100",
    pointsBg: "bg-blue-600",
    pointsText: "text-white",
  },
  locked: {
    cardBg: "bg-gray-50",
    cardBorder: "border-gray-300",
    statusBg: "bg-gray-400",
    statusText: "text-white",
    iconBg: "bg-gray-100",
    pointsBg: "bg-gray-300",
    pointsText: "text-gray-600",
  },
};

function TaskCard({ task }: { task: MockTask }) {
  const s = stateStyle[task.state];
  const Icon = task.icon;
  const isLocked = task.state === "locked";
  const isApproved = task.state === "approved";

  return (
    <div
      className={`rounded-2xl border-2 ${s.cardBorder} ${s.cardBg} shadow-sm overflow-hidden ${task.state === "actionable" ? "cursor-pointer" : ""}`}
      style={{ opacity: isLocked ? 0.55 : 1 }}
    >
      {/* Main row — icon + title + points */}
      <div className="flex items-center gap-4 px-4 pt-4 pb-3">
        {/* Icon — large for clarity */}
        <div className={`shrink-0 w-14 h-14 rounded-2xl flex items-center justify-center ${s.iconBg}`}>
          {isApproved ? (
            <CheckCircle2 className="h-8 w-8 text-emerald-600" />
          ) : (
            <Icon
              className={`h-8 w-8 ${isLocked ? "text-gray-400" : "text-violet-700"}`}
              style={{ filter: isLocked ? "grayscale(100%)" : "none" }}
            />
          )}
        </div>

        {/* Title — large, high-contrast */}
        <div className="flex-1 min-w-0">
          <p
            className={`font-extrabold text-lg leading-tight ${isLocked ? "text-gray-400" : "text-gray-900"}`}
            style={{ fontFamily: "Nunito, sans-serif" }}
          >
            {task.title}
          </p>
        </div>

        {/* Points — visible even on locked */}
        <div className={`shrink-0 flex flex-col items-center rounded-xl px-3 py-2 ${s.pointsBg}`}>
          <Star className={`h-4 w-4 ${s.pointsText} mb-0.5`} fill="currentColor" />
          <span className={`text-xl font-black leading-none ${s.pointsText}`} style={{ fontFamily: "Fredoka, sans-serif" }}>
            {task.points}
          </span>
        </div>
      </div>

      {/* Status strip — full width, high contrast, large text */}
      <div className={`${s.statusBg} flex items-center gap-2 px-4 py-2.5`}>
        <span className="text-base leading-none">{task.stateEmoji}</span>
        <span className={`text-sm font-bold ${s.statusText}`} style={{ fontFamily: "Nunito, sans-serif" }}>
          {task.stateLabel}
        </span>
        {task.state === "actionable" && (
          <div className="ml-auto w-3 h-3 rounded-full bg-white/40 animate-ping" />
        )}
      </div>
    </div>
  );
}

export function Accessibility() {
  return (
    <div
      className="min-h-screen p-5 flex flex-col gap-3"
      style={{
        background: "linear-gradient(160deg, #0f172a 0%, #1e3a5f 100%)",
        fontFamily: "Nunito, sans-serif",
      }}
    >
      {/* Header */}
      <div className="mb-1">
        <p className="text-white/60 text-sm font-semibold tracking-wide uppercase">Aufgabenliste</p>
        <h2 className="text-white text-2xl font-black" style={{ fontFamily: "Fredoka, sans-serif" }}>
          Heute
        </h2>
      </div>

      <div className="text-xs text-white/40 mb-1 text-right">
        Variante 3 — Lesbarkeit & Zugänglichkeit
      </div>

      {tasks.map((task, i) => (
        <TaskCard key={i} task={task} />
      ))}

      {/* Legend */}
      <div className="mt-2 p-3 bg-white/10 rounded-2xl">
        <p className="text-white/80 text-xs font-semibold mb-2">Designprinzip:</p>
        <ul className="text-white/60 text-xs space-y-1">
          <li>→ Größeres Icon (56px) + Titelschrift 18px für Lesbarkeit</li>
          <li>→ Status als durchgehender Farbstreifen, nicht kleines Pill</li>
          <li>→ Hoher Kontrast: weiß auf farbigem Hintergrund im Statusbereich</li>
          <li>→ Emoji + Text kombiniert für schnelles Verständnis ohne Lesen</li>
        </ul>
      </div>
    </div>
  );
}
