import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest, ApiError } from "@/lib/queryClient";
import { useWebSocket } from "@/hooks/useWebSocket";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Loader2, Lock, Check, Trophy, ArrowLeft, User, Star, Sparkles, Crown, Camera } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { SuccessCelebration } from "@/components/success-celebration";
import { Link } from "wouter";
import { SKIN_IMAGES, SKIN_BACKGROUNDS } from "@/lib/skins";
import { getAllSkinsInOrder, isLegacySkin, LEGACY_UNLOCK_THRESHOLD, POINTS_PER_SKIN } from "@shared/skin-config";
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
  const [selectedSkinId, setSelectedSkinId] = useState<string | null>(null);
  const [discoverDialogSkin, setDiscoverDialogSkin] = useState<Skin | null>(null);
  const [popupPosition, setPopupPosition] = useState<{ x: number; y: number } | null>(null);

  const { data: memberData, isLoading: memberLoading } = useQuery<FamilyMember>({
    queryKey: ["/api/family-members/current"],
  });

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
      setDiscoverDialogSkin(null); // Close the popup
      setPopupPosition(null);
      const skin = data?.skins.find(s => s.id === result.skinId);
      const skinName = skin?.id ? t(`skinNames.${skin.id}`) : "Skin";
      setCelebration({
        points: result.bonusPoints || 0,
        message: `${skinName} ${t('skins.discovered')}!${result.bonusPoints ? ` +${result.bonusPoints} ${t('common.points')}!` : ""}`,
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
          message: t('skins.photoEquipped'),
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
  const isDefaultActive = memberData?.activeSkinId === null || memberData?.activeSkinId === undefined;
  
  // Get skins in the new mixed order
  const orderedSkinIds = getAllSkinsInOrder();
  const orderedSkins = orderedSkinIds
    .map(id => skins.find(s => s.id === id))
    .filter((s): s is Skin => s !== undefined);
  
  // Separate legacy skins
  const regularSkins = orderedSkins.filter(s => !isLegacySkin(s.id));
  const legacySkins = orderedSkins.filter(s => isLegacySkin(s.id));
  
  // Find the selected skin for preview
  const selectedSkin = selectedSkinId 
    ? skins.find(s => s.id === selectedSkinId) 
    : null;
  const previewSkin = selectedSkin || (memberData?.activeSkinId ? skins.find(s => s.id === memberData.activeSkinId) : null);

  // Calculate next unlock
  const discoveredCount = skins.filter(s => s.isDiscovered).length;
  const nextUnlockPoints = (discoveredCount + 1) * POINTS_PER_SKIN;
  const progressToNext = totalEarned % POINTS_PER_SKIN;

  const renderMiniCard = (skin: Skin, index: number) => {
    const isDiscovered = skin.isDiscovered;
    const canDiscover = skin.canDiscover;
    const isActive = skin.isActive;
    const isSelected = selectedSkinId === skin.id;
    const isLegacy = isLegacySkin(skin.id);

    const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
      // If it's an undiscovered skin that can be discovered, show the popup
      if (canDiscover && !isDiscovered) {
        const rect = e.currentTarget.getBoundingClientRect();
        // Position popup above the card, centered
        setPopupPosition({
          x: rect.left + rect.width / 2,
          y: rect.top - 8
        });
        setDiscoverDialogSkin(skin);
      } else {
        setSelectedSkinId(skin.id);
      }
    };

    return (
      <div
        key={skin.id}
        onClick={handleClick}
        className={`
          relative cursor-pointer transition-all duration-200
          rounded-md overflow-hidden border-2
          ${isSelected ? "border-primary border-4 ring-4 ring-primary/60 scale-110 shadow-lg shadow-primary/30" : "border-transparent"}
          ${isActive ? "ring-4 ring-yellow-400 ring-offset-2" : ""}
          hover:scale-105 hover:border-primary/50
        `}
        data-testid={`mini-skin-${skin.id}`}
      >
        <div className="aspect-square w-full relative">
          {isDiscovered ? (
            SKIN_IMAGES[skin.id] ? (
              <img
                src={SKIN_IMAGES[skin.id]}
                alt={t(`skinNames.${skin.id}`)}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full bg-muted flex items-center justify-center">
                <User className="h-4 w-4 text-muted-foreground" />
              </div>
            )
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-primary/30 to-primary/10 flex items-center justify-center">
              <span className="text-2xl font-bold text-primary/60">?</span>
            </div>
          )}
        </div>
        
        {isActive && (
          <div className="absolute top-0.5 right-0.5">
            <div className="bg-yellow-400 rounded-full p-0.5">
              <Check className="h-2 w-2 text-yellow-900" />
            </div>
          </div>
        )}
        
        {isLegacy && isDiscovered && (
          <div className="absolute top-0.5 left-0.5">
            <div className="bg-purple-500 rounded-full p-0.5">
              <Crown className="h-2 w-2 text-white" />
            </div>
          </div>
        )}
        
        {canDiscover && !isDiscovered && (
          <div className="absolute inset-0 bg-primary/20 flex items-center justify-center">
            <Sparkles className="h-4 w-4 text-primary animate-pulse" />
          </div>
        )}
      </div>
    );
  };

  return (
    <>
      <div className="min-h-screen p-4">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
            <Link href={dashboardUrl}>
              <Button 
                variant="outline" 
                size="sm"
                className="bg-card/80 backdrop-blur-sm" 
                data-testid="button-back-to-dashboard"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                {t('common.back')}
              </Button>
            </Link>
            
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary" className="text-sm font-bold whitespace-nowrap">
                <Trophy className="h-4 w-4 mr-1" />
                {totalEarned} {t('common.points')}
              </Badge>
              
              {availableCards > 0 && (
                <Badge className="text-base font-bold animate-pulse whitespace-nowrap">
                  <Sparkles className="h-5 w-5 mr-1" />
                  {availableCards} {t('skins.cardsAvailable')}
                </Badge>
              )}
            </div>
          </div>

          {/* Main Layout: Preview Left + Grid Right */}
          <div className="flex gap-4 flex-col lg:flex-row">
            {/* Preview Panel - Left Side */}
            <div className="lg:w-80 flex-shrink-0">
              <Card className="bg-card/90 backdrop-blur-md p-4 sticky top-4">
                {/* Preview Image */}
                <div className="relative aspect-square rounded-lg overflow-hidden mb-4 bg-gradient-to-br from-muted to-card">
                  {previewSkin ? (
                    previewSkin.isDiscovered ? (
                      <>
                        {SKIN_BACKGROUNDS[previewSkin.id] && (
                          <img
                            src={SKIN_BACKGROUNDS[previewSkin.id]}
                            alt=""
                            className="absolute inset-0 w-full h-full object-cover opacity-50"
                          />
                        )}
                        <img
                          src={SKIN_IMAGES[previewSkin.id]}
                          alt={t(`skinNames.${previewSkin.id}`)}
                          className="relative w-full h-full object-contain p-4"
                        />
                        {previewSkin.isActive && (
                          <div className="absolute top-2 right-2">
                            <Badge className="bg-yellow-400 text-yellow-900">
                              <Check className="h-3 w-3 mr-1" />
                              {t('skins.equipped')}
                            </Badge>
                          </div>
                        )}
                      </>
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center">
                        <div className="text-8xl font-bold text-muted-foreground/30 mb-2">?</div>
                        <p className="text-muted-foreground text-sm">{t('skins.mystery')}</p>
                      </div>
                    )
                  ) : memberData?.avatarUrl ? (
                    <Avatar className="w-full h-full">
                      <AvatarImage src={memberData.avatarUrl} className="object-cover" />
                      <AvatarFallback>
                        <User className="h-16 w-16" />
                      </AvatarFallback>
                    </Avatar>
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <User className="h-16 w-16 text-muted-foreground" />
                    </div>
                  )}
                </div>
                
                {/* Preview Info */}
                <div className="text-center mb-4">
                  <h2 className="text-xl font-bold font-accent">
                    {previewSkin 
                      ? (previewSkin.isDiscovered ? t(`skinNames.${previewSkin.id}`) : "???")
                      : t('skins.yourPhoto')}
                  </h2>
                  {previewSkin && previewSkin.isDiscovered && isLegacySkin(previewSkin.id) && (
                    <Badge variant="secondary" className="mt-1">
                      <Crown className="h-3 w-3 mr-1" />
                      HeroKids Legacy
                    </Badge>
                  )}
                  {!previewSkin && memberData?.avatarUrl && (
                    <p className="text-sm text-muted-foreground mt-1">
                      <Camera className="h-3 w-3 inline mr-1" />
                      {t('skins.yourPhoto')}
                    </p>
                  )}
                </div>
                
                {/* Action Buttons */}
                <div className="space-y-2">
                  {previewSkin ? (
                    previewSkin.isDiscovered ? (
                      <Button
                        className="w-full"
                        variant={previewSkin.isActive ? "secondary" : "default"}
                        onClick={() => !previewSkin.isActive && selectSkinMutation.mutate(previewSkin.id)}
                        disabled={previewSkin.isActive || selectSkinMutation.isPending}
                        data-testid="button-equip-preview"
                      >
                        {previewSkin.isActive ? t('skins.equipped') : t('skins.equip')}
                      </Button>
                    ) : previewSkin.canDiscover ? (
                      <Button
                        className="w-full"
                        onClick={() => discoverSkinMutation.mutate(previewSkin.id)}
                        disabled={discoverSkinMutation.isPending}
                        data-testid="button-discover-preview"
                      >
                        <Sparkles className="h-4 w-4 mr-2" />
                        {t('skins.discover')}
                      </Button>
                    ) : (
                      <Button className="w-full" variant="secondary" disabled>
                        <Lock className="h-4 w-4 mr-2" />
                        {t('skins.locked')}
                      </Button>
                    )
                  ) : memberData?.avatarUrl ? (
                    <Button
                      className="w-full"
                      variant={isDefaultActive ? "secondary" : "default"}
                      onClick={() => !isDefaultActive && selectSkinMutation.mutate(null)}
                      disabled={isDefaultActive || selectSkinMutation.isPending}
                      data-testid="button-equip-default"
                    >
                      <Camera className="h-4 w-4 mr-2" />
                      {isDefaultActive ? t('skins.equipped') : t('skins.useYourPhoto')}
                    </Button>
                  ) : null}
                </div>
                
                {/* Progress to next unlock */}
                <div className="mt-4 pt-4 border-t">
                  <p className="text-sm text-muted-foreground mb-2">
                    {t('skins.nextUnlock')}: {nextUnlockPoints} {t('common.points')}
                  </p>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-primary transition-all"
                      style={{ width: `${(progressToNext / POINTS_PER_SKIN) * 100}%` }}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground mt-1 text-center">
                    {progressToNext} / {POINTS_PER_SKIN}
                  </p>
                </div>
              </Card>
            </div>

            {/* Skins Grid - Right Side */}
            <div className="flex-1">
              {/* Your Photo Option - only show if user has a photo */}
              {memberData?.avatarUrl && (
                <div className="mb-4">
                  <div
                    onClick={() => setSelectedSkinId(null)}
                    className={`
                      relative inline-block cursor-pointer transition-all duration-200
                      rounded-md overflow-hidden border-2 w-14 h-14
                      ${selectedSkinId === null && !previewSkin ? "border-blue-500 ring-2 ring-blue-500/50" : "border-blue-300"}
                      ${isDefaultActive ? "ring-2 ring-yellow-400" : ""}
                      hover:scale-105 hover:border-blue-400
                    `}
                    data-testid="mini-skin-default"
                  >
                    <div className="w-full h-full bg-card flex items-center justify-center">
                      <Avatar className="w-full h-full">
                        <AvatarImage src={memberData.avatarUrl} className="object-cover" />
                        <AvatarFallback>
                          <User className="h-6 w-6" />
                        </AvatarFallback>
                      </Avatar>
                    </div>
                    {isDefaultActive && (
                      <div className="absolute top-0.5 right-0.5">
                        <div className="bg-yellow-400 rounded-full p-0.5">
                          <Check className="h-2 w-2 text-yellow-900" />
                        </div>
                      </div>
                    )}
                    <div className="absolute bottom-0.5 left-0.5">
                      <div className="bg-blue-500 rounded-full p-0.5">
                        <Camera className="h-2 w-2 text-white" />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Regular Skins Grid */}
              <Card className="bg-card/80 backdrop-blur-md p-3 mb-4">
                <div className="grid grid-cols-6 sm:grid-cols-8 md:grid-cols-10 lg:grid-cols-8 xl:grid-cols-10 gap-2">
                  {regularSkins.map((skin, index) => renderMiniCard(skin, index))}
                </div>
              </Card>

              {/* Legacy Skins Section */}
              {legacySkins.length > 0 && (
                <Card className="bg-gradient-to-br from-purple-500/20 to-card/80 backdrop-blur-md p-3">
                  <div className="flex items-center gap-2 mb-3">
                    <Crown className="h-5 w-5 text-purple-400" />
                    <h3 className="font-bold font-accent text-purple-300">HeroKids Legacy</h3>
                    <Badge variant="secondary" className="text-xs">
                      {totalEarned >= LEGACY_UNLOCK_THRESHOLD 
                        ? t('skins.unlocked')
                        : `${LEGACY_UNLOCK_THRESHOLD} ${t('common.points')}`}
                    </Badge>
                  </div>
                  <div className="grid grid-cols-6 sm:grid-cols-8 md:grid-cols-10 lg:grid-cols-8 xl:grid-cols-10 gap-2">
                    {legacySkins.map((skin, index) => renderMiniCard(skin, index))}
                  </div>
                </Card>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Discovery Popup - positioned near clicked card */}
      {discoverDialogSkin && popupPosition && (
        <div 
          className="fixed inset-0 z-50"
          onClick={() => {
            setDiscoverDialogSkin(null);
            setPopupPosition(null);
          }}
        >
          <div
            className="absolute"
            style={{
              left: popupPosition.x,
              top: popupPosition.y,
              transform: 'translate(-50%, -100%)'
            }}
          >
            <Button
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                discoverDialogSkin && discoverSkinMutation.mutate(discoverDialogSkin.id);
              }}
              disabled={discoverSkinMutation.isPending}
              data-testid="button-discover-popup"
            >
              {discoverSkinMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Sparkles className="h-4 w-4 mr-2" />
              )}
              {t('skins.discover')}
            </Button>
          </div>
        </div>
      )}

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
