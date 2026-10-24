import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import type { FamilyMember } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { getSkinBackgroundUrl } from "@/lib/skins";

export function loadStartBackground(skinId: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    const timer = window.setTimeout(() => reject(new Error("BACKGROUND_LOAD_FAILED")), 20000);
    image.onload = () => { clearTimeout(timer); resolve(); };
    image.onerror = () => { clearTimeout(timer); reject(new Error("BACKGROUND_LOAD_FAILED")); };
    image.src = getSkinBackgroundUrl(skinId);
  });
}

/** Server state is per member; ephemeral activation state must be too. */
export function useStartSkin(member?: FamilyMember) {
  const { t } = useTranslation();
  const activeId = useRef(member?.id);
  activeId.current = member?.id;
  const [transitionId, setTransitionId] = useState<string | null>(null);
  const [errorState, setError] = useState<{ id: string; message: string } | null>(null);
  const [readyId, setReadyId] = useState<string | null>(null);
  const previous = useRef({ id: member?.id, pending: !!member?.startSkinOptions && !member.startCompletedAt });
  useLayoutEffect(() => {
    const wasPending = previous.current.id === member?.id && previous.current.pending;
    previous.current = { id: member?.id, pending: !!member?.startSkinOptions && !member.startCompletedAt };
    if (!wasPending || !member?.startCompletedAt || !member.freeStarterSkinId) return;
    // Another device can complete the choice. Preserve the same image-ready
    // boundary here as for the device that submitted the selection.
    let cancelled = false;
    setTransitionId(member.id);
    loadStartBackground(member.freeStarterSkinId).then(async () => {
      await new Promise(resolve => window.setTimeout(resolve, 850));
      if (!cancelled) { setReadyId(member.id); setTransitionId(null); }
    }).catch(() => {
      if (!cancelled) setError({ id: member.id, message: t("parentStart.selectionError") });
    });
    return () => { cancelled = true; };
  }, [member?.id, member?.startCompletedAt, member?.freeStarterSkinId, t]);
  useEffect(() => {
    if (!member?.startCompletedAt || !member.freeStarterSkinId) return;
    let cancelled = false;
    loadStartBackground(member.freeStarterSkinId).then(() => {
      if (!cancelled) setReadyId(member.id);
    }).catch(() => { /* Selection retry has its own visible error; no tour yet. */ });
    return () => { cancelled = true; };
  }, [member?.id, member?.startCompletedAt, member?.freeStarterSkinId]);

  const mutation = useMutation({
    mutationFn: async ({ skinId, memberId }: { skinId: string; memberId: string }) => {
      const response = await apiRequest("POST", "/api/onboarding/start-skin", { skinId, memberId });
      const updated: FamilyMember = await response.json();
      if (updated.id !== memberId) throw new Error("PROFILE_CHANGED");
      // Keep the welcome artwork visible until the actual selected image exists.
      await loadStartBackground(skinId);
      return updated;
    },
    onSuccess: async (updated) => {
      if (activeId.current !== updated.id) return;
      const current = queryClient.getQueryData<FamilyMember>(["/api/family-members/current"]);
      if (current?.id !== updated.id) return;
      queryClient.setQueryData(["/api/family-members/current"], updated);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["/api/skins"] }),
        queryClient.invalidateQueries({ queryKey: ["/api/stars"] }),
        queryClient.invalidateQueries({ queryKey: ["/api/family-members"] }),
      ]);
      // BackgroundWrapper's existing crossfade lasts 700ms. Two paints and
      // this delay keep the welcome screen until the normal backdrop is visible.
      await new Promise<void>(resolve => requestAnimationFrame(() =>
        requestAnimationFrame(() => window.setTimeout(resolve, 800))));
      if (activeId.current === updated.id) {
        setReadyId(updated.id);
        setTransitionId(null);
      }
    },
    onError: (_error, variables) => {
      if (activeId.current !== variables.memberId) return;
      setError({
        id: variables.memberId,
        message: t("parentStart.selectionError", "Der Hintergrund konnte nicht aktiviert werden. Bitte wähle die Karte erneut."),
      });
      // Do not dismiss if the server saved but the image download failed.
    },
  });
  const pending = !!member?.startSkinOptions && !member.startCompletedAt;
  return {
    pending,
    visible: member?.role === "parent" && (pending || transitionId === member.id),
    tourReady: !member?.startSkinOptions || (!!member.startCompletedAt && readyId === member.id && transitionId !== member.id),
    options: (member?.startSkinOptions || []).map(id => ({ id, name: t(`skinNames.${id}`, { defaultValue: id.replaceAll("-", " ") }) })),
    taskCreated: !!member?.firstTaskCreatedAt,
    selecting: mutation.isPending,
    error: errorState?.id === member?.id ? errorState?.message || null : null,
    choose: (skinId: string) => {
      if (!member || mutation.isPending) return;
      setTransitionId(member.id);
      setError(null);
      mutation.mutate({ skinId, memberId: member.id });
    },
  };
}
