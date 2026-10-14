import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "wouter";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { QrCode, Smartphone, UserPlus, ArrowRight, Copy, Check } from "lucide-react";

interface MemberOnboardingModalProps {
  open: boolean;
  onClose: () => void;
  joinCode?: string;
  fromSettings?: boolean;
}

export function MemberOnboardingModal({ open, onClose, joinCode, fromSettings = false }: MemberOnboardingModalProps) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);

  const handleCopyCode = () => {
    if (!joinCode) return;
    navigator.clipboard.writeText(joinCode).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent
        className="max-w-md mx-auto"
        onOpenAutoFocus={(e) => e.preventDefault()}
        data-testid="dialog-member-onboarding"
      >
        <DialogHeader>
          <DialogTitle className="text-xl font-accent text-center">
            {t("memberOnboarding.title")}
          </DialogTitle>
          <DialogDescription className="text-center text-sm">
            {t("memberOnboarding.subtitle")}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          {/* Option 1: Family Code */}
          <div
            className="p-3 rounded-lg border bg-card"
            data-testid="card-onboarding-family-code"
          >
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-lg bg-blue-500/10 flex-shrink-0 mt-0.5">
                <QrCode className="h-5 w-5 text-blue-500" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm leading-snug">
                  {t("memberOnboarding.option1Title")}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                  {t("memberOnboarding.option1Desc")}
                </p>
                {joinCode && (
                  <div className="flex items-center gap-2 mt-2">
                    <div className="flex-1 bg-muted rounded px-3 py-1.5 font-mono font-bold text-base tracking-widest text-primary select-all" data-testid="text-onboarding-join-code">
                      {joinCode}
                    </div>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={handleCopyCode}
                      className="flex-shrink-0"
                      data-testid="button-onboarding-copy-code"
                      aria-label={t("memberOnboarding.copyCode")}
                    >
                      {copied
                        ? <Check className="h-4 w-4 text-green-500" />
                        : <Copy className="h-4 w-4" />}
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Option 2: Device Link */}
          <div
            className="flex items-start gap-3 p-3 rounded-lg border bg-card"
            data-testid="card-onboarding-device-link"
          >
            <div className="p-2 rounded-lg bg-orange-500/10 flex-shrink-0 mt-0.5">
              <Smartphone className="h-5 w-5 text-orange-500" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm leading-snug">
                {t("memberOnboarding.option2Title")}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                {t("memberOnboarding.option2Desc")}
              </p>
            </div>
          </div>

          {/* Option 3: Add Directly */}
          <div
            className="flex items-start gap-3 p-3 rounded-lg border bg-card"
            data-testid="card-onboarding-add-direct"
          >
            <div className="p-2 rounded-lg bg-green-500/10 flex-shrink-0 mt-0.5">
              <UserPlus className="h-5 w-5 text-green-500" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm leading-snug">
                {t("memberOnboarding.option3Title")}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                {t("memberOnboarding.option3Desc")}
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-2 pt-1">
          {fromSettings ? (
            <Button
              className="w-full"
              onClick={onClose}
              data-testid="button-onboarding-got-it"
            >
              {t("memberOnboarding.gotIt")}
            </Button>
          ) : (
            <>
              <Link href="/settings" onClick={onClose}>
                <Button
                  variant="outline"
                  className="w-full gap-2"
                  data-testid="button-onboarding-to-settings"
                >
                  {t("memberOnboarding.toSettings")}
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
              <Button
                className="w-full"
                onClick={onClose}
                data-testid="button-onboarding-got-it"
              >
                {t("memberOnboarding.gotIt")}
              </Button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
