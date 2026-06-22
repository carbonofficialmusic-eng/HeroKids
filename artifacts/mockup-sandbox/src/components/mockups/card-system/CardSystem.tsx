import { Star, Zap, Trophy, Gift, CheckCircle2, Clock, XCircle, Lock, Users, Target, Sparkles, Crown, Heart, Flame, Shield, Coins } from "lucide-react";

// ─── Shared Design Tokens ────────────────────────────────────────────────────
const fonts = {
  display: "'Fredoka', sans-serif",
  body: "'Nunito', sans-serif",
};

// ─── Tiny Helpers ─────────────────────────────────────────────────────────────
function Coin({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none">
      <circle cx="10" cy="10" r="9" fill="#F59E0B" stroke="#D97706" strokeWidth="1.5"/>
      <circle cx="10" cy="10" r="6" fill="#FCD34D" stroke="#F59E0B" strokeWidth="1"/>
      <text x="10" y="14" textAnchor="middle" fontSize="8" fontWeight="bold" fill="#92400E">★</text>
    </svg>
  );
}

function StarBurst({ className = "" }: { className?: string }) {
  return <span className={`text-amber-400 ${className}`}>✦</span>;
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 mb-5">
      <div className="h-px flex-1 bg-gradient-to-r from-transparent via-white/20 to-transparent" />
      <span style={{ fontFamily: fonts.display }} className="text-sm font-semibold text-white/60 uppercase tracking-widest px-2">
        {children}
      </span>
      <div className="h-px flex-1 bg-gradient-to-r from-transparent via-white/20 to-transparent" />
    </div>
  );
}

// ─── Progress Bar ─────────────────────────────────────────────────────────────
function GameProgress({ value, color = "amber" }: { value: number; color?: string }) {
  const colors: Record<string, string> = {
    amber: "from-amber-400 to-yellow-300",
    blue: "from-blue-400 to-cyan-300",
    green: "from-emerald-400 to-teal-300",
    purple: "from-purple-400 to-violet-300",
    pink: "from-pink-400 to-rose-300",
  };
  const gradient = colors[color] ?? colors.amber;
  return (
    <div className="h-3 rounded-full bg-black/30 overflow-hidden relative">
      <div
        className={`h-full rounded-full bg-gradient-to-r ${gradient} relative transition-all`}
        style={{ width: `${value}%` }}
      >
        <div className="absolute inset-0 bg-gradient-to-b from-white/30 to-transparent rounded-full" />
        {value > 15 && (
          <div className="absolute right-1 top-1/2 -translate-y-1/2 w-1.5 h-1.5 bg-white/60 rounded-full" />
        )}
      </div>
    </div>
  );
}

// ─── Badge ────────────────────────────────────────────────────────────────────
function GameBadge({ children, variant }: { children: React.ReactNode; variant: "gold" | "blue" | "green" | "pink" | "gray" | "red" | "teal" }) {
  const styles: Record<string, string> = {
    gold:  "bg-amber-400/20 text-amber-300 border-amber-400/40",
    blue:  "bg-blue-400/20 text-blue-300 border-blue-400/40",
    green: "bg-emerald-400/20 text-emerald-300 border-emerald-400/40",
    pink:  "bg-pink-400/20 text-pink-300 border-pink-400/40",
    gray:  "bg-white/10 text-white/50 border-white/20",
    red:   "bg-red-400/20 text-red-300 border-red-400/40",
    teal:  "bg-teal-400/20 text-teal-300 border-teal-400/40",
  };
  return (
    <span
      className={`inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${styles[variant]}`}
      style={{ fontFamily: fonts.body }}
    >
      {children}
    </span>
  );
}

