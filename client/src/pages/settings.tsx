import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AddMemberDialog } from "@/components/add-member-dialog";
import { EditMemberDialog } from "@/components/edit-member-dialog";
import { ChevronLeft, Trophy, UserPlus, Trash2, RotateCcw, Pencil, Key, Copy, Check, Languages } from "lucide-react";
import { useLocation } from "wouter";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
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

export default function Settings() {
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
  const { data: familyMembers, isLoading: membersLoading } = useQuery<FamilyMember[]>({
    queryKey: ["/api/family-members"],
    enabled: !!member,
  });

  // Update family settings mutation
  const updateSettingsMutation = useMutation({
    mutationFn: async (settings: { showLeaderboard?: boolean; language?: "de" | "en" | "fr" | "es" | "ja" | "zh" }) => {
      return await apiRequest("PATCH", "/api/families/settings", settings);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/families/settings"] });
      queryClient.invalidateQueries({ queryKey: ["/api/families/current"] });
      toast({
        title: "Settings updated",
        description: "Your family settings have been saved.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update settings. Please try again.",
        variant: "destructive",
      });
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
          title: "Success!",
          description: "Family member added successfully.",
        });
      }
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to add family member. Please try again.",
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
      queryClient.invalidateQueries({ queryKey: ["/api/families/current"] });
      setEditMemberDialogOpen(false);
      setMemberToEdit(null);
      toast({
        title: "Member updated",
        description: "Family member has been updated successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update family member. Please try again.",
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
        title: "Member removed",
        description: "Family member has been removed successfully.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to remove family member. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Toggle leaderboard exclusion mutation
  const toggleLeaderboardExclusionMutation = useMutation({
    mutationFn: async ({ memberId, excludeFromLeaderboard }: { memberId: string; excludeFromLeaderboard: boolean }) => {
      return await apiRequest("PUT", `/api/family-members/${memberId}`, { excludeFromLeaderboard });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/family-members"] });
      queryClient.invalidateQueries({ queryKey: ["/api/analytics"] });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update leaderboard settings. Please try again.",
        variant: "destructive",
      });
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
        title: "Family Reset Complete",
        description: "All tasks, rewards, and points have been reset. Your family can start fresh!",
      });
      // Redirect to dashboard
      setLocation("/dashboard");
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to reset family. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Only parents can access settings
  if (!memberLoading && !familyLoading && realMember?.role !== "parent") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardHeader>
            <CardTitle>Access Denied</CardTitle>
            <CardDescription>
              Only parents can access family settings.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button 
              onClick={() => setLocation("/")} 
              variant="outline"
              data-testid="button-back-to-dashboard"
            >
              <ChevronLeft className="mr-2 h-4 w-4" />
              Back to Dashboard
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
          <p className="text-muted-foreground">Loading settings...</p>
        </div>
      </div>
    );
  }

  const handleToggleLeaderboard = (checked: boolean) => {
    updateSettingsMutation.mutate({ showLeaderboard: checked });
  };

  const handleCopyJoinCode = () => {
    if (familyData?.joinCode) {
      navigator.clipboard.writeText(familyData.joinCode);
      setJoinCodeCopied(true);
      setTimeout(() => setJoinCodeCopied(false), 2000);
      toast({
        title: "Join code copied!",
        description: "Share this code with new family members to let them join.",
      });
    }
  };

  const handleLanguageChange = (language: string) => {
    updateSettingsMutation.mutate({ language: language as "de" | "en" | "fr" | "es" | "ja" | "zh" });
  };

  const languageOptions = [
    { value: "de", label: "Deutsch" },
    { value: "en", label: "English" },
    { value: "fr", label: "Français" },
    { value: "es", label: "Español" },
    { value: "ja", label: "日本語" },
    { value: "zh", label: "中文" },
  ];

  return (
    <div className="min-h-screen">
      <div className="container max-w-4xl mx-auto p-4 sm:p-6 lg:p-8">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setLocation("/")}
            data-testid="button-back"
          >
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold">Family Settings</h1>
            <p className="text-muted-foreground">Manage your family's HeroKids experience</p>
          </div>
        </div>

        {/* Settings Cards */}
        <div className="space-y-4">
          {/* Family Members Settings */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <UserPlus className="h-5 w-5 text-primary" />
                <CardTitle>Family Members</CardTitle>
              </div>
              <CardDescription>
                Manage your family members. Add new members or remove existing ones.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Members List */}
              {membersLoading ? (
                <div className="text-center py-4 text-muted-foreground">
                  Loading members...
                </div>
              ) : familyMembers && familyMembers.length > 0 ? (
                <div className="space-y-2">
                  {familyMembers.map((familyMember) => {
                    const isCurrentUser = familyMember.id === member?.id;
                    return (
                      <div
                        key={familyMember.id}
                        className="flex items-center justify-between p-3 rounded-lg border bg-card hover-elevate"
                        data-testid={`member-item-${familyMember.id}`}
                      >
                        <div className="flex items-center gap-3">
                          <Avatar className="h-10 w-10">
                            <AvatarImage src={getAvatarUrl(familyMember.activeSkinId, familyMember.avatarUrl)} alt={familyMember.displayName} />
                            <AvatarFallback style={{ backgroundColor: familyMember.color }}>
                              {familyMember.displayName.slice(0, 2).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-medium" data-testid={`member-name-${familyMember.id}`}>
                                {familyMember.displayName}
                              </span>
                              {isCurrentUser && (
                                <Badge variant="secondary" className="text-xs">You</Badge>
                              )}
                            </div>
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              <span className="capitalize">{familyMember.role}</span>
                              <span>•</span>
                              <span>{familyMember.totalPoints} points</span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
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
                          {!isCurrentUser && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setMemberToDelete(familyMember)}
                              disabled={deleteMemberMutation.isPending}
                              data-testid={`button-delete-member-${familyMember.id}`}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-4 text-muted-foreground">
                  No family members yet. Add your first member below.
                </div>
              )}

              {/* Add Member Button */}
              <Button
                onClick={() => setAddMemberDialogOpen(true)}
                data-testid="button-add-member"
                className="w-full"
              >
                <UserPlus className="h-4 w-4 mr-2" />
                Add Member
              </Button>
            </CardContent>
          </Card>

          {/* Family Join Code */}
          <Card className="border-primary/50">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Key className="h-5 w-5 text-primary" />
                <CardTitle>Family Join Code</CardTitle>
              </div>
              <CardDescription>
                Share this code with children and other parents to invite them to your family. Anyone with this code can join.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between p-4 rounded-lg border bg-card/50">
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Your Family Join Code</p>
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
                New members can join at the login page by clicking "Join Existing Family" and entering this code.
              </p>
            </CardContent>
          </Card>

          {/* Language Settings */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Languages className="h-5 w-5 text-primary" />
                <CardTitle>Language Preferences</CardTitle>
              </div>
              <CardDescription>
                Choose your family's preferred language. This will affect all family members' interface language.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between gap-4">
                <div className="space-y-0.5 flex-1">
                  <Label htmlFor="language-select" className="text-base">
                    Interface Language
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Select the language for the application interface
                  </p>
                </div>
                <Select
                  value={familyData?.language || "en"}
                  onValueChange={handleLanguageChange}
                  disabled={updateSettingsMutation.isPending}
                >
                  <SelectTrigger className="w-[180px]" data-testid="select-language">
                    <SelectValue placeholder="Select language" />
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

          {/* Leaderboard Settings */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Trophy className="h-5 w-5 text-primary" />
                <CardTitle>Leaderboard Visibility</CardTitle>
              </div>
              <CardDescription>
                Control whether the leaderboard is visible to children. Parents can always see the leaderboard.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="show-leaderboard" className="text-base">
                    Show leaderboard to children
                  </Label>
                  {!familyData?.showLeaderboard && (
                    <p className="text-sm text-muted-foreground">
                      The leaderboard is hidden from children. Focus on motivation instead of competition.
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
            </CardContent>
          </Card>

          {/* Leaderboard Competition */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Trophy className="h-5 w-5 text-primary" />
                <CardTitle>Leaderboard Competition</CardTitle>
              </div>
              <CardDescription>
                Choose which family members participate in leaderboard rankings. Excluded members can still earn points and complete tasks, but won't appear in the competitive leaderboard.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {membersLoading ? (
                <div className="text-center py-4 text-muted-foreground">
                  Loading members...
                </div>
              ) : familyMembers && familyMembers.length > 0 ? (
                <div className="space-y-3">
                  {familyMembers.map((familyMember) => (
                    <div
                      key={familyMember.id}
                      className="flex items-center justify-between p-3 rounded-lg border bg-card"
                      data-testid={`leaderboard-exclusion-${familyMember.id}`}
                    >
                      <div className="flex items-center gap-3">
                        <Avatar className="h-10 w-10">
                          <AvatarImage src={getAvatarUrl(familyMember.activeSkinId, familyMember.avatarUrl)} alt={familyMember.displayName} />
                          <AvatarFallback style={{ backgroundColor: familyMember.color }}>
                            {familyMember.displayName.slice(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <div className="font-medium" data-testid={`leaderboard-member-name-${familyMember.id}`}>
                            {familyMember.displayName}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {familyMember.excludeFromLeaderboard 
                              ? "Not competing in leaderboard" 
                              : "Competing in leaderboard"}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Label htmlFor={`exclude-${familyMember.id}`} className="text-sm text-muted-foreground">
                          Include in leaderboard
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
                  No family members yet.
                </div>
              )}
            </CardContent>
          </Card>

          {/* Factory Reset Settings */}
          <Card className="border-destructive/50">
            <CardHeader>
              <div className="flex items-center gap-2">
                <RotateCcw className="h-5 w-5 text-destructive" />
                <CardTitle className="text-destructive">Factory Reset</CardTitle>
              </div>
              <CardDescription>
                Reset your family's game progress back to the beginning. This will delete all tasks, rewards, points, and history,
                then create fresh default tasks. Your family members will remain, but all their progress will be reset to zero.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="bg-destructive/10 p-4 rounded-lg mb-4">
                <p className="text-sm font-medium mb-2">⚠️ Warning: This action cannot be undone</p>
                <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                  <li>All tasks will be permanently deleted</li>
                  <li>All rewards will be permanently deleted</li>
                  <li>All points will be reset to zero</li>
                  <li>All unlocked skins will be locked again</li>
                  <li>All history will be permanently deleted</li>
                  <li>Three default tasks will be created (Clean room, Dishes, Vacuum)</li>
                  <li>Family members and avatars will be preserved</li>
                </ul>
              </div>
              <Button
                variant="destructive"
                onClick={() => setShowFactoryResetDialog(true)}
                disabled={factoryResetMutation.isPending}
                data-testid="button-factory-reset"
                className="w-full"
              >
                <RotateCcw className="h-4 w-4 mr-2" />
                Reset to Factory Settings
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
            <AlertDialogTitle>Member Added Successfully!</AlertDialogTitle>
            <AlertDialogDescription className="space-y-4">
              <p>
                A new family member profile has been created. Share this join code with them
                so they can access their account on their own device:
              </p>
              <div className="bg-primary/10 p-4 rounded-lg text-center">
                <p className="text-xs text-muted-foreground mb-1">Join Code</p>
                <p className="text-3xl font-bold tracking-wider text-primary" data-testid="text-join-code">
                  {newMemberJoinCode}
                </p>
              </div>
              <p className="text-sm text-muted-foreground">
                This code can only be used once. After they join, you'll both be part of the same family.
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={() => setNewMemberJoinCode(null)} data-testid="button-close-join-code">
              Got it!
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!memberToDelete} onOpenChange={() => setMemberToDelete(null)}>
        <AlertDialogContent data-testid="dialog-delete-member">
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Family Member?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove <strong>{memberToDelete?.displayName}</strong> from your family?
              This will delete all their tasks, points history, and progress. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel 
              onClick={() => setMemberToDelete(null)}
              data-testid="button-cancel-delete"
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => memberToDelete && deleteMemberMutation.mutate(memberToDelete.id)}
              disabled={deleteMemberMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-delete"
            >
              {deleteMemberMutation.isPending ? "Removing..." : "Remove Member"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Factory Reset Confirmation Dialog */}
      <AlertDialog open={showFactoryResetDialog} onOpenChange={setShowFactoryResetDialog}>
        <AlertDialogContent data-testid="dialog-factory-reset">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-destructive">⚠️ Reset to Factory Settings?</AlertDialogTitle>
            <AlertDialogDescription className="space-y-3">
              <p className="font-semibold text-foreground">
                This will permanently delete ALL game data and reset your family back to the beginning.
              </p>
              <p>
                <strong>What will be deleted:</strong>
              </p>
              <ul className="list-disc list-inside space-y-1 text-sm">
                <li>All tasks</li>
                <li>All rewards and reward requests</li>
                <li>All points (everyone back to 0)</li>
                <li>All unlocked skins (everyone back to default)</li>
                <li>All completion history</li>
              </ul>
              <p>
                <strong>What will be created:</strong>
              </p>
              <ul className="list-disc list-inside space-y-1 text-sm">
                <li>Clean your room (20 pts, daily)</li>
                <li>Do the dishes (15 pts, daily)</li>
                <li>Vacuum the house (30 pts, every 3 days)</li>
              </ul>
              <p>
                <strong>What will be kept:</strong>
              </p>
              <ul className="list-disc list-inside space-y-1 text-sm">
                <li>Your family name ({member?.familyName})</li>
                <li>All family members and their avatars</li>
              </ul>
              <p className="font-semibold text-destructive">
                This action cannot be undone. Are you absolutely sure?
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel 
              onClick={() => setShowFactoryResetDialog(false)}
              data-testid="button-cancel-reset"
              disabled={factoryResetMutation.isPending}
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => factoryResetMutation.mutate()}
              disabled={factoryResetMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-reset"
            >
              {factoryResetMutation.isPending ? "Resetting..." : "Yes, Reset Everything"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
