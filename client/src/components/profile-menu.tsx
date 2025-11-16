import { useState } from "react";
import { Link } from "wouter";
import { useTranslation } from "react-i18next";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
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
import { ThemeToggle } from "@/components/theme-toggle";
import { Settings, Palette, User2, LogOut, ChevronDown, Sun, Moon, Menu, RotateCcw, Baby, BarChart3 } from "lucide-react";
import { useTheme } from "@/components/theme-provider";
import type { FamilyMember } from "@shared/schema";
import { getAvatarUrl } from "@/lib/skins";

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
  const { toast } = useToast();
  const { theme, setTheme } = useTheme();
  const [open, setOpen] = useState(false);

  const resetSubscriptionMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("POST", "/api/admin/reset-subscription");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/families/current"] });
      toast({
        title: "✅ Subscription Reset",
        description: "Your family subscription has been reset to Free tier.",
      });
      setOpen(false);
    },
    onError: (error: any) => {
      toast({
        title: "❌ Error",
        description: error.message || "Failed to reset subscription",
        variant: "destructive",
      });
    },
  });

  const handleThemeToggle = () => {
    setTheme(theme === "dark" ? "light" : "dark");
  };

  const handleResetSubscription = () => {
    if (confirm("Are you sure you want to reset your subscription to Free? This cannot be undone.")) {
      resetSubscriptionMutation.mutate();
    }
  };

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="flex-shrink-0"
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
        <DropdownMenuItem asChild>
          <Link href="/kid-dashboard" data-testid="menu-item-kid-preview">
            <Baby className="mr-2 h-4 w-4" />
            <span>Kinder-Vorschau</span>
          </Link>
        </DropdownMenuItem>
        
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
              <Link href="/analytics" data-testid="menu-item-analytics">
                <BarChart3 className="mr-2 h-4 w-4" />
                <span>{t("dashboard.analytics")}</span>
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
        <DropdownMenuItem
          onClick={() => (window.location.href = "/api/logout")}
          data-testid="menu-item-logout"
        >
          <LogOut className="mr-2 h-4 w-4" />
          <span>{t("auth.logout")}</span>
        </DropdownMenuItem>
        
        {/* Admin Section (separated at bottom) */}
        {isParent && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem 
              onClick={handleResetSubscription}
              disabled={resetSubscriptionMutation.isPending}
              data-testid="menu-item-reset-subscription"
            >
              <RotateCcw className="mr-2 h-4 w-4" />
              <span>Reset to Free (Admin)</span>
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
