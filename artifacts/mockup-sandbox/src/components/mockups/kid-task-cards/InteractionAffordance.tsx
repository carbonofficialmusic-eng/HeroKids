import { Star, BrushCleaning, CheckCircle2, Clock, BookOpen, Music, Zap, ChevronRight, Sparkles } from "lucide-react";
import { useState } from "react";

type TaskState = "actionable" | "pending" | "approved";

interface MockTask {
  title: string;
  points: number;
  icon: React.ComponentType<{ className?: string }>;
  state: TaskState;
  emoji: string;
}

const tasks: MockTask[] = [
  { title: "Zimmer aufräumen", points: 20, icon: BrushCleaning, state: "actionable", emoji: "🧹" },
  { title: "Hausaufgaben", points: 30, icon: BookOpen, state: "pending", emoji: "📚" },
  { title: "Klavier üben", points: 15, icon: Music, state: "approved", emoji: "🎹" },
];

function ActionableCard({ task }: { task: MockTask }) {
  const [pressed, setPressed] = useState(false);
  const [done, setDone] = useState(false);

  const handleTap = () => {
    if (done) return;
    setPressed(true);
    setTimeout(() => {
      setPressed(false);
      setDone(true);
    }, 200);
  };

  if (done) {
    return (
      <div className="rounded-3xl border-2 border-emerald-400 bg-emerald-50 p-4 flex flex-col items-center gap-2 shadow-sm">
        <CheckCircle2 className="h-10 w-10 text-emerald-500" />
        <p className="font-bold text-emerald-700 text-center" style={{ fontFamily: "Fredoka, sans-serif" }}>
          {task.title}
        </p>
        <div className="flex items-center gap-1 bg-emerald-500 text-white rounded-full px-3 py-1">
          <Sparkles className="h-3.5 w-3.5" />
          <span className="text-sm font-bold">+{task.points} Punkte!</span>
        </div>
      </div>
    );
  }

  return (
    <div
      onClick={handleTap}
      className="rounded-3xl border-2 border-violet-400 bg-white cursor-pointer select-none shadow-md"
      style={{
        transform: pressed ? "scale(0.96)" : "scale(1)",
        transition: "transform 0.15s ease",
        boxShadow: pressed
          ? "0 2px 8px rgba(139,92,246,0.2)"
          : "0 4px 16px rgba(139,92,246,0.25)",
      }}
    >
      {/* Top: task icon + title */}
      <div className="flex items-center gap-3 p-4 pb-3">
        <div className="w-12 h-12 rounded-2xl bg-violet-100 flex items-center justify-center shrink-0">
          <span className="text-2xl">{task.emoji}</span>
        </div>
        <div className="flex-1">
          <p className="font-bold text-gray-800 text-base leading-tight" style={{ fontFamily: "Nunito, sans-serif" }}>
            {task.title}
          </p>
          <div className="flex items-center gap-1 mt-0.5">
            <Star className="h-3.5 w-3.5 text-amber-400" fill="currentColor" />
            <span className="text-sm font-bold text-amber-500">{task.points} Punkte</span>
          </div>
        </div>
      </div>

      {/* Big tap button — explicit affordance */}
      <div className="mx-3 mb-3 bg-violet-500 rounded-2xl flex items-center justify-center gap-2 py-3 px-4">
        <Zap className="h-4 w-4 text-white" fill="white" />
        <span className="text-white font-bold text-sm" style={{ fontFamily: "Fredoka, sans-serif" }}>
          Jetzt erledigen!
        </span>
        <ChevronRight className="h-4 w-4 text-white/80 ml-auto" />
      </div>
    </div>
  );
}

function PendingCard({ task }: { task: MockTask }) {
  return (
    <div className="rounded-3xl border-2 border-amber-300 bg-amber-50 p-4 flex items-center gap-3 shadow-sm">
      <div className="w-12 h-12 rounded-2xl bg-amber-100 flex items-center justify-center shrink-0">
        <span className="text-2xl">{task.emoji}</span>
      </div>
      <div className="flex-1">
        <p className="font-bold text-gray-700 text-base" style={{ fontFamily: "Nunito, sans-serif" }}>
          {task.title}
        </p>
        <div className="flex items-center gap-1.5 mt-1">
          <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
          <span className="text-xs font-semibold text-amber-600">Wird von Mama/Papa geprüft</span>
        </div>
      </div>
      <div className="shrink-0 text-center">
        <Clock className="h-8 w-8 text-amber-400" />
      </div>
    </div>
  );
}

function ApprovedCard({ task }: { task: MockTask }) {
  return (
    <div className="rounded-3xl border-2 border-emerald-300 bg-emerald-50 p-4 flex items-center gap-3 shadow-sm" style={{ opacity: 0.8 }}>
      <div className="w-12 h-12 rounded-2xl bg-emerald-100 flex items-center justify-center shrink-0">
        <CheckCircle2 className="h-7 w-7 text-emerald-500" />
      </div>
      <div className="flex-1">
        <p className="font-bold text-gray-600 text-base" style={{ fontFamily: "Nunito, sans-serif" }}>
          {task.title}
        </p>
        <p className="text-xs font-semibold text-emerald-600 mt-0.5">Erledigt — Super gemacht!</p>
      </div>
      <div className="shrink-0 bg-emerald-500 rounded-xl px-2.5 py-1.5 text-center">
        <Star className="h-3 w-3 text-white mx-auto mb-0.5" fill="white" />
        <span className="text-xs font-black text-white leading-none" style={{ fontFamily: "Fredoka, sans-serif" }}>
          +{task.points}
        </span>
      </div>
    </div>
  );
}

export function InteractionAffordance() {
  return (
    <div
      className="min-h-screen p-5 flex flex-col gap-3"
      style={{
        background: "linear-gradient(160deg, #1e1b4b 0%, #312e81 50%, #4c1d95 100%)",
        fontFamily: "Nunito, sans-serif",
      }}
    >
      {/* Header */}
      <div className="mb-1">
        <p className="text-white/60 text-sm font-semibold tracking-wide uppercase">Hey Lena!</p>
        <h2 className="text-white text-2xl font-black" style={{ fontFamily: "Fredoka, sans-serif" }}>
          Was erledigst du?
        </h2>
      </div>

      <div className="text-xs text-white/40 mb-1 text-right">
        Variante 2 — Interaktion & Affordanz
      </div>

      {/* Actionable — has explicit CTA button */}
      <ActionableCard task={tasks[0]} />

      {/* Pending — pulsing state indicator */}
      <PendingCard task={tasks[1]} />

      {/* Approved — muted, clearly done */}
      <ApprovedCard task={tasks[2]} />

      {/* Legend */}
      <div className="mt-2 p-3 bg-white/10 rounded-2xl">
        <p className="text-white/80 text-xs font-semibold mb-2">Designprinzip:</p>
        <ul className="text-white/60 text-xs space-y-1">
          <li>→ Expliziter „Erledigen"-Button (kein implizites Tippen)</li>
          <li>→ Tipp-Feedback: Karte federt ein (klick auf Karte oben)</li>
          <li>→ Klarer Zustandswechsel: Wartend = pulsierender Punkt</li>
        </ul>
      </div>
    </div>
  );
}
