import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Check, User } from "lucide-react";
import type { FamilyMember } from "@shared/schema";
import { getAvatarUrl } from "@/lib/skins";

interface SwitchMemberDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  members: FamilyMember[];
  currentMember: FamilyMember | null;
  onSwitch: (memberId: string | null) => void;
  isSubmitting?: boolean;
}

export function SwitchMemberDialog({ 
  open, 
  onOpenChange, 
  members,
  currentMember,
  onSwitch,
  isSubmitting = false
}: SwitchMemberDialogProps) {
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(currentMember?.id || null);

  const handleSwitch = () => {
    onSwitch(selectedMemberId);
  };

  const handleSwitchBack = () => {
    onSwitch(null as any);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]" data-testid="dialog-switch-member">
        <DialogHeader>
          <DialogTitle>Switch Member</DialogTitle>
          <DialogDescription>
            Act as a different family member to test their view
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-2 py-4">
          {members.map((member) => (
            <button
              key={member.id}
              onClick={() => setSelectedMemberId(member.id)}
              className={`w-full flex items-center gap-3 p-3 rounded-lg hover-elevate active-elevate-2 transition-colors ${
                selectedMemberId === member.id ? 'bg-accent' : 'bg-card'
              }`}
              data-testid={`button-select-member-${member.id}`}
            >
              <Avatar className="h-10 w-10">
                <AvatarImage src={getAvatarUrl(member.activeSkinId, member.avatarUrl)} alt={member.displayName} />
                <AvatarFallback style={{ backgroundColor: member.color }}>
                  <User className="h-5 w-5" />
                </AvatarFallback>
              </Avatar>
              
              <div className="flex-1 text-left">
                <div className="font-medium">{member.displayName}</div>
                <div className="text-sm text-muted-foreground capitalize">{member.role}</div>
              </div>
              
              {selectedMemberId === member.id && (
                <Check className="h-5 w-5 text-primary" data-testid={`icon-selected-${member.id}`} />
              )}
            </button>
          ))}
        </div>
        
        <DialogFooter className="flex-row gap-2 sm:gap-2">
          <Button
            variant="outline"
            onClick={handleSwitchBack}
            disabled={isSubmitting}
            data-testid="button-switch-back"
          >
            Switch Back to Me
          </Button>
          <Button
            onClick={handleSwitch}
            disabled={isSubmitting}
            data-testid="button-confirm-switch"
          >
            {isSubmitting ? "Switching..." : "Switch"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
