import { useState, useEffect, useCallback, useRef } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import boyImg from "@assets/Gemini_Generated_Image_i6o7f7i6o7f7i6o7_1781527770195.png";
import girlImg from "@assets/Gemini_Generated_Image_rjvz3prjvz3prjvz_1781527787492.png";

interface TourStep {
  key: string;
  character: "boy" | "girl";
  bubble: string;
}

const STEPS: TourStep[] = [
  {
    key: "",
    character: "girl",
    bubble:
      "Hei! Ich bin Mia — deine HeroKids-Führerin! Ich zeige dir in ein paar Schritten, wie alles funktioniert. Du kannst jederzeit abbrechen und später weitermachen.",
  },
  {
    key: "tour-add-task",
    character: "boy",
    bubble:
      "Hier erstellst du neue Aufgaben für deine Kinder. Du kannst Punkte vergeben, ein Fälligkeitsdatum setzen, Beweisfoto und Genehmigungen verlangen, Einkaufslisten erstellen und Kindern Aufgaben zuweisen. Aufgaben die du als Wichtig markierst erscheinen immer ganz oben in der Aufgabenliste.",
  },
  {
    key: "tour-rewards",
    character: "girl",
    bubble:
      "Belohnungen sind der beste Antrieb! Leg fest, was sich deine Kinder mit ihren gesammelten Punkten verdienen können. Belohnungen können auch zum Teilen angeboten werden.",
  },
  {
    key: "tour-approvals",
    character: "boy",
    bubble:
      "Wenn ein Kind eine Aufgabe als erledigt markiert hat, landet sie hier zur Prüfung.",
  },
  {
    key: "tour-profile-menu",
    character: "girl",
    bubble:
      "In den Einstellungen findest du Zeitzone, Familiencode, Device Link Funktion für Kinder, deinen Plan und vieles mehr. Mit dem Nutzerwechsel kannst du schnell zwischen den Kinderkonten wechseln — praktisch wenn mehrere Kinder dasselbe Gerät nutzen.",
  },
  {
    key: "tour-skins",
    character: "boy",
    bubble:
      "Über das Stern-Symbol kann jedes Kind eigene Charakter-Skins und neue Hintergründe freischalten. Dort kannst du auch Sterne sammeln um alle HeroKids freizuschalten.",
  },
  {
    key: "tour-bonus-rewards",
    character: "girl",
    bubble:
      "Bonus-Belohnungen sind besondere Extras. Wer wird monatlicher Champion? Du kannst Punkte vergeben oder auch eigene Belohnungen eingeben — wie zum Beispiel Taschengelderhöhungen.",
  },
  {
    key: "tour-family-goals",
    character: "boy",
    bubble:
      "Familienziele schweißen zusammen! Alle Kinder arbeiten gemeinsam auf ein Ziel hin — zum Beispiel ein gemeinsamer Ausflug oder ein Spieleabend.",
  },
  {
    key: "tour-pinboard",
    character: "girl",
    bubble:
      "Die Pinnwand ist euer Familien-Schwarzes Brett. Nachrichten, Lob und Ankündigungen — alles an einem Ort für alle sichtbar. Jedes Familienmitglied kann 2 Zettel dort anheften.",
  },
  {
    key: "",
    character: "boy",
    bubble:
      "Das war's — du kennst jetzt alle wichtigen Funktionen! Starte jetzt durch und mach deine Familie zu echten HeroKids!",
  },
];

interface SpotlightRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

function getRect(key: string): SpotlightRect | null {
  if (!key) return null;
  const el = document.querySelector(`[data-tour="${key}"]`);
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return { top: r.top, left: r.left, width: r.width, height: r.height };
}

interface OnboardingTourProps {
  onClose: () => void;
}

