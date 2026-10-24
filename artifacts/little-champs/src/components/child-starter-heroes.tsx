import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "wouter";
import { Check, ChevronRight, Gift, Loader2, RefreshCw, Star, Trophy } from "lucide-react";
import { BackgroundLayerPortal } from "@/components/background-layer";
import { isStandardSkin } from "@shared/skin-config";
import {
  getKidStarterHeroUrl,
  KID_STARTER_BANNER_URL,
  KID_STARTER_CARD_BACKGROUND_URL,
} from "@/lib/kid-starter-media";
import "./child-starter-heroes.css";

type LoadState = "loading" | "ok" | "error";

export interface ChildStarterHeroesProps {
  options: { id: string; name: string }[];
  starsFound: number;
  legacyCount?: number;
  rewardCount?: number;
  selecting: boolean;
  transitioning?: boolean;
  error: string | null;
  onChoose: (skinId: string) => void;
}

function HeroCard({ id, name, selected, disabled, onSelect, onReady }: {
  id: string; name: string; selected: boolean; disabled: boolean;
  onSelect: (id: string) => void; onReady: (id: string, ok: boolean) => void;
}) {
  const { t } = useTranslation();
  const [attempt, setAttempt] = useState(0);
  const [bg, setBg] = useState<LoadState>("loading");
  const [hero, setHero] = useState<LoadState>("loading");
  const bust = (u: string) => (attempt ? `${u}${u.includes("?") ? "&" : "?"}r=${attempt}` : u);
  const failed = bg === "error" || hero === "error";
  const ready = bg === "ok" && hero === "ok";
  const retry = () => { setBg("loading"); setHero("loading"); setAttempt((a) => a + 1); onReady(id, false); };
  // Image load events may be batched (especially from cache). Report readiness
  // from committed state, never from the other event handler's stale closure.
  useEffect(() => {
    onReady(id, ready);
  }, [id, ready, onReady]);

  return (
    <div className="lc-kh-cardwrap">
      <button
        type="button"
        className={`lc-kh-card${selected ? " is-selected" : ""}${ready ? " is-ready" : ""}`}
        aria-pressed={selected}
        aria-label={t("kidStart.selectHero", { name, defaultValue: "{{name}} auswählen" })}
        disabled={disabled || !ready}
        onClick={() => onSelect(id)}
        data-testid={`button-select-starter-${id}`}
      >
        <img key={`b${attempt}`} className="lc-kh-card__bg" src={bust(KID_STARTER_CARD_BACKGROUND_URL)} alt=""
          onLoad={() => setBg("ok")} onError={() => setBg("error")} style={{ opacity: bg === "ok" ? 1 : 0 }} />
        <img key={`h${attempt}`} className="lc-kh-card__hero" src={bust(getKidStarterHeroUrl(id))} alt=""
          onLoad={() => setHero("ok")} onError={() => setHero("error")} style={{ opacity: hero === "ok" ? 1 : 0 }} />
        {!ready && !failed && <span className="lc-kh-skel" aria-hidden="true" />}
        <span className="lc-kh-card__name" data-testid={`text-starter-name-${id}`}>{name}</span>
        {selected && <span className="lc-kh-check" aria-hidden="true"><Check size={18} strokeWidth={3.5} /></span>}
      </button>
      {failed && (
        <div className="lc-kh-card__err" role="alert">
          <span>{t("kidStart.previewError", "Bild nicht geladen")}</span>
          <button type="button" onClick={retry} data-testid={`button-retry-starter-${id}`}>
            <RefreshCw size={14} /> {t("kidStart.retry", "Nochmal")}
          </button>
        </div>
      )}
    </div>
  );
}

export function ChildStarterBackdrop() {
  const { t } = useTranslation();
  return (
    <BackgroundLayerPortal>
      <div className="lc-kh-hero">
        <img src={KID_STARTER_BANNER_URL} className="lc-kh-hero__art" data-testid="img-starter-banner"
          alt={t("kidStart.bannerAlt", "Wähle deinen ersten Helden. Finde die 48 Sterne und schalte die Little Champs Legacy frei.")}
          title={t("kidStart.bannerTitle", "Wähle deinen ersten Helden")} />
      </div>
    </BackgroundLayerPortal>
  );
}

