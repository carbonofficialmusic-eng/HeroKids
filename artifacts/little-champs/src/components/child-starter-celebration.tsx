import { useTranslation } from "react-i18next";
import type { FamilyMember } from "@shared/schema";
import { StartSkinCelebration } from "@/components/start-skin-celebration";

export type ChildStarterSelection = { memberId: string; skinId: string };

/** A success message for this choice, never for merely previewing a card or
 * visiting an already-completed profile. Wait for the real board to be ready. */
export function ChildStarterCelebration({ member, selection, ready, onClose }: {
  member?: Pick<FamilyMember, "id" | "role" | "startCompletedAt" | "freeStarterSkinId">;
  selection: ChildStarterSelection | null;
  ready: boolean;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const open = !!(ready && selection && member?.role === "child" &&
    member.id === selection.memberId && member.startCompletedAt &&
    member.freeStarterSkinId === selection.skinId);
  const name = selection
    ? t(`skinNames.${selection.skinId}`, { defaultValue: selection.skinId.replaceAll("-", " ") })
    : "";
  return (
    <StartSkinCelebration
      open={open}
      onClose={onClose}
      testId="dialog-child-starter-chosen"
      title={t("kidStart.heroChosen", { name, defaultValue: "Du hast dich für „{{name}}“ entschieden." })}
      description={t("kidStart.nextMission", "Lass deine nächste Mission nicht zu lange warten und entdecke mehr neue Helden und Welten.")}
      buttonLabel={t("kidStart.letsGo", "Los geht’s!")}
    />
  );
}
