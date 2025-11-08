import { useState } from "react";
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
import { ThemeToggle } from "@/components/theme-toggle";
import { Settings, Palette, User2, LogOut, ChevronDown, Sun, Moon, Menu } from "lucide-react";
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
  const { theme, setTheme } = useTheme();
  const [open, setOpen] = useState(false);

  const handleThemeToggle = () => {
    setTheme(theme === "dark" ? "light" : "dark");
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
        {!isParent && (
          <DropdownMenuItem onClick={onEditProfile} data-testid="menu-item-edit-profile">
            <Settings className="mr-2 h-4 w-4" />
            <span>{t("settings.editProfile")}</span>
          </DropdownMenuItem>
        )}
        <DropdownMenuItem asChild>
          <Link href="/skins-gallery" data-testid="menu-item-skins">
            <Palette className="mr-2 h-4 w-4" />
            <span>{t("nav.skins")}</span>
          </Link>
        </DropdownMenuItem>
        {isParent && (
          <DropdownMenuItem asChild>
            <Link href="/settings" data-testid="menu-item-settings">
              <Settings className="mr-2 h-4 w-4" />
              <span>{t("settings.familySettings")}</span>
            </Link>
          </DropdownMenuItem>
        )}
        {isRealParent && familyMemberCount > 1 && (
          <DropdownMenuItem onClick={onSwitchMember} data-testid="menu-item-switch-member">
            <User2 className="mr-2 h-4 w-4" />
            <span>{t("settings.switchMember")}</span>
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleThemeToggle} data-testid="menu-item-theme-toggle">
          {theme === "dark" ? (
            <Sun className="mr-2 h-4 w-4" />
          ) : (
            <Moon className="mr-2 h-4 w-4" />
          )}
          <span>{theme === "dark" ? t("settings.lightMode") : t("settings.darkMode")}</span>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() => (window.location.href = "/api/logout")}
          data-testid="menu-item-logout"
        >
          <LogOut className="mr-2 h-4 w-4" />
          <span>{t("auth.logout")}</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
