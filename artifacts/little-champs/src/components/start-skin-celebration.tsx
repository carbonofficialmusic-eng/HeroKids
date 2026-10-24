import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { ArrowRight, Sparkles, Star } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { celebrateTaskCompletion } from "@/lib/confetti";
import "./start-skin-celebration.css";

export function StartSkinCelebration({ open, onClose, title, description, buttonLabel, testId }: {
  open: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  buttonLabel?: string;
  testId?: string;
}) {
  const { t } = useTranslation();
  const celebrated = useRef(false);
  const chooseButton = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) { celebrated.current = false; return; }
    if (celebrated.current) return;
    celebrated.current = true;
    if (!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      celebrateTaskCompletion();
    }
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => { if (!nextOpen) onClose(); }}>
      <DialogContent
        className="lc-start-celebration"
        data-testid={testId ?? "dialog-start-skin-earned"}
        onOpenAutoFocus={(event) => { event.preventDefault(); chooseButton.current?.focus(); }}
        onPointerDownOutside={(event) => event.preventDefault()}
      >
        <div className="lc-start-celebration__glow" aria-hidden="true" />
        <div className="lc-start-celebration__prize" aria-hidden="true">
          <Sparkles className="lc-start-celebration__spark lc-start-celebration__spark--left" />
          <div className="lc-start-celebration__card lc-start-celebration__card--left" />
          <div className="lc-start-celebration__card lc-start-celebration__card--right" />
          <div className="lc-start-celebration__card lc-start-celebration__card--front">
            <Star />
          </div>
          <Sparkles className="lc-start-celebration__spark lc-start-celebration__spark--right" />
        </div>
        <DialogTitle className="lc-start-celebration__title">
          {title ?? t("parentStart.cardEarned")}
        </DialogTitle>
        <DialogDescription className="lc-start-celebration__description">
          {description ?? t("parentStart.chooseUnlockedCard")}
        </DialogDescription>
        <button
          ref={chooseButton}
          type="button"
          className="lc-start-celebration__choose"
          data-testid="button-start-skin-earned-choose"
          onClick={onClose}
        >
          {buttonLabel ?? t("parentStart.chooseSkin")}
          <ArrowRight size={20} aria-hidden="true" />
        </button>
      </DialogContent>
    </Dialog>
  );
}
