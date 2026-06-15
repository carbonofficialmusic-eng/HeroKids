import { useState, useEffect } from "react";

const IMG_URL = "/herokids_characters.png";

const steps = [
  {
    character: "boy" as const,
    bubble: "Hier erstellst du neue Aufgaben für deine Kinder — tippe einfach auf das +!",
    highlight: "add-task",
    label: "Aufgabe hinzufügen",
  },
  {
    character: "girl" as const,
    bubble: "Hier siehst du alle Familienmitglieder und deren Punktestand auf einen Blick.",
    highlight: "members",
    label: "Familienmitglieder",
  },
  {
    character: "boy" as const,
    bubble: "Belohnungen motivieren! Leg hier fest, was sich deine Kinder verdienen können.",
    highlight: "rewards",
    label: "Belohnungen",
  },
  {
    character: "girl" as const,
    bubble: "Alle Einstellungen für deine Familie findest du hier — Zeitzone, Plan und mehr.",
    highlight: "settings",
    label: "Einstellungen",
  },
];

function Character({ type, size = 130 }: { type: "boy" | "girl"; size?: number }) {
  const isBoy = type === "boy";
  return (
    <div
      style={{
        width: size,
        height: size * 1.9,
        overflow: "hidden",
        flexShrink: 0,
      }}
    >
      <img
        src={IMG_URL}
        alt={isBoy ? "Hero Max" : "Hero Mia"}
        style={{
          width: size * 2,
          height: size * 2 * 2,
          objectFit: "cover",
          objectPosition: isBoy ? "left top" : "right top",
          display: "block",
          imageRendering: "crisp-edges",
        }}
      />
    </div>
  );
}

const highlightRects: Record<string, { top: number; left: number; w: number; h: number }> = {
  "add-task":  { top: 58,  left: 14, w: 150, h: 44 },
  "members":   { top: 120, left: 14, w: 220, h: 100 },
  "rewards":   { top: 240, left: 14, w: 220, h: 80  },
  "settings":  { top: 18,  left: 270, w: 60, h: 36  },
};

