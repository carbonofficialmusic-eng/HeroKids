import { useState } from "react";

const steps = [
  {
    hero: "both",
    speaker: "left",
    bubble: "Willkommen bei HeroKids! Ich bin Max und das ist Mia. Wir zeigen dir alles, was du brauchst!",
    title: "Herzlich willkommen!",
    subtitle: "Dein Familien-Abenteuer beginnt jetzt.",
    step: 1,
  },
  {
    hero: "left",
    speaker: "left",
    bubble: "Erstell Aufgaben für deine Kinder — einmalig oder wiederkehrend. Mit Punkten als Belohnung!",
    title: "Aufgaben erstellen",
    subtitle: "Tippe auf das + Symbol im Dashboard.",
    step: 2,
  },
  {
    hero: "right",
    speaker: "right",
    bubble: "Kinder sammeln Punkte und können damit Belohnungen einlösen. Das motiviert wirklich!",
    title: "Belohnungen vergeben",
    subtitle: "Lege Belohnungen fest, auf die sich deine Kinder freuen.",
    step: 3,
  },
  {
    hero: "left",
    speaker: "left",
    bubble: "Lade Familienmitglieder ein — jeder bekommt seinen eigenen Bereich. Los geht's!",
    title: "Familie einladen",
    subtitle: "Nutze den Einladungslink in den Einstellungen.",
    step: 4,
  },
];

function HeroMax({ size = 160, dim = false }: { size?: number; dim?: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 120 140" fill="none" xmlns="http://www.w3.org/2000/svg"
      style={{ opacity: dim ? 0.35 : 1, transition: "opacity 0.3s" }}>
      {/* Cape */}
      <path d="M30 70 Q20 100 25 130 Q60 120 95 130 Q100 100 90 70 Z" fill="#5BC4C0" opacity="0.7"/>
      {/* Body */}
      <rect x="35" y="68" width="50" height="50" rx="10" fill="#5BC4C0"/>
      {/* Logo on chest */}
      <circle cx="60" cy="85" r="8" fill="white" opacity="0.8"/>
      <text x="60" y="89" textAnchor="middle" fontSize="9" fill="#5BC4C0" fontWeight="bold">H</text>
      {/* Head */}
      <ellipse cx="60" cy="48" rx="22" ry="24" fill="#FFDAA0"/>
      {/* Blonde hair */}
      <ellipse cx="60" cy="30" rx="22" ry="12" fill="#F5C842"/>
      <path d="M38 35 Q30 25 35 18 Q42 28 48 32" fill="#F5C842"/>
      <path d="M82 35 Q90 25 85 18 Q78 28 72 32" fill="#F5C842"/>
      {/* Mask */}
      <path d="M42 46 Q50 40 60 44 Q70 40 78 46 Q70 52 60 50 Q50 52 42 46Z" fill="#E86C5A" opacity="0.9"/>
      {/* Eyes */}
      <ellipse cx="52" cy="46" rx="4" ry="3" fill="white"/>
      <ellipse cx="68" cy="46" rx="4" ry="3" fill="white"/>
      <circle cx="53" cy="46" r="2" fill="#333"/>
      <circle cx="69" cy="46" r="2" fill="#333"/>
      {/* Smile */}
      <path d="M52 58 Q60 64 68 58" stroke="#C97B4B" strokeWidth="2" fill="none" strokeLinecap="round"/>
      {/* Raised fist */}
      <rect x="88" y="55" width="16" height="20" rx="6" fill="#FFDAA0"/>
      <rect x="89" y="50" width="14" height="10" rx="4" fill="#FFDAA0"/>
      {/* Left arm down */}
      <rect x="18" y="70" width="16" height="20" rx="6" fill="#5BC4C0"/>
      <ellipse cx="26" cy="93" rx="8" ry="8" fill="#FFDAA0"/>
      {/* Legs */}
      <rect x="40" y="112" width="16" height="24" rx="6" fill="#3A8F8A"/>
      <rect x="64" y="112" width="16" height="24" rx="6" fill="#3A8F8A"/>
      {/* Boots */}
      <rect x="38" y="130" width="20" height="10" rx="4" fill="#2A6F6A"/>
      <rect x="62" y="130" width="20" height="10" rx="4" fill="#2A6F6A"/>
    </svg>
  );
}