export function OnboardingTour({ onClose }: OnboardingTourProps) {
  const [step, setStep] = useState(0);
  const [rect, setRect] = useState<SpotlightRect | null>(null);
  const queryClient = useQueryClient();
  const rafRef = useRef<number>(0);

  const completeMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/auth/user/onboarding-complete"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
    },
  });

  const current = STEPS[step];
  const isLast = step === STEPS.length - 1;

  const updateRect = useCallback(() => {
    setRect(getRect(current.key));
  }, [current.key]);

  useEffect(() => {
    updateRect();

    if (current.key) {
      const el = document.querySelector(`[data-tour="${current.key}"]`);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        rafRef.current = requestAnimationFrame(() => {
          rafRef.current = requestAnimationFrame(updateRect);
        });
      }
    }

    window.addEventListener("resize", updateRect);
    return () => {
      window.removeEventListener("resize", updateRect);
      cancelAnimationFrame(rafRef.current);
    };
  }, [current.key, updateRect]);

  const handleComplete = useCallback(() => {
    completeMutation.mutate();
    onClose();
  }, [completeMutation, onClose]);

  const advance = () => {
    if (isLast) {
      handleComplete();
    } else {
      setStep((s) => s + 1);
    }
  };

  const skip = () => {
    handleComplete();
  };

  const PAD = 10;
  const RADIUS = 14;

  return (
    <div
      className="fixed inset-0 z-[9999]"
      style={{ fontFamily: "Nunito, sans-serif" }}
    >
      {/* Dark overlay */}
      <div className="absolute inset-0" style={{ background: "rgba(0,0,0,0.55)" }} />

      {/* Spotlight cutout */}
      {rect && (
        <div
          className="absolute pointer-events-none"
          style={{
            top: rect.top - PAD,
            left: rect.left - PAD,
            width: rect.width + PAD * 2,
            height: rect.height + PAD * 2,
            borderRadius: RADIUS,
            boxShadow: "0 0 0 9999px rgba(0,0,0,0.55)",
            border: "2px solid rgba(91,196,192,0.85)",
            background: "transparent",
            transition: "top 0.35s cubic-bezier(.4,0,.2,1), left 0.35s cubic-bezier(.4,0,.2,1), width 0.35s cubic-bezier(.4,0,.2,1), height 0.35s cubic-bezier(.4,0,.2,1)",
            zIndex: 1,
          }}
        />
      )}

      {/* Character + speech bubble — fixed bottom-right */}
      <div
        className="absolute flex flex-col items-end"
        style={{ bottom: 0, right: 12, zIndex: 2 }}
      >
        {/* Speech bubble */}
        <div
          className="relative bg-white rounded-2xl px-4 py-3 mb-2 shadow-xl"
          style={{
            maxWidth: 260,
            border: "1.5px solid rgba(91,196,192,0.4)",
            borderBottomRightRadius: 4,
          }}
        >
          <p className="text-xs text-gray-700 leading-relaxed">{current.bubble}</p>

          {/* Step dots */}
          <div className="flex justify-center gap-1.5 mt-2.5">
            {STEPS.map((_, i) => (
              <div
                key={i}
                className="rounded-full transition-all duration-300"
                style={{
                  width: i === step ? 16 : 6,
                  height: 6,
                  background: i === step ? "#5BC4C0" : "#d1d5db",
                  flexShrink: 0,
                }}
              />
            ))}
          </div>

          {/* Arrow pointing toward character (bottom-right) */}
          <div
            className="absolute -bottom-2.5 right-5"
            style={{
              width: 0,
              height: 0,
              borderLeft: "10px solid transparent",
              borderRight: "0px solid transparent",
              borderTop: "10px solid white",
            }}
          />
        </div>

        {/* Buttons + character */}
        <div className="flex items-end gap-2">
          <div className="flex flex-col gap-1.5 mb-6">
            <button
              onClick={advance}
              className="px-4 py-2 rounded-xl text-white text-xs font-bold shadow-lg transition-transform active:scale-95"
              style={{
                background: isLast ? "#22c55e" : "#5BC4C0",
                minWidth: 100,
              }}
            >
              {isLast ? "Los geht's!" : "Weiter →"}
            </button>
            <button
              onClick={skip}
              className="px-4 py-1.5 rounded-xl text-xs text-gray-500 bg-white/90 shadow transition-transform active:scale-95"
            >
              Überspringen
            </button>
          </div>

          {/* Character image */}
          <img
            src={current.character === "boy" ? boyImg : girlImg}
            alt={current.character === "boy" ? "Max" : "Mia"}
            style={{
              width: 130,
              height: 130,
              objectFit: "contain",
              objectPosition: "bottom center",
              filter: "drop-shadow(0 4px 12px rgba(0,0,0,0.2))",
              transition: "opacity 0.2s ease",
            }}
          />
        </div>
      </div>
    </div>
  );
}
