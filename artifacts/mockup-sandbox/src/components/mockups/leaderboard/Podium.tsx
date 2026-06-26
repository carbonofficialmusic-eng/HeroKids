import { Gift } from "lucide-react";

const members = [
  { name: "Peter", points: 505, color: "#f59e0b", grad: "from-amber-400 to-orange-500", initials: "P" },
  { name: "Riewert", points: 304, color: "#5BC4C0", grad: "from-teal-400 to-cyan-500", initials: "R" },
  { name: "Juri", points: 240, color: "#a78bfa", grad: "from-violet-400 to-purple-600", initials: "J" },
  { name: "Liv", points: 150, color: "#f472b6", grad: "from-pink-400 to-rose-500", initials: "L" },
  { name: "Katrin", points: 0, color: "#94a3b8", grad: "from-slate-400 to-slate-500", initials: "K" },
];

const podiumOrder = [members[1], members[0], members[2]]; // 2nd, 1st, 3rd
const rest = members.slice(3);

/* 3-D cup icons as styled SVG+gradient divs */
function Cup3D({ rank }: { rank: 1 | 2 | 3 }) {
  const cfg = {
    1: { outer: "#FFD700", inner: "#FFA500", shine: "#FFFBE6", size: 52, shadow: "#b8860b" },
    2: { outer: "#C0C0C0", inner: "#A0A0A0", shine: "#F5F5F5", size: 44, shadow: "#708090" },
    3: { outer: "#CD7F32", inner: "#A0522D", shine: "#F4D3A0", size: 40, shadow: "#7b4f28" },
  }[rank];

  return (
    <svg width={cfg.size} height={cfg.size} viewBox="0 0 48 52" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Drop shadow */}
      <ellipse cx="24" cy="50" rx="12" ry="3" fill={cfg.shadow} opacity="0.35" />
      {/* Cup body */}
      <path d="M10 6 Q10 30 24 34 Q38 30 38 6 Z" fill={cfg.outer} />
      {/* 3-D shine on body */}
      <path d="M14 8 Q13 22 20 28 Q17 20 16 8 Z" fill={cfg.shine} opacity="0.55" />
      {/* Handles */}
      <path d="M10 10 Q4 10 4 18 Q4 26 10 24" stroke={cfg.inner} strokeWidth="3" fill="none" strokeLinecap="round" />
      <path d="M38 10 Q44 10 44 18 Q44 26 38 24" stroke={cfg.inner} strokeWidth="3" fill="none" strokeLinecap="round" />
      {/* Stem */}
      <rect x="20" y="34" width="8" height="8" rx="1" fill={cfg.inner} />
      {/* Base */}
      <rect x="14" y="42" width="20" height="5" rx="2.5" fill={cfg.outer} />
      {/* Base shine */}
      <rect x="16" y="43" width="8" height="2" rx="1" fill={cfg.shine} opacity="0.6" />
    </svg>
  );
}

const podiumBlocks = [
  { height: "h-14", bg: "from-slate-300 to-slate-400", label: "2", labelColor: "text-slate-600" },
  { height: "h-24", bg: "from-amber-400 to-yellow-500", label: "1", labelColor: "text-amber-900" },
  { height: "h-9",  bg: "from-orange-700/70 to-amber-800/60", label: "3", labelColor: "text-amber-900" },
];

export function Podium() {
  return (
    <div
      className="min-h-screen flex items-start justify-center p-5 pt-7"
      style={{ background: "linear-gradient(150deg, #667eea 0%, #764ba2 40%, #f093fb 100%)" }}
    >
      <div className="w-full max-w-sm">
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-white font-black text-2xl leading-tight drop-shadow">Bestenliste</h2>
            <p className="text-white/70 text-sm font-semibold">Diese Woche</p>
          </div>
          <div className="flex gap-1 p-1 bg-white/20 backdrop-blur rounded-xl border border-white/30">
            <button className="px-3 py-1.5 rounded-lg bg-white text-purple-700 text-xs font-black shadow">Woche</button>
            <button className="px-3 py-1.5 rounded-lg text-white/70 text-xs font-semibold">Monat</button>
          </div>
        </div>

        {/* Podium card */}
        <div className="bg-white/15 backdrop-blur-sm rounded-3xl p-5 mb-4 border border-white/25">
          <div className="flex items-end justify-center gap-3">
            {podiumOrder.map((m, col) => {
              const rank = col === 0 ? 2 : col === 1 ? 1 : 3;
              const blk = podiumBlocks[col];
              const avatarSize = rank === 1 ? "w-16 h-16 text-xl" : "w-12 h-12 text-base";
              return (
                <div key={m.name} className="flex flex-col items-center flex-1">
                  {/* 3-D cup */}
                  <div className="mb-1">
                    <Cup3D rank={rank as 1|2|3} />
                  </div>

                  {/* Avatar */}
                  <div
                    className={`${avatarSize} rounded-full flex items-center justify-center text-white font-black mb-1.5 flex-shrink-0`}
                    style={{
                      background: `linear-gradient(135deg, ${m.color}cc, ${m.color})`,
                      boxShadow: `0 4px 14px ${m.color}88`,
                      border: "3px solid rgba(255,255,255,0.6)",
                    }}
                  >
                    {m.initials}
                  </div>

                  <p className="font-black text-white text-xs text-center leading-tight drop-shadow mb-0.5">{m.name}</p>
                  <p
                    className="font-black text-sm mb-1"
                    style={{ color: m.color, textShadow: "0 1px 4px rgba(0,0,0,0.3)" }}
                  >
                    {m.points}
                  </p>

                  {/* Podium block */}
                  <div className={`w-full ${blk.height} rounded-t-xl bg-gradient-to-b ${blk.bg} flex items-center justify-center shadow-inner`}>
                    <span className={`font-black text-xl ${blk.labelColor}`}>{blk.label}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Rest */}
        <div className="bg-white/15 backdrop-blur-sm rounded-3xl overflow-hidden border border-white/20 mb-4">
          {rest.map((m, i) => (
            <div
              key={m.name}
              className={`flex items-center gap-3 px-4 py-3 ${i < rest.length - 1 ? "border-b border-white/15" : ""}`}
            >
              <span className="w-5 text-center text-white/50 font-bold text-sm">{i + 4}</span>
              <div
                className="w-9 h-9 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0"
                style={{ background: `linear-gradient(135deg, ${m.color}aa, ${m.color})`, border: "2px solid rgba(255,255,255,0.4)" }}
              >
                {m.initials}
              </div>
              <span className="flex-1 font-bold text-white/90 text-sm">{m.name}</span>
              <span className="font-black text-white/70 text-sm">{m.points} <span className="text-xs font-normal opacity-70">Pkt</span></span>
            </div>
          ))}
        </div>

        {/* Prize */}
        <div className="rounded-2xl p-3 bg-white/20 border border-white/30 flex items-center gap-2 backdrop-blur-sm">
          <Gift className="w-4 h-4 text-yellow-300 flex-shrink-0" />
          <span className="text-white font-bold text-xs">Wochenpreis: Kino-Abend</span>
        </div>
      </div>
    </div>
  );
}
