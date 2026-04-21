import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { useTranslation } from "react-i18next";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Settings, Palette, User2, LogOut, Sun, Moon, Menu, Trophy, MailCheck, Loader2 } from "lucide-react";
import { useTheme } from "@/components/theme-provider";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import type { FamilyMember } from "@shared/schema";
import { getAvatarUrl } from "@/lib/skins";
import { apiRequest, queryClient } from "@/lib/queryClient";

interface ProfileMenuProps {
  member: FamilyMember;
  isParent: boolean;
  isRealParent: boolean;
  familyMemberCount: number;
  onEditProfile: () => void;
  onSwitchMember: () => void;
}

export function ProfileMenu({
  member,
  isParent,
  isRealParent,
  familyMemberCount,
  onEditProfile,
  onSwitchMember,
}: ProfileMenuProps) {
  const { t } = useTranslation();
  const { theme, setTheme } = useTheme();
  const { user } = useAuth();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);

  const resendVerificationMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/auth/resend-verification");
      return response.json() as Promise<{ message?: string }>;
    },
    onSuccess: (data) => {
      toast({
        title: "Bestätigungsmail gesendet",
        description: data.message || "Bitte prüfe deinen Posteingang und den Spam-Ordner.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Bestätigung konnte nicht gesendet werden",
        description: error?.message || "Bitte versuche es später noch einmal.",
        variant: "destructive",
      });
    },
  });

  const handleThemeToggle = () => {
    setTheme(theme === "dark" ? "light" : "dark");
  };

  const handleLogout = async () => {
    await apiRequest("POST", "/api/auth/logout");
    queryClient.clear();
    window.location.href = "/";
  };

  const showVerificationAction = isParent && !!user?.email && !user?.isEmailVerified;

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="flex-shrink-0 bg-background/60 backdrop-blur-sm border border-border/50"
          data-testid="button-profile-menu"
        >
          <Menu className="h-5 w-5" data-testid="icon-menu" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>
          <div className="flex flex-col space-y-1">
            <p className="text-sm font-medium leading-none">{member.displayName}</p>
            <p className="text-xs leading-none text-muted-foreground">{member.familyName}</p>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        
        {/* Block 1: Profile & Actions */}
        {showVerificationAction && (
          <>
            <DropdownMenuItem
              disabled={resendVerificationMutation.isPending}
              onSelect={(event) => {
                event.preventDefault();
                resendVerificationMutation.mutate();
              }}
              data-testid="menu-item-resend-verification"
            >
              {resendVerificationMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <MailCheck className="mr-2 h-4 w-4" />
              )}
              <span>{resendVerificationMutation.isPending ? "Wird gesendet..." : "Bestätigungsmail erneut senden"}</span>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
          </>
        )}
        {isRealParent && familyMemberCount > 1 && (
          <DropdownMenuItem onClick={onSwitchMember} data-testid="menu-item-switch-member">
            <User2 className="mr-2 h-4 w-4" />
            <span>{t("settings.switchMember")}</span>
          </DropdownMenuItem>
        )}
        {!isParent && (
          <DropdownMenuItem onClick={onEditProfile} data-testid="menu-item-edit-profile">
            <Settings className="mr-2 h-4 w-4" />
            <span>{t("settings.editProfile")}</span>
          </DropdownMenuItem>
        )}
        
        {/* Block 2: Family Navigation */}
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/skins-gallery" data-testid="menu-item-skins">
            <Palette className="mr-2 h-4 w-4" />
            <span>{t("nav.skins")}</span>
          </Link>
        </DropdownMenuItem>
        {isParent && (
          <>
            <DropdownMenuItem asChild>
              <Link href="/achievements" data-testid="menu-item-achievements">
                <Trophy className="mr-2 h-4 w-4" />
                <span>{t("achievements.title")}</span>
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/settings" data-testid="menu-item-settings">
                <Settings className="mr-2 h-4 w-4" />
                <span>{t("settings.familySettings")}</span>
              </Link>
            </DropdownMenuItem>
          </>
        )}
        
        {/* Block 3: System & Logout */}
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleThemeToggle} data-testid="menu-item-theme-toggle">
          {theme === "dark" ? (
            <Sun className="mr-2 h-4 w-4" />
          ) : (
            <Moon className="mr-2 h-4 w-4" />
          )}
          <span>{theme === "dark" ? t("settings.lightMode") : t("settings.darkMode")}</span>
        </DropdownMenuItem>
        {/* Only show logout for parents - children use "Switch Member" instead */}
        {isParent && (
          <DropdownMenuItem
            onClick={handleLogout}
            data-testid="menu-item-logout"
          >
            <LogOut className="mr-2 h-4 w-4" />
            <span>{t("auth.logout")}</span>
          </DropdownMenuItem>
        )}
        
        
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
