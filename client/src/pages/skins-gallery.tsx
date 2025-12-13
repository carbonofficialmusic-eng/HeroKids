import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest, ApiError } from "@/lib/queryClient";
import { useWebSocket } from "@/hooks/useWebSocket";
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

  // Subscribe to WebSocket for real-time updates (points changes unlock new skins)
  useWebSocket(memberData?.familyName || null);

  const isChild = memberData?.role === "child";
  const dashboardUrl = isChild ? "/kid-dashboard" : "/dashboard";

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
      const description = error instanceof ApiError && error.data?.message
        ? error.data.message
        : t('skins.failedToDiscover');
      
      toast({
        title: t('skins.discoveryFailed'),
        description,
        variant: "destructive",
      });
    },
  });

  const selectSkinMutation = useMutation({
    mutationFn: async (skinId: string | null) => {
      const res = await apiRequest("POST", "/api/skins/select", { skinId });
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
      const description = error instanceof ApiError && error.data?.message
        ? error.data.message
        : t('skins.failedToSelect');
      
      toast({
        title: t('common.error'),
        description,
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
  
  // Debug: Log the raw API response
  console.log('🎨 Frontend: Received skins from API:', {
    totalSkins: skins.length,
    totalEarned,
    unlockedTier,
    firstSkin: skins[0],
    skinTiers: skins.map(s => ({ id: s.id, tier: s.tier }))
  });
  
  // Organize skins by tier
  const tier1Skins = skins.filter(s => s.tier === 1);
  const tier2Skins = skins.filter(s => s.tier === 2);
  const tier3Skins = skins.filter(s => s.tier === 3);
  const tier4Skins = skins.filter(s => s.tier === 4);
  const tier5Skins = skins.filter(s => s.tier === 5);
  const tier6Skins = skins.filter(s => s.tier === 6);
  const tier7Skins = skins.filter(s => s.tier === 7);
  const tier8Skins = skins.filter(s => s.tier === 8);
  const tier9Skins = skins.filter(s => s.tier === 9);
  const tier10Skins = skins.filter(s => s.tier === 10);
  const tier11Skins = skins.filter(s => s.tier === 11);
  const tier12Skins = skins.filter(s => s.tier === 12);
  const tier13Skins = skins.filter(s => s.tier === 13);
  const tier14Skins = skins.filter(s => s.tier === 14);
  
  console.log('🎨 Frontend: Tier distribution:', {
    tier1: tier1Skins.length,
    tier2: tier2Skins.length,
    tier3: tier3Skins.length,
    tier4: tier4Skins.length,
    tier5: tier5Skins.length,
    tier6: tier6Skins.length,
    tier7: tier7Skins.length,
    tier8: tier8Skins.length,
    tier9: tier9Skins.length,
    tier10: tier10Skins.length,
    tier11: tier11Skins.length,
    tier12: tier12Skins.length,
    tier13: tier13Skins.length,
    tier14: tier14Skins.length,
  });

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
            <Badge className="text-xs px-2 py-0.5 font-semibold" data-testid={`badge-active-${skin.id}`}>
              <Check className="h-3 w-3" />
            </Badge>
          </div>
        )}
        
        {hasBonusPoints && isDiscovered && (
          <div className="absolute top-1 left-1 z-10">
            <Badge variant="secondary" className="text-xs px-2 py-0.5 font-semibold">
              <Star className="h-3 w-3 mr-0.5" />
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
        
        <div className="p-2">
          {isDiscovered ? (
            <>
              <h3 className="font-accent text-sm font-bold truncate text-center">{t(`skinNames.${skin.id}`)}</h3>
              <div className="mt-2 flex justify-center">
                <Button
                  size="sm"
                  variant={isActive ? "secondary" : "default"}
                  onClick={() => !isActive && selectSkinMutation.mutate(skin.id)}
                  disabled={isActive || selectSkinMutation.isPending}
                  className="h-7 text-xs px-3 font-semibold"
                  data-testid={`button-equip-${skin.id}`}
                >
                  {isActive ? t('skins.equipped') : t('skins.equip')}
                </Button>
              </div>
            </>
          ) : (
            <>
              <h3 className="font-accent text-sm font-bold truncate text-center text-muted-foreground">???</h3>
              <div className="mt-2 flex justify-center">
                <Button
                  size="sm"
                  variant="default"
                  onClick={() => discoverSkinMutation.mutate(skin.id)}
                  disabled={!canDiscover || discoverSkinMutation.isPending}
                  className="h-7 text-xs px-3 font-semibold"
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
        <Link href={dashboardUrl}>
          <Button 
            variant="outline" 
            className="mb-4 bg-background/30 backdrop-blur-sm border-border/40 hover:bg-background/60" 
            data-testid="button-back-to-dashboard"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            {t('common.backToDashboard')}
          </Button>
        </Link>
        
        <div className="mb-6">
          <h1 className="text-4xl font-black font-accent mb-3 text-glow-white">
            {t('skins.title')}
          </h1>
          <p className="text-lg font-semibold mb-4 text-glow-white">
            {t('skins.description')}
          </p>
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-2">
              <Trophy className="h-5 w-5 text-primary" />
              <span className="font-bold text-glow-white">
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
            <h2 className="text-2xl font-black font-accent mb-1 text-glow-white">
              {t('skins.yourCustomAvatar')}
            </h2>
            <p className="text-sm font-semibold text-glow-white">
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
                  <Badge className="text-xs px-2 py-0.5 font-semibold" data-testid="badge-active-default">
                    <Check className="h-3 w-3" />
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
              
              <div className="p-2 text-center">
                <h3 className="font-accent text-sm font-bold truncate">{t('skins.default')}</h3>
                <p className="text-xs text-muted-foreground font-medium">{t('skins.custom')}</p>
              </div>
            </Card>
          </div>
        </div>

        {/* Tier 1 - Starter Heroes */}
        <div className="mb-8">
          <div className="mb-4">
            <h2 className="text-2xl font-black font-accent mb-1 text-glow-white">
              {t('skins.starterHeroes')}
            </h2>
            <p className="text-sm font-semibold text-glow-white">
              {t('skins.unlockedUseCards')}
            </p>
          </div>
          <div className="grid grid-cols-4 gap-2">
            {tier1Skins.map(renderSkinCard)}
          </div>
        </div>

        {/* Tier 2 - Elite Heroes */}
        <div className="mb-8">
          <div className="mb-4">
            <h2 className="text-2xl font-black font-accent mb-1 text-glow-white">
              {t('skins.eliteHeroes')}
            </h2>
            <p className="text-sm font-semibold text-glow-white">
              {unlockedTier >= 2
                ? t('skins.unlockedUseCards')
                : t('skins.unlockAt700')}
            </p>
          </div>
          <div className="grid grid-cols-4 gap-2">
            {tier2Skins.length > 0 ? (
              tier2Skins.map(renderSkinCard)
            ) : (
              <p className="col-span-4 text-center text-muted-foreground py-8">
                {t('skins.noSkinsInTier')}
              </p>
            )}
          </div>
        </div>

        {/* Tier 3 - Dinosaur Heroes */}
        <div className="mb-8">
          <div className="mb-4">
            <h2 className="text-2xl font-black font-accent mb-1 text-glow-white">
              {t('skins.dinosaurBonusPack')}
            </h2>
            <p className="text-sm font-semibold text-glow-white">
              {unlockedTier >= 3
                ? t('skins.unlockedUseCards')
                : t('skins.unlockAt1400')}
            </p>
          </div>
          <div className="grid grid-cols-4 gap-2">
            {tier3Skins.length > 0 ? (
              tier3Skins.map(renderSkinCard)
            ) : (
              <p className="col-span-4 text-center text-muted-foreground py-8">
                {t('skins.noSkinsInTier')}
              </p>
            )}
          </div>
        </div>

        {/* Tier 4 - Magical Princess World */}
        <div className="mb-8">
          <div className="mb-4">
            <h2 className="text-2xl font-black font-accent mb-1 text-glow-white">
              Magical Princess World
            </h2>
            <p className="text-sm font-semibold text-glow-white">
              {unlockedTier >= 4
                ? t('skins.unlockedUseCards')
                : "Unlock at 2,100 points"}
            </p>
          </div>
          <div className="grid grid-cols-4 gap-2">
            {tier4Skins.length > 0 ? (
              tier4Skins.map(renderSkinCard)
            ) : (
              <p className="col-span-4 text-center text-muted-foreground py-8">
                {t('skins.noSkinsInTier')}
              </p>
            )}
          </div>
        </div>

        {/* Tier 5 - Space Explorers */}
        <div className="mb-8">
          <div className="mb-4">
            <h2 className="text-2xl font-black font-accent mb-1 text-glow-white">
              Space Explorers
            </h2>
            <p className="text-sm font-semibold text-glow-white">
              {unlockedTier >= 5
                ? t('skins.unlockedUseCards')
                : "Unlock at 2,800 points"}
            </p>
          </div>
          <div className="grid grid-cols-4 gap-2">
            {tier5Skins.length > 0 ? (
              tier5Skins.map(renderSkinCard)
            ) : (
              <p className="col-span-4 text-center text-muted-foreground py-8">
                {t('skins.noSkinsInTier')}
              </p>
            )}
          </div>
        </div>

        {/* Tier 6 - Cute Animals */}
        <div className="mb-8">
          <div className="mb-4">
            <h2 className="text-2xl font-black font-accent mb-1 text-glow-white">
              Cute Animals
            </h2>
            <p className="text-sm font-semibold text-glow-white">
              {unlockedTier >= 6
                ? t('skins.unlockedUseCards')
                : "Unlock at 3,500 points"}
            </p>
          </div>
          <div className="grid grid-cols-4 gap-2">
            {tier6Skins.length > 0 ? (
              tier6Skins.map(renderSkinCard)
            ) : (
              <p className="col-span-4 text-center text-muted-foreground py-8">
                {t('skins.noSkinsInTier')}
              </p>
            )}
          </div>
        </div>

        {/* Tier 7 - Vampire Adventure */}
        <div className="mb-8">
          <div className="mb-4">
            <h2 className="text-2xl font-black font-accent mb-1 text-glow-white">
              Vampire Adventure
            </h2>
            <p className="text-sm font-semibold text-glow-white">
              {unlockedTier >= 7
                ? t('skins.unlockedUseCards')
                : "Unlock at 4,200 points"}
            </p>
          </div>
          <div className="grid grid-cols-4 gap-2">
            {tier7Skins.length > 0 ? (
              tier7Skins.map(renderSkinCard)
            ) : (
              <p className="col-span-4 text-center text-muted-foreground py-8">
                {t('skins.noSkinsInTier')}
              </p>
            )}
          </div>
        </div>

        {/* Tier 8 - Ballerina Dreams */}
        <div className="mb-8">
          <div className="mb-4">
            <h2 className="text-2xl font-black font-accent mb-1 text-glow-white">
              Ballerina Dreams
            </h2>
            <p className="text-sm font-semibold text-glow-white">
              {unlockedTier >= 8
                ? t('skins.unlockedUseCards')
                : "Unlock at 4,900 points"}
            </p>
          </div>
          <div className="grid grid-cols-4 gap-2">
            {tier8Skins.length > 0 ? (
              tier8Skins.map(renderSkinCard)
            ) : (
              <p className="col-span-4 text-center text-muted-foreground py-8">
                {t('skins.noSkinsInTier')}
              </p>
            )}
          </div>
        </div>

        {/* Tier 9 - Superhero Squad */}
        <div className="mb-8">
          <div className="mb-4">
            <h2 className="text-2xl font-black font-accent mb-1 text-glow-white">
              Superhero Squad
            </h2>
            <p className="text-sm font-semibold text-glow-white">
              {unlockedTier >= 9
                ? t('skins.unlockedUseCards')
                : "Unlock at 5,600 points"}
            </p>
          </div>
          <div className="grid grid-cols-4 gap-2">
            {tier9Skins.length > 0 ? (
              tier9Skins.map(renderSkinCard)
            ) : (
              <p className="col-span-4 text-center text-muted-foreground py-8">
                {t('skins.noSkinsInTier')}
              </p>
            )}
          </div>
        </div>

        {/* Tier 10 - Mecha Robots */}
        <div className="mb-8">
          <div className="mb-4">
            <h2 className="text-2xl font-black font-accent mb-1 text-glow-white">
              Mecha Robots
            </h2>
            <p className="text-sm font-semibold text-glow-white">
              {unlockedTier >= 10
                ? t('skins.unlockedUseCards')
                : "Unlock at 6,300 points"}
            </p>
          </div>
          <div className="grid grid-cols-4 gap-2">
            {tier10Skins.length > 0 ? (
              tier10Skins.map(renderSkinCard)
            ) : (
              <p className="col-span-4 text-center text-muted-foreground py-8">
                {t('skins.noSkinsInTier')}
              </p>
            )}
          </div>
        </div>

        {/* Tier 11 - Manga Heroes */}
        <div className="mb-8">
          <div className="mb-4">
            <h2 className="text-2xl font-black font-accent mb-1 text-glow-white">
              Manga Heroes
            </h2>
            <p className="text-sm font-semibold text-glow-white">
              {unlockedTier >= 11
                ? t('skins.unlockedUseCards')
                : "Unlock at 7,000 points"}
            </p>
          </div>
          <div className="grid grid-cols-4 gap-2">
            {tier11Skins.length > 0 ? (
              tier11Skins.map(renderSkinCard)
            ) : (
              <p className="col-span-4 text-center text-muted-foreground py-8">
                {t('skins.noSkinsInTier')}
              </p>
            )}
          </div>
        </div>

        {/* Tier 12 - Gaming Legends */}
        <div className="mb-8">
          <div className="mb-4">
            <h2 className="text-2xl font-black font-accent mb-1 text-glow-white">
              Gaming Legends
            </h2>
            <p className="text-sm font-semibold text-glow-white">
              {unlockedTier >= 12
                ? t('skins.unlockedUseCards')
                : "Unlock at 7,700 points"}
            </p>
          </div>
          <div className="grid grid-cols-4 gap-2">
            {tier12Skins.length > 0 ? (
              tier12Skins.map(renderSkinCard)
            ) : (
              <p className="col-span-4 text-center text-muted-foreground py-8">
                {t('skins.noSkinsInTier')}
              </p>
            )}
          </div>
        </div>

        {/* Tier 13 - Pterosaur Sky */}
        <div className="mb-8">
          <div className="mb-4">
            <h2 className="text-2xl font-black font-accent mb-1 text-glow-white">
              {t('skins.pterosaurSky', 'Pterosaur Sky')}
            </h2>
            <p className="text-sm font-semibold text-glow-white">
              {unlockedTier >= 13
                ? t('skins.unlockedUseCards')
                : t('skins.unlockAtPoints', { points: '8,400' })}
            </p>
          </div>
          <div className="grid grid-cols-4 gap-2">
            {tier13Skins.length > 0 ? (
              tier13Skins.map(renderSkinCard)
            ) : (
              <p className="col-span-4 text-center text-muted-foreground py-8">
                {t('skins.noSkinsInTier')}
              </p>
            )}
          </div>
        </div>

        {/* Tier 14 - HeroKids Legacy */}
        <div className="mb-8">
          <div className="mb-4">
            <h2 className="text-2xl font-black font-accent mb-1 text-glow-white">
              HeroKids Legacy
            </h2>
            <p className="text-sm font-semibold text-glow-white">
              {unlockedTier >= 14
                ? t('skins.unlockedUseCards')
                : t('skins.unlockAtPoints', { points: '9,100' })}
            </p>
          </div>
          <div className="grid grid-cols-4 gap-2">
            {tier14Skins.length > 0 ? (
              tier14Skins.map(renderSkinCard)
            ) : (
              <p className="col-span-4 text-center text-muted-foreground py-8">
                {t('skins.noSkinsInTier')}
              </p>
            )}
          </div>
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
