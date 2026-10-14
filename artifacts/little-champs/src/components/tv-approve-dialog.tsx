import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Tv } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface TvApproveDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const messages = {
  de: {
    title: "Familien-TV anmelden",
    description: "Öffne Little Champs TV auf dem Fernseher. Gib den dort angezeigten Code und deine Eltern-PIN ein, um diesen Fernseher für deine Familie freizugeben.",
    code: "Code vom Fernseher",
    pin: "Deine Eltern-PIN",
    pinHint: "Lege zuerst eine eigene Eltern-PIN in den Familieneinstellungen fest. Ohne eingerichtete PIN ist keine TV-Freigabe möglich.",
    confirm: "Fernseher freigeben",
    confirming: "Wird freigegeben…",
    success: "Freigabe gesendet. Der Fernseher verbindet sich jetzt; er erscheint gleich unten in der Liste.",
    error: "Die Freigabe hat nicht funktioniert. Prüfe Code und PIN und versuche es erneut.",
    connected: "Angemeldete Fernseher",
    none: "Noch kein Familien-TV angemeldet.",
    disconnect: "Abmelden",
    disconnectConfirm: "Ja, TV abmelden",
    cancel: "Abbrechen",
    disconnectHint: "Der Fernseher verliert sofort den Familienzugang und muss danach erneut freigegeben werden.",
    lastUsed: "Zuletzt verwendet",
  },
  en: {
    title: "Connect family TV",
    description: "Open Little Champs TV on your television. Enter the code shown there and your parent PIN to approve this TV for your family.",
    code: "Code from the TV",
    pin: "Your parent PIN",
    pinHint: "Set a personal parent PIN in Family Settings first. A TV cannot be approved without a configured PIN.",
    confirm: "Approve TV",
    confirming: "Approving…",
    success: "Approval sent. The TV is connecting and will appear below shortly.",
    error: "The TV could not be approved. Check the code and PIN and try again.",
    connected: "Connected TVs",
    none: "No family TVs connected yet.",
    disconnect: "Sign out",
    disconnectConfirm: "Yes, sign out TV",
    cancel: "Cancel",
    disconnectHint: "This TV immediately loses family access and must be approved again.",
    lastUsed: "Last used",
  },
};

interface TvDevice {
  id: string;
  createdAt: string;
  lastSeenAt: string;
}

export function TvApproveDialog({ open, onOpenChange }: TvApproveDialogProps) {
  const { i18n } = useTranslation();
  const queryClient = useQueryClient();
  const text = i18n.language.startsWith("de") ? messages.de : messages.en;
  const [code, setCode] = useState("");
  const [pin, setPin] = useState("");
  const [message, setMessage] = useState("");
  const [success, setSuccess] = useState(false);
  const [confirmDisconnect, setConfirmDisconnect] = useState<string | null>(null);

  const devices = useQuery({
    queryKey: ["/api/tv/devices"],
    enabled: open,
    refetchInterval: open ? 4000 : false,
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/tv/devices");
      return response.json() as Promise<{ devices: TvDevice[] }>;
    },
  });

  useEffect(() => {
    if (!open) {
      setCode("");
      setPin("");
      setMessage("");
      setSuccess(false);
      setConfirmDisconnect(null);
    }
  }, [open]);

  const approve = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/tv/pair/approve", { code, pin });
    },
    onSuccess: () => {
      setSuccess(true);
      setPin("");
      setMessage(text.success);
      void queryClient.invalidateQueries({ queryKey: ["/api/tv/devices"] });
    },
    onError: (error: Error) => {
      setMessage(error.message || text.error);
    },
  });
  const disconnect = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/tv/devices/${encodeURIComponent(id)}`);
    },
    onSuccess: () => {
      setConfirmDisconnect(null);
      void queryClient.invalidateQueries({ queryKey: ["/api/tv/devices"] });
    },
    onError: (error: Error) => setMessage(error.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Tv className="h-5 w-5" />{text.title}</DialogTitle>
          <DialogDescription>{text.description}</DialogDescription>
        </DialogHeader>
        <form className="space-y-4" onSubmit={(event) => { event.preventDefault(); approve.mutate(); }}>
          {!success && <>
            <div className="space-y-2">
              <Label htmlFor="tv-approval-code">{text.code}</Label>
              <Input
                id="tv-approval-code"
                value={code}
                onChange={(event) => { setCode(event.target.value.toUpperCase().replace(/[^A-HJ-NP-Z2-9]/g, "").slice(0, 8)); setMessage(""); }}
                autoCapitalize="characters"
                autoComplete="off"
                maxLength={8}
                className="font-mono text-xl tracking-[0.2em] uppercase"
                placeholder="XXXXXXXX"
                data-testid="input-tv-approval-code"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tv-approval-pin">{text.pin}</Label>
              <Input
                id="tv-approval-pin"
                type="password"
                inputMode="numeric"
                pattern="[0-9]{4}"
                maxLength={4}
                value={pin}
                onChange={(event) => { setPin(event.target.value.replace(/\D/g, "").slice(0, 4)); setMessage(""); }}
                autoComplete="off"
                data-testid="input-tv-approval-pin"
              />
              <p className="text-xs text-muted-foreground">{text.pinHint}</p>
            </div>
          </>}
          {message && <p role={success ? "status" : "alert"} className={`text-sm ${success ? "text-emerald-700" : "text-destructive"}`}>{message}</p>}
          {!success && <Button type="submit" className="w-full" disabled={code.length !== 8 || pin.length !== 4 || approve.isPending} data-testid="button-tv-approve">
            {approve.isPending ? text.confirming : text.confirm}
          </Button>}
        </form>
        <div className="space-y-3 border-t pt-4">
          <h3 className="font-semibold">{text.connected}</h3>
          {devices.isLoading && <p className="text-sm text-muted-foreground">…</p>}
          {devices.isError && <Button variant="outline" size="sm" onClick={() => void devices.refetch()}>
            {i18n.language.startsWith("de") ? "Fernseher erneut laden" : "Reload TVs"}
          </Button>}
          {devices.data?.devices.length === 0 && <p className="text-sm text-muted-foreground">{text.none}</p>}
          {devices.data?.devices.map((device) => (
            <div key={device.id} className="rounded-xl border p-3 space-y-2">
              <div className="flex justify-between gap-3 text-sm">
                <span className="font-medium">TV · {new Date(device.createdAt).toLocaleDateString(i18n.language)}</span>
                <span className="text-muted-foreground">{device.id.slice(0, 8)}</span>
              </div>
              <p className="text-xs text-muted-foreground">{text.lastUsed}: {new Date(device.lastSeenAt).toLocaleString(i18n.language)}</p>
              {confirmDisconnect === device.id ? (
                <div className="space-y-2">
                  <p className="text-xs text-destructive">{text.disconnectHint}</p>
                  <div className="flex gap-2">
                    <Button type="button" size="sm" variant="destructive" disabled={disconnect.isPending} onClick={() => disconnect.mutate(device.id)}>{text.disconnectConfirm}</Button>
                    <Button type="button" size="sm" variant="outline" onClick={() => setConfirmDisconnect(null)}>{text.cancel}</Button>
                  </div>
                </div>
              ) : <Button type="button" size="sm" variant="outline" onClick={() => setConfirmDisconnect(device.id)}>{text.disconnect}</Button>}
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}