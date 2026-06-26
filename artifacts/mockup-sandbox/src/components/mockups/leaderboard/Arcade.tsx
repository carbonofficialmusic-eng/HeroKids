import { Trophy, Star, Zap } from "lucide-react";

const members = [
  { name: "Peter", points: 505, color: "#f59e0b", initials: "P" },
  { name: "Riewert", points: 304, color: "#5BC4C0", initials: "R" },
  { name: "Juri", points: 240, color: "#a78bfa", initials: "J" },
  { name: "Liv", points: 150, color: "#f472b6", initials: "L" },
  { name: "Katrin", points: 0, color: "#64748b", initials: "K" },
];

const max = members[0].points;

const rankColors = ["#f59e0b", "#94a3b8", "#cd7c2f"];
const rankGlows = ["0 0 12px #f59e0b88", "0 0 8px #94a3b888", "0 0 8px #cd7c2f88"];

export function Arcade() {
  return (
    <div className="min-h-screen bg-[#0d1117] flex items-start justify-center p-6 pt-8">
      <div className="w-full max-w-sm">
        {/* Header */}
        <div className="flex items-center gap-2 mb-5">
          <div className="p-1.5 rounded-lg bg-amber-500/20">
            <Trophy className="w-5 h-5 text-amber-400" />
          </div>
          <div>
            <h2 className="text-white font-black text-lg tracking-wide leading-none">BESTENLISTE</h2>
            <p className="text-teal-400 text-xs font-bold tracking-widest uppercase mt-0.5">Diese Woche</p>
          </div>
          {/* Tabs */}
          <div className="ml-auto flex gap-1">
            <button className="px-3 py-1 rounded-full text-xs font-bold bg-teal-500/20 text-teal-300 border border-teal-500/40">Woche</button>
            <button className="px-3 py-1 rounded-full text-xs font-bold text-slate-500">Monat</button>
          </div>
        </div>

        {/* Members list */}
        <div className="space-y-2.5">
          {members.map((m, i) => {
            const pct = max > 0 ? (m.points / max) * 100 : 0;
            const isTop3 = i < 3;
            return (
              <div
                key={m.name}
                className="relative rounded-2xl p-3 overflow-hidden"
                style={{
                  background: isTop3 ? `${m.color}12` : "#161b22",
                  border: isTop3 ? `1px solid ${m.color}40` : "1px solid #21262d",
                  boxShadow: i === 0 ? `inset 0 0 24px ${m.color}18` : undefined,
                }}
              >
                {/* Rank badge */}
                <div className="flex items-center gap-3">
                  <div
                    className="w-8 h-8 rounded-xl flex items-center justify-center font-black text-sm flex-shrink-0"
                    style={{
                      background: i < 3 ? rankColors[i] : "#1e2530",
                      color: i < 3 ? "#000" : "#64748b",
                      boxShadow: i < 3 ? rankGlows[i] : undefined,
                    }}
                  >
                    {i < 3 ? ["①","②","③"][i] : i + 1}
                  </div>

                  {/* Avatar */}
                  <div
                    className="w-9 h-9 rounded-full flex items-center justify-center font-black text-sm text-white flex-shrink-0"
                    style={{ background: m.color, boxShadow: `0 0 8px ${m.color}66` }}
                  >
                    {m.initials}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-white font-bold text-sm truncate">{m.name}</span>
                      <span className="font-black text-sm ml-2 flex-shrink-0" style={{ color: isTop3 ? m.color : "#64748b" }}>
                        {m.points} <span className="text-xs font-semibold opacity-70">Pkt</span>
                      </span>
                    </div>
                    {/* Progress bar */}
                    <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-700"
                        style={{
                          width: `${pct}%`,
                          background: isTop3 ? `linear-gradient(90deg, ${m.color}88, ${m.color})` : "#334155",
                          boxShadow: isTop3 ? `0 0 6px ${m.color}88` : undefined,
                        }}
                      />
                    </div>
                  </div>
                </div>

                {/* Winner crown */}
                {i === 0 && (
                  <div className="absolute top-2 right-2 flex gap-0.5">
                    <Star className="w-3 h-3 text-amber-400 fill-amber-400" />
                    <Star className="w-4 h-4 text-amber-400 fill-amber-400" />
                    <Star className="w-3 h-3 text-amber-400 fill-amber-400" />
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Prize banner */}
        <div className="mt-4 rounded-2xl p-3 border border-teal-500/30 bg-teal-500/10 flex items-center gap-2">
          <Zap className="w-4 h-4 text-teal-400 flex-shrink-0" />
          <span className="text-teal-300 text-xs font-bold">Wochenpreis: Kino-Abend</span>
        </div>
      </div>
    </div>
  );
}
