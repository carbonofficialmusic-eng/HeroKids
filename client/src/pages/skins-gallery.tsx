import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, Lock, Check, Trophy, ArrowLeft, User, Star, Sparkles } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { SuccessCelebration } from "@/components/success-celebration";
import { Link } from "wouter";
import { SKIN_IMAGES } from "@/lib/skins";
import type { FamilyMember } from "@shared/schema";
import { useTranslation } from "react-i18next";

interface Skin {
  id: string;
  name: string;
  description: string;
  imageUrl: string;
  pointsRequired: number;
  bonusPoints: number;
  tier: number;
  isDiscovered: boolean;
  isActive: boolean;
  canDiscover: boolean;
}

export default function SkinsGallery() {
  const { toast } = useToast();
  const { t } = useTranslation();
  const [celebration, setCelebration] = useState<{ points: number; message: string } | null>(null);

  const { data: memberData, isLoading: memberLoading } = useQuery<FamilyMember>({
    queryKey: ["/api/family-members/current"],
  });

  const { data, isLoading } = useQuery<{ 
    skins: Skin[]; 
    totalEarned: number;
    availableCards: number;
    unlockedTier: number;
  }>({
    queryKey: ["/api/skins"],
  });

  const discoverSkinMutation = useMutation({
    mutationFn: async (skinId: string) => {
      const res = await apiRequest("POST", "/api/skins/discover", { skinId });
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.message || "Failed to discover skin");
      }
      return await res.json();
    },
    onSuccess: (result) => {
      const skin = data?.skins.find(s => s.id === result.skinId);
      const skinName = skin?.id ? t(`skinNames.${skin.id}`) : "Skin";
      setCelebration({
        points: result.bonusPoints || 0,
        message: `${skinName} Discovered!${result.bonusPoints ? ` +${result.bonusPoints} bonus points!` : ""}`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/skins"] });
      queryClient.invalidateQueries({ queryKey: ["/api/family-members/current"] });
      queryClient.invalidateQueries({ queryKey: ["/api/family-members"] });
    },
    onError: (error: any) => {
      toast({
        title: t('skins.discoveryFailed'),
        description: error.message || t('skins.failedToDiscover'),
        variant: "destructive",
      });
    },
  });

  const selectSkinMutation = useMutation({
    mutationFn: async (skinId: string | null) => {
      const res = await apiRequest("POST", "/api/skins/select", { skinId });
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.message || "Failed to select skin");
      }
      return await res.json();
    },
    onSuccess: (_, skinId) => {
      if (skinId === null) {
        setCelebration({
          points: 0,
          message: t('skins.defaultAvatarEquipped'),
        });
      } else {
        const selectedSkin = data?.skins.find(s => s.id === skinId);
        if (selectedSkin) {
          const skinName = t(`skinNames.${selectedSkin.id}`);
          setCelebration({
            points: 0,
            message: t('skins.skinEquipped', { skinName }),
          });
        }
      }
      queryClient.invalidateQueries({ queryKey: ["/api/skins"] });
      queryClient.invalidateQueries({ queryKey: ["/api/member"] });
      queryClient.invalidateQueries({ queryKey: ["/api/family-members/current"] });
      queryClient.invalidateQueries({ queryKey: ["/api/family-members"] });
    },
    onError: (error: any) => {
      toast({
        title: t('common.error'),
        description: error.message || t('skins.failedToSelect'),
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
  const availableCards = data?.availableCards || 0;
  const unlockedTier = data?.unlockedTier || 1;
  const isDefaultActive = memberData?.activeSkinId === null || memberData?.activeSkinId === undefined;
  
  // Organize skins by tier
  const tier1Skins = skins.filter(s => s.tier === 1);
  const tier2Skins = skins.filter(s => s.tier === 2);
  const tier3Skins = skins.filter(s => s.tier === 3);

  const renderSkinCard = (skin: Skin) => {
    const isDiscovered = skin.isDiscovered;
    const canDiscover = skin.canDiscover;
    const isActive = skin.isActive;
    const hasBonusPoints = skin.bonusPoints > 0;

    return (
      <Card
        key={skin.id}
        className={`relative overflow-hidden transition-all hover-elevate ${
          isActive ? "ring-2 ring-primary" : ""
        } ${!isDiscovered ? "opacity-75" : ""}`}
        data-testid={`card-skin-${skin.id}`}
      >
        {isActive && (
          <div className="absolute top-1 right-1 z-10">
            <Badge className="text-xs px-1 py-0" data-testid={`badge-active-${skin.id}`}>
              <Check className="h-2 w-2" />
            </Badge>
          </div>
        )}
        
        {hasBonusPoints && isDiscovered && (
          <div className="absolute top-1 left-1 z-10">
            <Badge variant="secondary" className="text-xs px-1 py-0">
              <Star className="h-2 w-2 mr-0.5" />
              +{skin.bonusPoints}
            </Badge>
          </div>
        )}
        
        <div className="relative w-full aspect-square overflow-hidden bg-muted flex items-center justify-center">
          {isDiscovered ? (
            SKIN_IMAGES[skin.id] ? (
              <img
                src={SKIN_IMAGES[skin.id]}
                alt={skin.name}
                className="w-full h-full object-cover"
              />
            ) : (
              <User className="h-8 w-8 text-muted-foreground" />
            )
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-muted to-card">
              <Lock className="h-8 w-8 text-muted-foreground/50" />
            </div>
          )}
        </div>
        
        <div className="p-1">
          {isDiscovered ? (
            <>
              <h3 className="font-accent text-xs font-bold truncate text-center">{t(`skinNames.${skin.id}`)}</h3>
              <div className="mt-1 flex justify-center">
                <Button
                  size="sm"
                  variant={isActive ? "secondary" : "default"}
                  onClick={() => !isActive && selectSkinMutation.mutate(skin.id)}
                  disabled={isActive || selectSkinMutation.isPending}
                  className="h-6 text-xs px-2"
                  data-testid={`button-equip-${skin.id}`}
                >
                  {isActive ? t('skins.equipped') : t('skins.equip')}
                </Button>
              </div>
            </>
          ) : (
            <>
              <h3 className="font-accent text-xs font-bold truncate text-center text-muted-foreground">???</h3>
              <div className="mt-1 flex justify-center">
                <Button
                  size="sm"
                  variant="default"
                  onClick={() => discoverSkinMutation.mutate(skin.id)}
                  disabled={!canDiscover || discoverSkinMutation.isPending}
                  className="h-6 text-xs px-2"
                  data-testid={`button-discover-${skin.id}`}
                >
                  <Sparkles className="h-3 w-3 mr-1" />
                  {t('skins.discover')}
                </Button>
              </div>
            </>
          )}
        </div>
      </Card>
    );
  };

  return (
    <>
      <div className="container mx-auto p-6 max-w-6xl">
        <Link href="/dashboard">
          <Button variant="ghost" className="mb-4" data-testid="button-back-to-dashboard">
            <ArrowLeft className="h-4 w-4 mr-2" />
            {t('common.backToDashboard')}
          </Button>
        </Link>
        
        <div className="mb-6">
          <h1 className="text-4xl font-bold font-accent mb-2 gradient-text">
            {t('skins.title')}
          </h1>
          <p className="text-muted-foreground mb-4">
            {t('skins.description')}
          </p>
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-2">
              <Trophy className="h-5 w-5 text-primary" />
              <span className="font-semibold">
                {t('skins.lifetimePoints', { points: totalEarned })}
              </span>
            </div>
          </div>
        </div>

        {/* Available Cards Banner */}
        {availableCards > 0 && (
          <Alert className="mb-6 bg-primary/10 border-primary" data-testid="alert-available-cards">
            <Sparkles className="h-5 w-5 text-primary" />
            <AlertDescription className="flex items-center justify-between">
              <span className="font-semibold text-lg">
                {t('skins.availableCards', { count: availableCards })}
              </span>
              <span className="text-sm text-muted-foreground">
                {t('skins.clickDiscover')}
              </span>
            </AlertDescription>
          </Alert>
        )}

        {/* Default Avatar Card */}
        <div className="mb-8">
          <div className="mb-4">
            <h2 className="text-2xl font-bold font-accent gradient-text mb-1">
              {t('skins.yourCustomAvatar')}
            </h2>
            <p className="text-sm text-muted-foreground">
              {t('skins.usePersonalPicture')}
            </p>
          </div>
          <div className="grid grid-cols-4 gap-2">
            <Card
              className={`relative overflow-hidden transition-all hover-elevate cursor-pointer ${
                isDefaultActive ? "ring-2 ring-primary" : ""
              }`}
              data-testid="card-skin-default"
              onClick={() => !isDefaultActive && selectSkinMutation.mutate(null)}
            >
              {isDefaultActive && (
                <div className="absolute top-1 right-1 z-10">
                  <Badge className="text-xs px-1 py-0" data-testid="badge-active-default">
                    <Check className="h-2 w-2" />
                  </Badge>
                </div>
              )}
              
              <div className="relative w-full aspect-square overflow-hidden bg-muted flex items-center justify-center">
                {memberData?.avatarUrl ? (
                  <Avatar className="h-full w-full">
                    <AvatarImage src={memberData.avatarUrl} alt={t('skins.yourAvatar')} className="object-cover" />
                    <AvatarFallback>
                      <User className="h-8 w-8" />
                    </AvatarFallback>
                  </Avatar>
                ) : (
                  <User className="h-8 w-8 text-muted-foreground" />
                )}
              </div>
              
              <div className="p-1 text-center">
                <h3 className="font-accent text-xs font-bold truncate">{t('skins.default')}</h3>
                <p className="text-[10px] text-muted-foreground">{t('skins.custom')}</p>
              </div>
            </Card>
          </div>
        </div>

        {/* Tier 1 - Starter Heroes */}
        <div className="mb-8">
          <div className="mb-4">
            <h2 className="text-2xl font-bold font-accent gradient-text mb-1">
              {t('skins.starterHeroes')}
            </h2>
            <p className="text-sm text-muted-foreground">
              {t('skins.unlockedUseCards')}
            </p>
          </div>
          <div className="grid grid-cols-4 gap-2">
            {tier1Skins.map(renderSkinCard)}
          </div>
        </div>

        {/* Tier 2 - Elite Heroes */}
        {tier2Skins.length > 0 && (
          <div className="mb-8">
            <div className="mb-4">
              <h2 className="text-2xl font-bold font-accent gradient-text mb-1">
                {t('skins.eliteHeroes')}
              </h2>
              <p className="text-sm text-muted-foreground">
                {unlockedTier >= 2
                  ? t('skins.unlockedUseCards')
                  : t('skins.unlockAt500')}
              </p>
            </div>
            <div className="grid grid-cols-4 gap-2">
              {tier2Skins.map(renderSkinCard)}
            </div>
          </div>
        )}

        {/* Tier 3 - Dinosaur Bonus Pack */}
        {tier3Skins.length > 0 && (
          <div className="mb-8">
            <div className="mb-4">
              <h2 className="text-2xl font-bold font-accent gradient-text mb-1">
                {t('skins.dinosaurBonusPack')}
              </h2>
              <p className="text-sm text-muted-foreground">
                {unlockedTier >= 3
                  ? t('skins.unlockedUseCards')
                  : t('skins.unlockAt1000')}
              </p>
            </div>
            <div className="grid grid-cols-4 gap-2">
              {tier3Skins.map(renderSkinCard)}
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