export function ChildStarterHeroes(p: ChildStarterHeroesProps) {
  const { t } = useTranslation();
  const options = p.options.filter((o) => isStandardSkin(o.id)).slice(0, 3);
  const [selected, setSelected] = useState<string | null>(null);
  const [readyMap, setReadyMap] = useState<Record<string, boolean>>({});
  const handleReady = useCallback((id: string, ok: boolean) => {
    setReadyMap(m => m[id] === ok ? m : { ...m, [id]: ok });
  }, []);
  const busy = p.selecting || !!p.transitioning;
  const canConfirm = !!selected && options.some(option => option.id === selected) && readyMap[selected] && !busy;

  const confirm = () => { if (canConfirm && selected) p.onChoose(selected); };

  return (
    <section className="lc-kh" aria-labelledby="lc-kh-title" data-testid="child-starter-heroes">
      <h1 id="lc-kh-title" className="lc-kh-sr">{t("kidStart.bannerAlt", "Wähle deinen ersten Helden. Finde die 48 Sterne und schalte die Little Champs Legacy frei.")}</h1>
      <div className="lc-kh-spacer" aria-hidden="true" />
      <div className="lc-kh-box">
        <h2 className="lc-kh-boxtitle">
          <Star size={16} className="lc-kh-star" aria-hidden="true" />
          {t("kidStart.boxTitle", "Deine Starterhelden")}
          <Star size={16} className="lc-kh-star" aria-hidden="true" />
        </h2>

        {options.length === 0 ? (
          <div className="lc-kh-cards" aria-hidden="true">
            {[0, 1, 2].map((i) => <div key={i} className="lc-kh-card lc-kh-card--ph"><span className="lc-kh-skel" /></div>)}
          </div>
        ) : (
          <div className="lc-kh-cards" role="group" aria-label={t("kidStart.boxTitle", "Deine Starterhelden")}>
            {options.map((o) => (
              <HeroCard key={o.id} id={o.id} name={o.name} selected={selected === o.id} disabled={busy}
                onSelect={setSelected} onReady={handleReady} />
            ))}
          </div>
        )}

        <div className="lc-kh-foot">
          <span data-testid="text-starter-stars"><Star size={18} className="lc-kh-star" aria-hidden="true" />
            {t("kidStart.starsCollected", { count: p.starsFound, defaultValue: "{{count}} Sterne gesammelt" })}</span>
          <span className="lc-kh-divider" aria-hidden="true" />
          <span><Gift size={18} className="lc-kh-gift" aria-hidden="true" />{t("kidStart.firstFree", "Erster Held kostenlos")}</span>
        </div>

        {p.error && <p className="lc-kh-error" role="alert" data-testid="text-starter-error">{p.error}</p>}

        <button type="button" className="lc-kh-cta" disabled={!canConfirm} aria-busy={busy}
          onClick={confirm} data-testid="button-confirm-starter">
          {busy ? <><Loader2 size={20} className="animate-spin" /> {t("kidStart.activating", "Dein Held kommt...")}</>
            : <>{p.error ? t("kidStart.retryChoose", "Nochmal versuchen") : t("kidStart.cta", "Ersten Helden wählen")} <ChevronRight size={22} /></>}
        </button>
        {!selected && !busy && <p className="lc-kh-hint">{t("kidStart.hint", "Tippe auf einen Helden.")}</p>}
      </div>

      <nav className="lc-kh-links" aria-label={t("kidStart.linksLabel", "Dein Fortschritt")}>
        <Link href="/skins" className="lc-kh-link" data-testid="link-starter-legacy">
          <Trophy size={18} className="lc-kh-star" aria-hidden="true" />
          <span>{t("kidStart.legacyLink", { count: p.legacyCount ?? 0, defaultValue: "{{count}}/12 Little Champs Legacy" })}</span>
          <ChevronRight size={16} aria-hidden="true" />
        </Link>
        <Link href="/skins" className="lc-kh-link" data-testid="link-starter-stars">
          <Star size={18} className="lc-kh-star" aria-hidden="true" />
          <span>{t("kidStart.starsLink", { count: p.starsFound, defaultValue: "{{count}}/48 Sterne" })}</span>
          <ChevronRight size={16} aria-hidden="true" />
        </Link>
        <Link href="/my-rewards" className="lc-kh-link" data-testid="link-starter-rewards">
          <Gift size={18} className="lc-kh-gift" aria-hidden="true" />
          <span>{t("kidStart.rewardsLink", { count: p.rewardCount ?? 0, defaultValue: "{{count}} Belohnungen in der Schatzkiste" })}</span>
          <ChevronRight size={16} aria-hidden="true" />
        </Link>
      </nav>
    </section>
  );
}

export default ChildStarterHeroes;
