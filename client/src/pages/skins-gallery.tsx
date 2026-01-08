import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest, ApiError } from "@/lib/queryClient";
import { useWebSocket } from "@/hooks/useWebSocket";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Loader2, Lock, Check, Trophy, ArrowLeft, User, Star, Sparkles, Crown, Camera, ImageOff, Image } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { SuccessCelebration } from "@/components/success-celebration";
import { Link } from "wouter";
import { SKIN_IMAGES, SKIN_BACKGROUNDS } from "@/lib/skins";
import { getAllSkinsInOrder, isLegacySkin, LEGACY_UNLOCK_THRESHOLD, TOTAL_HIDDEN_STARS, STARS_PER_LEGACY_AVATAR, LEGACY_SKIN_ORDER } from "@shared/skin-config";
import type { FamilyMember, Family } from "@shared/schema";
import { useTranslation } from "react-i18next";
import { motion, AnimatePresence } from "framer-motion";

// Custom hook for sticky sidebar on desktop
function useStickyPreview(isDesktop: boolean) {
  const containerRef = useRef<HTMLDivElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const [stickyStyle, setStickyStyle] = useState<React.CSSProperties>({});

  useEffect(() => {
    if (!isDesktop) {
      setStickyStyle({});
      return;
    }

    const handleScroll = () => {
      if (!containerRef.current || !previewRef.current) return;
      
      const containerRect = containerRef.current.getBoundingClientRect();
      const previewHeight = previewRef.current.offsetHeight;
      const topOffset = 16; // 1rem gap from top
      const viewportHeight = window.innerHeight;
      
      // Calculate if we should fix the preview
      if (containerRect.top < topOffset) {
        // Container has scrolled past the top offset
        const maxScroll = containerRect.height - previewHeight;
        const currentScroll = topOffset - containerRect.top;
        
        if (currentScroll < maxScroll) {
          // Fix the preview at the top
          setStickyStyle({
            position: 'fixed',
            top: `${topOffset}px`,
            width: `${previewRef.current.offsetWidth}px`,
          });
        } else {
          // Pin to bottom of container
          setStickyStyle({
            position: 'absolute',
            bottom: '0',
            top: 'auto',
          });
        }
      } else {
        // Container hasn't scrolled yet
        setStickyStyle({});
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('resize', handleScroll, { passive: true });
    handleScroll(); // Initial call

    return () => {
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', handleScroll);
    };
  }, [isDesktop]);

  return { containerRef, previewRef, stickyStyle };
}

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
  const [discoverDialogSkinId, setDiscoverDialogSkinId] = useState<string | null>(null);
  
  // Detect desktop for sticky behavior (lg breakpoint = 1024px)
  const [isDesktop, setIsDesktop] = useState(false);
  useEffect(() => {
    const checkDesktop = () => setIsDesktop(window.innerWidth >= 1024);
    checkDesktop();
    window.addEventListener('resize', checkDesktop);
    return () => window.removeEventListener('resize', checkDesktop);
  }, []);
  
  const { containerRef, previewRef, stickyStyle } = useStickyPreview(isDesktop);

  const { data: memberData, isLoading: memberLoading } = useQuery<FamilyMember>({
    queryKey: ["/api/family-members/current"],
  });

  const { data: familyData } = useQuery<Family>({
    queryKey: ["/api/families/settings"],
    enabled: !!memberData,
  });

  // Use family's skinCardCost or default to 60
  const pointsPerSkin = familyData?.skinCardCost ?? 60;

  useWebSocket(memberData?.familyName || null);

  const isChild = memberData?.role === "child";
  const dashboardUrl = isChild ? "/kid-dashboard" : "/dashboard";

  const { data, isLoading } = useQuery<{ 
    skins: Skin[]; 
    totalEarned: number;
    availableCards: number;
    unlockedTier: number;
    starStats: { starsFound: number; totalStars: number; earnedLegacySkinIds: string[] };
    starPlacements: Record<string, boolean>; // skinId -> found
  }>({
    queryKey: ["/api/skins"],
  });
  
  // Star animation state
  const [showStarAnimation, setShowStarAnimation] = useState(false);
  const [starAnimationData, setStarAnimationData] = useState<{ totalStars: number; legacySkinAwarded: string | null } | null>(null);

  const discoverSkinMutation = useMutation({
    mutationFn: async (skinId: string) => {
      const res = await apiRequest("POST", "/api/skins/discover", { skinId });
      return await res.json();
    },
    onSuccess: (result) => {
      setDiscoverDialogSkinId(null); // Close the popup
      const skin = data?.skins.find(s => s.id === result.skinId);
      const skinName = skin?.id ? t(`skinNames.${skin.id}`) : "Skin";
      
      // Check if a star was found - show star animation first
      if (result.starFound) {
        setStarAnimationData({
          totalStars: result.totalStarsFound,
          legacySkinAwarded: result.legacySkinAwarded,
        });
        setShowStarAnimation(true);
        
        // After star animation, show the regular celebration
        setTimeout(() => {
          setShowStarAnimation(false);
          setCelebration({
            points: 0,
            message: skinName,
          });
        }, 2500);
      } else {
        setCelebration({
          points: 0,
          message: skinName,
        });
      }
      
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

  // Toggle background mutation
  const toggleBackgroundMutation = useMutation({
    mutationFn: async (useThemeBackground: boolean) => {
      const res = await apiRequest("POST", "/api/skins/background", { useThemeBackground });
      return await res.json();
    },
    onSuccess: (_, useThemeBackground) => {
      toast({
        title: useThemeBackground ? t('skins.backgroundEnabled') : t('skins.backgroundDisabled'),
        description: useThemeBackground 
          ? t('skins.backgroundEnabledDesc') 
          : t('skins.backgroundDisabledDesc'),
      });
      queryClient.invalidateQueries({ queryKey: ["/api/family-members/current"] });
      queryClient.invalidateQueries({ queryKey: ["/api/family-members"] });
    },
    onError: (error: any) => {
      toast({
        title: t('common.error'),
        description: t('skins.failedToToggleBackground'),
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
  const nextUnlockPoints = (discoveredCount + 1) * pointsPerSkin;
  const progressToNext = totalEarned % pointsPerSkin;

  const starPlacements = data?.starPlacements || {};
  const starStats = data?.starStats || { starsFound: 0, totalStars: 0, earnedLegacySkinIds: [] };

  const renderMiniCard = (skin: Skin, index: number) => {
    const isDiscovered = skin.isDiscovered;
    const canDiscover = skin.canDiscover;
    const isActive = skin.isActive;
    const isSelected = selectedSkinId === skin.id;
    const isLegacy = isLegacySkin(skin.id);
    const hasFoundStar = starPlacements[skin.id] === true; // Star was found on this card

    const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
      // If it's an undiscovered skin that can be discovered, show the popup
      if (canDiscover && !isDiscovered) {
        e.stopPropagation();
        setDiscoverDialogSkinId(skin.id);
      } else {
        setSelectedSkinId(skin.id);
      }
    };
    
    const isShowingDiscoverButton = discoverDialogSkinId === skin.id;

    return (
      <div
        key={skin.id}
        onClick={handleClick}
        className={`
          relative cursor-pointer transition-all duration-200
          rounded-md border-2
          ${isSelected ? "border-primary border-4 ring-4 ring-primary/60 scale-110 shadow-lg shadow-primary/30" : "border-transparent"}
          ${isActive ? "ring-4 ring-yellow-400 ring-offset-2" : ""}
          hover:scale-105 hover:border-primary/50
        `}
        data-testid={`mini-skin-${skin.id}`}
      >
        <div className="aspect-square w-full relative overflow-hidden rounded-md">
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
        
        {/* Mini-star indicator for discovered skins where a star was found */}
        {isDiscovered && hasFoundStar && (
          <div className="absolute bottom-0.5 right-0.5">
            <div className="bg-yellow-400 rounded-full p-0.5 shadow-lg">
              <Star className="h-2 w-2 text-yellow-900 fill-yellow-900" />
            </div>
          </div>
        )}
        
        {/* Discover button - Absolute overlay centered on card */}
        <AnimatePresence>
          {isShowingDiscoverButton && (
            <motion.div
              className="absolute inset-0 z-50 flex items-center justify-center p-1"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              transition={{ type: "spring", stiffness: 400, damping: 25 }}
            >
              <Button
                size="sm"
                className="w-full h-auto py-2 text-[10px] sm:text-xs font-bold ring-2 ring-white/30 shadow-lg shadow-primary/40 animate-pulse whitespace-normal text-center leading-tight"
                onClick={(e) => {
                  e.stopPropagation();
                  discoverSkinMutation.mutate(skin.id);
                }}
                disabled={discoverSkinMutation.isPending}
                data-testid="button-discover-popup"
              >
                {discoverSkinMutation.isPending ? (
                  <Loader2 className="h-3 w-3 animate-spin mr-1" />
                ) : null}
                {t('skins.discover')}
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
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
              
              {/* Star counter for children */}
              {starStats.totalStars > 0 && (
                <Badge variant="outline" className="text-xs sm:text-sm font-bold whitespace-nowrap bg-yellow-100 text-yellow-800 border-yellow-400 dark:bg-yellow-900/30 dark:text-yellow-300 px-1.5 sm:px-2.5">
                  <Star className="h-3 w-3 sm:h-4 sm:w-4 mr-0.5 sm:mr-1 fill-yellow-400" />
                  {starStats.starsFound}/{starStats.totalStars}
                </Badge>
              )}
              
              {availableCards > 0 && (
                <Badge className="text-base font-bold animate-pulse whitespace-nowrap">
                  <Sparkles className="h-5 w-5 mr-1" />
                  {availableCards} {t('skins.cardsAvailable')}
                </Badge>
              )}
            </div>
          </div>

          {/* Main Layout: Preview Left + Grid Right */}
          <div ref={containerRef} className="flex gap-4 flex-col lg:flex-row relative">
            {/* Preview Panel - Left Side - JS-based sticky on desktop, normal on mobile */}
            <div className="lg:w-80 flex-shrink-0">
              <div ref={previewRef} style={stickyStyle}>
                <Card className="bg-card/90 backdrop-blur-md p-4">
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
                  ) : (
                    <Button
                      className="w-full"
                      variant={isDefaultActive ? "secondary" : "default"}
                      onClick={() => !isDefaultActive && selectSkinMutation.mutate(null)}
                      disabled={isDefaultActive || selectSkinMutation.isPending}
                      data-testid="button-equip-default"
                    >
                      {memberData?.avatarUrl ? (
                        <>
                          <Camera className="h-4 w-4 mr-2" />
                          {isDefaultActive ? t('skins.equipped') : t('skins.useYourPhoto')}
                        </>
                      ) : (
                        <>
                          {isDefaultActive ? t('skins.equipped') : t('skins.useDefault')}
                        </>
                      )}
                    </Button>
                  )}
                  
                  {/* Background toggle - only show when a skin is active */}
                  {memberData?.activeSkinId && (
                    <Button
                      className="w-full"
                      variant="ghost"
                      size="sm"
                      onClick={() => toggleBackgroundMutation.mutate(!memberData.useThemeBackground)}
                      disabled={toggleBackgroundMutation.isPending}
                      data-testid="button-toggle-background"
                    >
                      {memberData.useThemeBackground !== false ? (
                        <>
                          <ImageOff className="h-4 w-4 mr-2" />
                          {t('skins.hideBackground')}
                        </>
                      ) : (
                        <>
                          <Image className="h-4 w-4 mr-2" />
                          {t('skins.showBackground')}
                        </>
                      )}
                    </Button>
                  )}
                </div>
                
                {/* Progress to next unlock */}
                <div className="mt-4 pt-4 border-t">
                  {previewSkin && isLegacySkin(previewSkin.id) ? (
                    // Legacy skin - show star-based info
                    (() => {
                      const legacyIndex = LEGACY_SKIN_ORDER.indexOf(previewSkin.id);
                      const starsNeeded = (legacyIndex + 1) * STARS_PER_LEGACY_AVATAR;
                      const currentStars = starStats.starsFound;
                      const progressPercent = Math.min((currentStars / starsNeeded) * 100, 100);
                      
                      if (previewSkin.isDiscovered) {
                        // Already unlocked - show how many stars were needed
                        return (
                          <p className="text-sm text-muted-foreground flex items-center gap-1 justify-center">
                            <Star className="h-4 w-4 text-yellow-400 fill-yellow-400" />
                            {t('skins.unlockedWithStars', { count: starsNeeded })}
                          </p>
                        );
                      }
                      
                      return (
                        <>
                          <p className="text-sm text-muted-foreground mb-2 flex items-center gap-1">
                            <Star className="h-4 w-4 text-yellow-400 fill-yellow-400" />
                            {t('skins.unlockAtStars', { count: starsNeeded })}
                          </p>
                          <div className="h-2 bg-muted rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-yellow-400 transition-all"
                              style={{ width: `${progressPercent}%` }}
                            />
                          </div>
                          <p className="text-xs text-muted-foreground mt-1 text-center">
                            {currentStars} / {starsNeeded} {t('common.stars')}
                          </p>
                        </>
                      );
                    })()
                  ) : (
                    // Regular skin - show points-based progress
                    <>
                      <p className="text-sm text-muted-foreground mb-2">
                        {t('skins.nextUnlock')}: {nextUnlockPoints} {t('common.points')}
                      </p>
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-primary transition-all"
                          style={{ width: `${(progressToNext / pointsPerSkin) * 100}%` }}
                        />
                      </div>
                      <p className="text-xs text-muted-foreground mt-1 text-center">
                        {progressToNext} / {pointsPerSkin}
                      </p>
                    </>
                  )}
                </div>
              </Card>
              </div>
            </div>

            {/* Skins Grid - Right Side */}
            <div className="flex-1">
              {/* Legacy Skins Section - unlocked via stars */}
              {legacySkins.length > 0 && (
                <Card className="bg-gradient-to-br from-purple-500/20 to-card/80 backdrop-blur-md p-3 mb-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Crown className="h-5 w-5 text-purple-400" />
                    <h3 className="font-bold font-accent text-purple-300">HeroKids Legacy</h3>
                    <Badge variant="secondary" className="text-xs">
                      <Star className="h-3 w-3 mr-1 fill-yellow-400 text-yellow-400" />
                      4 {t('common.stars')} = 1 Avatar
                    </Badge>
                  </div>
                  <div className="grid grid-cols-6 sm:grid-cols-8 md:grid-cols-10 lg:grid-cols-8 xl:grid-cols-10 gap-2">
                    {legacySkins.map((skin, index) => renderMiniCard(skin, index))}
                  </div>
                </Card>
              )}

              {/* Regular Skins Grid */}
              <Card className="bg-card/80 backdrop-blur-md p-3">
                <div className="grid grid-cols-6 sm:grid-cols-8 md:grid-cols-10 lg:grid-cols-8 xl:grid-cols-10 gap-2">
                  {regularSkins.map((skin, index) => renderMiniCard(skin, index))}
                </div>
              </Card>
            </div>
          </div>
        </div>
      </div>

      {/* Click-outside handler to dismiss discover button */}
      {discoverDialogSkinId && (
        <div 
          className="fixed inset-0 z-40"
          onClick={() => setDiscoverDialogSkinId(null)}
        />
      )}

      {celebration && (
        <SuccessCelebration
          points={celebration.points}
          message={celebration.message}
          onComplete={() => setCelebration(null)}
        />
      )}

      {/* Star Found Animation */}
      <AnimatePresence>
        {showStarAnimation && starAnimationData && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="flex flex-col items-center px-4 max-w-[90vw]"
              initial={{ scale: 0, rotate: -180 }}
              animate={{ 
                scale: [0, 1.15, 1],
                rotate: [0, 360, 360],
                y: [0, -20, -20, 0]
              }}
              transition={{
                duration: 2,
                times: [0, 0.4, 0.6, 1],
                ease: "easeOut"
              }}
            >
              <motion.div
                animate={{
                  scale: [1, 1.1, 1],
                  rotate: [0, 10, -10, 0]
                }}
                transition={{
                  duration: 0.5,
                  repeat: 3,
                  repeatType: "reverse"
                }}
              >
                <Star className="h-20 w-20 sm:h-24 sm:w-24 text-yellow-400 fill-yellow-400 drop-shadow-2xl" />
              </motion.div>
              <motion.p
                className="mt-4 text-xl sm:text-2xl font-bold font-accent text-white drop-shadow-lg text-center"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.8 }}
              >
                {t('skins.starFound', 'You found a Star!')}
              </motion.p>
              <motion.p
                className="mt-2 text-lg sm:text-xl text-yellow-300 text-center"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 1.2 }}
              >
                {starAnimationData.totalStars}/{TOTAL_HIDDEN_STARS} {t('common.stars', 'Stars')}
              </motion.p>
              {starAnimationData.legacySkinAwarded && (
                <motion.div
                  className="mt-3 bg-purple-500/80 rounded-lg px-3 py-2"
                  initial={{ opacity: 0, scale: 0 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 1.6 }}
                >
                  <p className="text-sm sm:text-base font-bold text-white flex items-center gap-2 text-center">
                    <Crown className="h-4 w-4 flex-shrink-0" />
                    {t('skins.legacyUnlocked', 'HeroKids Legacy Avatar unlocked!')}
                  </p>
                </motion.div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
