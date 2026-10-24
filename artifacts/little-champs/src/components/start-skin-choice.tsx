import type { FamilyMember } from "@shared/schema";
import { useTranslation } from "react-i18next";
import { Link } from "wouter";
import { StartSkinCard } from "./parent-start-screen";
import { useStartSkin } from "@/hooks/useStartSkin";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Optional gallery choice for children, without the parent task prerequisite.
 * This is not a child dashboard redesign or a blocking child onboarding. */
export function StartSkinChoice({ member }: { member?: FamilyMember }) {
  const start = useStartSkin(member);
  const { t } = useTranslation();
  if (!start.pending) return null;
  const enabled = member?.role !== "parent" || start.taskCreated;
  return (
    <section className="lc-start rounded-2xl p-4 mb-4" data-testid="gallery-start-choice">
      <p id="lc-start-hint" className="mb-3 text-sm">
        {enabled
          ? t("parentStart.hintChoose", "Wähle jetzt deinen Start-Hintergrund – er wird kostenlos freigeschaltet.")
          : t("parentStart.hintLocked", "Erstelle zuerst eure erste Aufgabe, dann kannst du einen dieser Hintergründe wählen.")}
      </p>
      <div className="lc-start__cards">
        {start.options.map(option => (
          <StartSkinCard key={option.id} {...option} enabled={enabled}
            selecting={start.selecting} onChoose={start.choose} />
        ))}
      </div>
      {start.error && <p role="alert">{start.error}</p>}
      {!enabled && (
        <Button asChild variant="outline" size="sm" className="mt-3 min-h-10 rounded-xl border-amber-400/40 bg-amber-400/10 text-amber-800 dark:text-amber-200 shadow-none">
          <Link href="/dashboard?createTask=1" data-testid="button-gallery-first-task">
            <Plus aria-hidden="true" />
            {t("parentStart.createFirstTask", "Erste Aufgabe erstellen")}
          </Link>
        </Button>
      )}
    </section>
  );
}
