import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Loader2, Lock, Check, Trophy, ArrowLeft, User } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { SuccessCelebration } from "@/components/success-celebration";
import { Link } from "wouter";
import { SKIN_IMAGES } from "@/lib/skins";
import type { FamilyMember } from "@shared/schema";

interface Skin {
  id: string;
  name: string;
  description: string;
  imageUrl: string;
  pointsRequired: number;
  isUnlocked: boolean;
  isActive: boolean;
  canUnlock: boolean;
}

export default function SkinsGallery() {
  const { toast } = useToast();
  const [celebration, setCelebration] = useState<{ points: number; message: string } | null>(null);

  const { data: memberData, isLoading: memberLoading } = useQuery<FamilyMember>({
    queryKey: ["/api/family-members/current"],
  });

  const { data, isLoading } = useQuery<{ skins: Skin[]; totalEarned: number }>({
    queryKey: ["/api/skins"],
  });

  const selectSkinMutation = useMutation({
    mutationFn: async (skinId: string | null) => {
      return await apiRequest("POST", "/api/skins/select", { skinId });
    },
    onSuccess: (_, skinId) => {
      if (skinId === null) {
        setCelebration({
          points: 0,
          message: "Default Avatar Equipped!",
        });
      } else {
        const selectedSkin = data?.skins.find(s => s.id === skinId);
        if (selectedSkin) {
          setCelebration({
            points: 0,
            message: `${selectedSkin.name} Equipped!`,
          });
        }
      }
      queryClient.invalidateQueries({ queryKey: ["/api/skins"] });
      queryClient.invalidateQueries({ queryKey: ["/api/member"] });
      queryClient.invalidateQueries({ queryKey: ["/api/family-members/current"] });
      queryClient.invalidateQueries({ queryKey: ["/api/family-members"] });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to select skin",
        variant: "destructive",
      });
    },
  });

  if (isLoading || memberLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const skins = data?.skins || [];
  const totalEarned = Number(data?.totalEarned) || 0;
  const isDefaultActive = memberData?.activeSkinId === null || memberData?.activeSkinId === undefined;
  const hasReached500 = totalEarned >= 500;
  
  // Organize skins by tier
  // Tier 1: 0-500 points (Starter Heroes)
  // Tier 2: 560-1000 points (Elite Heroes)
  const tier1Skins = skins.filter(s => s.pointsRequired <= 500);
  const tier2Skins = skins.filter(s => s.pointsRequired >= 560);

  return (
    <>
      <div className="container mx-auto p-6 max-w-6xl">
        <Link href="/dashboard">
          <Button variant="ghost" className="mb-4" data-testid="button-back-to-dashboard">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Dashboard
          </Button>
        </Link>
        
        <div className="mb-8">
          <h1 className="text-4xl font-bold font-accent mb-2 gradient-text">
            Character Skins
          </h1>
          <p className="text-muted-foreground mb-4">
            Unlock new skins by earning points! Complete tasks to unlock exclusive character skins.
          </p>
          <div className="flex items-center gap-2">
            <Trophy className="h-5 w-5 text-primary" />
            <span className="font-semibold">
              Lifetime Points Earned: {totalEarned}
            </span>
          </div>
        </div>

        {/* Default Avatar Card */}
        <Card
          className={`relative overflow-hidden transition-all hover-elevate mb-8 ${
            isDefaultActive ? "ring-2 ring-primary" : ""
          }`}
          data-testid="card-skin-default"
        >
          <Link href="/dashboard">
            <Button
              variant="ghost"
              size="icon"
              className="absolute top-4 left-4 z-10"
              data-testid="button-back-default"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>

          <CardHeader className="pb-4">
            <div className="relative w-full aspect-square mb-4 rounded-lg overflow-hidden bg-muted flex items-center justify-center max-w-xs mx-auto">
              {memberData?.avatarUrl ? (
                <Avatar className="h-32 w-32">
                  <AvatarImage src={memberData.avatarUrl} alt="Your avatar" />
                  <AvatarFallback>
                    <User className="h-16 w-16" />
                  </AvatarFallback>
                </Avatar>
              ) : (
                <User className="h-32 w-32 text-muted-foreground" />
              )}
              {isDefaultActive && (
                <Badge
                  className="absolute bottom-2 right-2 pointer-events-none"
                  data-testid="badge-active-default"
                >
                  <Check className="h-3 w-3 mr-1" />
                  Active
                </Badge>
              )}
            </div>
            <CardTitle className="font-accent text-xl">Default Avatar</CardTitle>
            <CardDescription>Your personal custom avatar</CardDescription>
          </CardHeader>

          <CardContent>
            <Button
              onClick={() => selectSkinMutation.mutate(null)}
              disabled={isDefaultActive || selectSkinMutation.isPending}
              className="w-full"
              data-testid="button-select-default"
            >
              {isDefaultActive ? "Equipped" : "Use Default"}
            </Button>
          </CardContent>
        </Card>

        {/* Tier 1 - Starter Skins */}
        <div className="mb-8">
          <div className="mb-4">
            <h2 className="text-2xl font-bold font-accent gradient-text mb-1">
              Starter Heroes
            </h2>
            <p className="text-sm text-muted-foreground">
              Unlock from 0 to 500 lifetime points earned
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {tier1Skins.map((skin) => (
            <Card
              key={skin.id}
              className={`relative overflow-hidden transition-all hover-elevate ${
                skin.isActive ? "ring-2 ring-primary" : ""
              }`}
              data-testid={`card-skin-${skin.id}`}
            >
              <Link href="/dashboard">
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute top-4 left-4 z-10"
                  data-testid={`button-back-${skin.id}`}
                >
                  <ArrowLeft className="h-4 w-4" />
                </Button>
              </Link>

              <CardHeader className="pb-4">
                <div className="relative w-full aspect-square mb-4 rounded-lg overflow-hidden bg-muted">
                  {SKIN_IMAGES[skin.id] ? (
                    <img
                      src={SKIN_IMAGES[skin.id]}
                      alt={skin.name}
                      className={`w-full h-full object-cover ${
                        !skin.isUnlocked ? "filter grayscale opacity-40" : ""
                      }`}
                      data-testid={`img-skin-${skin.id}`}
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-muted text-muted-foreground">
                      No Image
                    </div>
                  )}
                  {!skin.isUnlocked && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="bg-background/80 backdrop-blur-sm rounded-full p-4">
                        <Lock className="h-8 w-8 text-muted-foreground" />
                      </div>
                    </div>
                  )}
                  {skin.isActive && (
                    <Badge
                      className="absolute bottom-2 right-2 pointer-events-none"
                      data-testid={`badge-active-${skin.id}`}
                    >
                      <Check className="h-3 w-3 mr-1" />
                      Active
                    </Badge>
                  )}
                </div>
                <CardTitle className="font-accent text-xl">{skin.name}</CardTitle>
                <CardDescription>{skin.description}</CardDescription>
              </CardHeader>

              <CardContent>
                <Button
                  onClick={() => selectSkinMutation.mutate(skin.id)}
                  disabled={skin.isActive || selectSkinMutation.isPending}
                  className="w-full"
                  data-testid={`button-select-${skin.id}`}
                >
                  {skin.isActive ? "Equipped" : "Equip Skin"}
                </Button>
              </CardContent>
            </Card>
            ))}
          </div>
        </div>

        {/* Tier 2 - Elite Skins */}
        {tier2Skins.length > 0 && (
          <div className="mb-8">
            <div className="mb-4">
              <h2 className="text-2xl font-bold font-accent gradient-text mb-1">
                Elite Heroes
              </h2>
              <p className="text-sm text-muted-foreground">
                {hasReached500
                  ? "Unlock from 560 to 1000 lifetime points earned"
                  : "Mystery skins revealed at 500 points • Unlock from 560 to 1000"}
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {tier2Skins.map((skin) => (
                <Card
                  key={skin.id}
                  className={`relative overflow-hidden transition-all hover-elevate ${
                    skin.isActive ? "ring-2 ring-primary" : ""
                  }`}
                  data-testid={`card-skin-${skin.id}`}
                >
                  <Link href="/dashboard">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="absolute top-4 left-4 z-10"
                      data-testid={`button-back-${skin.id}`}
                    >
                      <ArrowLeft className="h-4 w-4" />
                    </Button>
                  </Link>

                  <CardHeader className="pb-4">
                    <div className="relative w-full aspect-square mb-4 rounded-lg overflow-hidden bg-muted">
                      {hasReached500 ? (
                        // Show preview image once user reaches 500 points
                        <>
                          {SKIN_IMAGES[skin.id] ? (
                            <img
                              src={SKIN_IMAGES[skin.id]}
                              alt={skin.name}
                              className={`w-full h-full object-cover ${
                                !skin.isUnlocked ? "filter grayscale opacity-40" : ""
                              }`}
                              data-testid={`img-skin-${skin.id}`}
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center bg-muted text-muted-foreground">
                              No Image
                            </div>
                          )}
                          {!skin.isUnlocked && (
                            <div className="absolute inset-0 flex items-center justify-center">
                              <div className="bg-background/80 backdrop-blur-sm rounded-full p-4">
                                <Lock className="h-8 w-8 text-muted-foreground" />
                              </div>
                            </div>
                          )}
                          {skin.isActive && (
                            <Badge
                              className="absolute bottom-2 right-2 pointer-events-none"
                              data-testid={`badge-active-${skin.id}`}
                            >
                              <Check className="h-3 w-3 mr-1" />
                              Active
                            </Badge>
                          )}
                        </>
                      ) : (
                        // Hide image preview until 500 points - show only lock
                        <div className="w-full h-full flex flex-col items-center justify-center bg-muted text-muted-foreground">
                          <Lock className="h-16 w-16 mb-2" />
                          <p className="text-xs font-medium">Mystery Skin</p>
                          <p className="text-xs opacity-70">Unlock at 500 points</p>
                        </div>
                      )}
                    </div>
                    <CardTitle className="font-accent text-xl">
                      {hasReached500 ? skin.name : "???"}
                    </CardTitle>
                    <CardDescription>
                      {hasReached500 ? skin.description : "A mysterious hero awaits..."}
                    </CardDescription>
                  </CardHeader>

                  <CardContent>
                    {skin.isUnlocked ? (
                      <Button
                        onClick={() => selectSkinMutation.mutate(skin.id)}
                        disabled={skin.isActive || selectSkinMutation.isPending}
                        className="w-full"
                        data-testid={`button-select-${skin.id}`}
                      >
                        {skin.isActive ? "Equipped" : "Equip Skin"}
                      </Button>
                    ) : (
                      <div className="text-center">
                        <p className="text-sm text-muted-foreground mb-2">
                          Unlock at {skin.pointsRequired} points
                        </p>
                        <div className="flex items-center justify-center gap-2">
                          <div className="flex-1 bg-muted rounded-full h-2 overflow-hidden">
                            <div
                              className="bg-primary h-full transition-all"
                              style={{
                                width: `${Math.min(
                                  100,
                                  (totalEarned / skin.pointsRequired) * 100
                                )}%`,
                              }}
                            />
                          </div>
                          <span className="text-xs font-semibold">
                            {totalEarned}/{skin.pointsRequired}
                          </span>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}
      </div>

      {celebration && (
        <SuccessCelebration
          points={celebration.points}
          message={celebration.message}
          onComplete={() => setCelebration(null)}
        />
      )}
    </>
  );
}
