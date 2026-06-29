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
import { QrCode, Smartphone, UserPlus, ArrowRight } from "lucide-react";

interface MemberOnboardingModalProps {
  open: boolean;
  onClose: () => void;
}

export function MemberOnboardingModal({ open, onClose }: MemberOnboardingModalProps) {
  const { t } = useTranslation();

  const options = [
    {
      icon: QrCode,
      iconColor: "text-blue-500",
      bgColor: "bg-blue-500/10",
      titleKey: "memberOnboarding.option1Title",
      descKey: "memberOnboarding.option1Desc",
      testId: "card-onboarding-family-code",
    },
    {
      icon: Smartphone,
      iconColor: "text-orange-500",
      bgColor: "bg-orange-500/10",
      titleKey: "memberOnboarding.option2Title",
      descKey: "memberOnboarding.option2Desc",
      testId: "card-onboarding-device-link",
    },
    {
      icon: UserPlus,
      iconColor: "text-green-500",
      bgColor: "bg-green-500/10",
      titleKey: "memberOnboarding.option3Title",
      descKey: "memberOnboarding.option3Desc",
      testId: "card-onboarding-add-direct",
    },
  ];

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
          {options.map((opt, i) => {
            const Icon = opt.icon;
            return (
              <div
                key={i}
                className="flex items-start gap-3 p-3 rounded-lg border bg-card"
                data-testid={opt.testId}
              >
                <div className={`p-2 rounded-lg ${opt.bgColor} flex-shrink-0 mt-0.5`}>
                  <Icon className={`h-5 w-5 ${opt.iconColor}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm leading-snug">
                    {t(opt.titleKey)}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                    {t(opt.descKey)}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        <div className="flex flex-col gap-2 pt-1">
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
        </div>
      </DialogContent>
    </Dialog>
  );
}
