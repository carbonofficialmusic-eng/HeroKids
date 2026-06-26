import { Flame, Trophy, Sparkles } from "lucide-react";

const members = [
  { name: "Peter", points: 505, color: "#f97316", initials: "P" },
  { name: "Riewert", points: 304, color: "#5BC4C0", initials: "R" },
  { name: "Juri", points: 240, color: "#818cf8", initials: "J" },
  { name: "Liv", points: 150, color: "#f472b6", initials: "L" },
  { name: "Katrin", points: 0, color: "#475569", initials: "K" },
];

const max = members[0].points;

const rankStyle = [
  { icon: <Flame className="w-4 h-4 text-orange-400" />, label: "🥇", bg: "from-orange-500/20 to-amber-500/10", border: "border-orange-500/40" },
  { icon: <Sparkles className="w-4 h-4 text-teal-400" />, label: "🥈", bg: "from-teal-500/20 to-cyan-500/10", border: "border-teal-500/30" },
  { icon: <Sparkles className="w-4 h-4 text-purple-400" />, label: "🥉", bg: "from-purple-500/20 to-indigo-500/10", border: "border-purple-500/30" },
];

export function FireLeague() {
  return (
    <div
      className="min-h-screen flex items-start justify-center p-6 pt-8"
      style={{ background: "linear-gradient(160deg, #0f172a 0%, #1e1b4b 50%, #0f172a 100%)" }}
    >
      <div className="w-full max-w-sm">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/5 border border-white/10 mb-3">
            <Trophy className="w-3.5 h-3.5 text-amber-400" />
            <span className="text-xs font-bold text-white/70 tracking-widest uppercase">Fire League</span>
          </div>
          <h2 className="text-white font-black text-2xl mb-1">Bestenliste</h2>
          <div className="flex gap-2 justify-center">
            <button className="px-4 py-1.5 rounded-full bg-white/15 text-white text-xs font-bold border border-white/20">Woche</button>
            <button className="px-4 py-1.5 rounded-full text-white/40 text-xs font-semibold">Monat</button>
          </div>
        </div>

        {/* Top 3 cards */}
        <div className="space-y-2.5 mb-3">
          {members.slice(0, 3).map((m, i) => {
            const pct = max > 0 ? (m.points / max) * 100 : 0;
            const rs = rankStyle[i];
            return (
              <div
                key={m.name}
                className={`rounded-2xl p-4 bg-gradient-to-r ${rs.bg} border ${rs.border}`}
              >
                <div className="flex items-center gap-3 mb-2.5">
                  <span className="text-xl">{rs.label}</span>
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center text-white font-black text-base flex-shrink-0"
                    style={{ background: `linear-gradient(135deg, ${m.color}cc, ${m.color})` }}
                  >
                    {m.initials}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-white font-bold text-sm leading-none">{m.name}</p>
                    <p className="text-white/50 text-xs mt-0.5">Rang #{i + 1}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="font-black text-xl leading-none" style={{ color: m.color }}>{m.points}</p>
                    <p className="text-white/40 text-xs">Punkte</p>
                  </div>
                </div>
                {/* Bar */}
                <div className="h-2 rounded-full bg-white/10 overflow-hidden">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${pct}%`,
                      background: `linear-gradient(90deg, ${m.color}88, ${m.color})`,
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>

        {/* Rest as compact list */}
        <div className="rounded-2xl overflow-hidden border border-white/10 bg-white/5">
          {members.slice(3).map((m, i) => (
            <div key={m.name} className={`flex items-center gap-3 px-4 py-3 ${i === 0 ? "border-b border-white/10" : ""}`}>
              <span className="w-5 text-center text-white/30 font-bold text-sm">{i + 4}</span>
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-xs flex-shrink-0"
                style={{ background: m.color + "66" }}
              >
                {m.initials}
              </div>
              <span className="flex-1 text-white/60 font-semibold text-sm">{m.name}</span>
              <span className="text-white/40 font-bold text-sm">{m.points} Pkt</span>
            </div>
          ))}
        </div>

        {/* Prize */}
        <div className="mt-4 rounded-2xl p-3 border border-amber-500/30 bg-amber-500/10 flex items-center gap-2">
          <Flame className="w-4 h-4 text-amber-400 flex-shrink-0" />
          <span className="text-amber-300 text-xs font-bold">Wochenpreis: Kino-Abend</span>
        </div>
      </div>
    </div>
  );
}
