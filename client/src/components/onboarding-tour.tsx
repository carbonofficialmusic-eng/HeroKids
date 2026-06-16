import { useState, useEffect, useCallback, useRef } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { apiRequest } from "@/lib/queryClient";
import boyImg from "@assets/hero_boy_nobg.png";
import girlImg from "@assets/hero_girl_nobg.png";
import bothImg from "@assets/mia_max_nobg.png";

interface TourStep {
  key: string;
  character: "boy" | "girl";
}

const STEPS: TourStep[] = [
  { key: "", character: "girl" },
  { key: "tour-add-task", character: "boy" },
  { key: "tour-add-reward", character: "girl" },
  { key: "tour-approvals", character: "boy" },
  { key: "tour-rewards-board", character: "girl" },
  { key: "tour-profile-menu", character: "girl" },
  { key: "tour-skins", character: "boy" },
  { key: "tour-pinboard", character: "girl" },
  { key: "tour-bonus-rewards", character: "girl" },
  { key: "tour-family-goals", character: "boy" },
  { key: "tour-send-points", character: "boy" },
  { key: "tour-family-chat", character: "girl" },
  { key: "", character: "boy" },
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
  const { t } = useTranslation();
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

  const scrollToAndUpdate = useCallback((key: string) => {
    const el = document.querySelector(`[data-tour="${key}"]`) as HTMLElement | null;
    if (!el) {
      updateRect();
      return;
    }
    const root = document.getElementById("root") ?? document.documentElement;
    const elRect = el.getBoundingClientRect();
    const viewH = window.innerHeight;
    const targetScroll = root.scrollTop + elRect.top - viewH / 2 + elRect.height / 2;
    root.scrollTo({ top: Math.max(0, targetScroll), behavior: "smooth" });
    const tid = window.setTimeout(updateRect, 420);
    return tid;
  }, [updateRect]);

  useEffect(() => {
    let tid: number | undefined;
    if (current.key) {
      tid = scrollToAndUpdate(current.key);
    } else {
      updateRect();
    }

    window.addEventListener("resize", updateRect);
    return () => {
      window.removeEventListener("resize", updateRect);
      cancelAnimationFrame(rafRef.current);
      if (tid !== undefined) window.clearTimeout(tid);
    };
  }, [current.key, updateRect, scrollToAndUpdate]);

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
      {!rect && (
        <div className="absolute inset-0" style={{ background: "rgba(0,0,0,0.55)" }} />
      )}

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

      <div
        className="absolute flex flex-col items-end"
        style={{ bottom: 0, right: 12, zIndex: 2, maxHeight: "95vh", justifyContent: "flex-end" }}
      >
        <div
          className="relative bg-white rounded-2xl px-4 py-3 mb-2 shadow-xl overflow-y-auto"
          style={{
            maxWidth: "min(260px, calc(100vw - 150px))",
            maxHeight: "min(240px, 45vh)",
            border: "1.5px solid rgba(91,196,192,0.4)",
            borderBottomRightRadius: 4,
          }}
        >
          <p className="text-xs text-gray-700 leading-relaxed">{t(`tour.step${step}`)}</p>

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

        <div className="flex items-end gap-2">
          <div className="flex flex-col gap-1.5 mb-4">
            <button
              onClick={advance}
              className="px-4 py-2 rounded-xl text-white text-xs font-bold shadow-lg transition-transform active:scale-95"
              style={{
                background: isLast ? "#22c55e" : "#5BC4C0",
                minWidth: 100,
              }}
            >
              {isLast ? t("tour.letsGo") : t("tour.next")}
            </button>
            <button
              onClick={skip}
              className="px-4 py-1.5 rounded-xl text-xs text-gray-500 bg-white/90 shadow transition-transform active:scale-95"
            >
              {t("tour.skip")}
            </button>
          </div>

          <img
            src={step === 0 ? bothImg : current.character === "boy" ? boyImg : girlImg}
            alt={step === 0 ? "Mia und Max" : current.character === "boy" ? "Max" : "Mia"}
            style={{
              width: step === 0 ? "min(160px, 24vh)" : "min(130px, 20vh)",
              height: step === 0 ? "min(160px, 24vh)" : "min(130px, 20vh)",
              objectFit: "contain",
              objectPosition: "bottom center",
              filter: "drop-shadow(0 4px 12px rgba(0,0,0,0.2))",
              transition: "opacity 0.2s ease",
              flexShrink: 0,
            }}
          />
        </div>
      </div>
    </div>
  );
}
