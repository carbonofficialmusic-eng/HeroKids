import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { AddMemberDialog } from "@/components/add-member-dialog";
import { EditMemberDialog } from "@/components/edit-member-dialog";
import { DeviceLinkDialog } from "@/components/device-link-dialog";
import { ChevronLeft, Trophy, UserPlus, Trash2, RotateCcw, Pencil, Key, Copy, Check, Languages, Smartphone, BarChart3, Users, Sparkles, CreditCard, ExternalLink, AlertTriangle, UserX } from "lucide-react";
import { useLocation } from "wouter";
import { apiRequest, queryClient, ApiError } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { getMaxMembers } from "@shared/tier-config";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import type { FamilyMember, Family } from "@shared/schema";
import { getAvatarUrl } from "@/lib/skins";

type FamilyMemberWithLimit = FamilyMember & { isOverLimit?: boolean };

export default function Settings() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [addMemberDialogOpen, setAddMemberDialogOpen] = useState(false);
  const [newMemberJoinCode, setNewMemberJoinCode] = useState<string | null>(null);
  const [memberToDelete, setMemberToDelete] = useState<FamilyMember | null>(null);
  const [memberToEdit, setMemberToEdit] = useState<FamilyMember | null>(null);
  const [editMemberDialogOpen, setEditMemberDialogOpen] = useState(false);
  const [showFactoryResetDialog, setShowFactoryResetDialog] = useState(false);
  const [joinCodeCopied, setJoinCodeCopied] = useState(false);
  const [weeklyPrize, setWeeklyPrize] = useState("");
  const [monthlyPrize, setMonthlyPrize] = useState("");
  const [memberForPinSetting, setMemberForPinSetting] = useState<FamilyMember | null>(null);
  const [pinDialogOpen, setPinDialogOpen] = useState(false);
  const [newPin, setNewPin] = useState("");
  const [memberForDeviceLink, setMemberForDeviceLink] = useState<FamilyMember | null>(null);
  const [deviceLinkDialogOpen, setDeviceLinkDialogOpen] = useState(false);
  const [localSkinCardCost, setLocalSkinCardCost] = useState<number | null>(null);

  // Fetch current family member (may be acting as someone)
  const { data: member, isLoading: memberLoading } = useQuery<FamilyMember>({
    queryKey: ["/api/family-members/current"],
    enabled: !!user,
  });

  // Fetch real user's member record (to determine permissions)
  const { data: realMember } = useQuery<FamilyMember>({
    queryKey: ["/api/family-members/real"],
    enabled: !!user,
  });

  // Fetch family data including settings
  const { data: familyData, isLoading: familyLoading } = useQuery<Family>({
    queryKey: ["/api/families/settings"],
    enabled: !!member,
  });

  // Fetch all family members
  const { data: familyMembers, isLoading: membersLoading } = useQuery<FamilyMemberWithLimit[]>({
    queryKey: ["/api/family-members"],
    enabled: !!member,
  });

  // Update family settings mutation
  const updateSettingsMutation = useMutation({
    mutationFn: async (settings: { 
      showLeaderboard?: boolean;
      singleDeviceMode?: boolean;
      language?: "de" | "en" | "fr" | "es" | "ja" | "zh" | "ko" | "sv";
      timezone?: string;
      weeklyPrize?: string | null;
      monthlyPrize?: string | null;
      skinCardCost?: number;
    }) => {
      return await apiRequest("PATCH", "/api/families/settings", settings);
    },
    onMutate: async (settings) => {
      await queryClient.cancelQueries({ queryKey: ["/api/families/current"] });
      const previousData = queryClient.getQueryData(["/api/families/current"]);
      queryClient.setQueryData(["/api/families/current"], (old: any) => {
        if (!old) return old;
        return { ...old, ...settings };
      });
      return { previousData };
    },
    onError: (_error, _variables, context) => {
      if (context?.previousData) {
        queryClient.setQueryData(["/api/families/current"], context.previousData);
      }
      toast({
        title: t('errors.somethingWrong'),
        description: t('settings.errorUpdateSettings'),
        variant: "destructive",
      });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/families/settings"] });
      queryClient.invalidateQueries({ queryKey: ["/api/families/current"] });
    },
  });

  // Add member mutation
  const addMemberMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await apiRequest("POST", "/api/family-members", data);
      return await response.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/family-members"] });
      queryClient.invalidateQueries({ queryKey: ["/api/families/current"] });
      setAddMemberDialogOpen(false);
      
      // Show join code if member was created with one
      if (data.joinCode) {
        setNewMemberJoinCode(data.joinCode);
      } else {
        toast({
          title: t('common.confirm'),
          description: t('settings.memberAddedSuccess'),
        });
      }
    },
    onError: (error: any) => {
      const description = error instanceof ApiError && error.data?.message
        ? error.data.message
        : t('settings.errorAddMember');
      
      toast({
        title: t('errors.somethingWrong'),
        description,
        variant: "destructive",
      });
    },
  });

  // Edit member mutation
  const editMemberMutation = useMutation({
    mutationFn: async ({ memberId, data }: { memberId: string; data: any }) => {
      const response = await apiRequest("PUT", `/api/family-members/${memberId}`, data);
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/family-members"] });
      queryClient.invalidateQueries({ queryKey: ["/api/family-members/current"] });
      queryClient.invalidateQueries({ queryKey: ["/api/family-members/real"] });
      queryClient.invalidateQueries({ queryKey: ["/api/families/current"] });
      setEditMemberDialogOpen(false);
      setMemberToEdit(null);
      toast({
        title: t('settings.memberUpdated'),
        description: t('settings.memberUpdatedDesc'),
      });
    },
    onError: (error: any) => {
      const description = error instanceof ApiError && error.data?.message
        ? error.data.message
        : t('settings.errorUpdateMember');
      
      toast({
        title: t('errors.somethingWrong'),
        description,
        variant: "destructive",
      });
    },
  });

  // Delete member mutation
  const deleteMemberMutation = useMutation({
    mutationFn: async (memberId: string) => {
      const response = await apiRequest("DELETE", `/api/family-members/${memberId}`, undefined);
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/family-members"] });
      queryClient.invalidateQueries({ queryKey: ["/api/families/current"] });
      setMemberToDelete(null);
      toast({
        title: t('settings.memberRemoved'),
        description: t('settings.memberRemovedDesc'),
      });
    },
    onError: () => {
      toast({
        title: t('errors.somethingWrong'),
        description: t('settings.errorRemoveMember'),
        variant: "destructive",
      });
    },
  });

  // Toggle leaderboard exclusion mutation with optimistic updates
  const toggleLeaderboardExclusionMutation = useMutation({
    mutationFn: async ({ memberId, excludeFromLeaderboard }: { memberId: string; excludeFromLeaderboard: boolean }) => {
      return await apiRequest("PUT", `/api/family-members/${memberId}`, { excludeFromLeaderboard });
    },
    onMutate: async ({ memberId, excludeFromLeaderboard }) => {
      await queryClient.cancelQueries({ queryKey: ["/api/family-members"] });
      const previousMembers = queryClient.getQueryData(["/api/family-members"]);
      queryClient.setQueryData(["/api/family-members"], (old: any) => {
        if (!old) return old;
        return old.map((m: any) => m.id === memberId ? { ...m, excludeFromLeaderboard } : m);
      });
      return { previousMembers };
    },
    onError: (_error, _variables, context) => {
      if (context?.previousMembers) {
        queryClient.setQueryData(["/api/family-members"], context.previousMembers);
      }
      toast({
        title: t('errors.somethingWrong'),
        description: t('settings.errorUpdateLeaderboard'),
        variant: "destructive",
      });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/family-members"] });
      queryClient.invalidateQueries({ queryKey: ["/api/analytics"] });
    },
  });

  // Factory reset mutation
  const factoryResetMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("POST", "/api/family/reset", {});
    },
    onSuccess: () => {
      // Invalidate all queries to refresh the entire app state
      queryClient.invalidateQueries();
      setShowFactoryResetDialog(false);
      toast({
        title: t('settings.familyResetComplete'),
        description: t('settings.familyResetDesc'),
      });
      // Redirect to dashboard
      setLocation("/dashboard");
    },
    onError: () => {
      toast({
        title: t('errors.somethingWrong'),
        description: t('settings.errorResetFamily'),
        variant: "destructive",
      });
    },
  });

  // Set/update PIN code mutation
  const setPinMutation = useMutation({
    mutationFn: async ({ memberId, pinCode }: { memberId: string; pinCode: string }) => {
      return await apiRequest("PATCH", `/api/family-members/${memberId}/pin`, { pinCode });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/family-members"] });
      setPinDialogOpen(false);
      setMemberForPinSetting(null);
      setNewPin("");
      toast({
        title: t('settings.pinUpdated'),
        description: t('settings.pinUpdatedDesc'),
      });
    },
    onError: () => {
      toast({
        title: t('errors.somethingWrong'),
        description: t('settings.errorSetPin'),
        variant: "destructive",
      });
    },
  });

  // Manage subscription (open Stripe portal)
  const manageSubscriptionMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/create-portal-session", {});
      return await response.json();
    },
    onSuccess: (data: { url: string }) => {
      window.location.href = data.url;
    },
    onError: (error: any) => {
      const description = error instanceof ApiError && error.data?.message
        ? error.data.message
        : t('settings.errorManageSubscription');
      
      toast({
        title: t('errors.somethingWrong'),
        description,
        variant: "destructive",
      });
    },
  });

  // Load prize values from familyData (must be before conditional returns to avoid hook order issues)
  useEffect(() => {
    if (familyData) {
      setWeeklyPrize(familyData.weeklyPrize || "");
      setMonthlyPrize(familyData.monthlyPrize || "");
    }
  }, [familyData]);

  // Only parents can access settings
  if (!memberLoading && !familyLoading && realMember?.role !== "parent") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardHeader>
            <CardTitle>{t('settings.accessDenied')}</CardTitle>
            <CardDescription>
              {t('settings.onlyParentsAccess')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button 
              onClick={() => setLocation("/")} 
              variant="outline"
              className="bg-background/30 backdrop-blur-sm border-border/40 hover:bg-background/60"
              data-testid="button-back-to-dashboard"
            >
              <ChevronLeft className="mr-2 h-4 w-4" />
              {t('settings.backToDashboard')}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (memberLoading || familyLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">{t('settings.loadingSettings')}</p>
        </div>
      </div>
    );
  }

  const handleToggleLeaderboard = (checked: boolean) => {
    updateSettingsMutation.mutate({ showLeaderboard: checked });
  };

  const handleToggleSingleDeviceMode = (checked: boolean) => {
    updateSettingsMutation.mutate({ singleDeviceMode: checked });
  };

  const handleCopyJoinCode = () => {
    if (familyData?.joinCode) {
      navigator.clipboard.writeText(familyData.joinCode);
      setJoinCodeCopied(true);
      setTimeout(() => setJoinCodeCopied(false), 2000);
      toast({
        title: t('settings.joinCodeCopied'),
        description: t('settings.shareJoinCode'),
      });
    }
  };

  const handleLanguageChange = (language: string) => {
    updateSettingsMutation.mutate({ language: language as "de" | "en" | "fr" | "es" | "ja" | "zh" | "ko" | "sv" });
  };

  const handleTimezoneChange = (timezone: string) => {
    updateSettingsMutation.mutate({ timezone });
  };

  const handleSavePrizes = () => {
    updateSettingsMutation.mutate({
      weeklyPrize: weeklyPrize.trim() || null,
      monthlyPrize: monthlyPrize.trim() || null,
    });
  };

  const languageOptions = [
    { value: "de", label: "Deutsch" },
    { value: "en", label: "English" },
    { value: "fr", label: "Français" },
    { value: "es", label: "Español" },
    { value: "ja", label: "日本語" },
    { value: "zh", label: "中文" },
    { value: "ko", label: "한국어" },
    { value: "sv", label: "Svenska" },
  ];

  // Common timezones grouped by region
  const timezoneOptions = [
    { value: "Europe/Berlin", label: "🇩🇪 Berlin (MEZ/MESZ)" },
    { value: "Europe/Stockholm", label: "🇸🇪 Stockholm (MEZ/MESZ)" },
    { value: "Europe/London", label: "🇬🇧 London (GMT/BST)" },
    { value: "Europe/Paris", label: "🇫🇷 Paris (MEZ/MESZ)" },
    { value: "Europe/Madrid", label: "🇪🇸 Madrid (MEZ/MESZ)" },
    { value: "Europe/Rome", label: "🇮🇹 Rom (MEZ/MESZ)" },
    { value: "Europe/Vienna", label: "🇦🇹 Wien (MEZ/MESZ)" },
    { value: "Europe/Zurich", label: "🇨🇭 Zürich (MEZ/MESZ)" },
    { value: "America/New_York", label: "🇺🇸 New York (EST/EDT)" },
    { value: "America/Chicago", label: "🇺🇸 Chicago (CST/CDT)" },
    { value: "America/Denver", label: "🇺🇸 Denver (MST/MDT)" },
    { value: "America/Los_Angeles", label: "🇺🇸 Los Angeles (PST/PDT)" },
    { value: "America/Toronto", label: "🇨🇦 Toronto (EST/EDT)" },
    { value: "America/Mexico_City", label: "🇲🇽 Mexico City (CST/CDT)" },
    { value: "America/Sao_Paulo", label: "🇧🇷 São Paulo (BRT)" },
    { value: "Asia/Tokyo", label: "🇯🇵 Tokyo (JST)" },
    { value: "Asia/Shanghai", label: "🇨🇳 Shanghai (CST)" },
    { value: "Asia/Seoul", label: "🇰🇷 Seoul (KST)" },
    { value: "Asia/Dubai", label: "🇦🇪 Dubai (GST)" },
    { value: "Asia/Singapore", label: "🇸🇬 Singapore (SGT)" },
    { value: "Australia/Sydney", label: "🇦🇺 Sydney (AEDT/AEST)" },
    { value: "Pacific/Auckland", label: "🇳🇿 Auckland (NZDT/NZST)" },
  ];

  // Auto-detect browser timezone
  const browserTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  return (
    <div className="min-h-screen">
      <div className="container max-w-4xl mx-auto p-4 sm:p-6 lg:p-8">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <Button
            variant="outline"
            size="icon"
            onClick={() => setLocation("/")}
            data-testid="button-back"
            className="bg-card/90 backdrop-blur-sm border-border"
          >
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold">{t('settings.familySettings')}</h1>
            <p className="text-muted-foreground">{t('settings.manageExperience')}</p>
          </div>
        </div>

        {/* Settings Cards */}
        <div className="space-y-4">
          {/* Family Members Settings */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <UserPlus className="h-5 w-5 text-primary" />
                <CardTitle>{t('settings.familySettings')}</CardTitle>
              </div>
              <CardDescription>
                {t('settings.manageMembersDesc')}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Family Name Display */}
              {member?.familyName && (
                <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 border" data-testid="family-name-display">
                  <Users className="h-5 w-5 text-primary" />
                  <div>
                    <p className="text-sm text-muted-foreground">{t('settings.familyName')}</p>
                    <p className="font-semibold text-lg" data-testid="text-family-name">{member.familyName}</p>
                  </div>
                </div>
              )}
              
              {/* Over-limit warning banner */}
              {familyMembers && familyMembers.some(m => m.isOverLimit) && (
                <div className="flex items-start gap-3 p-3 rounded-lg border border-amber-500/40 bg-amber-50 dark:bg-amber-950/30">
                  <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
                  <div className="text-sm">
                    <p className="font-semibold text-amber-800 dark:text-amber-300">{t('settings.overLimitTitle')}</p>
                    <p className="text-amber-700 dark:text-amber-400 mt-0.5">{t('settings.overLimitDesc', { count: familyMembers.filter(m => m.isOverLimit).length })}</p>
                  </div>
                </div>
              )}

              {/* Members List */}
              {membersLoading ? (
                <div className="text-center py-4 text-muted-foreground">
                  {t('settings.loadingMembers')}
                </div>
              ) : familyMembers && familyMembers.length > 0 ? (
                <div className="space-y-2">
                  {familyMembers.map((familyMember) => {
                    const isCurrentUser = familyMember.id === member?.id;
                    const isOverLimit = familyMember.isOverLimit === true;
                    return (
                      <div
                        key={familyMember.id}
                        className={`flex items-center justify-between p-3 rounded-lg border bg-card ${isOverLimit ? 'opacity-50 border-amber-500/40 bg-amber-50/30 dark:bg-amber-950/10' : 'hover-elevate'}`}
                        data-testid={`member-item-${familyMember.id}`}
                      >
                        <div className="flex items-center gap-3">
                          <Avatar className={`h-10 w-10 ${isOverLimit ? 'grayscale' : ''}`}>
                            <AvatarImage src={getAvatarUrl(familyMember.activeSkinId, familyMember.avatarUrl, familyMember.useCustomAvatar, familyMember.updatedAt)} alt={familyMember.displayName} />
                            <AvatarFallback style={{ backgroundColor: familyMember.color }}>
                              {familyMember.displayName.slice(0, 2).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-medium" data-testid={`member-name-${familyMember.id}`}>
                                {familyMember.displayName}
                              </span>
                              {isCurrentUser && (
                                <Badge variant="secondary" className="text-xs">{t('settings.you')}</Badge>
                              )}
                              {isOverLimit && (
                                <Badge variant="outline" className="text-xs border-amber-500 text-amber-700 dark:text-amber-400 gap-1">
                                  <UserX className="h-3 w-3" />
                                  {t('settings.deactivated')}
                                </Badge>
                              )}
                            </div>
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              <span>{familyMember.role === "parent" ? t('settings.parent') : t('settings.child')}</span>
                              <span>•</span>
                              <span>{familyMember.totalPoints} {t('dashboard.pointsLabel')}</span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {!isOverLimit && familyMember.role === "child" && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => {
                                setMemberForDeviceLink(familyMember);
                                setDeviceLinkDialogOpen(true);
                              }}
                              data-testid={`button-link-device-${familyMember.id}`}
                              title={t('settings.linkDevice')}
                            >
                              <Smartphone className="h-4 w-4" />
                            </Button>
                          )}
                          {!isOverLimit && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => {
                                setMemberToEdit(familyMember);
                                setEditMemberDialogOpen(true);
                              }}
                              disabled={editMemberMutation.isPending}
                              data-testid={`button-edit-member-${familyMember.id}`}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                          )}
                          {!isCurrentUser && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setMemberToDelete(familyMember)}
                              disabled={deleteMemberMutation.isPending}
                              data-testid={`button-delete-member-${familyMember.id}`}
                              title={isOverLimit ? t('settings.removeMemberButton') : undefined}
                            >
                              <Trash2 className={`h-4 w-4 ${isOverLimit ? 'text-amber-600' : 'text-destructive'}`} />
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-4 text-muted-foreground">
                  {t('settings.noMembersYet')}
                </div>
              )}

              {/* Add Member Button */}
              <Button
                onClick={() => setAddMemberDialogOpen(true)}
                data-testid="button-add-member"
                className="w-full"
              >
                <UserPlus className="h-4 w-4 mr-2" />
                {t('settings.addMember')}
              </Button>
            </CardContent>
          </Card>

          {/* Family Join Code */}
          <Card className="border-primary/50">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Key className="h-5 w-5 text-primary" />
                <CardTitle>{t('settings.familyJoinCodeTitle')}</CardTitle>
              </div>
              <CardDescription>
                {t('settings.joinCodeDesc')}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between p-4 rounded-lg border bg-card/50">
                <div>
                  <p className="text-xs text-muted-foreground mb-1">{t('settings.yourFamilyJoinCode')}</p>
                  <p className="text-3xl font-black tracking-widest text-primary font-mono" data-testid="text-family-join-code">
                    {familyData?.joinCode}
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={handleCopyJoinCode}
                  data-testid="button-copy-join-code"
                  className="flex-shrink-0"
                  aria-label="Copy join code"
                >
                  {joinCodeCopied ? (
                    <Check className="h-4 w-4 text-green-500" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>
              <p className="text-sm text-muted-foreground mt-3">
                {t('settings.joinCodeInstructions')}
              </p>
            </CardContent>
          </Card>

          {/* Language Settings */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Languages className="h-5 w-5 text-primary" />
                <CardTitle>{t('settings.languagePreferences')}</CardTitle>
              </div>
              <CardDescription>
                {t('settings.languageDesc')}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between gap-4">
                <div className="space-y-0.5 flex-1">
                  <Label htmlFor="language-select" className="text-base">
                    {t('settings.interfaceLanguage')}
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    {t('settings.selectInterfaceLanguage')}
                  </p>
                </div>
                <Select
                  value={familyData?.language || "en"}
                  onValueChange={handleLanguageChange}
                  disabled={updateSettingsMutation.isPending}
                >
                  <SelectTrigger className="w-[180px]" data-testid="select-language">
                    <SelectValue placeholder={t('settings.selectLanguage')} />
                  </SelectTrigger>
                  <SelectContent>
                    {languageOptions.map((lang) => (
                      <SelectItem key={lang.value} value={lang.value} data-testid={`select-language-${lang.value}`}>
                        {lang.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Timezone Settings */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <span className="text-xl">🕐</span>
                <CardTitle>{t('settings.timezoneTitle')}</CardTitle>
              </div>
              <CardDescription>
                {t('settings.timezoneDesc')}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between gap-4">
                <div className="space-y-0.5 flex-1">
                  <Label htmlFor="timezone-select" className="text-base">
                    {t('settings.yourTimezone')}
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    {t('settings.currentlyDetected')} <span className="font-mono text-xs">{browserTimezone}</span>
                  </p>
                </div>
                <Select
                  value={familyData?.timezone || "Europe/Berlin"}
                  onValueChange={handleTimezoneChange}
                  disabled={updateSettingsMutation.isPending}
                >
                  <SelectTrigger className="w-[240px]" data-testid="select-timezone">
                    <SelectValue placeholder={t('settings.selectTimezone')} />
                  </SelectTrigger>
                  <SelectContent>
                    {timezoneOptions.map((tz) => (
                      <SelectItem key={tz.value} value={tz.value} data-testid={`select-timezone-${tz.value}`}>
                        {tz.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {familyData?.timezone !== browserTimezone && (
                <div className="p-3 rounded-lg bg-muted/50 border border-muted">
                  <p className="text-sm text-muted-foreground">
                    💡 <strong>{t('settings.timezoneNote')}</strong> {t('settings.timezoneMismatch', { set: familyData?.timezone, browser: browserTimezone })}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Single Device Mode */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Key className="h-5 w-5 text-primary" />
                <CardTitle>{t('settings.singleDeviceTitle')}</CardTitle>
              </div>
              <CardDescription>
                {t('settings.singleDeviceDesc')}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="single-device-mode" className="text-base">
                    {t('settings.singleDeviceMode')}
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    {familyData?.singleDeviceMode 
                      ? t('settings.singleDeviceModeEnabled')
                      : t('settings.singleDeviceModeDisabled')}
                  </p>
                </div>
                <Switch
                  id="single-device-mode"
                  checked={familyData?.singleDeviceMode ?? false}
                  onCheckedChange={handleToggleSingleDeviceMode}
                  disabled={updateSettingsMutation.isPending}
                  data-testid="switch-single-device-mode"
                />
              </div>
            </CardContent>
          </Card>

          {/* PIN Code Management - only shown when single device mode is enabled */}
          {familyData?.singleDeviceMode && (
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Key className="h-5 w-5 text-primary" />
                  <CardTitle>{t('settings.parentPinCodesTitle')}</CardTitle>
                </div>
                <CardDescription>
                  {t('settings.parentPinCodesDesc')}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {membersLoading ? (
                  <div className="text-center py-4 text-muted-foreground">
                    {t('settings.loadingMembers')}
                  </div>
                ) : familyMembers && familyMembers.length > 0 ? (
                  <div className="space-y-3">
                    {familyMembers
                      .filter((m) => m.role === "parent")
                      .map((parent) => (
                        <div
                          key={parent.id}
                          className="flex items-center justify-between p-3 rounded-lg border bg-card"
                          data-testid={`pin-management-${parent.id}`}
                        >
                          <div className="flex items-center gap-3">
                            <Avatar className="h-10 w-10">
                              <AvatarImage src={getAvatarUrl(parent.activeSkinId, parent.avatarUrl, parent.useCustomAvatar)} alt={parent.displayName} />
                              <AvatarFallback style={{ backgroundColor: parent.color }}>
                                {parent.displayName.slice(0, 2).toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <div className="font-medium">{parent.displayName}</div>
                              <div className="text-sm text-muted-foreground">
                                {parent.pinCode ? t('settings.pinSet') : t('settings.noPin')}
                              </div>
                            </div>
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setMemberForPinSetting(parent);
                              setPinDialogOpen(true);
                            }}
                            data-testid={`button-set-pin-${parent.id}`}
                          >
                            <Key className="h-4 w-4 mr-2" />
                            {parent.pinCode ? t('settings.changePin') : t('settings.setPin')}
                          </Button>
                        </div>
                      ))}
                  </div>
                ) : (
                  <div className="text-center py-4 text-muted-foreground">
                    {t('settings.noMembersYet')}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Motivation Settings - Skin Card Cost */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" />
                <CardTitle>{t('settings.motivationTitle')}</CardTitle>
              </div>
              <CardDescription>
                {t('settings.motivationDesc')}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-base">{t('settings.skinCardCost')}</Label>
                  <span className="text-lg font-semibold text-primary" data-testid="text-skin-card-cost">
                    {localSkinCardCost ?? familyData?.skinCardCost ?? 60} {t('settings.points')}
                  </span>
                </div>
                <Slider
                  value={[localSkinCardCost ?? familyData?.skinCardCost ?? 60]}
                  min={40}
                  max={80}
                  step={5}
                  onValueChange={(value) => {
                    setLocalSkinCardCost(value[0]);
                  }}
                  onValueCommit={(value) => {
                    const newValue = value[0];
                    setLocalSkinCardCost(newValue);
                    updateSettingsMutation.mutate({ skinCardCost: newValue }, {
                      onSuccess: () => {
                        setLocalSkinCardCost(null);
                      }
                    });
                  }}
                  disabled={updateSettingsMutation.isPending}
                  className="w-full"
                  data-testid="slider-skin-card-cost"
                />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>{t('settings.moreFun')}</span>
                  <span>{t('settings.longerLasting')}</span>
                </div>
              </div>
              <p className="text-sm text-muted-foreground">
                {t('settings.skinCardCostInfo')}
              </p>
            </CardContent>
          </Card>

          {/* Leaderboard Settings - All in one card */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Trophy className="h-5 w-5 text-primary" />
                <CardTitle>{t('settings.leaderboardSettings')}</CardTitle>
              </div>
              <CardDescription>
                {t('settings.leaderboardSettingsDesc')}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Visibility Toggle */}
              <div className="flex items-center justify-between pb-4 border-b">
                <div className="space-y-0.5">
                  <Label htmlFor="show-leaderboard" className="text-base">
                    {t('settings.showToChildren')}
                  </Label>
                  {!familyData?.showLeaderboard && (
                    <p className="text-sm text-muted-foreground">
                      {t('settings.leaderboardHidden')}
                    </p>
                  )}
                </div>
                <Switch
                  id="show-leaderboard"
                  checked={familyData?.showLeaderboard ?? true}
                  onCheckedChange={handleToggleLeaderboard}
                  disabled={updateSettingsMutation.isPending}
                  data-testid="switch-show-leaderboard"
                />
              </div>

              {/* Competition Participation */}
              <div className="space-y-3">
                <div>
                  <h3 className="text-base font-semibold mb-1">{t('settings.leaderboardCompetition')}</h3>
                  <p className="text-sm text-muted-foreground">{t('settings.leaderboardCompetitionDesc')}</p>
                </div>
                {membersLoading ? (
                  <div className="text-center py-4 text-muted-foreground">
                    {t('settings.loadingMembers')}
                  </div>
                ) : familyMembers && familyMembers.length > 0 ? (
                  <div className="space-y-2">
                    {familyMembers.map((familyMember) => (
                      <div
                        key={familyMember.id}
                        className="flex items-center justify-between p-3 rounded-lg border bg-card/50"
                        data-testid={`leaderboard-exclusion-${familyMember.id}`}
                      >
                        <div className="flex items-center gap-3">
                          <Avatar className="h-8 w-8">
                            <AvatarImage src={getAvatarUrl(familyMember.activeSkinId, familyMember.avatarUrl, familyMember.useCustomAvatar, familyMember.updatedAt)} alt={familyMember.displayName} />
                            <AvatarFallback style={{ backgroundColor: familyMember.color }}>
                              {familyMember.displayName.slice(0, 2).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <div className="font-medium text-sm" data-testid={`leaderboard-member-name-${familyMember.id}`}>
                              {familyMember.displayName}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {familyMember.excludeFromLeaderboard 
                                ? t('settings.notCompeting')
                                : t('settings.competing')}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Label htmlFor={`exclude-${familyMember.id}`} className="text-sm text-muted-foreground">
                            {t('settings.includeInLeaderboard')}
                          </Label>
                          <Switch
                            id={`exclude-${familyMember.id}`}
                            checked={!familyMember.excludeFromLeaderboard}
                            onCheckedChange={(checked) => {
                              toggleLeaderboardExclusionMutation.mutate({
                                memberId: familyMember.id,
                                excludeFromLeaderboard: !checked,
                              });
                            }}
                            disabled={toggleLeaderboardExclusionMutation.isPending}
                            data-testid={`switch-leaderboard-inclusion-${familyMember.id}`}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-4 text-muted-foreground">
                    {t('settings.noMembersYet')}
                  </div>
                )}
              </div>

              {/* Prizes */}
              <div className="space-y-3 pt-4 border-t">
                <div>
                  <h3 className="text-base font-semibold mb-1">{t('settings.leaderboardPrizes')}</h3>
                  <p className="text-sm text-muted-foreground">{t('settings.leaderboardPrizesDesc')}</p>
                </div>
                <div className="space-y-3">
                  <div className="space-y-2">
                    <Label htmlFor="weekly-prize">{t('settings.weeklyPrize')}</Label>
                    <Input
                      id="weekly-prize"
                      placeholder={t('settings.weeklyPrizePlaceholder')}
                      value={weeklyPrize}
                      onChange={(e) => setWeeklyPrize(e.target.value)}
                      data-testid="input-weekly-prize"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="monthly-prize">{t('settings.monthlyPrize')}</Label>
                    <Input
                      id="monthly-prize"
                      placeholder={t('settings.monthlyPrizePlaceholder')}
                      value={monthlyPrize}
                      onChange={(e) => setMonthlyPrize(e.target.value)}
                      data-testid="input-monthly-prize"
                    />
                  </div>
                  <Button 
                    onClick={handleSavePrizes}
                    disabled={updateSettingsMutation.isPending}
                    data-testid="button-save-prizes"
                  >
                    {t('settings.savePrizes')}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Analytics */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-primary" />
                <CardTitle>{t('dashboard.analytics')}</CardTitle>
              </div>
              <CardDescription>
                {t('settings.analyticsDesc')}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button 
                onClick={() => setLocation("/analytics")}
                data-testid="button-open-analytics"
                className="w-full"
              >
                <BarChart3 className="h-4 w-4 mr-2" />
                {t('settings.openAnalytics')}
              </Button>
            </CardContent>
          </Card>

          {/* Subscription Management - only show if family has active paid subscription */}
          {familyData?.billingCustomerId && familyData.subscriptionTier !== 'free' && familyData.subscriptionStatus === 'active' && (
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <CreditCard className="h-5 w-5 text-primary" />
                  <CardTitle>{t('settings.subscriptionTitle')}</CardTitle>
                </div>
                <CardDescription>
                  {t('settings.subscriptionDesc')}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                    <span className="text-sm font-medium">{t('settings.currentPlan')}</span>
                    <Badge variant="secondary">
                      {familyData.subscriptionTier === 'family' && 'Family'}
                      {familyData.subscriptionTier === 'family_plus' && 'Family+'}
                      {familyData.subscriptionTier === 'family_hero' && 'Enterprise'}
                    </Badge>
                  </div>
                  <Button 
                    onClick={() => manageSubscriptionMutation.mutate()}
                    disabled={manageSubscriptionMutation.isPending}
                    data-testid="button-manage-subscription"
                    className="w-full"
                    variant="outline"
                  >
                    <ExternalLink className="h-4 w-4 mr-2" />
                    {manageSubscriptionMutation.isPending 
                      ? t('common.loading') 
                      : t('settings.manageSubscription')}
                  </Button>
                  <p className="text-xs text-muted-foreground text-center">
                    {t('settings.subscriptionPortalNote')}
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Factory Reset Settings */}
          <Card className="border-destructive/50">
            <CardHeader>
              <div className="flex items-center gap-2">
                <RotateCcw className="h-5 w-5 text-destructive" />
                <CardTitle className="text-destructive">{t('settings.dangerZone')}</CardTitle>
              </div>
              <CardDescription>
                {t('settings.resetAllData')}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="bg-destructive/10 p-4 rounded-lg mb-4">
                <p className="text-sm font-medium mb-2">{t('settings.factoryResetWarning')}</p>
              </div>
              <Button
                variant="destructive"
                onClick={() => setShowFactoryResetDialog(true)}
                disabled={factoryResetMutation.isPending}
                data-testid="button-factory-reset"
                className="w-full"
              >
                <RotateCcw className="h-4 w-4 mr-2" />
                {t('settings.factoryReset')}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Add Member Dialog */}
      {member && (
        <AddMemberDialog
          open={addMemberDialogOpen}
          onOpenChange={setAddMemberDialogOpen}
          onSubmit={(data) => addMemberMutation.mutate(data)}
          isSubmitting={addMemberMutation.isPending}
          familyName={member.familyName}
        />
      )}

      {/* Edit Member Dialog */}
      {memberToEdit && (
        <EditMemberDialog
          open={editMemberDialogOpen}
          onOpenChange={setEditMemberDialogOpen}
          member={memberToEdit}
          onSubmit={(memberId, data) => editMemberMutation.mutate({ memberId, data })}
          isSubmitting={editMemberMutation.isPending}
          currentUserRole={realMember?.role}
        />
      )}

      {/* Join Code Alert Dialog */}
      <AlertDialog open={!!newMemberJoinCode} onOpenChange={() => setNewMemberJoinCode(null)}>
        <AlertDialogContent data-testid="dialog-join-code">
          <AlertDialogHeader>
            <AlertDialogTitle>{t('settings.memberAddedTitle')}</AlertDialogTitle>
            <AlertDialogDescription className="space-y-4">
              <p>
                {t('settings.memberAddedInstructions')}
              </p>
              <div className="bg-primary/10 p-4 rounded-lg text-center">
                <p className="text-xs text-muted-foreground mb-1">{t('settings.joinCodeLabel')}</p>
                <p className="text-3xl font-bold tracking-wider text-primary" data-testid="text-join-code">
                  {newMemberJoinCode}
                </p>
              </div>
              <p className="text-sm text-muted-foreground">
                {t('settings.joinCodeOnce')}
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={() => setNewMemberJoinCode(null)} data-testid="button-close-join-code">
              {t('common.gotIt')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!memberToDelete} onOpenChange={() => setMemberToDelete(null)}>
        <AlertDialogContent data-testid="dialog-delete-member">
          <AlertDialogHeader>
            <AlertDialogTitle>{t('settings.removeMemberTitle', { name: memberToDelete?.displayName })}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('settings.removeMemberConfirm', { name: memberToDelete?.displayName })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel 
              onClick={() => setMemberToDelete(null)}
              data-testid="button-cancel-delete"
            >
              {t('common.cancel')}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => memberToDelete && deleteMemberMutation.mutate(memberToDelete.id)}
              disabled={deleteMemberMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-delete"
            >
              {deleteMemberMutation.isPending ? t('settings.removing') : t('settings.removeMemberButton')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* PIN Code Dialog */}
      <AlertDialog open={pinDialogOpen} onOpenChange={setPinDialogOpen}>
        <AlertDialogContent data-testid="dialog-set-pin">
          <AlertDialogHeader>
            <AlertDialogTitle>
              {memberForPinSetting?.pinCode ? t('settings.changePin') : t('settings.setPinTitle')}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t('settings.setPinDesc')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="pin-input">{t('settings.enterPin')}</Label>
              <Input
                id="pin-input"
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={4}
                value={newPin}
                onChange={(e) => {
                  const value = e.target.value.replace(/[^0-9]/g, '');
                  setNewPin(value);
                }}
                placeholder={t('settings.pinPlaceholder')}
                className="text-center text-2xl tracking-widest font-mono"
                data-testid="input-pin-code"
              />
            </div>
          </div>
          <AlertDialogFooter>
            {memberForPinSetting?.pinCode && (
              <Button
                variant="destructive"
                onClick={() => {
                  if (memberForPinSetting) {
                    setPinMutation.mutate({ memberId: memberForPinSetting.id, pinCode: "" });
                  }
                }}
                disabled={setPinMutation.isPending}
                data-testid="button-clear-pin"
              >
                {t('settings.removePin')}
              </Button>
            )}
            <AlertDialogCancel
              onClick={() => {
                setPinDialogOpen(false);
                setNewPin("");
                setMemberForPinSetting(null);
              }}
              disabled={setPinMutation.isPending}
              data-testid="button-cancel-pin"
            >
              {t('settings.cancel')}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (memberForPinSetting && newPin.length === 4) {
                  setPinMutation.mutate({ memberId: memberForPinSetting.id, pinCode: newPin });
                }
              }}
              disabled={setPinMutation.isPending || newPin.length !== 4}
              data-testid="button-save-pin"
            >
              {setPinMutation.isPending ? t('settings.saving') : t('settings.savePin')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Factory Reset Confirmation Dialog */}
      <AlertDialog open={showFactoryResetDialog} onOpenChange={setShowFactoryResetDialog}>
        <AlertDialogContent data-testid="dialog-factory-reset">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-destructive">{t('settings.resetConfirmTitle')}</AlertDialogTitle>
            <AlertDialogDescription className="space-y-3">
              <p className="font-semibold text-foreground">
                {t('settings.resetConfirmMessage')}
              </p>
              <p>
                <strong>{t('settings.whatDeleted')}</strong>
              </p>
              <ul className="list-disc list-inside space-y-1 text-sm">
                <li>{t('settings.allTasks')}</li>
                <li>{t('settings.allRewardsRequests')}</li>
                <li>{t('settings.allPoints')}</li>
                <li>{t('settings.allSkins')}</li>
                <li>{t('settings.allHistory')}</li>
              </ul>
              <p>
                <strong>{t('settings.whatCreated')}</strong>
              </p>
              <ul className="list-disc list-inside space-y-1 text-sm">
                <li>{t('settings.defaultTask1')}</li>
                <li>{t('settings.defaultTask2')}</li>
                <li>{t('settings.defaultTask3')}</li>
              </ul>
              <p>
                <strong>{t('settings.whatKept')}</strong>
              </p>
              <ul className="list-disc list-inside space-y-1 text-sm">
                <li>{t('settings.familyNameKept', { name: member?.familyName })}</li>
                <li>{t('settings.membersKept')}</li>
              </ul>
              <p className="font-semibold text-destructive">
                {t('settings.resetAbsoluteSure')}
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel 
              onClick={() => setShowFactoryResetDialog(false)}
              data-testid="button-cancel-reset"
              disabled={factoryResetMutation.isPending}
            >
              {t('common.cancel')}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => factoryResetMutation.mutate()}
              disabled={factoryResetMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-reset"
            >
              {factoryResetMutation.isPending ? t('settings.resetting') : t('settings.yesResetEverything')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Device Link Dialog */}
      <DeviceLinkDialog
        member={memberForDeviceLink}
        open={deviceLinkDialogOpen}
        onOpenChange={setDeviceLinkDialogOpen}
      />
    </div>
  );
}
