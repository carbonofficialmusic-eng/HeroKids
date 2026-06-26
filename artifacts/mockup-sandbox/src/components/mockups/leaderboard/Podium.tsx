import { Trophy, Medal, Award, Gift } from "lucide-react";

const members = [
  { name: "Peter", points: 505, color: "#f59e0b", initials: "P" },
  { name: "Riewert", points: 304, color: "#5BC4C0", initials: "R" },
  { name: "Juri", points: 240, color: "#a78bfa", initials: "J" },
  { name: "Liv", points: 150, color: "#f472b6", initials: "L" },
  { name: "Katrin", points: 0, color: "#94a3b8", initials: "K" },
];

const podiumOrder = [members[1], members[0], members[2]]; // 2nd, 1st, 3rd
const rest = members.slice(3);

export function Podium() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 flex items-start justify-center p-6 pt-8">
      <div className="w-full max-w-sm">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-slate-900 font-black text-xl leading-tight">Bestenliste</h2>
            <p className="text-slate-500 text-sm">Diese Woche</p>
          </div>
          <div className="flex gap-1 p-1 bg-white rounded-xl shadow-sm border border-slate-200">
            <button className="px-3 py-1.5 rounded-lg bg-slate-900 text-white text-xs font-bold">Woche</button>
            <button className="px-3 py-1.5 rounded-lg text-slate-500 text-xs font-semibold">Monat</button>
          </div>
        </div>

        {/* Podium */}
        <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100 mb-4">
          <div className="flex items-end justify-center gap-6">
            {/* 2nd place */}
            <div className="flex flex-col items-center flex-1">
              <Medal className="w-5 h-5 text-slate-400 mb-2" />
              <div
                className="w-14 h-14 rounded-full flex items-center justify-center text-white font-black text-lg mb-2 ring-4 ring-offset-2"
                style={{ background: podiumOrder[0].color, ringColor: podiumOrder[0].color + "40" }}
              >
                {podiumOrder[0].initials}
              </div>
              <p className="font-bold text-slate-700 text-sm text-center leading-tight">{podiumOrder[0].name}</p>
              <p className="font-black text-slate-400 text-base">{podiumOrder[0].points}</p>
              {/* Podium block */}
              <div className="w-full h-12 rounded-t-xl mt-2 bg-slate-200 flex items-center justify-center">
                <span className="font-black text-slate-500 text-xl">2</span>
              </div>
            </div>

            {/* 1st place */}
            <div className="flex flex-col items-center flex-1 -translate-y-4">
              <Trophy className="w-6 h-6 text-amber-500 mb-2" />
              <div
                className="w-16 h-16 rounded-full flex items-center justify-center text-white font-black text-xl mb-2 ring-4 ring-offset-2"
                style={{ background: podiumOrder[1].color, ringColor: podiumOrder[1].color + "40" }}
              >
                {podiumOrder[1].initials}
              </div>
              <p className="font-black text-slate-800 text-sm text-center leading-tight">{podiumOrder[1].name}</p>
              <p className="font-black text-amber-500 text-xl">{podiumOrder[1].points}</p>
              {/* Podium block */}
              <div className="w-full h-20 rounded-t-xl mt-2 bg-amber-400 flex items-center justify-center">
                <span className="font-black text-white text-2xl">1</span>
              </div>
            </div>

            {/* 3rd place */}
            <div className="flex flex-col items-center flex-1">
              <Award className="w-5 h-5 text-amber-700 mb-2" />
              <div
                className="w-14 h-14 rounded-full flex items-center justify-center text-white font-black text-lg mb-2 ring-4 ring-offset-2"
                style={{ background: podiumOrder[2].color, ringColor: podiumOrder[2].color + "40" }}
              >
                {podiumOrder[2].initials}
              </div>
              <p className="font-bold text-slate-700 text-sm text-center leading-tight">{podiumOrder[2].name}</p>
              <p className="font-black text-amber-700 text-base">{podiumOrder[2].points}</p>
              {/* Podium block */}
              <div className="w-full h-8 rounded-t-xl mt-2 bg-amber-700/40 flex items-center justify-center">
                <span className="font-black text-amber-800 text-lg">3</span>
              </div>
            </div>
          </div>
        </div>

        {/* Rest */}
        <div className="bg-white rounded-3xl overflow-hidden shadow-sm border border-slate-100">
          {rest.map((m, i) => (
            <div key={m.name} className={`flex items-center gap-3 px-4 py-3 ${i < rest.length - 1 ? "border-b border-slate-100" : ""}`}>
              <span className="w-5 text-center text-slate-400 font-bold text-sm">{i + 4}</span>
              <div
                className="w-9 h-9 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0"
                style={{ background: m.color }}
              >
                {m.initials}
              </div>
              <span className="flex-1 font-semibold text-slate-700">{m.name}</span>
              <span className="font-black text-slate-500">{m.points} <span className="text-xs font-normal">Pkt</span></span>
            </div>
          ))}
        </div>

        {/* Prize */}
        <div className="mt-4 rounded-2xl p-3 bg-amber-50 border border-amber-200 flex items-center gap-2">
          <Gift className="w-4 h-4 text-amber-600 flex-shrink-0" />
          <span className="text-amber-700 text-xs font-bold">Wochenpreis: Kino-Abend</span>
        </div>
      </div>
    </div>
  );
}
