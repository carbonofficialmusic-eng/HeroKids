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
  unlockThreshold: number;
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

  const { data, isLoading } = useQuery<{ skins: Skin[]; rewardsRedeemed: number }>({
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
  const rewardsRedeemed = data?.rewardsRedeemed || 0;
  const isDefaultActive = memberData?.activeSkinId === null || memberData?.activeSkinId === undefined;

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
            Unlock new skins by redeeming rewards! Each skin needs a certain number of reward redemptions.
          </p>
          <div className="flex items-center gap-2">
            <Trophy className="h-5 w-5 text-primary" />
            <span className="font-semibold">
              Rewards Redeemed: {rewardsRedeemed}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Default Avatar Card */}
          <Card
            className={`relative overflow-hidden transition-all hover-elevate ${
              isDefaultActive ? "ring-2 ring-primary" : ""
            }`}
            data-testid="card-skin-default"
          >
            {isDefaultActive && (
              <Badge
                className="absolute top-4 right-4 z-10"
                data-testid="badge-active-default"
              >
                <Check className="h-3 w-3 mr-1" />
                Active
              </Badge>
            )}

            <CardHeader className="pb-4">
              <div className="relative w-full aspect-square mb-4 rounded-lg overflow-hidden bg-muted flex items-center justify-center">
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

          {/* Character Skins */}
          {skins.map((skin) => (
            <Card
              key={skin.id}
              className={`relative overflow-hidden transition-all hover-elevate ${
                skin.isActive ? "ring-2 ring-primary" : ""
              }`}
              data-testid={`card-skin-${skin.id}`}
            >
              {skin.isActive && (
                <Badge
                  className="absolute top-4 right-4 z-10"
                  data-testid={`badge-active-${skin.id}`}
                >
                  <Check className="h-3 w-3 mr-1" />
                  Active
                </Badge>
              )}

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
                </div>
                <CardTitle className="font-accent text-xl">{skin.name}</CardTitle>
                <CardDescription>{skin.description}</CardDescription>
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
                      Unlock at {skin.unlockThreshold} reward{skin.unlockThreshold !== 1 ? 's' : ''}
                    </p>
                    <div className="flex items-center justify-center gap-2">
                      <div className="flex-1 bg-muted rounded-full h-2 overflow-hidden">
                        <div
                          className="bg-primary h-full transition-all"
                          style={{
                            width: `${Math.min(
                              100,
                              (rewardsRedeemed / skin.unlockThreshold) * 100
                            )}%`,
                          }}
                        />
                      </div>
                      <span className="text-xs font-semibold">
                        {rewardsRedeemed}/{skin.unlockThreshold}
                      </span>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
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
