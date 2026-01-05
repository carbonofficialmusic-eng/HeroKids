import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Check, User, Lock } from "lucide-react";
import type { FamilyMember, Family } from "@shared/schema";
import { getAvatarUrl } from "@/lib/skins";

interface SwitchMemberDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  members: FamilyMember[];
  currentMember: FamilyMember | null;
  familyData: { singleDeviceMode?: boolean } | null | undefined;
  onSwitch: (params: { memberId: string | null; pinCode?: string }) => void;
  isSubmitting?: boolean;
}

export function SwitchMemberDialog({ 
  open, 
  onOpenChange, 
  members,
  currentMember,
  familyData,
  onSwitch,
  isSubmitting = false
}: SwitchMemberDialogProps) {
  const { t } = useTranslation();
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(currentMember?.id || null);
  const [pinCode, setPinCode] = useState("");

  const selectedMember = members.find(m => m.id === selectedMemberId);
  const requiresPin = familyData?.singleDeviceMode && selectedMember?.role === "parent";

  const handleSwitch = () => {
    // If PIN is required but empty, use default PIN "0000"
    const finalPinCode = requiresPin ? (pinCode || "0000") : undefined;
    onSwitch({ memberId: selectedMemberId, pinCode: finalPinCode });
    setPinCode("");
  };

  const handleSwitchBack = () => {
    onSwitch({ memberId: null });
    setPinCode("");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px] max-h-[90vh] flex flex-col" data-testid="dialog-switch-member">
        <DialogHeader>
          <DialogTitle>{t('memberDialogs.switchMember')}</DialogTitle>
          <DialogDescription>
            {t('memberDialogs.switchMemberDesc')}
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4 overflow-y-auto flex-1 min-h-0">
          <div className="space-y-2 pr-1">
            {members.map((member) => (
              <div key={member.id}>
                <button
                  onClick={() => {
                    setSelectedMemberId(member.id);
                    setPinCode("");
                  }}
                  className={`w-full flex items-center gap-3 p-3 rounded-lg hover-elevate active-elevate-2 transition-colors ${
                    selectedMemberId === member.id ? 'bg-accent' : 'bg-card'
                  }`}
                  data-testid={`button-select-member-${member.id}`}
                >
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={getAvatarUrl(member.activeSkinId, member.avatarUrl, member.useCustomAvatar, member.updatedAt)} alt={member.displayName} />
                    <AvatarFallback style={{ backgroundColor: member.color }}>
                      <User className="h-5 w-5" />
                    </AvatarFallback>
                  </Avatar>
                  
                  <div className="flex-1 text-left">
                    <div className="font-medium flex items-center gap-2">
                      {member.displayName}
                      {familyData?.singleDeviceMode && member.role === "parent" && (
                        <Lock className="h-3 w-3 text-muted-foreground" />
                      )}
                    </div>
                    <div className="text-sm text-muted-foreground capitalize">{member.role}</div>
                  </div>
                  
                  {selectedMemberId === member.id && (
                    <Check className="h-5 w-5 text-primary" data-testid={`icon-selected-${member.id}`} />
                  )}
                </button>

                {/* PIN Code Input - shown directly below the selected parent */}
                {selectedMemberId === member.id && familyData?.singleDeviceMode && member.role === "parent" && (
                  <div className="mt-2 space-y-2 p-4 rounded-lg border bg-accent/20">
                    <div className="flex items-center gap-2 text-sm font-medium">
                      <Lock className="h-4 w-4" />
                      <span>{t('memberDialogs.pinRequired')}</span>
                    </div>
                    <Label htmlFor="pin-input-switch" className="text-sm text-muted-foreground">
                      {t('memberDialogs.enterPinFor', { name: member.displayName })}
                    </Label>
                    <Input
                      id="pin-input-switch"
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      maxLength={4}
                      value={pinCode}
                      onChange={(e) => {
                        const value = e.target.value.replace(/[^0-9]/g, '');
                        setPinCode(value);
                      }}
                      placeholder="0000"
                      className="text-center text-2xl tracking-widest font-mono"
                      data-testid="input-switch-pin"
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
        
        <DialogFooter className="flex-row gap-2 sm:gap-2 flex-shrink-0">
          <Button
            variant="outline"
            onClick={handleSwitchBack}
            disabled={isSubmitting || familyData?.singleDeviceMode === true}
            data-testid="button-switch-back"
          >
            {t('memberDialogs.switchBackToMe')}
          </Button>
          <Button
            onClick={handleSwitch}
            disabled={isSubmitting || (requiresPin && pinCode.length > 0 && pinCode.length < 4)}
            data-testid="button-confirm-switch"
          >
            {isSubmitting ? t('memberDialogs.switching') : t('memberDialogs.switch')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
