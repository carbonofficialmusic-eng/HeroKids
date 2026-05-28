import { Star, CheckCircle2, Clock, RotateCcw, Trash2, BookOpen, Music, Leaf, BrushCleaning, Sparkles, Trophy, Gift, ChevronRight } from "lucide-react";

type TaskState = "actionable" | "pending" | "approved" | "rejected" | "locked";

interface MockTask {
  title: string;
  points: number;
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  state: TaskState;
  stateLabel?: string;
}

interface MockReward {
  title: string;
  points: number;
  threshold: number;
  canRedeem: boolean;
}

const tasks: MockTask[] = [
  { title: "Zimmer aufräumen", points: 20, icon: BrushCleaning, state: "actionable" },
  { title: "Hausaufgaben machen", points: 30, icon: BookOpen, state: "pending", stateLabel: "Wird geprüft…" },
  { title: "Klavier üben", points: 15, icon: Music, state: "approved", stateLabel: "Genehmigt!" },
  { title: "Müll rausbringen", points: 10, icon: Trash2, state: "rejected", stateLabel: "Nochmal versuchen" },
  { title: "Pflanzen gießen", points: 8, icon: Leaf, state: "locked", stateLabel: "Morgen wieder" },
];

const rewards: MockReward[] = [
  { title: "Extra Bildschirmzeit", points: 120, threshold: 100, canRedeem: true },
  { title: "Kinoabend wählen", points: 60, threshold: 200, canRedeem: false },
];

const stateStyles: Record<TaskState, {
  card: string;
  iconWrap: string;
  iconColor: string;
  pointsBadge: string;
  statusPill: string;
  statusText: string;
}> = {
  actionable: {
    card: "bg-white/10 border border-white/20 shadow-lg shadow-black/20 hover:border-primary/60 hover:bg-white/15",
    iconWrap: "bg-gradient-to-br from-violet-400/25 to-violet-600/15 shadow-inner",
    iconColor: "text-violet-300",
    pointsBadge: "bg-gradient-to-r from-amber-500/90 to-yellow-400/90 text-white shadow-md shadow-amber-900/30",
    statusPill: "",
    statusText: "",
  },
  pending: {
    card: "bg-amber-500/8 border border-amber-400/30 shadow-lg shadow-black/20",
    iconWrap: "bg-gradient-to-br from-amber-400/25 to-amber-600/15 shadow-inner",
    iconColor: "text-amber-300",
    pointsBadge: "bg-gradient-to-r from-amber-500/90 to-yellow-400/90 text-white shadow-md shadow-amber-900/30",
    statusPill: "bg-amber-500/15 border border-amber-400/30 text-amber-300",
    statusText: "text-amber-300",
  },
  approved: {
    card: "bg-emerald-500/8 border border-emerald-400/30 shadow-lg shadow-black/20",
    iconWrap: "bg-gradient-to-br from-emerald-400/25 to-emerald-600/15 shadow-inner",
    iconColor: "text-emerald-400",
    pointsBadge: "bg-gradient-to-r from-emerald-500/90 to-green-400/90 text-white shadow-md shadow-emerald-900/30",
    statusPill: "bg-emerald-500/15 border border-emerald-400/30 text-emerald-300",
    statusText: "text-emerald-300",
  },
  rejected: {
    card: "bg-blue-500/8 border border-blue-400/30 shadow-lg shadow-black/20",
    iconWrap: "bg-gradient-to-br from-blue-400/25 to-blue-600/15 shadow-inner",
    iconColor: "text-blue-300",
    pointsBadge: "bg-gradient-to-r from-amber-500/90 to-yellow-400/90 text-white shadow-md shadow-amber-900/30",
    statusPill: "bg-blue-500/15 border border-blue-400/30 text-blue-300",
    statusText: "text-blue-300",
  },
  locked: {
    card: "bg-white/5 border border-white/10 opacity-60",
    iconWrap: "bg-white/10",
    iconColor: "text-white/30",
    pointsBadge: "bg-white/15 text-white/40",
    statusPill: "bg-white/10 border border-white/15 text-white/40",
    statusText: "text-white/40",
  },
};

