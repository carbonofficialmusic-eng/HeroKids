#!/usr/bin/env node
/**
 * Kopiert alle Skin-Bilder in client/public/skins/ mit vorhersagbaren Namen.
 * Danach werden nur noch die freigeschaltenen Skins geladen (on-demand).
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const ASSETS_DIR = path.join(ROOT, 'attached_assets', 'generated_images');
const AVATARS_OUT = path.join(ROOT, 'client', 'public', 'skins', 'avatars');
const BG_OUT = path.join(ROOT, 'client', 'public', 'skins', 'backgrounds');

// Full mapping: skinId -> { avatar: filename, background: filename }
const SKIN_MAP = {
  // Tier 1 - Starter Heroes
  "junior-champion":    { avatar: "Modern_Junior_Champion_avatar_2bc47f6b.png",           bg: "Modern_city_skyline_background_a5f841c6.png" },
  "brave-explorer":     { avatar: "Modern_Brave_Explorer_avatar_5d8a0f47.png",            bg: "Modern_jungle_park_background_ec08fd63.png" },
  "star-cadet":         { avatar: "Modern_Star_Cadet_avatar_03106676.png",                bg: "Modern_space_station_background_1605b9f8.png" },
  "nature-scout":       { avatar: "Modern_Nature_Scout_avatar_9a7998e2.png",              bg: "Modern_eco_garden_background_86a539ca.png" },
  "speed-runner":       { avatar: "Modern_Speed_Runner_avatar_6438bf70.png",              bg: "Modern_racing_track_background_850e8bdc.png" },
  "book-wizard":        { avatar: "Modern_Book_Wizard_avatar_a7765dd5.png",               bg: "Modern_magical_library_background_514c4635.png" },
  "kitchen-hero":       { avatar: "Modern_Kitchen_Hero_avatar_4062600a.png",              bg: "Modern_professional_kitchen_background_30a471ed.png" },
  "art-master":         { avatar: "Modern_Art_Master_avatar_9e59088f.png",                bg: "Modern_art_studio_background_56a4110e.png" },

  // Tier 2 - Elite Heroes
  "tech-ninja":         { avatar: "Friendly_Tech_Ninja_white_bg_ab574699.png",            bg: "Elite_tech_city_background_21f1690c.png" },
  "ocean-guardian":     { avatar: "Friendly_Ocean_Guardian_white_bg_d61b9379.png",        bg: "Elite_ocean_depths_background_112ffacd.png" },
  "sky-knight":         { avatar: "Sky_Knight_avatar_11e5e952.png",                       bg: "Night_sky_knight_background_b50bd51d.png" },
  "fire-phoenix":       { avatar: "Fire_Phoenix_avatar_0eb558b2.png",                     bg: "Fire_Phoenix_volcanic_background_f3ebef18.png" },
  "crystal-mage":       { avatar: "Crystal_Mage_avatar_3822ee79.png",                     bg: "Crystal_Mage_cave_background_64b9c911.png" },
  "neon-rebel":         { avatar: "Neon_Rebel_avatar_fe8fea5f.png",                       bg: "Neon_Rebel_city_background_29209636.png" },
  "cosmic-drifter":     { avatar: "Cosmic_Drifter_avatar_1d7d3759.png",                   bg: "Cosmic_Drifter_nebula_background_cea3dec7.png" },
  "thunder-champion":   { avatar: "Thunder_Champion_avatar_cf3f783f.png",                 bg: "Thunder_Champion_storm_background_4272fb58.png" },

  // Tier 3 - Dinosaur Heroes
  "t-rex":              { avatar: "T-Rex_realistic_portrait_82feaa74.png",                bg: "Cretaceous_volcanic_landscape_80691058.png" },
  "triceratops":        { avatar: "Triceratops_realistic_portrait_028d6c17.png",          bg: "Cretaceous_plains_background_f84649c6.png" },
  "stegosaurus":        { avatar: "Stegosaurus_realistic_portrait_539445d4.png",          bg: "Jurassic_forest_background_dca2add4.png" },
  "velociraptor":       { avatar: "Velociraptor_realistic_feathered_portrait_d3f3b6ad.png", bg: "Cretaceous_scrubland_background_779cd327.png" },
  "brachiosaurus":      { avatar: "Brachiosaurus_realistic_portrait_d0eb144d.png",        bg: "Jurassic_swamp_background_e9a9dd22.png" },
  "spinosaurus":        { avatar: "Spinosaurus_realistic_portrait_2e2df3d4.png",          bg: "Cretaceous_river_delta_background_23c38a31.png" },
  "ankylosaurus":       { avatar: "Ankylosaurus_realistic_portrait_34a4b4bf.png",         bg: "Cretaceous_coastal_plains_background_cb7d4a93.png" },
  "allosaurus":         { avatar: "Allosaurus_realistic_portrait_c0d02199.png",           bg: "Jurassic_canyon_background_c736e0a5.png" },

  // Tier 4 - Magical Princess World
  "princess-tiara":     { avatar: "princess_with_tiara_magical.png",                      bg: "pink_castle_magical_rainbow.png" },
  "purple-princess":    { avatar: "purple_princess_glitter_gown.png",                     bg: "purple_crystal_palace_night.png" },
  "ice-princess":       { avatar: "ice_princess_blue_snowflake.png",                      bg: "ice_castle_winter_wonderland.png" },
  "rainbow-princess":   { avatar: "rainbow_princess_colorful_stars.png",                  bg: "rainbow_castle_colorful_clouds.png" },
  "nature-princess":    { avatar: "nature_princess_green_flowers.png",                    bg: "enchanted_green_forest_magical.png" },
  "sun-princess":       { avatar: "sun_princess_golden_bright.png",                       bg: "golden_palace_sunny_bright.png" },
  "ocean-princess":     { avatar: "ocean_princess_coral_seashells.png",                   bg: "underwater_coral_palace_ocean.png" },
  "fairy-princess":     { avatar: "fairy_princess_lavender_butterflies.png",              bg: "fairy_garden_lavender_magical.png" },

  // Tier 5 - Space Explorers
  "astronaut-kid":      { avatar: "astronaut_kid_white_spacesuit.png",                    bg: "space_station_command_center.png" },
  "space-cadet-blue":   { avatar: "blue_space_cadet_uniform.png",                         bg: "alien_planet_colorful_landscape.png" },
  "green-alien":        { avatar: "green_alien_orange_spacesuit.png",                     bg: "rocket_launch_pad_countdown.png" },
  "rocket-pilot":       { avatar: "rocket_pilot_red_yellow.png",                          bg: "moon_base_lunar_station.png" },
  "moon-walker":        { avatar: "moon_walker_gray_lunar.png",                           bg: "purple_pink_nebula_cosmic.png" },
  "galaxy-scout":       { avatar: "galaxy_scout_purple_cosmic.png",                       bg: "space_academy_blue_training.png" },
  "robot-astronaut":    { avatar: "robot_astronaut_metallic_friendly.png",                bg: "asteroid_field_mining_station.png" },
  "star-captain":       { avatar: "star_captain_gold_uniform.png",                        bg: "starship_bridge_gold_command.png" },

  // Tier 6 - Cute Animals
  "cat-girl":           { avatar: "cat_girl_pink_hoodie.png",                             bg: "sunny_meadow_wildflowers_butterflies.png" },
  "bunny-girl":         { avatar: "bunny_girl_lavender_dress.png",                        bg: "enchanted_forest_magical_purple.png" },
  "fox-girl":           { avatar: "fox_girl_orange_outfit.png",                           bg: "autumn_woodland_orange_leaves.png" },
  "puppy-girl":         { avatar: "puppy_girl_brown_hoodie.png",                          bg: "flower_garden_colorful_blooms.png" },
  "panda-girl":         { avatar: "panda_girl_black_white.png",                           bg: "bamboo_forest_peaceful_panda.png" },
  "deer-girl":          { avatar: "deer_girl_brown_antlers.png",                          bg: "woodland_clearing_deer_sunbeams.png" },
  "raccoon-girl":       { avatar: "raccoon_girl_gray_hoodie.png",                         bg: "hollow_tree_house_cozy.png" },
  "squirrel-girl":      { avatar: "squirrel_girl_orange_acorn.png",                       bg: "oak_tree_park_squirrel.png" },

  // Tier 7 - Vampire Adventure
  "classic-vampire":    { avatar: "classic_vampire_boy_white_bg.png",                     bg: "3d_vampire_castle_background.png" },
  "bat-boy":            { avatar: "bat_boy_vampire_white_bg.png",                         bg: "3d_whimsical_gothic_graveyard.png" },
  "moonlight-vampire":  { avatar: "moonlight_vampire_white_bg.png",                       bg: "3d_moonlit_enchanted_forest.png" },
  "gothic-vampire":     { avatar: "gothic_vampire_white_bg.png",                          bg: "3d_gothic_cathedral_interior.png" },
  "shadow-vampire":     { avatar: "shadow_vampire_white_bg.png",                          bg: "3d_shadowy_crystal_crypt.png" },
  "night-hunter":       { avatar: "night_hunter_vampire_white_bg.png",                   bg: "3d_vampire_mansion_interior.png" },
  "blood-moon-vampire": { avatar: "blood_moon_vampire_white_bg.png",                      bg: "3d_blood_moon_night_sky.png" },
  "vampire-prince":     { avatar: "vampire_prince_white_bg.png",                          bg: "3d_vampire_throne_room.png" },

  // Tier 8 - Ballerina Dreams
  "ballerina-pink":     { avatar: "ballerina_pink_tutu_classic.png",                      bg: "ballet_stage_red_curtains.png" },
  "swan-ballerina":     { avatar: "swan_ballerina_white_feathers.png",                    bg: "swan_lake_sunset_castle.png" },
  "purple-ballerina":   { avatar: "purple_ballerina_flower_crown.png",                    bg: "ballet_studio_mirrors_barre.png" },
  "blue-ballerina":     { avatar: "blue_ballerina_ocean_waves.png",                       bg: "underwater_ballet_coral_ocean.png" },
  "golden-ballerina":   { avatar: "golden_ballerina_star_sequins.png",                    bg: "sunflower_field_golden_bright.png" },
  "peach-ballerina":    { avatar: "peach_ballerina_rose_details.png",                     bg: "rose_garden_romantic_trellis.png" },
  "mint-ballerina":     { avatar: "mint_ballerina_leaf_patterns.png",                     bg: "spring_meadow_green_fresh.png" },
  "rainbow-ballerina":  { avatar: "rainbow_ballerina_colorful_layers.png",                bg: "rainbow_sky_magical_clouds.png" },

  // Tier 9 - Superhero Squad
  "classic-superhero":  { avatar: "classic_superhero_red_blue.png",                       bg: "city_skyline_hero_signal.png" },
  "lightning-speedster":{ avatar: "lightning_speedster_yellow_suit.png",                  bg: "lightning_storm_electric_sky.png" },
  "tech-hero":          { avatar: "tech_hero_purple_armor.png",                           bg: "tech_lab_purple_holograms.png" },
  "nature-guardian":    { avatar: "nature_guardian_green_eco.png",                        bg: "forest_clearing_nature_magic.png" },
  "ice-hero":           { avatar: "ice_hero_blue_frost.png",                              bg: "arctic_ice_northern_lights.png" },
  "fire-hero":          { avatar: "fire_hero_orange_flames.png",                          bg: "volcanic_crater_lava_glowing.png" },
  "shadow-ninja":       { avatar: "shadow_ninja_black_purple.png",                        bg: "shadow_dojo_ninja_training.png" },
  "shield-hero":        { avatar: "shield_hero_gold_energy.png",                          bg: "hero_fortress_gold_shields.png" },

  // Tier 10 - Mecha Robots
  "titan-mech":         { avatar: "titan_mech_robot_avatar.png",                          bg: "titan_mech_hangar_background.png" },
  "cyber-warrior":      { avatar: "cyber_warrior_robot_avatar.png",                       bg: "cyber_warrior_city_background.png" },
  "iron-guardian":      { avatar: "iron_guardian_robot_avatar.png",                       bg: "iron_guardian_fortress_background.png" },
  "plasma-bot":         { avatar: "plasma_bot_robot_avatar.png",                          bg: "plasma_bot_lab_background.png" },
  "steel-samurai":      { avatar: "steel_samurai_robot_avatar.png",                       bg: "steel_samurai_castle_background.png" },
  "thunder-mech":       { avatar: "thunder_mech_robot_avatar.png",                        bg: "thunder_mech_storm_background.png" },
  "neon-droid":         { avatar: "neon_droid_robot_avatar.png",                          bg: "neon_droid_digital_background.png" },
  "battle-commander":   { avatar: "battle_commander_robot_avatar.png",                    bg: "battle_commander_center_background.png" },

  // Tier 11 - Manga Heroes
  "ninja-shadow":       { avatar: "ninja_shadow_manga_avatar.png",                        bg: "ninja_shadow_village_background.png" },
  "spirit-fox":         { avatar: "spirit_fox_manga_avatar.png",                          bg: "spirit_fox_shrine_background.png" },
  "dragon-slayer":      { avatar: "dragon_slayer_manga_avatar.png",                       bg: "dragon_slayer_lair_background.png" },
  "magical-girl":       { avatar: "magical_girl_manga_avatar.png",                        bg: "magical_girl_sky_background.png" },
  "samurai-hero":       { avatar: "samurai_hero_manga_avatar.png",                        bg: "samurai_hero_battlefield_background.png" },
  "elemental-master":   { avatar: "elemental_master_manga_avatar.png",                    bg: "elemental_master_chamber_background.png" },
  "cat-fighter":        { avatar: "cat_fighter_manga_avatar.png",                         bg: "cat_fighter_rooftop_scene.png" },
  "school-hero":        { avatar: "school_hero_manga_avatar.png",                         bg: "anime_school_rooftop_sunset.png" },

  // Tier 12 - Gaming Legends
  "pro-gamer":          { avatar: "pro_gamer_esports_avatar.png",                         bg: "pro_gamer_arena_background.png" },
  "pixel-warrior":      { avatar: "pixel_warrior_retro_avatar.png",                       bg: "pixel_art_fantasy_landscape_background.png" },
  "controller-king":    { avatar: "controller_king_gamer_avatar.png",                     bg: "controller_king_throne_background.png" },
  "vr-champion":        { avatar: "vr_champion_gaming_avatar.png",                        bg: "vr_champion_cyberspace_background.png" },
  "stream-star":        { avatar: "stream_star_creator_avatar.png",                       bg: "stream_star_studio_background.png" },
  "arcade-master":      { avatar: "arcade_master_retro_avatar.png",                       bg: "arcade_master_retro_background.png" },
  "console-hero":       { avatar: "console_hero_gamer_avatar.png",                        bg: "console_hero_setup_background.png" },
  "level-boss":         { avatar: "level_boss_gaming_avatar.png",                         bg: "level_boss_throne_background.png" },

  // Tier 13 - Pterosaur Sky
  "pteranodon":         { avatar: "pteranodon_white_bg.png",                              bg: "pteranodon_ocean_sunset_scene.png" },
  "quetzalcoatlus":     { avatar: "quetzalcoatlus_white_bg.png",                          bg: "quetzalcoatlus_canyon_landscape.png" },
  "rhamphorhynchus":    { avatar: "rhamphorhynchus_white_bg.png",                         bg: "rhamphorhynchus_lagoon_twilight.png" },
  "pterodactylus":      { avatar: "pterodactylus_white_bg.png",                           bg: "pterodactylus_forest_canopy.png" },
  "dimorphodon":        { avatar: "dimorphodon_white_bg.png",                             bg: "dimorphodon_jungle_cliff.png" },
  "tapejara":           { avatar: "tapejara_white_bg.png",                                bg: "tapejara_tropical_coast.png" },
  "anhanguera":         { avatar: "anhanguera_white_bg.png",                              bg: "anhanguera_ocean_hunting.png" },
  "dsungaripterus":     { avatar: "dsungaripterus_white_bg.png",                          bg: "dsungaripterus_rocky_shore.png" },
  "nemicolopterus":     { avatar: "nemicolopterus_white_bg.png",                          bg: "nemicolopterus_forest_canopy_scene.png" },

  // Tier 14 - HeroKids Legacy
  "shield-blaze":       { avatar: "shield_blaze_boy_hero_avatar.png",                    bg: "shield_blaze_city_protection_background.png" },
  "comet-dash":         { avatar: "comet_dash_boy_hero_avatar.png",                       bg: "comet_dash_sky_bridge_background.png" },
  "wave-glider":        { avatar: "wave_glider_boy_hero_avatar.png",                      bg: "wave_glider_ocean_bay_background.png" },
  "forest-guard":       { avatar: "forest_guard_boy_hero_avatar.png",                    bg: "forest_guard_nature_clearing_background.png" },
  "luna-beacon":        { avatar: "luna_beacon_girl_hero_avatar.png",                     bg: "luna_beacon_moonlit_rooftop_background.png" },
  "sunrise-spark":      { avatar: "sunrise_spark_girl_hero_avatar.png",                  bg: "sunrise_spark_hilltop_dawn_background.png" },
  "bloom-guardian":     { avatar: "bloom_guardian_girl_hero_avatar.png",                 bg: "bloom_guardian_flower_garden_background.png" },
  "breeze-captain":     { avatar: "breeze_captain_girl_hero_avatar.png",                 bg: "breeze_captain_cloud_deck_background.png" },
  "storm-runner":       { avatar: "storm_runner_mint_coral_avatar.png",                  bg: "storm_runner_cel-shaded_coastal_highway.png" },
  "star-guardian":      { avatar: "star_guardian_mint_coral_avatar.png",                 bg: "star_guardian_cel-shaded_observatory.png" },
  "thunder-bolt":       { avatar: "thunder_bolt_mint_coral_avatar.png",                  bg: "thunder_bolt_cel-shaded_storm_city.png" },
  "heart-shield":       { avatar: "heart_shield_mint_coral_avatar.png",                  bg: "heart_shield_cel-shaded_plaza.png" },

  // Tier 15 - Bonus Adventure Pack
  "pirate-captain":     { avatar: "pirate_captain_kid_avatar.png",                        bg: "pirate_ship_deck_background.png" },
  "wizard-kid":         { avatar: "wizard_kid_avatar.png",                                bg: "wizard_tower_magical_background.png" },
  "rock-star":          { avatar: "rock_star_kid_avatar.png",                             bg: "rock_concert_stage_background.png" },
  "detective-kid":      { avatar: "detective_kid_avatar.png",                             bg: "detective_mystery_office_background.png" },
  "skater-kid":         { avatar: "skater_kid_adventure_avatar.png",                      bg: "skater_kid_skatepark_scene.png" },
};

let copied = 0;
let missing = 0;

for (const [skinId, files] of Object.entries(SKIN_MAP)) {
  // Avatar
  const avatarSrc = path.join(ASSETS_DIR, files.avatar);
  const avatarDst = path.join(AVATARS_OUT, `${skinId}.png`);
  if (fs.existsSync(avatarSrc)) {
    fs.copyFileSync(avatarSrc, avatarDst);
    copied++;
  } else {
    console.warn(`MISSING avatar: ${files.avatar}`);
    missing++;
  }

  // Background
  const bgSrc = path.join(ASSETS_DIR, files.bg);
  const bgDst = path.join(BG_OUT, `${skinId}.png`);
  if (fs.existsSync(bgSrc)) {
    fs.copyFileSync(bgSrc, bgDst);
    copied++;
  } else {
    console.warn(`MISSING background: ${files.bg}`);
    missing++;
  }
}

console.log(`Done. Copied: ${copied}, Missing: ${missing}`);
console.log(`Avatars: ${fs.readdirSync(AVATARS_OUT).length} files`);
console.log(`Backgrounds: ${fs.readdirSync(BG_OUT).length} files`);