// ─── REWARD SHOP CARDS ────────────────────────────────────────────────────────
function RewardCard({
  title, icon, points, current, state, note
}: {
  title: string; icon: string; points: number; current: number;
  state: "available" | "ready" | "locked"; note?: string;
}) {
  const pct = Math.min((current / points) * 100, 100);
  const remaining = Math.max(points - current, 0);

  const cardStyles: Record<string, string> = {
    available: "from-indigo-900/80 via-purple-900/80 to-violet-900/80 border-violet-500/40",
    ready:     "from-amber-900/80 via-yellow-900/80 to-amber-800/80 border-amber-400/60",
    locked:    "from-slate-900/80 via-slate-800/80 to-slate-900/80 border-slate-600/30",
  };
  const glowStyles: Record<string, string> = {
    available: "shadow-violet-500/20",
    ready:     "shadow-amber-400/30",
    locked:    "shadow-black/10",
  };
  const iconBg: Record<string, string> = {
    available: "from-violet-500/20 to-purple-500/20 border-violet-400/20",
    ready:     "from-amber-500/30 to-yellow-400/20 border-amber-400/40",
    locked:    "from-slate-600/20 to-slate-500/10 border-slate-500/20",
  };

  return (
    <div className={`relative rounded-2xl border bg-gradient-to-br ${cardStyles[state]} shadow-xl ${glowStyles[state]} overflow-hidden`}>
      {/* Shine overlay */}
      <div className="absolute inset-0 bg-gradient-to-b from-white/5 to-transparent pointer-events-none" />
      {/* Ready glow pulse */}
      {state === "ready" && (
        <div className="absolute inset-0 rounded-2xl border-2 border-amber-400/30 pointer-events-none" />
      )}

      <div className="p-4 flex items-center gap-3">
        {/* Icon */}
        <div className={`relative flex-shrink-0 w-14 h-14 rounded-2xl bg-gradient-to-br ${iconBg[state]} border flex items-center justify-center text-3xl shadow-inner`}>
          {state === "locked" ? (
            <div className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-2xl backdrop-blur-[1px]">
              <Lock className="w-5 h-5 text-white/40" />
            </div>
          ) : null}
          <span style={{ filter: state === "locked" ? "grayscale(0.8) opacity(0.5)" : undefined }}>{icon}</span>
          {state === "ready" && (
            <div className="absolute -top-1 -right-1 w-4 h-4 bg-amber-400 rounded-full flex items-center justify-center">
              <span className="text-[8px] font-bold text-amber-900">✓</span>
            </div>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="font-bold text-base text-white truncate" style={{ fontFamily: fonts.display }}>
              {title}
            </h3>
            {state === "ready" && <GameBadge variant="gold"><Sparkles className="w-2.5 h-2.5" />Ready!</GameBadge>}
            {state === "locked" && <GameBadge variant="gray"><Lock className="w-2.5 h-2.5" />Locked</GameBadge>}
          </div>
          <GameProgress value={pct} color={state === "ready" ? "amber" : state === "locked" ? "blue" : "purple"} />
          <div className="flex items-center justify-between mt-1.5">
            <span className="text-xs text-white/50" style={{ fontFamily: fonts.body }}>
              {state === "ready" ? "✦ You've got enough!" : (
                <span className="flex items-center gap-1">
                  <Zap className="w-3 h-3 text-amber-400" />{remaining} more to go
                </span>
              )}
            </span>
            <span className="flex items-center gap-1 text-xs font-bold text-amber-300">
              <Coin size={13} />{points}
            </span>
          </div>
        </div>

        {/* CTA */}
        <div className="flex-shrink-0">
          {state === "ready" ? (
            <button className="w-12 h-12 rounded-xl bg-gradient-to-b from-amber-400 to-amber-500 flex items-center justify-center shadow-lg shadow-amber-500/30 active:scale-95 transition-transform border border-amber-300/50">
              <Gift className="w-5 h-5 text-amber-900" />
            </button>
          ) : state === "locked" ? (
            <button className="w-12 h-12 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center opacity-40 cursor-not-allowed">
              <Lock className="w-4 h-4 text-white/50" />
            </button>
          ) : (
            <button className="w-12 h-12 rounded-xl bg-violet-500/20 border border-violet-400/30 flex items-center justify-center">
              <Trophy className="w-5 h-5 text-violet-300" />
            </button>
          )}
        </div>
      </div>
      {note && (
        <div className="px-4 pb-3 -mt-1">
          <span className="text-[10px] text-white/30 italic" style={{ fontFamily: fonts.body }}>{note}</span>
        </div>
      )}
    </div>
  );
}

// ─── TASK CARDS ───────────────────────────────────────────────────────────────
function TaskCard({
  title, icon, points, state, recurrence, isShared, sharedWith, parentView
}: {
  title: string; icon: string; points: number;
  state: "available" | "pending" | "approved" | "rejected" | "locked";
  recurrence?: string; isShared?: boolean; sharedWith?: string;
  parentView?: boolean;
}) {
  const cardBg: Record<string, string> = {
    available: "from-blue-900/70 via-indigo-900/70 to-blue-900/70 border-blue-500/30",
    pending:   "from-violet-900/70 via-purple-900/60 to-violet-900/70 border-violet-500/30",
    approved:  "from-emerald-900/70 via-green-900/60 to-emerald-900/70 border-emerald-500/40",
    rejected:  "from-red-900/60 via-rose-900/60 to-red-900/60 border-red-500/30",
    locked:    "from-slate-900/70 via-slate-800/60 to-slate-900/70 border-slate-600/20",
  };
  const stateIcon = {
    available: <Flame className="w-3.5 h-3.5 text-blue-300" />,
    pending:   <Clock className="w-3.5 h-3.5 text-violet-300" />,
    approved:  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-300" />,
    rejected:  <XCircle className="w-3.5 h-3.5 text-red-300" />,
    locked:    <Lock className="w-3.5 h-3.5 text-white/30" />,
  };
  const stateBadge: Record<string, { label: string; variant: "blue" | "pink" | "green" | "red" | "gray" }> = {
    available: { label: "Do it!", variant: "blue" },
    pending:   { label: "Waiting…", variant: "pink" },
    approved:  { label: "Done!", variant: "green" },
    rejected:  { label: "Try again", variant: "red" },
    locked:    { label: "Completed", variant: "gray" },
  };

  const badge = stateBadge[state];

  return (
    <div className={`relative rounded-2xl border bg-gradient-to-br ${cardBg[state]} shadow-lg overflow-hidden`}>
      <div className="absolute inset-0 bg-gradient-to-b from-white/4 to-transparent pointer-events-none" />
      <div className="p-3.5 flex items-center gap-3">
        {/* Icon */}
        <div className="relative flex-shrink-0">
          <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-2xl ${
            state === "locked" ? "bg-white/5 opacity-40" : "bg-white/10 border border-white/10"
          }`}>
            {icon}
          </div>
          {state === "approved" && (
            <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-emerald-400 rounded-full flex items-center justify-center border-2 border-slate-900">
              <CheckCircle2 className="w-3 h-3 text-emerald-900" />
            </div>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-0.5">
            {stateIcon[state]}
            <h3 className={`font-bold text-sm truncate ${state === "locked" ? "text-white/30" : "text-white"}`} style={{ fontFamily: fonts.display }}>
              {title}
            </h3>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <GameBadge variant={badge.variant}>{badge.label}</GameBadge>
            {recurrence && (
              <span className="text-[10px] text-white/40 font-medium" style={{ fontFamily: fonts.body }}>{recurrence}</span>
            )}
            {isShared && (
              <span className="flex items-center gap-1 text-[10px] text-pink-300/70" style={{ fontFamily: fonts.body }}>
                <Users className="w-2.5 h-2.5" />{sharedWith ?? "Shared"}
              </span>
            )}
          </div>
        </div>

        {/* Points + button */}
        <div className="flex-shrink-0 flex flex-col items-end gap-1.5">
          <span className="flex items-center gap-1 text-sm font-bold text-amber-300">
            <Coin size={14} />+{points}
          </span>
          {state === "available" ? (
            <button className="text-[11px] font-bold px-2.5 py-1 rounded-lg bg-blue-500/25 border border-blue-400/30 text-blue-200 active:scale-95 transition-transform">
              Start
            </button>
          ) : state === "rejected" ? (
            <button className="text-[11px] font-bold px-2.5 py-1 rounded-lg bg-red-500/20 border border-red-400/30 text-red-200">
              Retry
            </button>
          ) : parentView && state === "pending" ? (
            <button className="text-[11px] font-bold px-2.5 py-1 rounded-lg bg-emerald-500/20 border border-emerald-400/30 text-emerald-200">
              Approve
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

// ─── MY REWARDS CARD ─────────────────────────────────────────────────────────
function MyRewardCard({
  title, icon, state, redeemedBy
}: {
  title: string; icon: string;
  state: "pending" | "approved" | "fulfilled" | "shared";
  redeemedBy?: string;
}) {
  const cardBg: Record<string, string> = {
    pending:   "from-violet-900/70 to-purple-900/70 border-violet-400/30",
    approved:  "from-emerald-900/70 to-teal-900/70 border-emerald-400/30",
    fulfilled: "from-amber-900/70 to-yellow-900/70 border-amber-400/40",
    shared:    "from-pink-900/70 to-rose-900/70 border-pink-400/30",
  };
  const stateConfig: Record<string, { icon: React.ReactNode; label: string; labelStyle: string }> = {
    pending:   { icon: <Clock className="w-4 h-4 text-violet-300" />,  label: "Waiting for approval", labelStyle: "text-violet-300" },
    approved:  { icon: <CheckCircle2 className="w-4 h-4 text-emerald-300" />, label: "Approved!", labelStyle: "text-emerald-300" },
    fulfilled: { icon: <Crown className="w-4 h-4 text-amber-300" />,   label: "Redeemed!", labelStyle: "text-amber-300" },
    shared:    { icon: <Heart className="w-4 h-4 text-pink-300" />,    label: "Sharing with family", labelStyle: "text-pink-300" },
  };
  const cfg = stateConfig[state];

  return (
    <div className={`relative rounded-2xl border bg-gradient-to-br ${cardBg[state]} shadow-lg overflow-hidden`}>
      <div className="absolute inset-0 bg-gradient-to-b from-white/5 to-transparent pointer-events-none" />
      <div className="p-3.5 flex items-center gap-3">
        <div className="w-12 h-12 rounded-xl bg-white/10 border border-white/10 flex items-center justify-center text-2xl flex-shrink-0">
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-bold text-sm text-white truncate" style={{ fontFamily: fonts.display }}>{title}</h3>
          <div className="flex items-center gap-1.5 mt-0.5">
            {cfg.icon}
            <span className={`text-xs ${cfg.labelStyle}`} style={{ fontFamily: fonts.body }}>{cfg.label}</span>
          </div>
          {redeemedBy && (
            <p className="text-[10px] text-white/40 mt-0.5" style={{ fontFamily: fonts.body }}>by {redeemedBy}</p>
          )}
        </div>
        {state === "fulfilled" && (
          <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-amber-400/20 border border-amber-400/30 flex items-center justify-center">
            <Trophy className="w-5 h-5 text-amber-300" />
          </div>
        )}
        {state === "shared" && (
          <div className="flex-shrink-0">
            <button className="text-[11px] font-bold px-2.5 py-1 rounded-lg bg-pink-500/20 border border-pink-400/30 text-pink-200">
              View
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── FAMILY GOAL CARD ─────────────────────────────────────────────────────────
function FamilyGoalCard({
  title, icon, description, progress, total, state, contributed
}: {
  title: string; icon: string; description: string;
  progress: number; total: number; state: "active" | "achieved";
  contributed?: boolean;
}) {
  const pct = Math.min((progress / total) * 100, 100);
  const isAchieved = state === "achieved";

  return (
    <div className={`relative rounded-2xl border overflow-hidden shadow-xl ${
      isAchieved
        ? "bg-gradient-to-br from-amber-900/80 to-yellow-900/80 border-amber-400/50"
        : "bg-gradient-to-br from-teal-900/80 to-cyan-900/80 border-teal-500/30"
    }`}>
      <div className="absolute inset-0 bg-gradient-to-b from-white/5 to-transparent pointer-events-none" />
      {isAchieved && (
        <div className="absolute top-0 right-0 w-20 h-20 overflow-hidden">
          <div className="absolute top-2 right-2 text-2xl">🏆</div>
        </div>
      )}

      <div className="p-4">
        <div className="flex items-start gap-3 mb-3">
          <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-2xl flex-shrink-0 ${
            isAchieved ? "bg-amber-400/20 border border-amber-400/30" : "bg-teal-500/20 border border-teal-400/30"
          }`}>
            {icon}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <h3 className="font-bold text-base text-white" style={{ fontFamily: fonts.display }}>{title}</h3>
              {isAchieved && <GameBadge variant="gold"><Star className="w-2.5 h-2.5" />Achieved!</GameBadge>}
              {contributed && !isAchieved && <GameBadge variant="teal"><CheckCircle2 className="w-2.5 h-2.5" />Contributed</GameBadge>}
            </div>
            <p className="text-xs text-white/50" style={{ fontFamily: fonts.body }}>{description}</p>
          </div>
        </div>

        {/* Progress */}
        <div className="space-y-1.5">
          <GameProgress value={pct} color={isAchieved ? "amber" : "teal"} />
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1 text-xs text-white/50" style={{ fontFamily: fonts.body }}>
              <Target className="w-3 h-3" />{progress}/{total} points
            </span>
            {!isAchieved && (
              <button className="text-xs font-bold px-3 py-1 rounded-lg bg-teal-500/20 border border-teal-400/30 text-teal-200">
                Contribute
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── TREASURE CHEST CARD ─────────────────────────────────────────────────────
function TreasureCard({ title, pointCost, members, canAfford }: {
  title: string; pointCost: number; members: string[]; canAfford: boolean;
}) {
  return (
    <div className={`relative rounded-2xl border overflow-hidden shadow-xl ${
      canAfford
        ? "bg-gradient-to-br from-amber-900/80 to-orange-900/80 border-amber-400/50"
        : "bg-gradient-to-br from-slate-900/80 to-slate-800/80 border-slate-600/30"
    }`}>
      <div className="absolute inset-0 bg-gradient-to-b from-white/5 to-transparent pointer-events-none" />
      <div className="p-4">
        <div className="flex items-center gap-3 mb-3">
          <div className={`w-14 h-14 rounded-xl flex items-center justify-center text-3xl ${
            canAfford ? "bg-amber-400/20 border border-amber-400/40" : "bg-white/5 border border-white/10"
          }`}>
            🎁
          </div>
          <div>
            <h3 className="font-bold text-base text-white" style={{ fontFamily: fonts.display }}>{title}</h3>
            <div className="flex items-center gap-2 mt-1">
              <span className={`flex items-center gap-1 text-sm font-bold ${canAfford ? "text-amber-300" : "text-white/40"}`}>
                <Coin size={15} />{pointCost} pts
              </span>
              {canAfford
                ? <GameBadge variant="gold">Can buy!</GameBadge>
                : <GameBadge variant="gray">Not enough</GameBadge>
              }
            </div>
          </div>
        </div>

        {/* Split members */}
        <div className="flex items-center gap-2 p-2.5 rounded-xl bg-white/5 border border-white/10">
          <Users className="w-4 h-4 text-white/40 flex-shrink-0" />
          <div className="flex-1">
            <p className="text-[10px] text-white/40 mb-1" style={{ fontFamily: fonts.body }}>Sharing with</p>
            <div className="flex gap-1 flex-wrap">
              {members.map((m) => (
                <span key={m} className="text-xs font-semibold text-white/70 px-2 py-0.5 bg-white/10 rounded-full">{m}</span>
              ))}
            </div>
          </div>
          <span className="text-xs text-white/40">{Math.round(pointCost / members.length)} ea.</span>
        </div>

        <button className={`w-full mt-3 py-2.5 rounded-xl font-bold text-sm transition-all ${
          canAfford
            ? "bg-gradient-to-b from-amber-400 to-amber-500 text-amber-900 shadow-lg shadow-amber-500/30 border border-amber-300/50"
            : "bg-white/5 border border-white/10 text-white/25 cursor-not-allowed"
        }`} style={{ fontFamily: fonts.display }}>
          {canAfford ? "🎉 Redeem Together!" : "Need more coins"}
        </button>
      </div>
    </div>
  );
}

// ─── PARENT TASK OVERVIEW CARD ────────────────────────────────────────────────
function ParentTaskCard({ title, icon, points, pendingCount, completedCount }: {
  title: string; icon: string; points: number; pendingCount: number; completedCount: number;
}) {
  return (
    <div className="relative rounded-2xl border bg-gradient-to-br from-indigo-900/70 to-blue-900/70 border-indigo-400/25 shadow-lg overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-b from-white/4 to-transparent pointer-events-none" />
      <div className="p-3.5 flex items-center gap-3">
        <div className="w-11 h-11 rounded-xl bg-white/10 border border-white/10 flex items-center justify-center text-2xl flex-shrink-0">
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-bold text-sm text-white truncate" style={{ fontFamily: fonts.display }}>{title}</h3>
          <div className="flex items-center gap-2 mt-1">
            {pendingCount > 0 && (
              <span className="flex items-center gap-1 text-[10px] font-bold text-violet-300 bg-violet-400/15 px-2 py-0.5 rounded-full border border-violet-400/25">
                <Clock className="w-2.5 h-2.5" />{pendingCount} pending
              </span>
            )}
            {completedCount > 0 && (
              <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-300 bg-emerald-400/15 px-2 py-0.5 rounded-full border border-emerald-400/25">
                <CheckCircle2 className="w-2.5 h-2.5" />{completedCount} done
              </span>
            )}
          </div>
        </div>
        <div className="flex-shrink-0 flex flex-col items-end gap-1">
          <span className="flex items-center gap-1 text-sm font-bold text-amber-300">
            <Coin size={14} />{points}
          </span>
          {pendingCount > 0 && (
            <button className="text-[11px] font-bold px-2.5 py-1 rounded-lg bg-emerald-500/20 border border-emerald-400/30 text-emerald-200">
              Review
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── MAIN PREVIEW ─────────────────────────────────────────────────────────────
export function CardSystem() {
  return (
    <div
      className="min-h-screen p-6"
      style={{
        background: "linear-gradient(135deg, #0f0c29 0%, #1a1044 30%, #170b30 60%, #0d1b2a 100%)",
        fontFamily: fonts.body,
      }}
    >
      {/* Google Fonts */}
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Fredoka:wght@400;500;600;700&family=Nunito:wght@400;500;600;700;800&display=swap');`}</style>

      {/* Header */}
      <div className="text-center mb-8">
        <div className="inline-flex items-center gap-2 mb-2">
          <StarBurst />
          <span className="text-xs font-bold text-white/40 uppercase tracking-widest" style={{ fontFamily: fonts.body }}>HeroKids</span>
          <StarBurst />
        </div>
        <h1 className="text-3xl font-bold text-white mb-1" style={{ fontFamily: fonts.display }}>
          Card Design System
        </h1>
        <p className="text-sm text-white/40">All card types · all states · one overview</p>
      </div>

      {/* ── REWARD SHOP ── */}
      <SectionLabel>Reward Shop Cards</SectionLabel>
      <div className="space-y-3 mb-8">
        <RewardCard title="Movie Night" icon="🎬" points={150} current={90} state="available" note="Child view — enough points to collect" />
        <RewardCard title="Ice Cream Trip" icon="🍦" points={100} current={100} state="ready" note="Gold state — child can redeem now" />
        <RewardCard title="New Game" icon="🎮" points={300} current={40} state="locked" note="Locked / not enough points" />
      </div>

      {/* ── TASK CARDS (CHILD VIEW) ── */}
      <SectionLabel>Task Cards — Child View</SectionLabel>
      <div className="space-y-2.5 mb-8">
        <TaskCard title="Clean Your Room" icon="🧹" points={20} state="available" recurrence="Daily" />
        <TaskCard title="Do Homework" icon="📚" points={30} state="pending" recurrence="Daily" note="Awaiting parent approval" />
        <TaskCard title="Feed the Dog" icon="🐕" points={15} state="approved" recurrence="Daily" />
        <TaskCard title="Tidy Kitchen" icon="🍽️" points={25} state="rejected" />
        <TaskCard title="Set the Table" icon="🍴" points={10} state="locked" recurrence="Daily" note="Already completed today" />
        <TaskCard title="Wash Dishes" icon="💧" points={20} state="available" isShared sharedWith="Alex & Sam" />
      </div>

      {/* ── TASK CARDS (PARENT VIEW) ── */}
      <SectionLabel>Task Cards — Parent View</SectionLabel>
      <div className="space-y-2.5 mb-8">
        <ParentTaskCard title="Clean Your Room" icon="🧹" points={20} pendingCount={2} completedCount={0} />
        <ParentTaskCard title="Do Homework" icon="📚" points={30} pendingCount={0} completedCount={3} />
        <ParentTaskCard title="Tidy Kitchen" icon="🍽️" points={25} pendingCount={1} completedCount={1} />
      </div>

      {/* ── MY REWARDS ── */}
      <SectionLabel>My Rewards (Purchased)</SectionLabel>
      <div className="space-y-2.5 mb-8">
        <MyRewardCard title="Movie Night" icon="🎬" state="pending" />
        <MyRewardCard title="Extra Screen Time" icon="📱" state="approved" />
        <MyRewardCard title="Ice Cream Trip" icon="🍦" state="fulfilled" redeemedBy="Mom" />
        <MyRewardCard title="Pizza Friday" icon="🍕" state="shared" />
      </div>

      {/* ── FAMILY GOALS ── */}
      <SectionLabel>Family Goal Cards</SectionLabel>
      <div className="space-y-3 mb-8">
        <FamilyGoalCard
          title="Family Camping Trip"
          icon="⛺"
          description="Earn together for the big adventure!"
          progress={340}
          total={500}
          state="active"
        />
        <FamilyGoalCard
          title="Waterpark Day"
          icon="🏊"
          description="You contributed this week already!"
          progress={120}
          total={400}
          state="active"
          contributed
        />
        <FamilyGoalCard
          title="Board Game Night"
          icon="🎲"
          description="Great teamwork — goal achieved!"
          progress={200}
          total={200}
          state="achieved"
        />
      </div>

      {/* ── SHARED REWARD ── */}
      <SectionLabel>Shared Reward Card</SectionLabel>
      <div className="mb-8">
        <TreasureCard
          title="Theme Park Day"
          pointCost={600}
          members={["Alex", "Sam", "Riley"]}
          canAfford={true}
        />
        <div className="mt-3">
          <TreasureCard
            title="Concert Tickets"
            pointCost={1200}
            members={["Alex", "Sam"]}
            canAfford={false}
          />
        </div>
      </div>

      {/* ── LEGEND ── */}
      <SectionLabel>State Color Legend</SectionLabel>
      <div className="grid grid-cols-2 gap-2 mb-4">
        {[
          { color: "bg-violet-500/30 border-violet-400/40", label: "Available / Active" },
          { color: "bg-amber-500/30 border-amber-400/50", label: "Ready / Unlocked" },
          { color: "bg-slate-600/30 border-slate-500/30", label: "Locked / Disabled" },
          { color: "bg-emerald-500/30 border-emerald-400/40", label: "Completed / Approved" },
          { color: "bg-purple-500/30 border-purple-400/40", label: "Pending Approval" },
          { color: "bg-red-500/20 border-red-400/30", label: "Rejected / Error" },
          { color: "bg-teal-500/30 border-teal-400/40", label: "Family Goal" },
          { color: "bg-pink-500/30 border-pink-400/40", label: "Shared Reward" },
        ].map(({ color, label }) => (
          <div key={label} className={`flex items-center gap-2.5 p-2.5 rounded-xl border ${color}`}>
            <div className={`w-3 h-3 rounded-full ${color.replace("border-", "bg-").split(" ")[0]}`} />
            <span className="text-xs text-white/60" style={{ fontFamily: fonts.body }}>{label}</span>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div className="text-center mt-8 pb-2">
        <div className="flex items-center justify-center gap-2 text-white/20 text-xs">
          <Shield className="w-3 h-3" />
          <span>HeroKids Card Design System v2</span>
          <Sparkles className="w-3 h-3" />
        </div>
      </div>
    </div>
  );
}