function StatusIcon({ state }: { state: TaskState }) {
  if (state === "approved") return <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />;
  if (state === "pending") return <Clock className="h-3.5 w-3.5 text-amber-400" />;
  if (state === "rejected") return <RotateCcw className="h-3.5 w-3.5 text-blue-400" />;
  return null;
}

function TaskCard({ task }: { task: MockTask }) {
  const s = stateStyles[task.state];
  const Icon = task.icon;
  return (
    <div
      className={`flex items-center gap-4 p-4 rounded-2xl backdrop-blur-sm transition-all duration-200 cursor-pointer ${s.card}`}
      style={{ transform: "scale(1)" }}
    >
      <div className={`shrink-0 w-14 h-14 rounded-2xl flex items-center justify-center ${s.iconWrap}`}>
        {task.state === "approved" ? (
          <CheckCircle2 className="h-7 w-7 text-emerald-400" />
        ) : (
          <Icon className={`h-7 w-7 ${s.iconColor}`} />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p
          className="font-bold text-base leading-tight text-white"
          style={{ fontFamily: "Nunito, sans-serif", textShadow: "0 1px 2px rgba(0,0,0,0.5)" }}
        >
          {task.title}
        </p>
        {task.stateLabel && task.state !== "locked" && (
          <div className={`inline-flex items-center gap-1 mt-1.5 px-2 py-0.5 rounded-full text-xs font-semibold ${s.statusPill}`}>
            <StatusIcon state={task.state} />
            <span>{task.stateLabel}</span>
          </div>
        )}
        {task.state === "locked" && task.stateLabel && (
          <div className="inline-flex items-center gap-1 mt-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-white/8 border border-white/15 text-white/40">
            <span>{task.stateLabel}</span>
          </div>
        )}
      </div>
      <div className={`shrink-0 flex flex-col items-center justify-center rounded-full px-4 py-2 gap-0.5 ${s.pointsBadge}`}>
        <Star className="h-3.5 w-3.5" fill="currentColor" />
        <span className="text-base font-black leading-none" style={{ fontFamily: "Fredoka, sans-serif" }}>
          {task.points}
        </span>
      </div>
    </div>
  );
}

function RewardCard({ reward }: { reward: MockReward }) {
  const progress = Math.min((reward.points / reward.threshold) * 100, 100);
  return (
    <div
      className={`p-4 rounded-2xl backdrop-blur-sm transition-all duration-200 ${
        reward.canRedeem
          ? "bg-gradient-to-br from-amber-500/12 to-yellow-400/8 ring-2 ring-amber-400/40 shadow-xl shadow-amber-900/20"
          : "bg-white/8 border border-white/15"
      }`}
    >
      <div className="flex items-center gap-3">
        <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${
          reward.canRedeem ? "bg-amber-400/20" : "bg-white/10"
        }`}>
          <Gift className={`h-6 w-6 ${reward.canRedeem ? "text-amber-300" : "text-white/40"}`} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-sm text-white truncate" style={{ fontFamily: "Nunito, sans-serif" }}>
            {reward.title}
          </p>
          <div className="flex items-center gap-1 mt-0.5">
            <Star className="h-3 w-3 text-amber-400" fill="currentColor" />
            <span className="text-xs text-white/60">
              {reward.points} / {reward.threshold}
            </span>
          </div>
        </div>
        <button
          className={`shrink-0 px-4 py-1.5 rounded-full text-sm font-bold transition-all ${
            reward.canRedeem
              ? "bg-gradient-to-r from-amber-500 to-yellow-400 text-white shadow-lg shadow-amber-900/40"
              : "bg-white/10 text-white/40 opacity-55"
          }`}
          style={{ fontFamily: "Fredoka, sans-serif" }}
        >
          {reward.canRedeem ? "Einlösen" : "Bald"}
        </button>
      </div>
      <div className="mt-3 h-2 rounded-full bg-white/10 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${
            reward.canRedeem
              ? "bg-gradient-to-r from-amber-400 to-yellow-300"
              : "bg-white/30"
          }`}
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}

export function LiveDesign() {
  return (
    <div
      className="min-h-screen p-5 flex flex-col gap-6"
      style={{
        background: "linear-gradient(135deg, #667eea 0%, #764ba2 50%, #6B21A8 100%)",
        fontFamily: "Nunito, sans-serif",
      }}
    >
      {/* Points Box */}
      <div
        className="p-4 rounded-2xl border border-white/20 flex items-center justify-between gap-4"
        style={{ background: "rgba(0,0,0,0.30)", backdropFilter: "blur(24px)" }}
      >
        <div>
          <p className="text-white/60 text-xs font-semibold tracking-wide uppercase">Deine Punkte</p>
          <div className="flex items-baseline gap-1 mt-0.5">
            <span className="text-3xl font-black text-white" style={{ fontFamily: "Fredoka, sans-serif" }}>120</span>
            <Star className="h-5 w-5 text-amber-400 mb-0.5" fill="currentColor" />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="text-center px-3 py-2 rounded-xl bg-white/10">
            <p className="text-white/50 text-xs">Rang</p>
            <p className="text-white font-black text-lg" style={{ fontFamily: "Fredoka, sans-serif" }}>🥇 1.</p>
          </div>
          <div className="text-center px-3 py-2 rounded-xl bg-white/10">
            <p className="text-white/50 text-xs">Serie</p>
            <p className="text-white font-black text-lg" style={{ fontFamily: "Fredoka, sans-serif" }}>🔥 5</p>
          </div>
        </div>
      </div>

      {/* Filter Tabs */}
      <div
        className="flex gap-1 p-1 rounded-xl"
        style={{ background: "rgba(0,0,0,0.25)", backdropFilter: "blur(12px)", border: "1px solid rgba(255,255,255,0.10)" }}
      >
        {["Heute", "Diese Woche", "Alle"].map((tab, i) => (
          <button
            key={tab}
            className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${
              i === 0
                ? "bg-white/20 text-white shadow-sm"
                : "text-white/60 hover:text-white/80"
            }`}
            style={{ fontFamily: "Fredoka, sans-serif" }}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Tasks Section */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-violet-300 animate-pulse" />
            <h2
              className="text-xl font-black text-white"
              style={{ fontFamily: "Fredoka, sans-serif", textShadow: "0 2px 8px rgba(0,0,0,0.5)" }}
            >
              Aufgaben
            </h2>
          </div>
          <button
            className="text-white/90 text-xs font-semibold px-4 py-1.5 rounded-full border"
            style={{ background: "rgba(255,255,255,0.10)", borderColor: "rgba(255,255,255,0.15)" }}
          >
            Alle ansehen
          </button>
        </div>
        <div className="flex flex-col gap-3">
          {tasks.map((task, i) => (
            <TaskCard key={i} task={task} />
          ))}
        </div>
      </div>

      {/* Rewards Section */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-amber-400 animate-pulse" />
            <h2
              className="text-xl font-black text-white"
              style={{ fontFamily: "Fredoka, sans-serif", textShadow: "0 2px 8px rgba(0,0,0,0.5)" }}
            >
              Belohnungen
            </h2>
          </div>
          <button
            className="text-white/90 text-xs font-semibold px-4 py-1.5 rounded-full border"
            style={{ background: "rgba(255,255,255,0.10)", borderColor: "rgba(255,255,255,0.15)" }}
          >
            Alle ansehen
          </button>
        </div>
        <div className="flex flex-col gap-3">
          {rewards.map((r, i) => (
            <RewardCard key={i} reward={r} />
          ))}
        </div>
      </div>

      {/* Label */}
      <div
        className="p-3 rounded-xl text-center"
        style={{ background: "rgba(255,255,255,0.08)" }}
      >
        <p className="text-white/50 text-xs">
          Live — Implementiertes Design (kid-dashboard.tsx)
        </p>
        <p className="text-white/30 text-xs mt-0.5">
          Glas-Cards · Gold-Stern-Badge · Farbkodierte Status-Pills · Amber-Reward-Glow
        </p>
      </div>
    </div>
  );
}
