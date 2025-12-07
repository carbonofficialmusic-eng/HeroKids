import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Smartphone, Copy, Check, Trash2, RefreshCw, Clock, Loader2, Lock } from "lucide-react";
import type { FamilyMember } from "@shared/schema";
import { formatDistanceToNow } from "date-fns";
import { de, enUS } from "date-fns/locale";

interface DeviceLinkDialogProps {
  member: FamilyMember | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface DeviceSession {
  id: string;
  deviceLabel: string | null;
  lastSeenAt: string;
  createdAt: string;
}

interface LinkCodeResponse {
  code: string;
  expiresAt: string;
  memberName: string;
}

export function DeviceLinkDialog({ member, open, onOpenChange }: DeviceLinkDialogProps) {
  const { t, i18n } = useTranslation();
  const { toast } = useToast();
  const [codeCopied, setCodeCopied] = useState(false);
  const [generatedCode, setGeneratedCode] = useState<LinkCodeResponse | null>(null);
  const [expiresIn, setExpiresIn] = useState<number>(0);
  const [pin, setPin] = useState("");
  const [pinError, setPinError] = useState(false);

  const locale = i18n.language === "de" ? de : enUS;

  const { data: devices, isLoading: devicesLoading, refetch: refetchDevices } = useQuery<DeviceSession[]>({
    queryKey: ["/api/device-link/devices", member?.id],
    enabled: !!member && open,
  });

  const generateCodeMutation = useMutation({
    mutationFn: async ({ memberId, pin }: { memberId: string; pin: string }) => {
      const res = await apiRequest("POST", "/api/device-link/generate-code", { memberId, pin });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Failed to generate code");
      }
      return res.json();
    },
    onSuccess: (data: LinkCodeResponse) => {
      setGeneratedCode(data);
      setPin("");
      setPinError(false);
      toast({
        title: t("deviceLink.codeGenerated"),
        description: t("deviceLink.codeGeneratedDesc"),
      });
    },
    onError: (error: Error) => {
      if (error.message === "Invalid PIN") {
        setPinError(true);
        toast({
          title: t("common.error"),
          description: t("deviceLink.invalidPin"),
          variant: "destructive",
        });
      } else {
        toast({
          title: t("common.error"),
          description: t("deviceLink.generateError"),
          variant: "destructive",
        });
      }
    },
  });

  const revokeDeviceMutation = useMutation({
    mutationFn: async (sessionId: string) => {
      await apiRequest("DELETE", `/api/device-link/devices/${sessionId}`);
    },
    onSuccess: () => {
      refetchDevices();
      toast({
        title: t("deviceLink.deviceRevoked"),
        description: t("deviceLink.deviceRevokedDesc"),
      });
    },
    onError: () => {
      toast({
        title: t("common.error"),
        description: t("deviceLink.revokeError"),
        variant: "destructive",
      });
    },
  });

  useEffect(() => {
    if (!generatedCode) return;

    const expiresAt = new Date(generatedCode.expiresAt).getTime();
    const updateTimer = () => {
      const remaining = Math.max(0, Math.floor((expiresAt - Date.now()) / 1000));
      setExpiresIn(remaining);
      if (remaining === 0) {
        setGeneratedCode(null);
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [generatedCode]);

  useEffect(() => {
    if (!open) {
      setGeneratedCode(null);
      setCodeCopied(false);
      setPin("");
      setPinError(false);
    }
  }, [open]);

  const copyCode = async () => {
    if (!generatedCode) return;
    try {
      await navigator.clipboard.writeText(generatedCode.code);
      setCodeCopied(true);
      setTimeout(() => setCodeCopied(false), 2000);
      toast({
        title: t("deviceLink.codeCopied"),
        description: t("deviceLink.codeCopiedDesc"),
      });
    } catch {
      toast({
        title: t("common.error"),
        description: t("deviceLink.copyError"),
        variant: "destructive",
      });
    }
  };

  const formatMinutes = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  if (!member) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Smartphone className="h-5 w-5" />
            {t("deviceLink.title")}
          </DialogTitle>
          <DialogDescription className="space-y-2">
            <span>{t("deviceLink.description", { name: member.displayName })}</span>
            <span className="block text-xs text-amber-600 dark:text-amber-400">
              {t("deviceLink.pinRequiredHint")}
            </span>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {generatedCode ? (
            <div className="space-y-3">
              <div className="flex items-center justify-center gap-2 p-4 bg-primary/10 rounded-lg">
                <span 
                  className="text-3xl font-mono font-bold tracking-widest"
                  data-testid="device-link-code"
                >
                  {generatedCode.code}
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={copyCode}
                  data-testid="button-copy-code"
                >
                  {codeCopied ? (
                    <Check className="h-5 w-5 text-green-500" />
                  ) : (
                    <Copy className="h-5 w-5" />
                  )}
                </Button>
              </div>
              <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                <Clock className="h-4 w-4" />
                <span>{t("deviceLink.expiresIn", { time: formatMinutes(expiresIn) })}</span>
              </div>
              <p className="text-sm text-center text-muted-foreground">
                {t("deviceLink.instructions")}
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="pin" className="flex items-center gap-2">
                  <Lock className="h-4 w-4" />
                  {t("deviceLink.enterPin")}
                </Label>
                <Input
                  id="pin"
                  type="password"
                  inputMode="numeric"
                  maxLength={4}
                  value={pin}
                  onChange={(e) => {
                    setPin(e.target.value.replace(/\D/g, "").slice(0, 4));
                    setPinError(false);
                  }}
                  placeholder="••••"
                  className={`text-center text-xl tracking-widest ${pinError ? "border-destructive" : ""}`}
                  data-testid="input-device-link-pin"
                />
                {pinError && (
                  <p className="text-xs text-destructive">{t("deviceLink.invalidPin")}</p>
                )}
                <p className="text-xs text-muted-foreground">{t("deviceLink.pinRequired")}</p>
              </div>
              <Button
                onClick={() => generateCodeMutation.mutate({ memberId: member.id, pin })}
                disabled={generateCodeMutation.isPending || pin.length !== 4}
                className="w-full"
                data-testid="button-generate-code"
              >
                {generateCodeMutation.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4 mr-2" />
                )}
                {t("deviceLink.generateCode")}
              </Button>
            </div>
          )}

          <div className="border-t pt-4">
            <h4 className="font-medium mb-3 flex items-center gap-2">
              <Smartphone className="h-4 w-4" />
              {t("deviceLink.linkedDevices")}
            </h4>

            {devicesLoading ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : devices && devices.length > 0 ? (
              <div className="space-y-2">
                {devices.map((device) => (
                  <div
                    key={device.id}
                    className="flex items-center justify-between p-3 rounded-lg border bg-card"
                    data-testid={`device-session-${device.id}`}
                  >
                    <div className="flex items-center gap-3">
                      <Smartphone className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <div className="font-medium">
                          {device.deviceLabel || t("deviceLink.unknownDevice")}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {t("deviceLink.lastSeen")}: {formatDistanceToNow(new Date(device.lastSeenAt), { addSuffix: true, locale })}
                        </div>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => revokeDeviceMutation.mutate(device.id)}
                      disabled={revokeDeviceMutation.isPending}
                      data-testid={`button-revoke-device-${device.id}`}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-4 text-muted-foreground text-sm">
                {t("deviceLink.noDevices")}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
