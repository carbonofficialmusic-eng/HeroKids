// Import skin images using @assets alias
import dinosaurImg from "@assets/generated_images/Cute_dinosaur_character_avatar_4f48bda8.png";
import policeImg from "@assets/generated_images/Cute_police_officer_avatar_c145fb6f.png";
import plantsImg from "@assets/generated_images/Cute_plant_character_avatar_36aa366b.png";
import spaceImg from "@assets/generated_images/Cute_space_explorer_avatar_a0b60f1e.png";
import superheroImg from "@assets/generated_images/Cute_superhero_character_avatar_72557276.png";
import chefImg from "@assets/generated_images/Cute_chef_character_avatar_4cecd321.png";

// Import themed background images
import jungleBg from "@assets/generated_images/Jungle_plants_background_3f3fc573.png";
import cityStreetBg from "@assets/generated_images/City_street_background_9c722182.png";
import gardenBg from "@assets/generated_images/Garden_nature_background_b373f3a6.png";
import spaceBg from "@assets/generated_images/Space_galaxy_background_8100facc.png";
import skylineBg from "@assets/generated_images/City_skyline_background_cf75a668.png";
import kitchenBg from "@assets/generated_images/Kitchen_restaurant_background_877f922e.png";

// Skin image mappings
export const SKIN_IMAGES: Record<string, string> = {
  dinosaur: dinosaurImg,
  police: policeImg,
  plants: plantsImg,
  space: spaceImg,
  superhero: superheroImg,
  chef: chefImg,
};

// Themed background mappings
export const SKIN_BACKGROUNDS: Record<string, string> = {
  dinosaur: jungleBg,
  police: cityStreetBg,
  plants: gardenBg,
  space: spaceBg,
  superhero: skylineBg,
  chef: kitchenBg,
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