function HeroMia({ size = 160, dim = false }: { size?: number; dim?: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 120 140" fill="none" xmlns="http://www.w3.org/2000/svg"
      style={{ opacity: dim ? 0.35 : 1, transition: "opacity 0.3s" }}>
      {/* Cape flowing */}
      <path d="M85 68 Q100 95 95 130 Q60 122 25 130 Q20 100 35 68 Z" fill="#7DD6D3" opacity="0.7"/>
      {/* Body */}
      <rect x="35" y="68" width="50" height="50" rx="10" fill="#7DD6D3"/>
      {/* Star on chest */}
      <text x="60" y="92" textAnchor="middle" fontSize="16" fill="white" opacity="0.9">★</text>
      {/* Head */}
      <ellipse cx="60" cy="48" rx="22" ry="24" fill="#FFDAA0"/>
      {/* Red/pink hair - pigtails */}
      <ellipse cx="60" cy="28" rx="22" ry="11" fill="#E86080"/>
      <path d="M38 34 Q28 22 32 14 Q40 26 46 32" fill="#E86080"/>
      <path d="M82 34 Q92 22 88 14 Q80 26 74 32" fill="#E86080"/>
      {/* Hair ribbons */}
      <circle cx="37" cy="36" r="5" fill="#FF8FAB" opacity="0.9"/>
      <circle cx="83" cy="36" r="5" fill="#FF8FAB" opacity="0.9"/>
      {/* Eyes — bigger, rounder */}
      <ellipse cx="52" cy="48" rx="5" ry="5" fill="white"/>
      <ellipse cx="68" cy="48" rx="5" ry="5" fill="white"/>
      <circle cx="53" cy="48" r="3" fill="#555"/>
      <circle cx="69" cy="48" r="3" fill="#555"/>
      {/* Sparkle in eyes */}
      <circle cx="55" cy="46" r="1" fill="white"/>
      <circle cx="71" cy="46" r="1" fill="white"/>
      {/* Rosy cheeks */}
      <ellipse cx="46" cy="55" rx="6" ry="4" fill="#FFB3C6" opacity="0.5"/>
      <ellipse cx="74" cy="55" rx="6" ry="4" fill="#FFB3C6" opacity="0.5"/>
      {/* Smile */}
      <path d="M50 60 Q60 68 70 60" stroke="#C97B4B" strokeWidth="2" fill="none" strokeLinecap="round"/>
      {/* Arms */}
      <rect x="18" y="70" width="16" height="20" rx="6" fill="#7DD6D3"/>
      <ellipse cx="26" cy="93" rx="8" ry="8" fill="#FFDAA0"/>
      <rect x="86" y="70" width="16" height="20" rx="6" fill="#7DD6D3"/>
      <ellipse cx="94" cy="93" rx="8" ry="8" fill="#FFDAA0"/>
      {/* Skirt */}
      <path d="M35 112 Q60 125 85 112 L80 118 Q60 132 40 118 Z" fill="#5BC4C0"/>
      {/* Legs */}
      <rect x="42" y="118" width="14" height="18" rx="6" fill="#FFDAA0"/>
      <rect x="64" y="118" width="14" height="18" rx="6" fill="#FFDAA0"/>
      {/* Shoes */}
      <ellipse cx="49" cy="137" rx="10" ry="5" fill="#E86080"/>
      <ellipse cx="71" cy="137" rx="10" ry="5" fill="#E86080"/>
    </svg>
  );
}

