// Skin image mappings
export const SKIN_IMAGES: Record<string, string> = {
  dinosaur: "/assets/generated_images/Cute_dinosaur_character_avatar_4f48bda8.png",
  police: "/assets/generated_images/Cute_police_officer_avatar_c145fb6f.png",
  plants: "/assets/generated_images/Cute_plant_character_avatar_36aa366b.png",
  space: "/assets/generated_images/Cute_space_explorer_avatar_a0b60f1e.png",
  superhero: "/assets/generated_images/Cute_superhero_character_avatar_72557276.png",
  chef: "/assets/generated_images/Cute_chef_character_avatar_4cecd321.png",
};

// Helper to get avatar URL - returns skin image if active, otherwise custom avatar
export function getAvatarUrl(activeSkinId: string | null | undefined, customAvatarUrl: string | null | undefined): string | undefined {
  if (activeSkinId && SKIN_IMAGES[activeSkinId]) {
    return SKIN_IMAGES[activeSkinId];
  }
  return customAvatarUrl || undefined;
}
