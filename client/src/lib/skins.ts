// Import skin images using @assets alias
// Tier 1 - Starter Heroes (Modern fresh designs)
import juniorChampionImg from "@assets/generated_images/Modern_Junior_Champion_avatar_2bc47f6b.png";
import braveExplorerImg from "@assets/generated_images/Modern_Brave_Explorer_avatar_5d8a0f47.png";
import starCadetImg from "@assets/generated_images/Modern_Star_Cadet_avatar_03106676.png";
import natureScoutImg from "@assets/generated_images/Modern_Nature_Scout_avatar_9a7998e2.png";
import speedRunnerImg from "@assets/generated_images/Modern_Speed_Runner_avatar_6438bf70.png";
import bookWizardImg from "@assets/generated_images/Modern_Book_Wizard_avatar_a7765dd5.png";
import kitchenHeroImg from "@assets/generated_images/Modern_Kitchen_Hero_avatar_4062600a.png";
import artMasterImg from "@assets/generated_images/Modern_Art_Master_avatar_9e59088f.png";

// Tier 2 - Elite Heroes (Epic heroic designs)
import techNinjaImg from "@assets/generated_images/Elite_Tech_Ninja_avatar_d51179ff.png";
import oceanGuardianImg from "@assets/generated_images/Elite_Ocean_Guardian_avatar_0d83ac8b.png";
import skyKnightImg from "@assets/generated_images/Sky_Knight_avatar_11e5e952.png";
import firePhoenixImg from "@assets/generated_images/Fire_Phoenix_avatar_0eb558b2.png";
import crystalMageImg from "@assets/generated_images/Crystal_Mage_avatar_3822ee79.png";
import neonRebelImg from "@assets/generated_images/Neon_Rebel_avatar_fe8fea5f.png";
import cosmicDrifterImg from "@assets/generated_images/Cosmic_Drifter_avatar_1d7d3759.png";
import thunderChampionImg from "@assets/generated_images/Thunder_Champion_avatar_cf3f783f.png";

// Import themed background images
// Modern fresh backgrounds for Tier 1
import modernCitySkylineBg from "@assets/generated_images/Modern_city_skyline_background_a5f841c6.png";
import modernJungleParkBg from "@assets/generated_images/Modern_jungle_park_background_ec08fd63.png";
import modernSpaceStationBg from "@assets/generated_images/Modern_space_station_background_1605b9f8.png";
import modernEcoGardenBg from "@assets/generated_images/Modern_eco_garden_background_86a539ca.png";
import modernRacingTrackBg from "@assets/generated_images/Modern_racing_track_background_850e8bdc.png";
import modernMagicalLibraryBg from "@assets/generated_images/Modern_magical_library_background_514c4635.png";
import modernProfessionalKitchenBg from "@assets/generated_images/Modern_professional_kitchen_background_30a471ed.png";
import modernArtStudioBg from "@assets/generated_images/Modern_art_studio_background_56a4110e.png";

// Tier 2 backgrounds (Epic dramatic scenes)
import eliteTechCityBg from "@assets/generated_images/Elite_tech_city_background_21f1690c.png";
import eliteOceanDepthsBg from "@assets/generated_images/Elite_ocean_depths_background_112ffacd.png";
import skylineBg from "@assets/generated_images/City_skyline_background_cf75a668.png";
import nightSkyBg from "@assets/generated_images/Night_sky_knight_background_b50bd51d.png";
import volcanicBg from "@assets/generated_images/Fire_Phoenix_volcanic_background_f3ebef18.png";
import crystalCaveBg from "@assets/generated_images/Crystal_Mage_cave_background_64b9c911.png";
import neonCityBg from "@assets/generated_images/Neon_Rebel_city_background_29209636.png";
import nebulaBg from "@assets/generated_images/Cosmic_Drifter_nebula_background_cea3dec7.png";
import stormBg from "@assets/generated_images/Thunder_Champion_storm_background_4272fb58.png";

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
  // Tier 1 - Starter Heroes (Modern fresh backgrounds)
  "junior-champion": modernCitySkylineBg,
  "brave-explorer": modernJungleParkBg,
  "star-cadet": modernSpaceStationBg,
  "nature-scout": modernEcoGardenBg,
  "speed-runner": modernRacingTrackBg,
  "book-wizard": modernMagicalLibraryBg,
  "kitchen-hero": modernProfessionalKitchenBg,
  "art-master": modernArtStudioBg,
  
  // Tier 2 - Elite Heroes (Epic dramatic backgrounds)
  "tech-ninja": eliteTechCityBg,
  "ocean-guardian": eliteOceanDepthsBg,
  "sky-knight": nightSkyBg,
  "fire-phoenix": volcanicBg,
  "crystal-mage": crystalCaveBg,
  "neon-rebel": neonCityBg,
  "cosmic-drifter": nebulaBg,
  "thunder-champion": stormBg,
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