function SpeechBubble({ text, side }: { text: string; side: "left" | "right" }) {
  return (
    <div className={`relative max-w-[220px] bg-white rounded-2xl px-4 py-3 shadow-md text-sm text-gray-700 leading-snug
      ${side === "left" ? "rounded-bl-sm" : "rounded-br-sm"}`}>
      <p>{text}</p>
      {side === "left" && (
        <div className="absolute -bottom-2 left-4 w-4 h-4 bg-white"
          style={{ clipPath: "polygon(0 0, 100% 0, 0 100%)" }}/>
      )}
      {side === "right" && (
        <div className="absolute -bottom-2 right-4 w-4 h-4 bg-white"
          style={{ clipPath: "polygon(0 0, 100% 0, 100% 100%)" }}/>
      )}
    </div>
  );
}

export function OnboardingWizard() {
  const [current, setCurrent] = useState(0);
  const step = steps[current];
  const isLast = current === steps.length - 1;

  return (
    <div className="min-h-screen bg-gradient-to-b from-sky-100 to-teal-50 flex items-center justify-center p-4 font-sans">
      <div className="bg-white rounded-3xl shadow-xl w-full max-w-sm overflow-hidden">

        {/* Skip */}
        <div className="flex justify-end px-5 pt-4">
          <button
            onClick={() => setCurrent(steps.length - 1)}
            className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
          >
            Überspringen →
          </button>
        </div>

        {/* Characters scene */}
        <div className="relative bg-gradient-to-b from-sky-50 to-teal-50 mx-4 rounded-2xl overflow-hidden"
          style={{ height: 220 }}>

          {/* Clouds */}
          <div className="absolute top-3 left-6 w-16 h-6 bg-white rounded-full opacity-60"/>
          <div className="absolute top-5 left-10 w-10 h-5 bg-white rounded-full opacity-50"/>
          <div className="absolute top-2 right-10 w-14 h-5 bg-white rounded-full opacity-60"/>

          {/* Ground */}
          <div className="absolute bottom-0 left-0 right-0 h-10 bg-teal-200 rounded-b-2xl opacity-50"/>

          {/* Left character: Max */}
          <div className="absolute bottom-6 left-6" style={{ transition: "all 0.4s ease" }}>
            <HeroMax size={110} dim={step.hero === "right"} />
          </div>

          {/* Right character: Mia */}
          <div className="absolute bottom-6 right-6" style={{ transition: "all 0.4s ease" }}>
            <HeroMia size={110} dim={step.hero === "left"} />
          </div>

          {/* Speech bubble */}
          <div className={`absolute top-4 ${step.speaker === "left" ? "left-28" : "right-28"} z-10`}
            style={{ transition: "all 0.3s ease" }}>
            <SpeechBubble text={step.bubble} side={step.speaker} />
          </div>
        </div>

        {/* Step dots */}
        <div className="flex justify-center gap-2 mt-5">
          {steps.map((_, i) => (
            <button
              key={i}
              onClick={() => setCurrent(i)}
              className={`rounded-full transition-all duration-300 ${
                i === current
                  ? "w-6 h-2.5 bg-teal-500"
                  : "w-2.5 h-2.5 bg-gray-200 hover:bg-teal-200"
              }`}
            />
          ))}
        </div>

        {/* Content */}
        <div className="px-6 pt-4 pb-2 text-center">
          <h2 className="text-xl font-bold text-gray-800 mb-1">{step.title}</h2>
          <p className="text-sm text-gray-500">{step.subtitle}</p>
        </div>

        {/* Buttons */}
        <div className="px-6 pb-6 pt-3 flex gap-3">
          {current > 0 && (
            <button
              onClick={() => setCurrent(c => c - 1)}
              className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
            >
              Zurück
            </button>
          )}
          <button
            onClick={() => isLast ? undefined : setCurrent(c => c + 1)}
            className={`flex-1 py-2.5 rounded-xl text-sm font-bold text-white transition-all
              ${isLast
                ? "bg-emerald-500 hover:bg-emerald-600 shadow-lg shadow-emerald-200"
                : "bg-teal-500 hover:bg-teal-600 shadow-lg shadow-teal-200"
              }`}
          >
            {isLast ? "Los geht's!" : "Weiter →"}
          </button>
        </div>

        {/* Step counter */}
        <p className="text-center text-xs text-gray-300 pb-4">
          Schritt {current + 1} von {steps.length}
        </p>
      </div>
    </div>
  );
}
