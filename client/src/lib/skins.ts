// Import skin images using @assets alias
// Tier 1 - Starter Heroes (reusing existing images)
import juniorChampionImg from "@assets/generated_images/Female_superhero_character_avatar_c7f67934.png";
import braveExplorerImg from "@assets/generated_images/Construction_worker_hero_avatar_d1064dc6.png";
import starCadetImg from "@assets/generated_images/Cute_space_explorer_avatar_a0b60f1e.png";
import natureScoutImg from "@assets/generated_images/Cute_plant_character_avatar_36aa366b.png";
import speedRunnerImg from "@assets/generated_images/Female_train_conductor_hero_avatar_dad8a300.png";
import bookWizardImg from "@assets/generated_images/Cute_dinosaur_character_avatar_4f48bda8.png";
import kitchenHeroImg from "@assets/generated_images/Cute_chef_character_avatar_4cecd321.png";
import artMasterImg from "@assets/generated_images/Cute_Halloween_monster_avatar_ea8b9c0b.png";

// Tier 2 - Elite Heroes
import techNinjaImg from "@assets/generated_images/Female_police_officer_avatar_ad47a20a.png";
import oceanGuardianImg from "@assets/generated_images/Dolphin_hero_avatar_19162df6.png";
import skyKnightImg from "@assets/generated_images/Sky_Knight_avatar_11e5e952.png";
import firePhoenixImg from "@assets/generated_images/Fire_Phoenix_avatar_0eb558b2.png";
import crystalMageImg from "@assets/generated_images/Crystal_Mage_avatar_3822ee79.png";
import neonRebelImg from "@assets/generated_images/Neon_Rebel_avatar_fe8fea5f.png";
import cosmicDrifterImg from "@assets/generated_images/Cosmic_Drifter_avatar_1d7d3759.png";
import thunderChampionImg from "@assets/generated_images/Thunder_Champion_avatar_cf3f783f.png";

// Import themed background images
import jungleBg from "@assets/generated_images/Jungle_plants_background_3f3fc573.png";
import cityStreetBg from "@assets/generated_images/City_street_background_9c722182.png";
import gardenBg from "@assets/generated_images/Garden_nature_background_b373f3a6.png";
import spaceBg from "@assets/generated_images/Space_galaxy_background_8100facc.png";
import skylineBg from "@assets/generated_images/City_skyline_background_cf75a668.png";
import kitchenBg from "@assets/generated_images/Kitchen_restaurant_background_877f922e.png";
import castleBg from "@assets/generated_images/Halloween_castle_background_scene_6acbb0d7.png";
import constructionBg from "@assets/generated_images/Construction_site_background_scene_990a32c9.png";
import trainStationBg from "@assets/generated_images/Train_station_background_scene_3c539965.png";
import underwaterBg from "@assets/generated_images/Underwater_ocean_background_scene_378220c2.png";

// Skin image mappings for new HeroKids themed skins
export const SKIN_IMAGES: Record<string, string> = {
  // Tier 1 - Starter Heroes
  "junior-champion": juniorChampionImg,
  "brave-explorer": braveExplorerImg,
  "star-cadet": starCadetImg,
  "nature-scout": natureScoutImg,
  "speed-runner": speedRunnerImg,
  "book-wizard": bookWizardImg,
  "kitchen-hero": kitchenHeroImg,
  "art-master": artMasterImg,
  
  // Tier 2 - Elite Heroes
  "tech-ninja": techNinjaImg,
  "ocean-guardian": oceanGuardianImg,
  "sky-knight": skyKnightImg,
  "fire-phoenix": firePhoenixImg,
  "crystal-mage": crystalMageImg,
  "neon-rebel": neonRebelImg,
  "cosmic-drifter": cosmicDrifterImg,
  "thunder-champion": thunderChampionImg,
};

// Themed background mappings for new HeroKids themed skins
export const SKIN_BACKGROUNDS: Record<string, string> = {
  // Tier 1 - Starter Heroes
  "junior-champion": skylineBg,
  "brave-explorer": constructionBg,
  "star-cadet": spaceBg,
  "nature-scout": gardenBg,
  "speed-runner": trainStationBg,
  "book-wizard": jungleBg,
  "kitchen-hero": kitchenBg,
  "art-master": castleBg,
  
  // Tier 2 - Elite Heroes
  "tech-ninja": cityStreetBg,
  "ocean-guardian": underwaterBg,
  "sky-knight": spaceBg,
  "fire-phoenix": castleBg,
  "crystal-mage": gardenBg,
  "neon-rebel": cityStreetBg,
  "cosmic-drifter": spaceBg,
  "thunder-champion": skylineBg,
};

// Helper to get avatar URL - returns skin image if active, otherwise custom avatar
export function getAvatarUrl(activeSkinId: string | null | undefined, customAvatarUrl: string | null | undefined): string | undefined {
  if (activeSkinId && SKIN_IMAGES[activeSkinId]) {
    return SKIN_IMAGES[activeSkinId];
  }
  return customAvatarUrl || undefined;
}

// Helper to get background URL for active skin
export function getBackgroundUrl(activeSkinId: string | null | undefined): string | undefined {
  if (activeSkinId && SKIN_BACKGROUNDS[activeSkinId]) {
    return SKIN_BACKGROUNDS[activeSkinId];
  }
  return undefined;
}
