import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Trophy, Star } from "lucide-react";
import { useTranslation } from "react-i18next";

interface GoalCompletedModalProps {
  goal: { id: number; title: string } | null;
  onClose: () => void;
}

export function GoalCompletedModal({ goal, onClose }: GoalCompletedModalProps) {
  const { t } = useTranslation();

  return (
    <Dialog open={!!goal} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent
        className="max-w-sm p-0 border-0 rounded-3xl overflow-hidden"
        onOpenAutoFocus={(e) => e.preventDefault()}
        data-testid="modal-goal-completed"
      >
        <div className="bg-gradient-to-br from-yellow-400 via-amber-400 to-orange-500 px-6 pt-8 pb-6 flex flex-col items-center text-center gap-3">
          <div className="w-20 h-20 rounded-full bg-white/25 flex items-center justify-center">
            <Trophy className="h-10 w-10 text-white" />
          </div>
          <DialogTitle className="text-2xl font-bold text-white leading-tight">
            {t("familyGoals.completedTitle", "Familienziel erreicht!")}
          </DialogTitle>
          <div className="flex gap-1.5">
            <Star className="h-5 w-5 text-white fill-white" />
            <Star className="h-5 w-5 text-white fill-white" />
            <Star className="h-5 w-5 text-white fill-white" />
          </div>
        </div>

        <div className="px-6 py-6 flex flex-col items-center text-center gap-3">
          <DialogDescription className="text-sm text-muted-foreground">
            {t("familyGoals.completedSubtitle", "Eure Familie hat gemeinsam das Ziel erfüllt:")}
          </DialogDescription>
          <p className="text-lg font-bold text-foreground leading-snug">
            "{goal?.title}"
          </p>
          <p className="text-sm text-muted-foreground">
            {t("familyGoals.completedMessage", "Herzlichen Glückwunsch! Feiert gemeinsam diesen Erfolg.")}
          </p>
          <Button
            onClick={onClose}
            className="w-full rounded-2xl mt-1"
            size="lg"
            data-testid="button-goal-completed-close"
          >
            {t("familyGoals.completedClose", "Super, danke!")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
