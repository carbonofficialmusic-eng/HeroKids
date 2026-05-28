import { Star, BrushCleaning, CheckCircle2, Clock, RotateCcw, Trash2, BookOpen, Music, Leaf } from "lucide-react";

type TaskState = "actionable" | "pending" | "approved" | "rejected" | "locked";

interface MockTask {
  title: string;
  points: number;
  icon: React.ComponentType<{ className?: string }>;
  state: TaskState;
  stateLabel?: string;
}

const tasks: MockTask[] = [
  { title: "Zimmer aufräumen", points: 20, icon: BrushCleaning, state: "actionable" },
  { title: "Hausaufgaben machen", points: 30, icon: BookOpen, state: "pending", stateLabel: "Wird geprüft…" },
  { title: "Klavier üben", points: 15, icon: Music, state: "approved", stateLabel: "Genehmigt!" },
  { title: "Müll rausbringen", points: 10, icon: Trash2, state: "rejected", stateLabel: "Nochmal versuchen" },
  { title: "Pflanzen gießen", points: 8, icon: Leaf, state: "locked", stateLabel: "Morgen wieder" },
];

const stateConfig: Record<TaskState, { border: string; pointsBg: string; pointsText: string; iconBg: string }> = {
  actionable: {
    border: "border-violet-400",
    pointsBg: "bg-violet-500",
    pointsText: "text-white",
    iconBg: "bg-violet-100",
  },
  pending: {
    border: "border-amber-400",
    pointsBg: "bg-amber-400",
    pointsText: "text-white",
    iconBg: "bg-amber-50",
  },
  approved: {
    border: "border-emerald-400",
    pointsBg: "bg-emerald-500",
    pointsText: "text-white",
    iconBg: "bg-emerald-100",
  },
  rejected: {
    border: "border-blue-400",
    pointsBg: "bg-blue-500",
    pointsText: "text-white",
    iconBg: "bg-blue-50",
  },
  locked: {
    border: "border-gray-300",
    pointsBg: "bg-gray-300",
    pointsText: "text-gray-600",
    iconBg: "bg-gray-100",
  },
};

function StateIcon({ state }: { state: TaskState }) {
  if (state === "approved") return <CheckCircle2 className="h-4 w-4 text-emerald-600" />;
  if (state === "pending") return <Clock className="h-4 w-4 text-amber-500" />;
  if (state === "rejected") return <RotateCcw className="h-4 w-4 text-blue-500" />;
  return null;
}

function TaskCard({ task }: { task: MockTask }) {
  const cfg = stateConfig[task.state];
  const Icon = task.icon;
  const isLocked = task.state === "locked";

  return (
    <div
      className={`flex items-center gap-3 p-3 rounded-2xl border-2 ${cfg.border} bg-white/90 backdrop-blur-sm shadow-sm ${task.state === "actionable" ? "cursor-pointer hover:shadow-md transition-shadow" : ""}`}
      style={{ opacity: isLocked ? 0.6 : 1 }}
    >
      {/* Icon — fixed size left column */}
      <div className={`shrink-0 w-12 h-12 rounded-xl flex items-center justify-center ${cfg.iconBg}`}>
        {task.state === "approved" ? (
          <CheckCircle2 className="h-7 w-7 text-emerald-500" />
        ) : (
          <Icon className={`h-7 w-7 ${isLocked ? "text-gray-400" : "text-violet-600"}`}
            style={{ filter: isLocked ? "grayscale(100%)" : "none" }}
          />
        )}
      </div>

      {/* Main content — grows */}
      <div className="flex-1 min-w-0">
        <p
          className={`font-bold text-base leading-tight ${isLocked ? "text-gray-400" : "text-gray-800"}`}
          style={{ fontFamily: "Nunito, sans-serif" }}
        >
          {task.title}
        </p>
        {task.stateLabel && (
          <div className="flex items-center gap-1 mt-0.5">
            <StateIcon state={task.state} />
            <span className={`text-xs font-medium ${
              task.state === "pending" ? "text-amber-600" :
              task.state === "approved" ? "text-emerald-600" :
              task.state === "rejected" ? "text-blue-600" :
              "text-gray-400"
            }`}>
              {task.stateLabel}
            </span>
          </div>
        )}
      </div>

      {/* Points — fixed right column, dominant visual element */}
      <div className={`shrink-0 flex flex-col items-center justify-center rounded-xl px-3 py-2 min-w-[52px] ${cfg.pointsBg}`}>
        <Star className={`h-3.5 w-3.5 ${cfg.pointsText} mb-0.5`} fill="currentColor" />
        <span className={`text-base font-black leading-none ${cfg.pointsText}`} style={{ fontFamily: "Fredoka, sans-serif" }}>
          {task.points}
        </span>
      </div>
    </div>
  );
}

export function InfoHierarchy() {
  return (
    <div
      className="min-h-screen p-5 flex flex-col gap-3"
      style={{
        background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
        fontFamily: "Nunito, sans-serif",
      }}
    >
      {/* Header */}
      <div className="mb-1">
        <p className="text-white/70 text-sm font-semibold tracking-wide uppercase">Deine Aufgaben</p>
        <h2 className="text-white text-2xl font-black" style={{ fontFamily: "Fredoka, sans-serif" }}>
          Heute
        </h2>
      </div>

      {/* Label explanation */}
      <div className="text-xs text-white/60 mb-1 text-right">
        Variante 1 — Informationshierarchie
      </div>

      {tasks.map((task, i) => (
        <TaskCard key={i} task={task} />
      ))}

      {/* Legend */}
      <div className="mt-2 p-3 bg-white/10 rounded-2xl">
        <p className="text-white/80 text-xs font-semibold mb-2">Designprinzip:</p>
        <ul className="text-white/70 text-xs space-y-1">
          <li>→ Punkte-Badge rechts: höchste visuelle Priorität</li>
          <li>→ Horizontales Layout: Icon ▸ Titel ▸ Punkte</li>
          <li>→ Status als Unterzeile, nicht als Hauptelement</li>
        </ul>
      </div>
    </div>
  );
}
