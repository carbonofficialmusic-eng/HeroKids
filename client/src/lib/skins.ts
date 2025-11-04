// Import skin images using @assets alias
import dinosaurImg from "@assets/generated_images/Cute_dinosaur_character_avatar_4f48bda8.png";
import policeImg from "@assets/generated_images/Cute_police_officer_avatar_c145fb6f.png";
import plantsImg from "@assets/generated_images/Cute_plant_character_avatar_36aa366b.png";
import spaceImg from "@assets/generated_images/Cute_space_explorer_avatar_a0b60f1e.png";
import superheroImg from "@assets/generated_images/Cute_superhero_character_avatar_72557276.png";
import chefImg from "@assets/generated_images/Cute_chef_character_avatar_4cecd321.png";

// Skin image mappings
export const SKIN_IMAGES: Record<string, string> = {
  dinosaur: dinosaurImg,
  police: policeImg,
  plants: plantsImg,
  space: spaceImg,
  superhero: superheroImg,
  chef: chefImg,
};

// Helper to get avatar URL - returns skin image if active, otherwise custom avatar
export function getAvatarUrl(activeSkinId: string | null | undefined, customAvatarUrl: string | null | undefined): string | undefined {
  if (activeSkinId && SKIN_IMAGES[activeSkinId]) {
    return SKIN_IMAGES[activeSkinId];
  }
  return customAvatarUrl || undefined;
}
