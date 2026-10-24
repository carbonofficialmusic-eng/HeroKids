import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Plus, ChevronRight, Lock, Loader2 } from "lucide-react";
import { getSkinBackgroundUrl, getSkinImageUrl } from "@/lib/skins";
import { BackgroundLayerPortal } from "@/components/background-layer";
import { getStartArtworkUrl } from "@/lib/start-artwork";
import "./parent-start-screen.css";

const startBg = getStartArtworkUrl("parent", `${import.meta.env.BASE_URL}images/welcome-start.webp`);

export interface ParentStartScreenProps {
  options: { id: string; name: string }[];
  taskCreated: boolean;
  selecting: boolean;
  error: string | null;
  onChoose: (skinId: string) => void;
  onCreateTask: () => void;
}

type LoadState = "loading" | "ok" | "error";

export function StartSkinCard({ id, name, enabled, selecting, onChoose }: { id: string; name: string; enabled: boolean; selecting: boolean; onChoose: (id: string) => void }) {
  const { t } = useTranslation();
  const [attempt, setAttempt] = useState(0);
  const [bg, setBg] = useState<LoadState>("loading");
  const [av, setAv] = useState<LoadState>("loading");
  const sep = (u: string) => (attempt ? `${u}${u.includes("?") ? "&" : "?"}r=${attempt}` : u);
  const failed = bg === "error" || av === "error";
  const ready = bg === "ok" && av === "ok";
  const retry = () => { setBg("loading"); setAv("loading"); setAttempt((a) => a + 1); };
  const disabled = !enabled || !ready || selecting;

  return (
    <div className="relative">
      <button
        type="button"
        className={`lc-card ${enabled && ready ? "lc-card--ready" : ""}`}
        disabled={disabled}
        aria-disabled={disabled}
        aria-label={enabled ? t("parentStart.chooseCard", { name, defaultValue: "{{name}} wählen" }) : t("parentStart.lockedCard", { name, defaultValue: "{{name}} – erst nach der ersten Aufgabe wählbar" })}
        onClick={() => onChoose(id)}
        data-testid={`button-choose-skin-${id}`}
      >
        <img key={`bg${attempt}`} className="lc-card__bg" src={sep(getSkinBackgroundUrl(id))} alt="" onLoad={() => setBg("ok")} onError={() => setBg("error")} style={{ opacity: bg === "ok" ? 1 : 0 }} />
        <img key={`av${attempt}`} className="lc-card__avatar" src={sep(getSkinImageUrl(id))} alt="" onLoad={() => setAv("ok")} onError={() => setAv("error")} style={{ opacity: av === "ok" ? 1 : 0 }} />
        {!ready && !failed && <div className="lc-card__state lc-skel" aria-hidden="true" />}
        <div className="lc-card__foot">
          <div className="lc-card__name" data-testid={`text-skin-name-${id}`}>{name}</div>
          {selecting ? <Loader2 size={15} className="animate-spin shrink-0" /> : enabled ? <ChevronRight size={16} className="shrink-0" /> : <Lock size={14} className="shrink-0 opacity-80" />}
        </div>
      </button>
      {failed && (
        <div className="lc-card__state" style={{ borderRadius: 14 }} role="alert">
          <span>{t("parentStart.previewError", "Vorschau nicht geladen")}</span>
          <button type="button" className="lc-card__retry" onClick={retry} data-testid={`button-retry-skin-${id}`}>
            {t("parentStart.retry", "Erneut versuchen")}
          </button>
        </div>
      )}
    </div>
  );
}

export function ParentStartBackdrop() {
  return (
    <BackgroundLayerPortal>
    <div className="lc-start__hero" aria-hidden="true">
      <div
        className="lc-start__artwork"
        style={{ backgroundImage: `url("${startBg}")` }}
        data-testid="img-parent-start-background"
      />
    </div>
    </BackgroundLayerPortal>
  );
}

export function ParentStartScreen(p: ParentStartScreenProps) {
  const { t } = useTranslation();
  return (
    <section className={`lc-start lg:col-span-3 ${p.taskCreated ? "lc-start--unlocked" : ""}`} aria-labelledby="lc-start-title" data-testid="parent-start-screen">
      <h1 id="lc-start-title" className="lc-sr">{t("parentStart.srTitle", "Willkommen bei Little Champs. Euer Familienabenteuer startet hier.")}</h1>
      <div className="lc-start__spacer" aria-hidden="true" />
      <div className="lc-start__body">
        <div className="lc-start__cards">
          {p.options.map((o) => (
            <StartSkinCard key={o.id} id={o.id} name={o.name} enabled={p.taskCreated} selecting={p.selecting} onChoose={p.onChoose} />
          ))}
        </div>
        {p.error && <p className="lc-start__err" role="alert" data-testid="text-start-error">{p.error}</p>}
        {!p.taskCreated && (
        <button type="button" className="lc-start__cta" onClick={p.onCreateTask} data-testid="button-first-task">
          <span className="lc-start__cta-icon"><Plus size={22} /></span>
          <span className="lc-grow">
            {t("parentStart.createFirstTask", "Erste Aufgabe erstellen")}
          </span>
          <ChevronRight size={20} />
        </button>
        )}
      </div>
    </section>
  );
}

export default ParentStartScreen;