export function OnboardingWizard() {
  const [current, setCurrent] = useState(0);
  const [visible, setVisible] = useState(true);
  const step = steps[current];
  const isLast = current === steps.length - 1;
  const rect = highlightRects[step.highlight];

  const advance = () => {
    if (isLast) { setVisible(false); return; }
    setCurrent(c => c + 1);
  };

  if (!visible) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <p className="text-gray-400 text-sm">Tour abgeschlossen ✓</p>
      </div>
    );
  }

  return (
    <div className="relative w-full font-sans" style={{ height: "100vh", background: "#f3f4f6", overflow: "hidden" }}>

      {/* ── Simulated Dashboard ─────────────────────────────── */}
      <div className="absolute inset-0 flex flex-col" style={{ background: "#f3f4f6" }}>
        {/* Top bar */}
        <div className="flex items-center justify-between px-4 py-3 bg-white border-b border-gray-100 shadow-sm">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-full bg-teal-400"/>
            <span className="font-bold text-gray-700 text-sm">HeroKids</span>
          </div>
          <div className="flex gap-2">
            <div data-highlight="settings"
              className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center text-gray-400 text-xs">⚙</div>
            <div className="w-8 h-8 rounded-full bg-teal-100 flex items-center justify-center text-teal-600 text-xs font-bold">M</div>
          </div>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Main content */}
          <div className="flex-1 p-4 overflow-auto">
            {/* Add task button */}
            <div data-highlight="add-task"
              className="flex items-center gap-2 bg-teal-500 text-white rounded-xl px-4 py-3 text-sm font-semibold w-44 shadow-md mb-4">
              <span className="text-lg leading-none">+</span> Aufgabe erstellen
            </div>

            {/* Members row */}
            <div data-highlight="members" className="mb-4">
              <p className="text-xs text-gray-400 font-semibold mb-2 uppercase tracking-wide">Kinder</p>
              <div className="flex gap-3">
                {["Lena 120 P", "Tom 85 P", "Anna 60 P"].map(m => (
                  <div key={m} className="bg-white rounded-xl px-3 py-2 text-xs text-gray-600 shadow-sm flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-teal-200"/>
                    {m}
                  </div>
                ))}
              </div>
            </div>

            {/* Rewards */}
            <div data-highlight="rewards" className="mb-4">
              <p className="text-xs text-gray-400 font-semibold mb-2 uppercase tracking-wide">Belohnungen</p>
              <div className="flex gap-3">
                {["Kinoabend", "Spielzeit"].map(r => (
                  <div key={r} className="bg-white rounded-xl px-3 py-2 text-xs text-gray-600 shadow-sm">
                    🎁 {r}
                  </div>
                ))}
              </div>
            </div>

            {/* Task list placeholder */}
            <div className="space-y-2">
              {["Zimmer aufräumen", "Hausaufgaben", "Tisch decken"].map(t => (
                <div key={t} className="bg-white rounded-xl px-4 py-3 text-sm text-gray-600 shadow-sm flex justify-between">
                  <span>{t}</span>
                  <span className="text-teal-500 text-xs">+10 P</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── Spotlight overlay ───────────────────────────────── */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: "rgba(0,0,0,0.45)",
          transition: "all 0.4s ease",
        }}
      />
      {/* Cutout hole */}
      {rect && (
        <div
          className="absolute pointer-events-none"
          style={{
            top: rect.top - 6,
            left: rect.left - 6,
            width: rect.w + 12,
            height: rect.h + 12,
            borderRadius: 14,
            boxShadow: "0 0 0 9999px rgba(0,0,0,0.45)",
            border: "2px solid rgba(99,214,210,0.8)",
            background: "transparent",
            transition: "all 0.4s cubic-bezier(.4,0,.2,1)",
            zIndex: 10,
          }}
        />
      )}

      {/* ── Character + speech bubble (bottom right) ───────── */}
      <div
        className="absolute flex flex-col items-end"
        style={{
          bottom: 0,
          right: 12,
          zIndex: 20,
          transition: "all 0.35s ease",
        }}
      >
        {/* Speech bubble */}
        <div
          className="relative bg-white rounded-2xl rounded-br-sm px-4 py-3 shadow-xl mb-2 max-w-[200px]"
          style={{ border: "1.5px solid rgba(99,214,210,0.4)" }}
        >
          <p className="text-xs text-gray-700 leading-snug">{step.bubble}</p>

          {/* Step dots */}
          <div className="flex justify-center gap-1.5 mt-2">
            {steps.map((_, i) => (
              <div
                key={i}
                className="rounded-full transition-all duration-300"
                style={{
                  width: i === current ? 16 : 6,
                  height: 6,
                  background: i === current ? "#5BC4C0" : "#d1d5db",
                }}
              />
            ))}
          </div>

          {/* Arrow pointing down-right */}
          <div
            className="absolute -bottom-2.5 right-4 w-5 h-3 bg-white"
            style={{
              clipPath: "polygon(0 0, 100% 0, 100% 100%)",
              border: "none",
            }}
          />
        </div>

        {/* Buttons row + character */}
        <div className="flex items-end gap-2">
          <div className="flex flex-col gap-1.5 mb-8">
            <button
              onClick={advance}
              className="px-4 py-2 rounded-xl text-white text-xs font-bold shadow-lg"
              style={{ background: isLast ? "#22c55e" : "#5BC4C0", minWidth: 90 }}
            >
              {isLast ? "Fertig!" : "Weiter →"}
            </button>
            <button
              onClick={() => setVisible(false)}
              className="px-4 py-1.5 rounded-xl text-xs text-gray-400 bg-white/80 shadow"
            >
              Überspringen
            </button>
          </div>

          {/* Character image - CSS-cropped */}
          <div style={{ transition: "all 0.35s ease" }}>
            <Character type={step.character} size={100} />
          </div>
        </div>
      </div>
    </div>
  );
}
