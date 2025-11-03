import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { ThemeToggle } from "@/components/theme-toggle";
import { AddMemberDialog } from "@/components/add-member-dialog";
import { ChevronLeft, Trophy, UserPlus } from "lucide-react";
import { useLocation } from "wouter";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import type { FamilyMember, Family } from "@shared/schema";

export default function Settings() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [addMemberDialogOpen, setAddMemberDialogOpen] = useState(false);
  const [newMemberJoinCode, setNewMemberJoinCode] = useState<string | null>(null);

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

  // Update family settings mutation
  const updateSettingsMutation = useMutation({
    mutationFn: async (settings: { showLeaderboard: boolean }) => {
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
      <div className="min-h-screen bg-background flex items-center justify-center">
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

  return (
    <div className="min-h-screen bg-background">
      <div className="container max-w-4xl mx-auto p-4 sm:p-6 lg:p-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
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
              <p className="text-muted-foreground">Manage your family's HomeHero experience</p>
            </div>
          </div>
          <ThemeToggle />
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
                Add new members to your family. Each member gets their own profile and can complete tasks.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                onClick={() => setAddMemberDialogOpen(true)}
                data-testid="button-add-member"
              >
                <UserPlus className="h-4 w-4 mr-2" />
                Add Member
              </Button>
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
                  <p className="text-sm text-muted-foreground">
                    {familyData?.showLeaderboard 
                      ? "Children can see the monthly leaderboard and compete with each other."
                      : "The leaderboard is hidden from children. Focus on motivation instead of competition."
                    }
                  </p>
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

          {/* Future settings can be added here */}
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
    </div>
  );
}
